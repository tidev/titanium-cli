import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import fs from 'fs-extra';
import { expand } from './expand.js';
import { arrayify } from './arrayify.js';
import * as version from './version.js';
import { TiError } from './tierror.js';
import { Tiapp } from './tiapp.js';
import chalk from 'chalk';
import { request } from './request.js';
import { prompt } from './prompt.js';

const { cyan, gray } = chalk;

export const locations = {
	linux: [
		'~/.titanium'
	],
	osx: [
		'~/Library/Application Support/Titanium',
		'/Library/Application Support/Titanium'
	],
	win32: [
		'%ProgramData%\\Titanium',
		'%APPDATA%\\Titanium'
	]
};

const os = process.platform === 'darwin' ? 'osx' : process.platform;

export async function getTitaniumSDKPaths(config) {
	const sdkPaths = new Set();

	for (const p of locations[os]) {
		sdkPaths.add(expand(p));
	}

	const defaultInstallLocation = config.get('sdk.defaultInstallLocation');
	if (defaultInstallLocation) {
		sdkPaths.add(expand(defaultInstallLocation));
	}

	let configSdkPaths = config.get('paths.sdks');
	if (configSdkPaths) {
		for (const p of arrayify(configSdkPaths, true)) {
			sdkPaths.add(expand(p));
		}
	}

	return {
		defaultInstallLocation,
		sdkPaths: Array.from(sdkPaths)
	};
}

let cache;

export async function detectTitaniumSDKs(config) {
	if (cache) {
		return cache;
	}

	let {
		defaultInstallLocation,
		sdkPaths
	} = await getTitaniumSDKPaths(config);
	const sdks = [];

	await Promise.all(
		sdkPaths.map(async sdkPath => {
			if (basename(sdkPath) !== os && basename(dirname(sdkPath)) !== 'mobilesdk') {
				sdkPath = join(sdkPath, 'mobilesdk', os);
			}

			try {
				const dirs = await readdir(sdkPath);

				return await Promise.all(dirs.map(async name => {
					const path = join(sdkPath, name);
					try {
						const manifest = await fs.readJson(join(path, 'manifest.json'));

						// SDKs before 3.0.0 used Python and thus not supported
						if (version.gte(manifest.version, '3.0.0')) {
							sdks.push({
								name: manifest.name,
								manifest,
								path,
								platforms: Array.isArray(manifest.platforms)
									? manifest.platforms.reduce((platforms, name) => {
										platforms[name] = {
											path: join(path, name)
										};
										return platforms;
									}, {})
									: {},
								type: getSDKType(manifest.name),
								version: manifest.version
							});
						}
					} catch {
						// no manifest (too old)
					}
				}));
			} catch {
				// directory probably does not exist, ignore
			}
		})
	);

	sdks.sort((a, b) => version.compare(a.name, b.name)).reverse();

	cache = {
		installPath: defaultInstallLocation || sdkPaths[0],
		latest: sdks.find(s => /.GA$/.test(s.name))?.name || sdks[0]?.name || null,
		sdks,
		sdkPaths
	};

	return cache;
}

function getSDKType(name) {
	if (/.ga$/i.test(name)) {
		return 'ga';
	}
	if (/.rc$/i.test(name)) {
		return 'rc';
	}
	if (/.beta$/i.test(name)) {
		return 'beta';
	}
	return 'unsupported';
}

const sortTypes = ['unsupported', 'beta', 'rc', 'ga'];

export async function initSDK({ cmdName, config, cwd, logger, promptingEnabled, selectedSdk }) {
	let sdkVersion;

	// try to read the tiapp.xml
	let tiapp = new Tiapp();
	try {
		await tiapp.load(join(cwd, 'tiapp.xml'));
		sdkVersion = tiapp.select1('//sdk-version', 'latest');
	} catch {
		// might not be a project dir or bad tiapp.xml
	}

	// detect sdks
	const {
		installPath,
		latest,
		sdks,
		sdkPaths
	} = await detectTitaniumSDKs(config);

	if (!sdks.length) {
		throw new TiError('No Titanium SDKs found', {
			after: `You can download the latest Titanium SDK by running: ${cyan('titanium sdk install')}`
		});
	}

	// determine version to use
	sdkVersion = (Boolean(selectedSdk) === selectedSdk ? null : selectedSdk) || sdkVersion || 'latest';
	if (sdkVersion === 'latest') {
		sdkVersion = latest;
	}

	let sdk = sdks.find(s => s.name === sdkVersion);

	const typeLabels = {
		unsupported: 'Unsupported',
		beta: 'Beta',
		rc: 'Release Candidate',
		ga: 'Production Stable'
	};

	// this is a hack... if this is the create command, prompt for
	if (promptingEnabled && ((selectedSdk && !sdk) || (!selectedSdk && cmdName === 'create'))) {
		logger.banner();

		const sdkTypes = {};
		for (const s of sdks) {
			if (!sdkTypes[s.type]) {
				sdkTypes[s.type] = [];
			}
			sdkTypes[s.type].push(s.name);
		}

		const choices = [];
		for (const t of Object.keys(sdkTypes).sort((a, b) => sortTypes.indexOf(b) - sortTypes.indexOf(a))) {
			for (const s of sdkTypes[t]) {
				choices.push({ label: s, value: s, description: typeLabels[t] });
			}
		}

		({ sdkVersion } = await prompt({
			type: 'select',
			message: 'Which Titanium SDK would you like to use?',
			name: 'sdkVersion',
			initial: sdk ? choices.find(s => s.name === sdk.name)?.name : undefined,
			choices
		}));

		if (sdkVersion === undefined) {
			// sigint
			process.exit(0);
		}

		sdk = sdks.find(s => s.name === sdkVersion);
	}

	// return the specified sdk
	if (!sdk) {
		throw new TiError(`Titanium SDK "${sdkVersion}" not found`, {
			after: `Available SDKs:\n${sdks.map(sdk => `  ${cyan(sdk.name.padEnd(24))} ${gray(typeLabels[sdk.type])}`).join('\n')}`
		});
	}

	try {
		// check if the sdk is compatible with our version of node
		sdk.packageJson = await fs.readJson(join(sdk.path, 'package.json'));

		const current = process.versions.node;
		const required = sdk.packageJson.vendorDependencies.node;
		const supported = version.satisfies(current, required, true);

		if (supported === false) {
			throw new TiError(`Titanium SDK v${sdk.name} is incompatible with Node.js v${current}`, {
				after: `Please install Node.js ${version.parseMax(required)} in order to use this version of the Titanium SDK.`
			});
		}

		if (supported === 'maybe' && !config.get('cli.hideNodejsWarning')) {
			logger.on('cli:logger-banner', function () {
				logger.warn(`Support for Node.js v${current} has not been verified for Titanium SDK ${sdk.name}`);
				logger.warn(`If you run into issues, try downgrading to Node.js v${required}`);
			});
		}
	} catch (e) {
		// do nothing
	}

	return {
		installPath,
		sdk,
		sdkPaths,
		sdks: sdks.reduce((obj, sdk) => {
			obj[sdk.name] = sdk;
			return obj;
		}, {})
	};
}

/**
 * Retrieves the list of releases.
 * @param {String} os - The name of the OS (osx, linux, win32)
 * @param {Boolean} [unstable] - When `true`, returns beta and rc releases along with ga releases.
 * @returns {Promise<Release[]>}
 */
export async function getReleases(unstable) {
	const releaseRE = /^(\d+)\.(\d+)\.(\d+)\.(\w+)$/;

	const fetches = [
		unstable && request('https://downloads.titaniumsdk.com/registry/beta.json', {
			responseType: 'json'
		}).then(async res => ({ type: 'beta', releases: await res.body.json() })),

		unstable && request('https://downloads.titaniumsdk.com/registry/rc.json', {
			responseType: 'json'
		}).then(async res => ({ type: 'rc', releases: await res.body.json() })),

		request('https://downloads.titaniumsdk.com/registry/ga.json', {
			responseType: 'json'
		}).then(async res => ({ type: 'ga', releases: await res.body.json() }))
	];

	const results = await Promise.allSettled(fetches);

	return results
		.flatMap(r => {
			return r.status === 'fulfilled' && r.value ? r.value.releases.map(rel => {
				rel.type = r.value.type;
				return rel;
			}) : [];
		})
		.filter(r => r.assets.some(a => a.os === os))
		.sort((a, b) => {
			const [, amajor, aminor, apatch, atag] = a.name.toLowerCase().match(releaseRE);
			const [, bmajor, bminor, bpatch, btag] = b.name.toLowerCase().match(releaseRE);

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

			return sortTypes.indexOf(btag) - sortTypes.indexOf(atag);
		});
}
