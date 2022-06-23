/**
 * Displays installed Titanium SDKs and installs new SDKs.
 *
 * @copyright
 * Copyright TiDev, Inc. 04/07/2022-Present
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const fs = require('fs-extra');
const got = require('got');
const path = require('path');
const fields = require('fields'); // TODO: Move to the couple locations it's used, on-demand?
const appc = require('node-appc');
const tmp = require('tmp');
const yauzl = require('yauzl');
const afs = appc.fs;

const callbackify = require('util').callbackify;

/** SDK command title. */
exports.title = 'SDK';

/** SDK command description. */
exports.desc = 'manages installed Titanium SDKs';

/** @namespace SdkSubcommands */
const SdkSubcommands = {};

const versionRegExp = /^(\d+)\.(\d+)\.(\d+)(?:\.\w+)?$/i;
const sortTypes = [ 'beta', 'rc', 'ga' ];
const releaseTypeMap = {
	latest: 'ga',
	stable: 'ga',
	rc: 'rc',
	beta: 'beta'
};

/**
 * Returns the configuration for the SDK command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} SDK command configuration
 */
exports.config = function config(logger, config, cli) {
	const subcommands = {};
	for (const s of Object.keys(SdkSubcommands)) {
		subcommands[s] = SdkSubcommands[s].conf(logger, config, cli);
	}
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands
	};
};

/**
 * Displays all installed Titanium SDKs or installs a new SDK.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function run(logger, config, cli, finished) {
	const action = cli.argv._.shift() || 'list';
	if (action !== 'list') {
		logger.banner();
	}

	if (SdkSubcommands[action]) {
		SdkSubcommands[action].fn.call(SdkSubcommands[action].fn, logger, config, cli, (error, result) => {
			if (error && error instanceof CLIError) {
				logger.error(error.message);
				if (error.detail) {
					logger.log();
					logger.log(error.detail);
				}
			} else if (error && error instanceof Error) {
				logger.error(error);
			}
			finished(error, result);
		});
	} else {
		logger.error(`Invalid subcommand "${action}"\n`);
		appc.string.suggest(action, Object.keys(SdkSubcommands), logger.log);
		logger.log('Available subcommands:');
		for (const cmd of Object.keys(SdkSubcommands)) {
			logger.log('    ' + cmd.cyan);
		}
		logger.log();
		finished();
	}
};

/**
 * Displays a list of all installed Titanium SDKs.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubcommands.list = {
	conf: function (_logger, _config, _cli) {
		return {
			desc: 'print a list of installed SDK versions',
			flags: {
				branches: {
					abbr: 'b',
					desc: 'retrieve and print all branches'
				},
				releases: {
					abbr: 'r',
					desc: 'retrieve and print all releases'
				}
			},
			options: {
				branch: {
					desc: 'branch to fetch CI builds'
				},
				output: {
					abbr: 'o',
					default: 'report',
					desc: 'output format',
					values: [ 'report', 'json' ]
				}
			}
		};
	},
	fn: callbackify(list)
};

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
async function list(logger, config, cli) {
	const os = cli.env.os.name;

	const [ releases, branches, branchBuilds ] = (await Promise.allSettled([
		cli.argv.releases && getReleases(os),
		cli.argv.branches && getBranches(),
		cli.argv.branch && getBranchBuilds(cli.argv.branch, os)
	])).map(r => {
		return r.status === 'fulfilled' ? r.value : new CLIError(r.reason);
	});

	const { sdks } = cli.env;
	const vers = appc.version.sort(Object.keys(sdks)).reverse();

	let activeSDK = config.get('sdk.selected', config.get('app.sdk'));
	if ((!activeSDK || activeSDK === 'latest') && vers.length) {
		activeSDK = vers[0];
	}

	const defaultInstallLocation = cli.env.installPath;
	const locations = Array.from(
		new Set([
			cli.env.os.sdkPaths,
			defaultInstallLocation,
			config.get('paths.sdks')
		].flat().map(p => p && afs.resolvePath(p)).filter(Boolean))
	).sort();

	if (cli.argv.output === 'json') {
		for (const ver of vers) {
			delete sdks[ver].commands;
			delete sdks[ver].packageJson;
			delete sdks[ver].platforms;
		}

		const obj = {
			activeSDK,
			branch: branchBuilds.length ? {
				[cli.argv.branch]: branchBuilds
			} : {},
			branches,
			defaultInstallLocation,
			installLocations: locations,
			installed: vers.reduce((obj, v) => {
				obj[v] = sdks[v].path;
				return obj;
			}, {}),
			releases,
			sdks
		};

		logger.log(JSON.stringify(obj, null, '\t'));
		return;
	}

	logger.banner();
	logger.log('SDK Install Locations:');
	for (const p of locations) {
		logger.log(`   ${p.cyan}${p === defaultInstallLocation ? ' [default]'.gray : ''}`);
	}
	logger.log();

	let activeValid = false;

	if (vers.length) {
		const activeLabel = ' [selected]';
		const maxlen = vers.reduce((len, b) => {
			return Math.max(len, b.length + (b === activeSDK ? activeLabel.length : 0));
		}, 0);
		const maxname = vers.reduce((len, b) => {
			return Math.max(len, sdks[b].manifest && sdks[b].manifest.name ? sdks[b].manifest.name.length : 0);
		}, 0);

		logger.log('Installed SDKs:');
		for (const v of vers) {
			const d = v === activeSDK ? activeLabel : '';
			const n = maxlen + 2 - v.length - d.length;
			let name = sdks[v].manifest && (sdks[v].manifest.name || sdks[v].manifest.version);

			if (!name) {
				try {
					name = appc.version.format(v, 3, 3);
				} catch (ex) {
					// ignore
				}
			}

			activeValid = activeValid || v === activeSDK;
			logger.log(`   ${v.cyan}${d.grey}${' '.repeat(n)}${maxname ? appc.string.rpad(name ? name : '', maxname + 2).magenta : ''}${sdks[v].path}`);
		}
		logger.log();
	} else {
		logger.log('No Titanium SDKs are installed\n');
		logger.log(`You can download the latest Titanium SDK by running: ${(cli.argv.$ + ' sdk install').cyan}\n`);
	}

	const humanize = require('humanize');

	if (releases) {
		logger.log('Releases:');
		if (releases instanceof Error) {
			logger.log(`   ${releases.message.red}`);
		} else if (!releases.length) {
			logger.log('   No releases found');
		} else {
			let i = 0;
			for (const r of releases) {
				logger.log(`   ${r.name.padEnd(12).cyan}\
${Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(new Date(r.date)).padStart(8)}\
${humanize.filesize(r.assets.find(a => a.os === os).size, 1024, 1).toUpperCase().padStart(11)}\
${Object.prototype.hasOwnProperty.call(sdks, r) ? ' [installed]' : ''}\
${r.type !== 'ga' ? '  [unstable]'.grey : i++ === 0 ? '  [latest stable]'.green : ''}`);
			}
		}
		logger.log();
	}

	if (branches) {
		logger.log('Branches:');
		if (branches instanceof Error) {
			logger.log(`   ${branches.message.red}`);
		} else {
			for (const b of branches) {
				logger.log(`   ${b.cyan}${b === 'master' ? ' [default]'.grey : ''}`);
			}
		}
		logger.log();
	}

	if (cli.argv.branch) {
		if (branchBuilds instanceof Error) {
			logger.error(`Invalid branch "${cli.argv.branch}"\n`);
			logger.log(`Run '${`${cli.argv.$} sdk --branches`.cyan}' for a list of available branches.\n`);
		} else {
			logger.log(`'${cli.argv.branch}' Branch Builds:`);
			if (branchBuilds.length) {
				for (const b of branchBuilds) {
					const dt = Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(new Date(b.date));
					logger.log(`   ${b.name.cyan}\
${dt.padStart(11)}\
${humanize.filesize(b.assets.find(a => a.os === os).size, 1024, 1).toUpperCase().padStart(11)}`);
				}
				logger.log('** NOTE: these builds not recommended for production use **'.grey);
			} else {
				logger.log('   No builds found');
			}
			logger.log();
		}
	}

	if (vers.length && !activeValid) {
		logger.error(`Selected Titanium SDK '${activeSDK}' not found\n`);
		logger.log(`Run '${`${cli.argv.$} sdk select <sdk-version>`.cyan}' to set the selected Titanium SDK.\n`);
	}
}

/**
 * Selects the specified Titanium SDK as the selected SDK.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubcommands.select = {
	conf: function (_logger, config, _cli) {
		return {
			desc: 'used to select which installed Titanium SDK is the selected SDK',
			args: [
				{
					desc: 'the version to select',
					name: 'version',
					required: !config.get('cli.prompt')
				}
			]
		};
	},
	fn: callbackify(select)
};

function sortVersion(a, b) {
	const [ , amajor, aminor, apatch, atag ] = a.toLowerCase().match(versionRegExp);
	const [ , bmajor, bminor, bpatch, btag ] = b.toLowerCase().match(versionRegExp);

	let n = parseInt(bmajor) - parseInt(amajor);
	if (n !== 0) {
		return n;
	}

	n = parseInt(bminor) - parseInt(aminor);
	if (n !== 0) {
		return n;
	}

	n = parseInt(bpatch) - parseInt(apatch);
	if (n !== 0) {
		return n;
	}

	if (atag && btag) {
		return sortTypes.indexOf(btag) - sortTypes.indexOf(atag);
	}

	return atag ? -1 : btag ? 1 : 0;
}

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
async function select(logger, config, cli) {
	// we only care about SDKs that are 3.0 or newer
	// also we sort before filter so that the invalid SDKs print in some order
	const vers = Object.keys(cli.env.sdks)
		.filter(v => {
			const s = cli.env.sdks[v];
			const name = s.manifest && s.manifest.version || s.name;
			return appc.version.gte(name, '3.2.0');
		})
		.sort(sortVersion);

	// check we even have any (valid) SDKs installed
	if (!vers.length) {
		const error = 'No suitable Titanium SDKs installed';
		// TODO: provide a command to install latest GA?
		logger.error(error + '\n');
		throw new CLIError(error); // NOTE: this used to log this normally and treat as "success"
	}

	// if they specified 'latest' or 'stable', then determine the latest/stable version
	let selectedSDK = cli.argv.version?.toLowerCase();
	if (selectedSDK in releaseTypeMap) {
		selectedSDK = vers.find(v => {
			const m = v.toLowerCase().match(versionRegExp);
			return m && m[4] === releaseTypeMap[selectedSDK];
		});
	}

	// we have a version, see if it's valid
	const selected = selectedSDK && vers.find(ver => ver.toLowerCase() === selectedSDK);
	if (selected) {
		// need to force the config to reload
		config.load();
		config.set('sdk.selected', selected);
		config.save();
		logger.log('Configuration saved\n');
		return;
	}

	const noPrompt = !cli.argv.prompt;
	if (selectedSDK) {
		const error = `Invalid Titanium SDK "${cli.argv.version}"`;
		logger.error(error + '\n');
		appc.string.suggest(selectedSDK, vers, logger.log.bind(logger));
		// if prompting is disabled, then we're done
		if (noPrompt) {
			throw new CLIError(error);
		}
	} else if (noPrompt) {
		// no version supplied, no prompting, show error and exit
		const error = 'No SDK version specified';
		logger.error(error + '\n');
		logger.log(`Usage: ${`${cli.argv.$} sdk select <version>`.cyan}\n`);
		throw new CLIError(error);
	}

	// get the current SDK
	let activeSDK = config.get('sdk.selected', config.get('app.sdk', 'latest'));

	// prompt for the sdk version to select
	if (activeSDK === 'latest') {
		activeSDK = vers.find(v => {
			const m = v.toLowerCase().match(versionRegExp);
			return m && m[4] === releaseTypeMap[activeSDK];
		});
	}

	const activeLabel = ' [selected]';
	const maxlen = vers.reduce(function (a, b) {
		return Math.max(a, b.length + (b === activeSDK ? activeLabel.length : 0));
	}, 0);

	return new Promise(resolve => {
		fields.select({
			default: cli.env.sdks[activeSDK] ? activeSDK : undefined,
			promptLabel: 'Titanium SDK version to select',
			complete: true,
			completeIgnoreCase: true,
			numbered: true,
			margin: '',
			options: {
				'Installed SDKs:': vers.map(function (v) {
					return {
						path: cli.env.sdks[v].path,
						value: v
					};
				})
			},
			formatters: {
				option: function (opt, idx, num) {
					var d = opt.value === activeSDK ? activeLabel : '',
						n = maxlen + 2 - opt.value.length - d.length;
					return '  ' + num + opt.value.cyan + d.grey + new Array(n + 1).join(' ') + opt.path;
				}
			},
			validate: function (value) {
				if (!cli.env.sdks[value]) {
					logger.error(`Invalid Titanium SDK "${value}"`);
					return false;
				}
				return true;
			}
		}).prompt(function (err, value) {
			if (err && err.message === 'cancelled') {
				logger.log('\n');
				return resolve();
			}

			// need to force the config to reload
			config.load();
			config.set('sdk.selected', value);
			config.save();

			logger.log('\nConfiguration saved\n');
			resolve();
		});
	});
}

/**
 * Installs the specified Titanium SDK.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubcommands.install = {
	conf(_logger, _config, _cli) {
		return {
			// command examples:
			// ti sdk install
			// ti sdk install --default
			// ti sdk install latest
			// ti sdk install latest-rc
			// ti sdk install latest-beta
			// ti sdk install something.zip
			// ti sdk install something.zip --default
			// ti sdk install http://builds.appcelerator.com/mobile/master/mobilesdk-3.2.0.v20130612114042-osx.zip
			// ti sdk install 3.1.0.GA
			// ti sdk install 3.1.0.GA --default
			// ti sdk install master:11.1.0.v20220614174006
			desc: 'download the latest Titanium SDK or a specific version',
			args: [
				{
					desc: 'the version to install, "latest", URL, zip file, or <branch>:<build_name>',
					name: 'version',
					required: true
				}
			],
			flags: {
				default: {
					abbr: 'd',
					desc: 'set as default SDK'
				},
				force: {
					abbr: 'f',
					desc: 'force re-install'
				},
				'keep-files': {
					abbr: 'k',
					desc: 'keep downloaded files after install'
				}
			},
			options: {
				branch: {
					abbr: 'b',
					desc: 'the branch to install from or "latest" (stable)',
					hint: 'branch name'
				}
			}
		};
	},
	fn: callbackify(install)
};

/**
 * A regex to test if a string is a URL or path to a zip file.
 * @type {RegExp}
 */
const uriRegExp = /^(https?:\/\/.+)|(?:file:\/\/(.+))$/;

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
async function install(logger, config, cli) {
	const titaniumDir  = afs.resolvePath(cli.env.installPath);
	const osName       = cli.env.os.name;
	const branch       = cli.argv.branch;
	let force          = cli.argv.force;
	const keepFiles    = cli.argv['keep-files'];
	const noPrompt     = !cli.argv.prompt;
	const setDefault   = cli.argv.default || !Object.keys(cli.env.sdks).length;
	const subject      = cli.argv.version;
	const showProgress = !cli.argv.quiet && !!cli.argv['progress-bars'];
	let uri            = (subject || 'latest').trim().toLowerCase();
	const uriMatch     = subject?.match(uriRegExp);
	let downloadedFile = null;
	let file           = null;
	let url            = null;
	const releases     = await getReleases(osName);

	// step 0: make sure the install location exists

	await ensureInstallLocation(titaniumDir);

	// step 1: determine what the uri is

	if (uriMatch && uriMatch[2]) {
		file = uriMatch[2];
	} else if (subject && fs.existsSync(subject)) {
		file = subject;
	}

	if (file) {
		file = afs.resolvePath(file);

		if (!fs.existsSync(file)) {
			throw new CLIError('Specified file does not exist');
		}

		if (!/\.zip$/.test(file)) {
			throw new CLIError('Specified file is not a zip file');
		}
	} else {
		// we are downloading an sdk

		if (uriMatch && uriMatch[1]) {
			// we have a http url
			url = uriMatch[1];
		} else if (branch) {
			// we have a ci build
			const branches = await getBranches();
			if (!branches.includes(branch)) {
				let str = '';
				appc.string.suggest(branch, branches, s => {
					str += (s || '') + '\n';
				}, 2);
				str += 'Available Branches:\n';
				str += appc.string.renderColumns(branches, '    ', 100).cyan;
				throw new CLIError(`Branch "${branch}" does not exist`, str);
			}

			const builds = await getBranchBuilds(branch, osName);
			const build = uri === 'latest' ? builds[0] : builds.find(b => b.name.toLowerCase() === uri);
			if (!build) {
				throw new CLIError(`CI build ${subject} does not exist`);
			}

			const asset = build.assets.find(a => a.os === osName);
			if (!asset) {
				throw new CLIError(`CI build ${subject} does not support ${osName}`);
			}

			url = asset.url;
		} else {
			// try to find the release by name
			let release = null;

			if (uri === 'latest') {
				release = releases.find(r => r.type === 'ga');
			} else if (uri === 'latest-rc') {
				release = releases.find(r => r.type === 'rc');
			} else if (uri === 'latest-beta') {
				release = releases.find(r => r.type === 'beta');
			} else {
				release = releases.find(r => r.name.toLowerCase() === uri);
				if (!release) {
					const name = `${uri}.ga`;
					release = releases.find(r => r.name.toLowerCase() === name);
				}
			}

			if (release) {
				const asset = release.assets.find(a => a.os === osName);
				if (!asset) {
					throw new CLIError(`SDK release ${subject} does not support ${osName}`);
				}
				url = asset.url;
			}
		}

		if (!url) {
			throw new CLIError(`Unable to find any Titanium SDK releases or CI builds that match "${subject}"`);
		}

		// step 1.5: download the file

		downloadedFile = tmp.tmpNameSync({
			prefix: 'titanium-',
			postfix: '.zip'
		});
		const downloadDir = path.dirname(downloadedFile);
		await fs.mkdirp(downloadDir);

		file = await new Promise((resolve, reject) => {
			let bar;
			let busy;
			let last = 0;
			let total = 0;

			logger.log(`Downloading ${url.cyan}`);

			const stream = got.stream(url, { retry: 0 })
				.on('downloadProgress', ({ transferred }) => {
					if (bar) {
						bar?.tick(transferred - last);
						last = transferred;
					}
				})
				.on('error', err => {
					if (bar) {
						bar.tick(total);
						logger.log('\n');
					}
					reject(err);
				})
				.on('response', response => {
					const { headers } = response;
					const cd = headers['content-disposition'];
					let m = cd && cd.match(/filename[^;=\n]*=['"]*(.*?\2|[^'";\n]*)/);
					let filename = m && m[1];

					// try to determine the file extension by the filename in the url
					if (!filename && (m = url.match(/.*\/(.+\.zip)$/))) {
						filename = m[1];
					}

					total = parseInt(headers['content-length']);
					if (showProgress) {
						if (total) {
							bar = new appc.progress('  :paddedPercent [:bar]', {
								complete: '='.cyan,
								incomplete: '.'.grey,
								width: 40,
								total
							});
						} else {
							busy = new appc.busyindicator();
							busy.start();
						}
					}

					const out = fs.createWriteStream(downloadedFile);
					out.on('error', err => {
						if (bar) {
							bar.tick(total);
						}
						reject(err);
					});
					out.on('close', () => {
						if (bar) {
							bar.tick(total);
						} else if (busy) {
							busy.stop();
							logger.log();
						}

						let file = downloadedFile;
						if (filename) {
							file = path.join(downloadDir, filename);
							fs.moveSync(downloadedFile, file, { overwrite: true });
						}

						setTimeout(() => {
							if (bar) {
								logger.log('\n');
							}
							resolve(file);
						}, 250);
					});
					stream.pipe(out);
				});
		});
	}

	// step 2: extract the sdk zip file

	// eslint-disable-next-line security/detect-non-literal-regexp
	const sdkDestRegExp = new RegExp(`^mobilesdk[/\\\\]${osName}[/\\\\]([^/\\\\]+)`);
	let tempDir = tmp.tmpNameSync({ prefix: 'titanium-' });
	let tempArtifactDir = tmp.tmpNameSync({ prefix: 'titanium-' });
	let name;
	let src;

	try {
		let bar;

		const zipFile = await extractArtifactZip({
			dest: tempArtifactDir,
			file,
			logger
		});

		await extractZip({
			dest: tempDir,
			file: zipFile,
			logger,
			async onEntry(filename, idx, total) {
				// do a quick check to make sure the destination doesn't exist
				const m = !name && filename.match(sdkDestRegExp);
				if (m) {
					name = m[1];

					const sdkDir = path.join(titaniumDir, 'mobilesdk', osName, name);
					if (!force && isDir(sdkDir)) {
						// already installed
						const latest = releases.find(r => r.type === 'ga');
						const tip = `Run '${`${cli.argv.$} sdk install ${latest.name} --force`.cyan}' to re-install`;
						if (noPrompt) {
							if (subject === 'latest' && name === latest.name) {
								throw new CLIError(
									`Titanium SDK ${name} is already installed`,
									`You're up-to-date. Version ${latest.name.cyan} is currently the newest version available.\n${tip}`
								);
							}
							throw new CLIError(`Titanium SDK ${name} is already installed`, tip);
						}

						await new Promise(resolve => {
							logger.log();
							logger.log(`Titanium SDK ${name} is already installed!`.yellow);
							fields.select({
								promptLabel: 'Overwrite?',
								display: 'prompt',
								default: 'yes',
								options: [ 'yes', 'no' ]
							}).prompt(function (err, value) {
								force = !err && value !== 'no';
								logger.log();
								if (!force) {
									logger.log(`\n${tip}`);
									process.exit();
								}
								resolve();
							});
						});
					}

					if (showProgress) {
						if (!bar) {
							bar = new appc.progress('  :paddedPercent [:bar]', {
								complete: '='.cyan,
								incomplete: '.'.grey,
								width: 40,
								total
							});
						}
					}
				}

				bar?.tick();
			}
		});
		logger.log('\n');

		// validate the manifest.json
		if (name) {
			src = path.join(tempDir, 'mobilesdk', osName, name);
			try {
				await fs.readJson(path.join(src, 'manifest.json'));
			} catch (e) {
				name = null;
			}
		}

		if (!name) {
			throw new CLIError('Zip file does not contain a valid Titanium SDK');
		}

		// step 3: move the sdk files to the dest

		const dest = path.join(titaniumDir, 'mobilesdk', osName, name);
		logger.log(`Installing SDK files to ${dest.cyan}`);
		await fs.mkdirs(dest);
		await fs.move(src, dest, { overwrite: true });

		// install the modules

		const modules = [];
		src = path.join(tempDir, 'modules');
		if (isDir(src)) {
			const modulesDest = path.join(titaniumDir, 'modules');

			for (const platform of fs.readdirSync(src)) {
				const srcPlatformDir = path.join(src, platform);
				if (!isDir(srcPlatformDir)) {
					continue;
				}

				for (const moduleName of fs.readdirSync(srcPlatformDir)) {
					const srcModuleDir = path.join(srcPlatformDir, moduleName);
					if (!isDir(srcModuleDir)) {
						continue;
					}

					for (const ver of fs.readdirSync(srcModuleDir)) {
						const srcVersionDir = path.join(srcModuleDir, ver);
						if (!isDir(srcVersionDir)) {
							continue;
						}

						const destDir = path.join(modulesDest, platform, moduleName, ver);
						if (!force && isDir(destDir)) {
							continue;
						}

						modules.push({ src: srcVersionDir, dest: destDir });
					}
				}
			}
		}

		const numModules = modules.length;
		if (numModules) {
			for (const { src, dest } of modules) {
				await fs.move(src, dest, { overwrite: true });
			}
		}
	} finally {
		if (downloadedFile && !keepFiles) {
			await fs.remove(downloadedFile);
		}
		await fs.remove(tempDir);
		await fs.remove(tempArtifactDir);
	}

	if (setDefault) {
		logger.log(`Setting Titanium SDK ${name.cyan} as the default`);
		config.load();
		config.set('sdk.selected', name);
		config.save();
	}

	logger.log(`Titanium SDK ${name.cyan} successfully installed`);
}

/**
 * Validates the zip that has been requested to be installed. This is because when downloading a
 * GitHub artifact the actual SDK zip will be placed inside a zip which will cause the extract to
 * fail. If this zip is a GitHub artifact then it will be unzipped and the resulting zip will be
 * returned.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.dest - The path to extract the artifact to.
 * @param {String} params.file - The zip file to extract the artifact from.
 * @param {Object} params.logger - The logger instance.
 * @returns {String} - The correct path to install.
 */
async function extractArtifactZip(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	let { dest, file, logger } = params;

	if (!dest || typeof dest !== 'string') {
		throw new TypeError('Expected destination directory to be a non-empty string');
	}

	if (!file || typeof file !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!fs.existsSync(file)) {
		throw new CLIError('The specified zip file does not exist');
	}

	if (!fs.statSync(file).isFile()) {
		throw new CLIError('The specified zip file is not a file');
	}

	return await new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(new CLIError(`Invalid zip file: ${err.message || err}`));
			}

			if (zipfile.entryCount > 1) {
				zipfile.close();
				return resolve(file);
			}

			logger.log('Extracting SDK artifact');

			const abort = err => {
				zipfile.close();
				reject(err);
			};

			zipfile
				.on('entry', entry => {
					const mode = (entry.externalFileAttributes >>> 16) || 0o644;
					const isSymlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
					let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;

					// check for windows weird way of specifying a directory
					// https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
					const madeBy = entry.versionMadeBy >> 8;
					if (!isDir) {
						isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
					}

					if (!entry.fileName.endsWith('.zip') || isSymlink || isDir) {
						return abort(new CLIError('Invalid SDK: does not contain a SDK zip file'));
					}

					const fullPath = path.join(dest, entry.fileName);
					fs.mkdirp(path.dirname(fullPath), () => {
						zipfile.openReadStream(entry, (err, readStream) => {
							if (err) {
								return abort(err);
							}

							const writeStream = fs.createWriteStream(fullPath,  { mode });
							writeStream.on('close', () => {
								zipfile.close();
								resolve(fullPath);
							});
							writeStream.on('error', abort);
							readStream.pipe(writeStream);
						});
					});
				})
				.readEntry();
		});
	});
}

/**
 * Extracts a SDK zip file to the destination.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.dest - The path to extract the SDK to.
 * @param {String} params.file - The zip file to extract.
 * @param {Object} params.logger - The logger instance.
 * @returns {String} - The correct path to install.
 */
async function extractZip(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	let { dest, file, logger } = params;

	if (!dest || typeof dest !== 'string') {
		throw new TypeError('Expected destination directory to be a non-empty string');
	}

	if (!file || typeof file !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!fs.existsSync(file)) {
		throw new CLIError('The specified zip file does not exist');
	}

	if (!fs.statSync(file).isFile()) {
		throw new CLIError('The specified zip file is not a file');
	}

	return await new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(new CLIError(`Invalid zip file: ${err.message || err}`));
			}

			let idx = 0;
			const total = zipfile.entryCount;
			const abort = err => {
				zipfile.removeListener('end', resolve);
				zipfile.close();
				reject(err);
			};

			logger.log('Extracting SDK');

			zipfile
				.on('entry', async entry => {
					idx++;
					if (typeof params.onEntry === 'function') {
						try {
							await params.onEntry(entry.fileName, idx, total);
						} catch (e) {
							return abort(e);
						}
					}

					const fullPath = path.join(dest, entry.fileName);
					const mode = (entry.externalFileAttributes >>> 16) || 0o644;

					const isSymlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
					let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;

					// check for windows weird way of specifying a directory
					// https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
					const madeBy = entry.versionMadeBy >> 8;
					if (!isDir) {
						isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
					}

					if (isSymlink) {
						// skip symlinks because A) we don't really need them and B) we can't
						// reliably create them on Windows due to the default security policy
						// only allows administrators to create symlinks
						zipfile.readEntry();
					} else if (isDir) {
						fs.mkdirp(fullPath, () => zipfile.readEntry());
					} else {
						fs.mkdirp(path.dirname(fullPath), () => {
							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									return abort(err);
								}

								const writeStream = fs.createWriteStream(fullPath,  { mode });
								writeStream.on('close', () => zipfile.readEntry());
								writeStream.on('error', abort);
								readStream.pipe(writeStream);
							});
						});
					}
				})
				.once('end', resolve)
				.readEntry();
		});
	});
}

function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squelch
	}
	return false;
}

/**
 * Ensures the install location exists and we have write access to it
 * @param {string} installLocation directory we plan to install the SDK to
 * @returns {Promise<void>}
 * @throws {Error} if unable to create install directory, or it is not writable
 */
async function ensureInstallLocation(installLocation) {
	try {
		await fs.ensureDir(installLocation);
	} catch (ex) {
		let str = `Unable to create installation location: ${installLocation}\n`;
		if (ex.code === 'EACCES') {
			str += 'Permission denied\n';
		} else {
			str += ex.toString();
		}
		throw new CLIError(str);
	}

	// make sure sdk folder is writable when installing an sdk
	if (!afs.isDirWritable(installLocation)) {
		throw new CLIError(`Installation location is not writable: ${installLocation}\n`);
	}
}

/**
 * Uninstalls the specified Titanium SDK.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubcommands.uninstall = {
	conf: function (_logger, _config, _cli) {
		return {
			desc: 'uninstall a specific Titanium SDK version',
			args: [
				{
					desc: 'the version to uninstall',
					name: 'version',
					required: true
				}
			],
			flags: {
				force: {
					abbr: 'f',
					desc: 'force uninstall without confirmation'
				}
			}
		};
	},
	fn: callbackify(uninstall)
};

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Promise<void>}
 */
async function uninstall(logger, config, cli) {
	// Gather up current state of sdks...
	const vers = appc.version.sort(Object.keys(cli.env.sdks)).reverse();
	const activeSDK = config.get('sdk.selected', config.get('app.sdk', 'latest')) === 'latest' && vers.length ? vers[0] : config.get('sdk.selected', config.get('app.sdk'));
	const activeLabel = ' [selected]';
	const maxlen = vers.reduce(function (a, b) {
		return Math.max(a, b.length + (b === activeSDK ? activeLabel.length : 0));
	}, 0);

	let version = cli.argv.version;
	const noPrompt = !cli.argv.prompt;
	const force = cli.argv.force;
	if (!version) {
		// if they didn't specify a version and prompting is disabled, then exit
		if (noPrompt) {
			const error = 'No SDK version specified';
			logger.error(error + '\n');
			logger.log(`Usage: ${`${cli.argv.$} sdk uninstall <version>`.cyan}\n`);
			throw new CLIError(error);
		}
		// prompt for which sdk to remove
		await new Promise((resolve, reject) => {
			fields.select({
				promptLabel: 'Titanium SDK version to uninstall',
				complete: true,
				numbered: true,
				margin: '',
				options: {
					'Installed SDKs:': vers.map(v => {
						return {
							path: cli.env.sdks[v].path,
							value: v
						};
					})
				},
				formatters: {
					option: function (opt, idx, num) {
						var d = opt.value === activeSDK ? activeLabel : '',
							n = maxlen + 2 - opt.value.length - d.length;
						return '  ' + num + opt.value.cyan + d.grey + new Array(n + 1).join(' ') + opt.path;
					}
				},
				validate: function (value) {
					if (!cli.env.sdks[value]) {
						logger.error(`Invalid Titanium SDK "${value}"`);
						return false;
					}
					return true;
				}
			}).prompt(function (err, value) {
				if (err && err.message === 'cancelled') {
					logger.log('\n');
					return reject(err);
				}

				logger.log();
				version = value;
				resolve();
			});
		});
	}

	// Validate that the version exists
	if (!vers.includes(version)) {
		const error = `Titanium SDK "${version}" is not found`;
		logger.error(error + '\n');
		appc.string.suggest(version, vers, logger.log.bind(logger));
		throw new CLIError(error);
	}

	if (!force) {
		// Must specify --force if no prompt
		if (noPrompt) {
			const error = `To uninstall a Titanium SDK in non-interactive mode, you must use ${'--force'.cyan}`;
			logger.error(error + '\n');
			logger.log(`Usage: ${`${cli.argv.$} sdk uninstall ${version} --force`.cyan}\n`);
			throw new CLIError(error);
		}

		// prompt for confirmation
		logger.log(`${`WARNING! This will permanently remove Titanium SDK ${version}!`.red}\n`);
		await new Promise((resolve, reject) => {
			fields.text({
				promptLabel: `Enter '${version.cyan}' to confirm uninstall`,
				validate: function (value) {
					if (value !== version) {
						logger.error('Incorrect, try again');
						return false;
					}
					return true;
				}
			}).prompt(function (err) {
				logger.log();
				if (err) {
					logger.log();
					return reject(err);
				}
				resolve();
			});
		});
	}

	try {
		logger.log(`Removing SDK directory: ${cli.env.sdks[version].path.cyan}\n`);
		await fs.remove(cli.env.sdks[version].path);
	} catch (e) {
		logger.error('An error occurred trying to remove the Titanium SDK folder:');
		if (e.code === 'EACCES') {
			logger.error('Permission denied\n');
		} else {
			e.toString().split('\n').forEach(function (line) {
				line.trim() && logger.error(line);
			});
			logger.log();
		}
		throw e;
	}

	vers.splice(vers.indexOf(version), 1);

	if (config.get('sdk.selected', config.get('app.sdk')) === version) {
		// need to force the config to reload
		config.load();
		config.set('sdk.selected', vers.shift() || 'latest');
		config.save();
		logger.log(`Updated selected Titanium SDK to ${config.sdk.selected.cyan}\n`);
	}

	logger.log(`Successfully uninstalled Titanium SDK ${version.cyan}\n`);
}

/**
 * Retrieves the list of releases.
 * @param {String} os - The name of the OS (osx, linux, win32)
 * @returns {Promise<Release[]>}
 */
async function getReleases(os) {
	const releaseRE = /^(\d+)\.(\d+)\.(\d+)\.(\w+)$/;
	const releaseTypes = [ 'beta', 'rc', 'ga' ];

	return (await Promise.allSettled([
		got('https://downloads.titaniumsdk.com/registry/beta.json', { responseType: 'json' }).then(res => ({ type: 'beta', releases: res.body })),
		got('https://downloads.titaniumsdk.com/registry/rc.json', { responseType: 'json' }).then(res => ({ type: 'rc', releases: res.body })),
		got('https://downloads.titaniumsdk.com/registry/ga.json', { responseType: 'json' }).then(res => ({ type: 'ga', releases: res.body }))
	])).flatMap(r => {
		return r.status === 'fulfilled' ? r.value.releases.map(rel => {
			rel.type = r.value.type;
			return rel;
		}) : [];
	}).filter(r => {
		return r.assets.some(a => a.os === os);
	}).sort((a, b) => {
		const [ , amajor, aminor, apatch, atag ] = a.name.toLowerCase().match(releaseRE);
		const [ , bmajor, bminor, bpatch, btag ] = b.name.toLowerCase().match(releaseRE);

		let n = parseInt(bmajor) - parseInt(amajor);
		if (n !== 0) {
			return n;
		}

		n = parseInt(bminor) - parseInt(aminor);
		if (n !== 0) {
			return n;
		}

		n = parseInt(bpatch) - parseInt(apatch);
		if (n !== 0) {
			return n;
		}

		return releaseTypes.indexOf(btag) - releaseTypes.indexOf(atag);
	});
}
exports.getReleases = getReleases;

/**
 * Retrieves the list of branches.
 * @returns {Promise<Branches>}
 */
async function getBranches() {
	return Object
		.entries((await got('https://downloads.titaniumsdk.com/registry/branches.json', { responseType: 'json' })).body)
		.filter(([ , count ]) => count)
		.map(([ name ]) => name);
}

/**
 * Retrieves the list of builds for a given branch.
 * @param {String} branch - The name of the branch
 * @param {String} os - The name of the current OS (osx, linux, win32)
 * @returns {Promise<BranchBuild[]>}
 */
async function getBranchBuilds(branch, os) {
	const now = Date.now();
	return (await got(`https://downloads.titaniumsdk.com/registry/${branch}.json`, { responseType: 'json' })).body.filter(b => {
		return (!b.expires || Date.parse(b.expires) > now) && b.assets.some(a => a.os === os);
	});
}

class CLIError extends Error {
	constructor(message, detail) {
		super(message);
		this.detail = detail;
	}
}
