import chalk from 'chalk';
import { TiError } from '../util/tierror.js';
import { expand } from '../util/expand.js';
import * as version from '../util/version.js';
import { request } from '../util/request.js';
import { BusyIndicator } from '../util/busyindicator.js';
import fs from 'fs-extra';
import { mkdir } from 'node:fs/promises';
import { suggest } from '../util/suggest.js';
import { columns } from '../util/columns.js';
import { basename, dirname, join } from 'node:path';
import os from 'node:os';
import { ProgressBar } from '../util/progress.js';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extractZip } from '../util/extract-zip.js';
import { prompt } from '../util/prompt.js';
import { getReleases } from '../util/tisdk.js';
import prettyBytes from 'pretty-bytes';
import wrapAnsi from 'wrap-ansi';

const { cyan, gray, green, magenta, red, yellow } = chalk;

const SdkSubcommands = {};

/**
 * Returns the configuration for the SDK command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} SDK command configuration
 */
export function config(logger, config, cli) {
	const subcommands = {};
	for (const [name, subcmd] of Object.entries(SdkSubcommands)) {
		subcommands[name] = subcmd.conf(logger, config, cli);
		if (subcmd.alias) {
			subcommands[name].alias = subcmd.alias;
		}
	}
	return {
		title: 'SDK',
		defaultSubcommand: 'list',
		skipBanner: true,
		subcommands
	};
}

/**
 * Displays all installed Titanium SDKs or installs a new SDK.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
export async function run(logger, config, cli) {
	let action = cli.command.name();
	if (action === 'list' && cli.command.args.length) {
		action = cli.command.args[0];
		if (cli.argv.$_.includes('list')) {
			throw new TiError(`Invalid argument "${action}"`, { showHelp: true });
		}
		cli.command = cli.command.parent;
	}
	for (const [name, subcommand] of Object.entries(SdkSubcommands)) {
		if (action === name || action === subcommand.alias) {
			await SdkSubcommands[name].fn(logger, config, cli);
			return;
		}
	}
	throw new TiError(`Invalid subcommand "${action}"`, { showHelp: true });
}

SdkSubcommands.select = {
	conf() {
		return {
			hidden: true
		};
	},
	fn(logger, config, _cli) {
		logger.skipBanner(false);
		logger.banner();
		logger.log(
			yellow(
				wrapAnsi(
					`Good news! The "select" subcommand is no longer required.

If the current working directory is a Titanium app, the Titanium CLI will
automatically use the <sdk-version> from the "tiapp.xml", otherwise use the
default to the latest installed SDK.`,
					config.get('cli.width', 80),
					{ hard: true, trim: false }
				)
			)
		);
	}
};

/**
 * Displays a list of all installed Titanium SDKs.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
SdkSubcommands.list = {
	alias: 'ls',
	conf(_logger, _config, _cli) {
		return {
			desc: 'print a list of installed SDK versions',
			flags: {
				branches: {
					abbr: 'b',
					desc: 'retrieve and print all branches'
				},
				json: {
					desc: 'display installed modules as json'
				},
				releases: {
					abbr: 'r',
					desc: 'retrieve and print all releases'
				},
				unstable: {
					abbr: 'u',
					desc: 'retrieve and print all unstable release candidate (rc) and beta releases'
				}
			},
			options: {
				branch: {
					desc: 'branch to fetch CI builds'
				},
				output: {
					abbr: 'o',
					default: 'report',
					hidden: true,
					values: ['report', 'json']
				}
			}
		};
	},
	async fn(logger, config, cli) {
		const os = cli.env.os.name;

		const [releases, branches, branchBuilds] = (await Promise.allSettled([
			(cli.argv.releases || cli.argv.unstable) && getReleases(cli.argv.unstable),
			cli.argv.branches && getBranches(),
			cli.argv.branch && getBranchBuilds(cli.argv.branch, os)
		])).map(r => {
			return r.status === 'fulfilled' ? r.value : new TiError(r.reason);
		});

		const { sdks } = cli.env;
		const vers = version.sort(Object.keys(sdks)).reverse();

		const defaultInstallLocation = cli.env.installPath;
		const locations = Array.from(
			new Set([
				cli.env.os.sdkPaths,
				defaultInstallLocation,
				config.get('paths.sdks')
			].flat().filter(Boolean).map(p => p && expand(p)))
		).sort();

		if (cli.argv.json || cli.argv.output === 'json') {
			for (const ver of vers) {
				delete sdks[ver].commands;
				delete sdks[ver].packageJson;
				delete sdks[ver].platforms;
			}

			const obj = {
				branch: branchBuilds?.length ? {
					[cli.argv.branch]: branchBuilds
				} : {},
				branches: {
					defaultBranch: 'master',
					branches: branches || []
				},
				defaultInstallLocation,
				installLocations: locations,
				installed: vers.reduce((obj, v) => {
					obj[v] = sdks[v].path;
					return obj;
				}, {}),
				releases: releases && releases.reduce((obj, { name, assets }) => {
					obj[name] = assets.find(a => a.os === os).url;
					return obj;
				}, {}) || {},
				sdks
			};

			logger.log(JSON.stringify(obj, null, '\t'));
			return;
		}

		logger.skipBanner(false);
		logger.banner();

		logger.log('SDK Install Locations:');
		for (const p of locations) {
			logger.log(`   ${cyan(p)}${p === defaultInstallLocation ? gray(' [default]') : ''}`);
		}
		logger.log();

		if (vers.length) {
			const maxlen = vers.reduce((len, b) => Math.max(len, b.length), 0);
			const maxname = vers.reduce((len, b) => {
				return Math.max(len, sdks[b].manifest && sdks[b].manifest.name ? sdks[b].manifest.name.length : 0);
			}, 0);

			logger.log('Installed SDKs:');
			for (const v of vers) {
				const n = maxlen + 2 - v.length;
				let name = sdks[v].manifest && (sdks[v].manifest.name || sdks[v].manifest.version);

				if (!name) {
					try {
						name = version.format(v, 3, 3);
					} catch (ex) {
						name = '';
					}
				}

				logger.log(`   ${cyan(v)}${' '.repeat(n)}${maxname ? magenta(name.padEnd(maxname + 2)) : ''}${sdks[v].path}`);
			}
		} else {
			logger.log(red('No Titanium SDKs found\n'));
			logger.log(`You can download the latest Titanium SDK by running: ${cyan('titanium sdk install')}\n`);
		}

		if (releases) {
			logger.log();
			logger.log('Releases:');
			if (releases instanceof Error) {
				logger.log(`   ${red(releases.message)}`);
			} else if (!releases.length) {
				logger.log('   No releases found');
			} else {
				let i = 0;
				for (const r of releases) {
					logger.log(`   ${cyan(r.name.padEnd(12))}\
${Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(new Date(r.date)).padStart(8)}\
${prettyBytes(r.assets.find(a => a.os === os).size).toUpperCase().padStart(11)}\
${Object.prototype.hasOwnProperty.call(sdks, r) ? ' [installed]' : ''}\
${r.type !== 'ga' ? gray('  [unstable]') : i++ === 0 ? green('  [latest stable]') : ''}`);
				}
			}
		}

		if (branches) {
			logger.log();
			logger.log('Branches:');
			if (branches instanceof Error) {
				logger.log(`   ${branches.message.red}`);
			} else {
				for (const b of branches) {
					logger.log(`   ${cyan(b)}${b === 'master' ? gray(' [default]') : ''}`);
				}
			}
		}

		if (cli.argv.branch) {
			logger.log();
			if (branchBuilds instanceof Error) {
				logger.error(`Invalid branch "${cli.argv.branch}"\n`);
				logger.log(`Run '${cyan('titanium sdk --branches')}' for a list of available branches.\n`);
			} else {
				logger.log(`'${cli.argv.branch}' Branch Builds:`);
				if (branchBuilds?.length) {
					for (const b of branchBuilds) {
						const dt = Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(new Date(b.date));
						logger.log(`   ${cyan(b.name)}\
${dt.padStart(11)}\
${prettyBytes(b.assets.find(a => a.os === os).size).toUpperCase().padStart(11)}  ${gray('[unstable]')}`);
					}
					logger.log(gray('** NOTE: these builds not recommended for production use **'));
				} else {
					logger.log('   No builds found');
				}
			}
		}
	}
};

/**
 * Installs the specified Titanium SDK.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubcommands.install = {
	alias: 'i',
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
			// ti sdk install https://github.com/tidev/titanium-sdk/releases/download/12_1_2_GA/mobilesdk-12.1.2.GA-osx.zip
			// ti sdk install 3.1.0.GA
			// ti sdk install 3.1.0.GA --default
			desc: 'download the latest Titanium SDK or a specific version',
			args: [
				{
					desc: 'the version to install, "latest", URL, zip file, or <branch>:<build_name>',
					name: 'version'
				}
			],
			flags: {
				default: {
					abbr: 'd',
					hidden: true
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
	async fn(logger, config, cli) {
		const titaniumDir  = expand(cli.env.installPath);
		const showProgress = !cli.argv.quiet && !!cli.argv['progress-bars'];
		const osName       = cli.env.os.name;
		const subject      = cli.argv._.shift() || 'latest';
		const { trace }    = cli.debugLogger;

		logger.skipBanner(false);
		logger.banner();

		// step 0: make sure the install location exists

		await mkdir(titaniumDir, { recursive: true });

		// step 1: determine what the uri is

		const { downloadedFile, file } = await getInstallFile({
			branch: cli.argv.branch,
			config,
			logger,
			osName,
			showProgress,
			subject
		});

		// step 2: extract the sdk zip file

		let { forceModules, name, renameTo, tempDir } = await extractSDK({
			debugLogger: cli.debugLogger,
			file,
			force: cli.argv.force,
			logger,
			noPrompt: !cli.argv.prompt,
			osName,
			showProgress,
			subject,
			titaniumDir
		});

		// step 3: validate the manifest.json

		let src = name && join(tempDir, 'mobilesdk', osName, name);
		if (name) {
			try {
				const manifestFile = join(src, 'manifest.json');
				const manifest = await fs.readJson(manifestFile);
				if (renameTo) {
					manifest.name = renameTo;
					await fs.writeJson(manifestFile, manifest);
				}
			} catch (e) {
				name = null;
			}
		}
		if (!name) {
			throw new TiError('Zip file does not contain a valid Titanium SDK');
		}

		// step 4: move the sdk files to the dest

		const dest = join(titaniumDir, 'mobilesdk', osName, renameTo || name);
		if (showProgress) {
			logger.log();
		}
		logger.log(`\nInstalling SDK files to ${cyan(dest)}`);
		await fs.mkdirs(dest);
		await fs.move(src, dest, { overwrite: true });

		// step 5: install the modules

		const modules = {};
		src = join(tempDir, 'modules');
		if (fs.statSync(src).isDirectory()) {
			const modulesDest = join(titaniumDir, 'modules');

			for (const platform of fs.readdirSync(src)) {
				const srcPlatformDir = join(src, platform);
				if (!fs.statSync(srcPlatformDir).isDirectory()) {
					continue;
				}

				for (const moduleName of fs.readdirSync(srcPlatformDir)) {
					const srcModuleDir = join(srcPlatformDir, moduleName);
					if (!fs.statSync(srcModuleDir).isDirectory()) {
						continue;
					}

					for (const ver of fs.readdirSync(srcModuleDir)) {
						const srcVersionDir = join(srcModuleDir, ver);
						if (!fs.statSync(srcVersionDir).isDirectory()) {
							continue;
						}

						const destDir = join(modulesDest, platform, moduleName, ver);
						if (!forceModules && fs.existsSync(destDir)) {
							trace(`Module ${cyan(`${moduleName}@${ver}`)} already installed`);
							continue;
						}

						modules[`${moduleName}@${ver}`] = { src: srcVersionDir, dest: destDir };
					}
				}
			}
		}

		if (Object.keys(modules).length) {
			trace(`Installing ${cyan(Object.keys(modules).length)} modules:`);
			for (const [name, { src, dest }] of Object.entries(modules)) {
				trace(`   ${cyan(name)}`);
				await fs.move(src, dest, { overwrite: true });
			}
		} else {
			trace('SDK has new modules to install');
		}

		// step 6: cleanup

		if (downloadedFile && !cli.argv['keep-files']) {
			await fs.remove(downloadedFile);
		}
		await fs.remove(tempDir);

		logger.log(`\nTitanium SDK ${cyan(name)} successfully installed!`);
	}
};

async function getInstallFile({ branch, config, logger, osName, showProgress, subject }) {
	const uriMatch = subject?.match(/^(https?:\/\/.+)|(?:file:\/\/(.+))$/);
	let file;

	if (uriMatch && uriMatch[2]) {
		file = uriMatch[2];
	} else if (subject && fs.existsSync(subject)) {
		file = subject;
	}

	if (file) {
		file = expand(file);

		if (!fs.existsSync(file)) {
			throw new TiError('Specified file does not exist');
		}

		if (!/\.zip$/.test(file)) {
			throw new TiError('Specified file is not a zip file');
		}
		return { file };
	}

	// we are downloading an sdk

	let url;
	let uri = subject.toLowerCase();
	if (uriMatch && uriMatch[1]) {
		// we have a http url
		url = uriMatch[1];
	} else if (branch) {
		// we have a ci build
		const branches = await getBranches();
		if (!branches.includes(branch)) {
			throw new TiError(`Branch "${branch}" does not exist`, {
				after: `${
					suggest(branch, branches, 2)
				}Available Branches:\n${
					columns(branches, '    ', config.get('cli.width', 80))
				}`
			});
		}

		const builds = await getBranchBuilds(branch, osName);
		const build = uri === 'latest' ? builds[0] : builds.find(b => b.name.toLowerCase() === uri);
		if (!build) {
			throw new TiError(`CI build ${subject} does not exist`);
		}

		const asset = build.assets.find(a => a.os === osName);
		if (!asset) {
			throw new TiError(`CI build ${subject} does not support ${osName}`);
		}

		url = asset.url;
	} else {
		// try to find the release by name
		let release = null;

		const releases = await getReleases(true);
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
				throw new TiError(`SDK release ${subject} does not support ${osName}`);
			}
			url = asset.url;
		}
	}

	if (!url) {
		throw new TiError(`Unable to find any Titanium SDK releases or CI builds that match "${subject}"`);
	}

	// step 1.5: download the file

	let downloadedFile = expand('~', '.titanium', 'downloads', `titanium-sdk-${Math.floor(Math.random(1e6))}.zip`);
	const downloadDir = dirname(downloadedFile);
	await mkdir(downloadDir, { recursive: true });

	logger.log(`Downloading ${cyan(url)}`);

	let bar;
	let busy;
	let filename;
	let total;
	const out = fs.createWriteStream(downloadedFile);
	let response = await request(url);

	if ([301, 302].includes(response.statusCode)) {
		response = await request(response.headers.location);
	}

	const cd = response.headers['content-disposition'];
	let m = cd && cd.match(/filename[^;=\n]*=['"]*(.*?\2|[^'";\n]*)/);
	filename = m && m[1];

	// try to determine the file extension by the filename in the url
	if (!filename && (m = url.match(/.*\/(.+\.zip)$/))) {
		filename = m[1];
	}

	total = parseInt(response.headers['content-length']);

	if (showProgress) {
		if (total) {
			bar = new ProgressBar('  :paddedPercent [:bar]', {
				complete: cyan('='),
				incomplete: gray('.'),
				width: 40,
				total
			});
		} else {
			busy = new BusyIndicator();
			busy.start();
		}
	}

	const progressStream = new Transform({
		transform(chunk, _encoding, callback) {
			bar?.tick(chunk.length);
			this.push(chunk);
			callback();
		}
	});

	await pipeline(response.body, progressStream, out);

	out.close();
	busy?.stop();
	bar?.tick(total);
	if (bar) {
		logger.log('\n');
	} else if (busy) {
		logger.log();
	}

	if (filename) {
		file = join(downloadDir, filename);
		await fs.move(downloadedFile, file, { overwrite: true });
		downloadedFile = file;
	} else {
		file = downloadedFile;
	}

	return { downloadedFile, file };
}

async function extractSDK({ debugLogger, file, force, logger, noPrompt, osName, showProgress, subject, titaniumDir }) {
	const sdkDestRegExp = new RegExp(`^mobilesdk[/\\\\]${osName}[/\\\\]([^/\\\\]+)`);
	const tempDir = join(os.tmpdir(), `titanium-cli-${Math.floor(Math.random() * 1e6)}`);
	let artifact;
	let bar;
	let name;
	let renameTo;
	let forceModules = force;

	const onEntry = async (filename, _idx, total) => {
		if (total > 1) {
			const m = !name && filename.match(sdkDestRegExp);
			if (m) {
				name = m[1];
				const result = await checkSDKFile({
					force,
					logger,
					filename,
					name,
					noPrompt,
					osName,
					sdkDir: join(titaniumDir, 'mobilesdk', osName, name),
					subject
				});

				forceModules = result?.forceModules ?? force;
				renameTo = result?.renameTo;

				logger.log('Extracting SDK...');
				if (showProgress && !bar) {
					bar = new ProgressBar('  :paddedPercent [:bar]', {
						complete: cyan('='),
						incomplete: gray('.'),
						width: 40,
						total
					});
				}
			}

			bar?.tick();
		} else {
			artifact = filename;
		}
	};

	debugLogger.trace(`Extracting ${file} -> ${tempDir}`);
	await extractZip({
		dest: tempDir,
		file,
		onEntry
	});

	if (!artifact) {
		return { forceModules, name, renameTo, tempDir };
	}

	debugLogger.trace(`Detected artifact: ${artifact}`);
	const tempDir2 = join(os.tmpdir(), `titanium-cli-${Math.floor(Math.random() * 1e6)}`);
	file = join(tempDir, artifact);

	debugLogger.trace(`Extracting ${file} -> ${tempDir2}`);
	await extractZip({
		dest: tempDir2,
		file,
		onEntry
	});

	await fs.remove(tempDir);
	return { forceModules, name, renameTo, tempDir: tempDir2 };
}

async function checkSDKFile({ force, logger, filename, name, noPrompt, osName, sdkDir, subject }) {
	try {
		if (force || !fs.statSync(sdkDir).isDirectory()) {
			return;
		}
	} catch {
		return;
	}

	// already installed
	const releases = await getReleases(false);
	const latest = releases[0];
	const tip = `Run '${cyan(`titanium sdk install ${latest.name} --force`)}' to re-install`;

	if (noPrompt) {
		if (subject === 'latest' && name === latest.name) {
			throw new TiError(`Titanium SDK ${name} is already installed`, {
				after: `You're up-to-date. Version ${cyan(latest.name)} is currently the newest version available.\n${tip}`
			});
		}
		throw new TiError(`Titanium SDK ${name} is already installed`, {
			after: tip
		});
	}

	let renameTo;
	for (let i = 2; true; i++) {
		try {
			renameTo = `${name}-${i}`;
			if (!fs.statSync(`${sdkDir}-${i}`).isDirectory()) {
				break;
			}
		} catch {
			break;
		}
	}

	const action = await prompt({
		type: 'select',
		name: 'action',
		message: `Titanium SDK ${name} is already installed`,
		instructions: false,
		hint: 'Use arrows to select and return to submit',
		choices: [
			{ title: 'Overwrite', value: 'overwrite' },
			{ title: `Rename as ${basename(renameTo)}`, value: 'rename' },
			{ title: 'Abort', value: 'abort' }
		]
	});

	if (!action || action === 'abort') {
		process.exit(0);
	}

	logger.log();

	const result = { action };
	if (action === 'rename') {
		result.renameTo = renameTo;
	} else if (action === 'overwrite') {
		result.forceModules = true;
	}
	return result;
}

/**
 * Uninstalls the specified Titanium SDK.
 * @memberof SdkSubcommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
SdkSubcommands.uninstall = {
	alias: 'rm',
	conf(_logger, _config, _cli) {
		return {
			desc: 'uninstall a specific Titanium SDK versions',
			args: [
				{
					desc: 'one or more SDK names to uninstall',
					name: 'versions',
					variadic: true
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
	async fn(logger, _config, cli) {
		const vers = version.sort(Object.keys(cli.env.sdks)).reverse();
		const { force } = cli.argv;
		let versions = cli.argv._[0] || [];

		logger.skipBanner(false);
		logger.banner();

		if (!cli.argv.prompt) {
			if (!versions.length) {
				throw new TiError('Missing <version...> argument');
			}
			if (!force) {
				throw new TiError('To uninstall a Titanium SDK in non-interactive mode, you must use --force');
			}
		}

		if (!versions.length) {
			versions = await prompt({
				type: 'multiselect',
				name: 'versions',
				message: 'Which SDKs to uninstall?',
				instructions: false,
				hint: 'Space to select. Return to submit',
				choices: vers.map(v => ({
					title: v,
					value: v
				}))
			});
			if (!versions) {
				return;
			}
			logger.log();
		}

		const found = versions.filter(v => vers.includes(v));
		const maxlen = versions.reduce((a, b) => Math.max(a, b.length), 0);

		if (!found.length) {
			for (const v of versions) {
				logger.log(` • ${cyan(v.padEnd(maxlen))}  ${cli.env.sdks[v]?.path || yellow('not found')}`);
			}
			return;
		}

		if (!force) {
			// prompt for confirmation
			logger.log(`${yellow('WARNING!')} This will permanently remove the following Titanium SDKs:\n`);
			for (const v of versions) {
				logger.log(` • ${cyan(v.padEnd(maxlen))}  ${cli.env.sdks[v]?.path || yellow('not found')}`);
			}
			logger.log();

			const confirm = await prompt({
				type: 'toggle',
				name: 'confirm',
				message: 'Proceed?',
				initial: false,
				active: 'yes',
				inactive: 'no'
			});
			if (!confirm) {
				return;
			}
			logger.log();
		}

		let busy;
		if (!cli.argv.quiet && !!cli.argv['progress-bars']) {
			busy = new BusyIndicator();
			busy.start();
		}

		let results;
		try {
			results = await Promise.allSettled(found.map(async (ver) => {
				const dir = cli.env.sdks[ver].path;
				try {
					await fs.remove(dir);
					return dir;
				} catch (e) {
					throw new TiError(`Failed to remove ${dir}`, {
						after: e.message
					});
				}
			}));
		} finally {
			busy?.stop();
		}

		for (const r of results) {
			if (r.status === 'fulfilled') {
				logger.log(` ${green('√')} ${cyan(r.value)} removed`);
			} else {
				logger.log(` ${red(`× ${r.reason}`)}`);
				if (r.reason.after) {
					logger.log(`     ${red(r.reason.after)}`);
				}
			}
		}
	}
};

/**
 * Retrieves the list of branches.
 * @returns {Promise<Branches>}
 */
async function getBranches() {
	const res = await request('https://downloads.titaniumsdk.com/registry/branches.json', {
		responseType: 'json'
	});
	return Object
		.entries(await res.body.json())
		.filter(([, count]) => count)
		.map(([name]) => name);
}

/**
 * Retrieves the list of builds for a given branch.
 * @param {String} branch - The name of the branch
 * @param {String} os - The name of the current OS (osx, linux, win32)
 * @returns {Promise<BranchBuild[]>}
 */
async function getBranchBuilds(branch, os) {
	const res = await request(`https://downloads.titaniumsdk.com/registry/${branch}.json`, {
		responseType: 'json'
	});
	const now = Date.now();
	const results = await res.body.json();
	return results.filter(b => {
		return (!b.expires || Date.parse(b.expires) > now) && b.assets.some(a => a.os === os);
	});
}
