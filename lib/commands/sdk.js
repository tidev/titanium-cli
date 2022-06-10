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
const http = require('http');
const got = require('got');
const path = require('path');
const fields = require('fields'); // TODO: Move to the couple locations it's used, on-demand?
const appc = require('node-appc');
const afs = appc.fs;

const callbackify = require('util').callbackify;

/** SDK command title. */
exports.title = 'SDK';

/** SDK command description. */
exports.desc = 'manages installed Titanium SDKs';

/** @namespace SdkSubcommands */
const SdkSubcommands = {};

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
				logger.log(error.detail);
			} else if (error && error instanceof Error) {
				logger.error(error.message);
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
		return r.status === 'fulfilled' ? r.value : new Error(r.reason);
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
${Object.hasOwn(sdks, r) ? ' [installed]' : ''}\
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

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
async function select(logger, config, cli) {
	let invalidSDKCount = 0;
	// we only care about SDKs that are 3.0 or newer
	// also we sort before filter so that the invalid SDKs print in some order
	const vers = Object.keys(cli.env.sdks).sort().filter(function (v) {
		var s = cli.env.sdks[v],
			name = s.manifest && s.manifest.version || s.name;
		try {
			return appc.version.gte(name, '3.0.0');
		} catch (e) {
			// the sdk is pre-3.3.0 and doesn't have a version number in the manifest and the name is not a version number
			logger.error(`Found invalid Titanium SDK "${name}" [${s.path}]`);
			invalidSDKCount++;
			return false;
		}
	// sort the SDKs by their actual version so we know that the first one is the 'latest'
	}).sort(function (a, b) {
		var as = cli.env.sdks[a],
			av = as.manifest && as.manifest.version || as.name,
			bs = cli.env.sdks[b],
			bv = bs.manifest && bs.manifest.version || bs.name;
		try {
			if (appc.version.lt(av, bv)) {
				return -1;
			} else if (appc.version.eq(av, bv)) {
				return 0;
			}
		} catch (ex) {
			// ignore
		}
		return 1;
	}).reverse();

	// if we printed any invalid sdks, add an empty line
	if (invalidSDKCount > 0) {
		logger.log();
	}

	// check we even have any (valid) SDKs installed
	if (!vers.length) {
		const error = 'No suitable Titanium SDKs installed';
		// TODO: provide a command to install latest GA?
		logger.error(error + '\n');
		throw new Error(error); // NOTE: this used to log this nromally and treat as "success"
	}

	// if they specified 'latest' or 'stable', then determine the latest/stable version
	let selectedSDK = cli.argv.version;
	if (vers.length) {
		if (selectedSDK === 'latest') {
			selectedSDK = vers[0];
		} else if (selectedSDK === 'stable') {
			for (var i = 0, re = /GA$/i; i < vers.length; i++) {
				if (re.test(vers[i])) {
					selectedSDK = vers[i];
					break;
				}
			}
		}
	}

	const noPrompt = !cli.argv.prompt;
	if (selectedSDK) {
		// we have a version, see if it's valid
		if (vers.includes(selectedSDK)) {
			if (appc.version.lt(selectedSDK, '3.2.0')) {
				logger.warn(`Titanium SDK ${selectedSDK} has been deprecated and will not work with future releases.`);
				logger.warn('Please use Titanium SDK 3.2 or newer.');
				logger.log('');
			}

			// need to force the config to reload
			config.load();
			config.set('sdk.selected', selectedSDK);
			config.save();
			logger.log('Configuration saved\n');
			return;
		}

		const error = `Invalid Titanium SDK "${selectedSDK}"`;
		logger.error(error + '\n');
		appc.string.suggest(selectedSDK, vers, logger.log.bind(logger));
		// if prompting is disabled, then we're done
		if (noPrompt) {
			throw new Error(error);
		}
	} else if (noPrompt) {
		// no version supplied, no prompting, show error and exit
		const error = 'No SDK version specified';
		logger.error(error + '\n');
		logger.log(`Usage: ${`${cli.argv.$} sdk select <version>`.cyan}\n`);
		throw new Error(error);
	}

	// prompt for the sdk version to select
	const activeSDK = config.get('sdk.selected', config.get('app.sdk', 'latest')) === 'latest' && vers.length ? vers[0] : config.get('sdk.selected', config.get('app.sdk'));
	const activeLabel = ' [selected]';
	const maxlen = vers.reduce(function (a, b) {
		return Math.max(a, b.length + (b === activeSDK ? activeLabel.length : 0));
	}, 0);
	return new Promise((resolve, reject) => {
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
				if (appc.version.lt(value, '3.2.0')) {
					logger.log('');
					logger.warn(`Titanium SDK ${value} has been deprecated and will not work with future releases.`);
					logger.warn('Please use Titanium SDK 3.2 or newer.');
				}
				return true;
			}
		}).prompt(function (err, value) {
			if (err && err.message === 'cancelled') {
				logger.log('\n');
				return reject(err);
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
			// ti sdk install something.zip
			// ti sdk install something.zip --default
			// ti sdk install http://builds.appcelerator.com/mobile/master/mobilesdk-3.2.0.v20130612114042-osx.zip
			// ti sdk install 3.1.0.GA
			// ti sdk install 3.1.0.GA --default
			desc: 'download the latest Titanium SDK or a specific version',
			args: [
				{
					desc: 'the version to install, "latest", URL, or zip file',
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
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
async function install(logger, config, cli) {
	const installLocation = afs.resolvePath(cli.env.installPath);

	// make sure the install location exists
	try {
		await ensureInstallLocation(installLocation);
	} catch (error) {
		logger.error(error);
		throw error;
	}

	// encapsulate the request to install
	const request = await handleInstallArgs(logger, config, cli);

	// record the newest sdk already installed
	const vers = appc.version.sort(Object.keys(cli.env.sdks).filter(v => appc.version.gte(v, '3.0.0'))).reverse();
	const newestInstalledSdk = config.get('sdk.selected', config.get('app.sdk', 'latest')) === 'latest' ? (vers.length ? vers[0] : null) : config.get('sdk.selected', config.get('app.sdk'));

	const setDefault = cli.argv.default;

	// avoid re-installing if it looks like it's already installed
	if (!cli.argv.force && await request.isInstalled(cli.env.sdks)) {
		if (request.isLatest) {
			logger.log(`You're up-to-date. Version ${request.version.cyan} is currently the newest version available.\n`);
		} else {
			logger.log(`Titanium SDK ${request.version.cyan} is already installed!\n`);
		}
		logger.log(`Run '${`${cli.argv.$} sdk install ${request.version} --force`.cyan}' to re-install.\n`);

		if (setDefault) {
			logger.log(`Setting Titanium SDK ${request.version.cyan} as the default.\n`);
			config.load();
			config.set('sdk.selected', request.version);
			config.save();
		}

		return;
	}

	// If remote, download
	await request.download();
	// unzip/extract
	await request.extract(installLocation);

	// set as new default if necessary
	if (request.version) {
		// Set as default if:
		// user explicitly asked to, this is the first sdk, or its a GA newer than previous newest
		const setDefault2 = setDefault || newestInstalledSdk === null || (request.setDefault && appc.version.gte(request.version, '3.0.0') && appc.version.gt(request.version, newestInstalledSdk));
		if (setDefault2) {
			logger.log(`Setting Titanium SDK ${request.version.cyan} as the default.\n`);
			config.load();
			config.set('sdk.selected', request.version);
			config.save();
		}

		logger.log(`Titanium SDK ${request.version.cyan} successfully installed!\n`);
	} else {
		logger.log('Successfully installed!\n');
	}
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
		throw new Error(str);
	}

	// make sure sdk folder is writable when installing an sdk
	if (!afs.isDirWritable(installLocation)) {
		throw new Error(`Installation location is not writable: ${installLocation}\n`);
	}
}

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Promise<SDKInstallRequest>}
 */
async function handleInstallArgs(logger, config, cli) {
	const version = cli.argv.version;
	// const branch = cli.argv.branch;
	const osName = cli.env.os.name;

	if (version) {
		// version is a URL?
		if (/^http(s)?:\/\/.+/.test(version)) {
			return new SDKInstallRequest(logger, config, cli, { url: version });
		}

		// version is a filepath?
		if (/.+\.zip$/.test(version)) {
			const file = afs.resolvePath(version);
			if (await fs.pathExists(file)) {
				const stat = await fs.stat(file);
				if (stat.isFile()) {
					const zipFile = await handleGitHubArtifact(file);
					const manifest = await getZippedManifest(zipFile);
					return new LocalSDKInstallRequest(logger, config, cli, zipFile, manifest);
				}
			}
		}

		// version is a git hash?
		// const match = version.match(/^([A-Za-z0-9_]+?):(.+)$/);
		// if (match) {
		// 	return doBranch(logger, config, cli, match[2], match[1], osName);
		// }
	}

	// if (branch) {
	// 	return doBranch(logger, config, cli, version, branch, osName);
	// }
	return doReleases(logger, config, cli, version, osName);
}

/**
 * Validates the zip that has been requested to be installed. This is because when downloading a
 * GitHub artifact the actual SDK zip will be placed inside a zip which will cause the extract to
 * fail. If this zip is a GitHub artifact then it will be unzipped and the resulting zip will be
 * returned
 *
 * @param {String} filepath - The path to the zip.
 * @returns {String} - The correct path to install.
 */
function handleGitHubArtifact(filepath) {
	return new Promise((resolve, reject) => {
		const yauzl = require('yauzl');
		yauzl.open(filepath, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(err);
			}

			const temp = require('temp');
			const tempName = temp.path({ suffix: '.zip' });
			const writeStream = fs.createWriteStream(tempName);

			if (zipfile.entryCount > 1) {
				zipfile.close();
				return resolve(filepath);
			}

			zipfile.once('close', () => {
				return resolve(tempName);
			});
			zipfile.once('error', err => reject(err));

			zipfile.on('entry', (entry) => {
				zipfile.openReadStream(entry, (err, readStream) => {
					if (err) {
						return reject(err);
					}
					readStream.on('end', () => {
						zipfile.readEntry();
					});
					readStream.pipe(writeStream);
				});
			});

			zipfile.readEntry();
		});
	});
}

/**
 * @typedef {Object} ManifestJSON
 * @property {string} name fully suffixed/timestamped version i.e. '9.2.0.v20200923092031'
 * @property {string} version short version i.e. '9.2.0'
 * @property {string} timestamp i.e. '9/23/2020 16:25'
 * @property {string} githash i.e. '58a34e529d'
 * @property {object} moduleAPIVersion holds module api versiosn for platforms
 * @property {string} moduleAPIVersion.iphone i.e. '2'
 * @property {string} moduleAPIVersion.android i.e. '4'
 * @property {string[]} platforms i.e. ["iphone", "android"]
 */

/**
 * @param {string} filepath path to zipfile
 * @returns {Promise<ManifestJSON>}
 */
async function getZippedManifest(filepath) {
	return new Promise((resolve, reject) => {
		const yauzl = require('yauzl');
		let matched = false; // track if we never found the manifest.json
		yauzl.open(filepath, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(err);
			}

			zipfile.once('close', () => {
				if (!matched) {
					reject(new Error('Zip file did not contain expected manifest.json entry'));
				}
			});
			zipfile.once('error', err => reject(err));
			zipfile.on('entry', entry => {
				// Skip all but the expected manifest.json file
				if (!entry.fileName.endsWith('manifest.json')) {
					zipfile.readEntry(); // move on
					return;
				}
				if (!entry.fileName.match(/^mobilesdk\/(osx|win32|linux)\/([^/]+)\/manifest\.json$/)) {
					zipfile.readEntry(); // move on
					return;
				}
				matched = true; // we found what should be our manifest.json file

				// Read the manifest
				zipfile.openReadStream(entry, (err, readStream) => {
					if (err) {
						return reject(err);
					}

					const chunks = [];
					readStream.on('data', chunk => chunks.push(chunk));
					readStream.on('error', err => reject(err));
					readStream.on('end', () => {
						const str = Buffer.concat(chunks).toString('utf8');
						zipfile.close();
						try {
							const manifest = JSON.parse(str);
							resolve(manifest);
						} catch (jsonErr) {
							reject(jsonErr);
						}
					});
				});
			});
			zipfile.readEntry();
		});
	});
}

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {string} [version] sdk version to install
 * @param {string} branch branch to install from
 * @param {string} osName 'linux' || 'osx' || 'win32'
 * @returns {Promise<SDKInstallRequest>}
 */
// async function doBranch(logger, config, cli, version, branch, osName) {
// 	branch = await getBranch(branch, config, logger);

// 	const builds = await getBranchBuilds(config, branch, osName);
// 	if (!builds || !builds.length) {
// 		throw new Error(__('Branch \'%s\' does not have any builds', branch) + '\n');
// 	}

// 	const isLatest = !version || version === 'latest';
// 	const build = isLatest ? builds[0] : builds.filter(b => b.name === version).shift();

// 	if (!build) {
// 		const buildNames = builds.map(b => b.name).sort().reverse();
// 		let str = '';
// 		appc.string.suggest(version, buildNames, s => {
// 			str += (s || '') + '\n';
// 		}, 2);
// 		str += __('Available Builds:\n');
// 		str += appc.string.renderColumns(buildNames, '    ', 100).cyan + '\n';
// 		throw new CLIError(__('Build "%s" does not exist\n', version), str);
// 	}

// 	version = build.name;

// 	return new SDKInstallRequest(logger, config, cli, {
// 		url: urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, build.filename).replace(/\$TOKEN/, process.env.APPC_SESSION_TOKEN || 'X'),
// 		version,
// 		branch,
// 		isLatest
// 	});
// }

/**
 * @param {string} branch branch name to validate/get, use 'latest' to pick default branch
 * @param {object} config cli config
 * @param {object} logger logger instance
 * @returns {Promise<string>} validated/resolved branch name
 * @throws {Error} if no branches are found, or if named barnch is not found in listing
 */
// async function getBranch(branch, config, logger) {
// 	const data = await getBranches(config, logger);

// 	// check that we have branches
// 	if (!data || !data.branches.length) {
// 		throw new Error(__('No branches found!') + '\n');
// 	}

// 	// resolve 'latest' alias
// 	if (branch === 'latest') {
// 		branch = data.defaultBranch;
// 	}

// 	// check that the desired branch exists
// 	if (!data.branches.includes(branch)) {
// 		let str = '';
// 		appc.string.suggest(branch, data.branches, s => {
// 			str += (s || '') + '\n';
// 		}, 2);
// 		str += __('Available Branches:\n');
// 		str += appc.string.renderColumns(data.branches.sort().reverse(), '    ', 100).cyan + '\n';
// 		throw new CLIError(__('Branch "%s" does not exist\n', branch), str);
// 	}
// 	return branch;
// }

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {string} version version to install
 * @param {string} osName 'linux' || 'osx' || 'win32'
 * @throws {Error} if no releases are found
 * @returns {Promise<SDKInstallRequest>}
 */
async function doReleases(logger, config, cli, version, osName) {
	// check if it's a valid release
	const releases = await getReleases(config, osName, { allReleaseTypes: true });
	if (!releases || releases.size === 0) {
		throw new Error('No releases found!\n');
	}

	const isLatest = !version || version === 'latest';
	const rels = appc.version.sort(Array.from(releases.keys())).reverse();

	// if choosing latest, resolve to latest listed releases
	if (isLatest) {
		version = rels.find(ver => releases.get(ver).releaseType === 'GA');
	}

	if (releases.has(version)) {
		// we found the version, move on...
		const release = releases.get(version);
		return new SDKInstallRequest(logger, config, cli, {
			url: release.url, // TODO: Use rest of metadata we have like checksum for integrity check?
			version,
			isLatest,
			setDefault: isLatest // we want to auto-select it if it's the latest GA
		});
	}

	throw new CLIError(`Unable to find SDK release "${version}"`);

	// logger.log(__('Did not find a release %s, scanning branches...', version.cyan));
	// const matchingBuild = await scanBranches(logger, config, cli, version, osName);
	// if (!matchingBuild) {
	// 	let str = '';
	// 	if (!cli.argv.branch && version.indexOf('.v') !== -1) {
	// 		str += __('Did you forget to specify the branch?') + '\n';
	// 	}
	// 	appc.string.suggest(version, rels, s => {
	// 		str += (s || '') + '\n';
	// 	}, 1);
	// 	str += __('Available Releases:\n');
	// 	str += appc.string.renderColumns(rels, '    ', 100).cyan + '\n';
	// 	throw new CLIError(__('Release "%s" does not exist\n', version), str);
	// }

	// logger.log(__('Found build %s in branch %s', version.cyan, matchingBuild.branch.cyan) + '\n');
	// return matchingBuild;
}

/**
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {string} version sdk version to install?
 * @param {string} osName 'linux' || 'osx' || 'win32'
 * @returns {Promise<SDKInstallRequest>} metadata for the build seletced/found
 * @throws {Error} if unable to find the requested version in any branch
 */
// async function scanBranches(logger, config, cli, version, osName) {
// 	const data = await getBranches(config, logger);
// 	if (!data || !Array.isArray(data.branches)) {
// 		throw new Error('Unable to find any branches');
// 	}

// 	// TODO: Be smarter with version, we should generally "know" the expected branch name to check
// 	// i.e. "9.2.0.v..." should check like 'master' and '9_2_X'

// 	// Now in parallel, check all branches listed?
// 	let matchingBuild;
// 	await Promise.all(data.branches.map(async branch => {
// 		if (matchingBuild) {
// 			return;
// 		}

// 		const builds = await getBranchBuilds(config, branch, osName);
// 		if (!matchingBuild && Array.isArray(builds)) {
// 			for (const build of builds) {
// 				if (build.name === version) {
// 					matchingBuild = {
// 						url: urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, build.filename).replace(/\$TOKEN/, process.env.APPC_SESSION_TOKEN || 'X'),
// 						version,
// 						branch
// 					};
// 					break;
// 				}
// 			}
// 		}
// 	}));
// 	return new SDKInstallRequest(logger, config, cli, matchingBuild);
// }

/**
 * Encapsulates a request to install an SDK
 */
class SDKInstallRequest {
	/**
	 * @param {Object} logger - The logger instance
	 * @param {Object} config - The CLI config object
	 * @param {CLI} cli - The CLI instance
	 * @param {object} options options
	 * @param {string} options.url url to download from
	 * @param {string} [options.version] SDK version (from JSON?)
	 * @param {string} [options.branch] branch name it came from?
	 * @param {boolean} [options.setDefault=false] whether to auto-select this SDK as default
	 * @param {boolean} [options.isLatest=false] is this a request for the latest on a branch/release list?
	 */
	constructor(logger, config, cli, options) {
		this.logger = logger;
		this.config = config;

		// Data about the SDK to install
		this.url = options.url; // only required option (for remote installs)
		this.version = options.version;
		this.branch = options.branch;
		this.setDefault = options.setDefault;
		this.isLatest = options.isLatest;

		this._showProgress = !cli.argv.quiet && !!cli.argv['progress-bars'];
		this.keepFiles = cli.argv['keep-files'];
	}

	/**
	 * @returns {Promise<string>} path to downloaded file
	 */
	async download() {
		this.logger.log(`Downloading ${this.url.cyan}`);

		const temp = require('temp');
		const tempName = temp.path({ suffix: '.zip' });
		this.file = tempName; // store for extraction later!
		const tempDir = path.dirname(tempName);
		await fs.ensureDir(tempDir);

		return new Promise((resolve, reject) => {
			const tempStream = fs.createWriteStream(tempName);
			// const req = request({
			// 	url: this.url,
			// 	proxy: this.config.get('cli.httpProxyServer'),
			// 	rejectUnauthorized: this.config.get('cli.rejectUnauthorized', true),
			// 	followRedirect: true
			// });
			const req = {};

			req.pipe(tempStream);

			req.on('error', err => {
				fs.removeSync(tempName);
				reject(new Error(`Failed to download SDK: ${err.toString()}\n`));
			});

			req.on('response', req => {
				if (req.statusCode >= 400) {
					// something went wrong, abort
					return reject(new Error(`Request failed with HTTP status code ${req.statusCode} ${http.STATUS_CODES[req.statusCode] || ''}\n`));
				}

				if (req.headers['content-length']) {
					// we know how big the file is, display the progress bar
					const total = parseInt(req.headers['content-length']);

					let bar;
					if (this._showProgress) {
						bar = new appc.progress('  :paddedPercent [:bar] :etas', {
							complete: '='.cyan,
							incomplete: '.'.grey,
							width: 40,
							total
						});
						req.on('data', buffer => bar.tick(buffer.length));
					}

					tempStream.on('close', () => {
						if (bar) {
							bar.tick(total);
							this.logger.log('\n');
						}
						resolve(tempName);
					});
				} else {
					// we don't know how big the file is, display a spinner
					let busy;
					if (this._showProgress) {
						busy = new appc.busyindicator();
						busy.start();
					}

					tempStream.on('close', () => {
						busy && busy.stop();
						this.logger.log();
						resolve(tempName);
					});
				}
			});
		});
	}

	/**
	 * @param {string} installLocation destination folder
	 * @returns {Promise<void>}
	 */
	async extract(installLocation) {
		this.logger.log(`Extracting SDK to ${installLocation.cyan}`);

		return new Promise((resolve, reject) => {
			let bar;
			appc.zip.unzip(this.file, installLocation, {
				visitor: (entry, i, total) => {
					if (i === 0 && this._showProgress) {
						bar = new appc.progress('  :paddedPercent [:bar]', {
							complete: '='.cyan,
							incomplete: '.'.grey,
							width: 40,
							total
						});
					}

					bar && bar.tick();

					// record the version if we don't have one set
					if (!this.version) {
						const m = entry.fileName.match(/^mobilesdk\/[^/]+\/([^/]+)\/(version\.txt|manifest\.json)$/);
						if (m) {
							this.version = m[1];
						}
					}
				}
			}, (err, extracted, total) => {
				// erase the zipfile if we've been asked to
				if (!this.keepFiles) {
					fs.unlinkSync(this.file);
				}

				if (err) {
					let str;
					if (this.version) {
						str = `Failed to unzip Titanium SDK ${this.version}`;
					} else {
						str = 'Failed to unzip Titanium SDK';
					}
					str += String(err);
					return reject(new Error(str));
				}

				if (bar) {
					bar.tick(total);
					this.logger.log('\n');
				}

				// get the actual version number
				const manifestFile = path.join(installLocation, 'manifest.json');
				if (fs.existsSync(manifestFile)) {
					const manifest = fs.readJSONSync(manifestFile);
					this.version = manifest.version || this.version;
				}

				resolve();
			});
		});
	}

	/**
	 * @param {object} sdks CLI config sdks (version -> info mapping)
	 * @returns {Promise<boolean>}
	 */
	async isInstalled(sdks) {
		return Object.hasOwnProperty.call(sdks, this.version);
	}
}

/**
 * Override for local zipfiles to no-op the download, not delete the zipfile
 */
class LocalSDKInstallRequest extends SDKInstallRequest {
	/**
	 * @param {Object} logger - The logger instance
	 * @param {Object} config - The CLI config object
	 * @param {CLI} cli - The CLI instance
	 * @param {string} file filepath to sdk .zip file
	 * @param {ManifestJSON} manifest representation of manifest.json file
	 */
	constructor(logger, config, cli, file, manifest) {
		super(logger, config, cli, { version: manifest.version || manifest.name });
		this.file = file;
		this.manifest = manifest;
		this.keepFiles = true; // don't erase zipfiles when extracting from local zip
	}

	async download() {
		// no-op, already available locally on fs
		return this.file;
	}

	/**
	 * For whatever reason we choose to assume local SDK zips are only installed if version matches AND timestamp matches
	 * @param {object} sdks CLI config sdks (version -> info mapping)
	 * @returns {Promise<boolean>}
	 */
	async isInstalled(sdks) {
		// we need to loop through the sdks comparing manifests
		// if manifest.name matches and manifest.timestamp consider it installed
		for (const value of Object.values(sdks)) {
			if (value.manifest.name === this.manifest.name && value.manifest.timestamp === this.manifest.timestamp) {
				return true;
			}
		}
		return false;
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
			throw new Error(error);
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
		throw new Error(error);
	}

	if (!force) {
		// Must specify --force if no prompt
		if (noPrompt) {
			const error = `To uninstall a Titanium SDK in non-interactive mode, you must use ${'--force'.cyan}`;
			logger.error(error + '\n');
			logger.log(`Usage: ${`${cli.argv.$} sdk uninstall ${version} --force`.cyan}\n`);
			throw new Error(error);
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
 * @typedef {Object} Release
 * @property {string} os - 'linux' || 'win32' || 'osx'
 * @property {string} name - 'mobilesdk'
 * @property {string} checksum - checksum for the zipfile (sha1?)
 * @property {string} guid - unique guid?
 * @property {string} build_type - i.e. '64bit_i386'
 * @property {string} version - i.e. '8.0.1.GA'
 * @property {string} url - fulle URl of the zipfile containign the SDK
 */

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
		const [ _, amajor, aminor, apatch, atag ] = a.name.toLowerCase().match(releaseRE);
		const [ __, bmajor, bminor, bpatch, btag ] = b.name.toLowerCase().match(releaseRE);

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
		.filter(([ name, count ]) => count)
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
