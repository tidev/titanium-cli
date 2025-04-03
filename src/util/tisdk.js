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

	if (!process.env.TI_CLI_SKIP_ENV_PATHS) {
		for (const p of locations[os]) {
			sdkPaths.add(expand(p));
		}
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
	if (/\.ga$/i.test(name)) {
		return 'ga';
	}
	if (/\.rc$/i.test(name)) {
		return 'rc';
	}
	if (/\.beta$/i.test(name)) {
		return 'beta';
	}
	if (/\.v\d+$/i.test(name)) {
		return 'nightly';
	}
	return 'local';
}

const sortTypes = ['local', 'nightly', 'beta', 'rc', 'ga'];

export const typeLabels = {
	local: 'Local Build',
	nightly: 'Nightly Build',
	beta: 'Beta',
	rc: 'Release Candidate',
	ga: 'Production Stable'
};

export async function initSDK({ config, cwd, debugLogger, logger, promptingEnabled, selectedSdk, showSDKPrompt }) {
	let sdkVersion;
	let tiappSdkVersion;

	// try to read the tiapp.xml
	let tiapp = new Tiapp();
	try {
		const tiappFile = join(cwd, 'tiapp.xml');
		await tiapp.load(tiappFile);
		debugLogger.trace(`Loaded ${tiappFile}`);
		sdkVersion = tiappSdkVersion = await tiapp.select1('//sdk-version', 'latest');
		debugLogger.trace(`<sdk-version> is ${tiappSdkVersion ? `set to ${tiappSdkVersion}` : 'undefined'}`);
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
	let sdk = null;

	if (sdks.length) {
		// determine version to use
		sdkVersion = (Boolean(selectedSdk) === selectedSdk ? null : selectedSdk) || sdkVersion || 'latest';
		if (sdkVersion === 'latest') {
			sdkVersion = latest;
		}

		sdk = sdks.find(s => s.name === sdkVersion);

		if (promptingEnabled && ((selectedSdk && !sdk) || showSDKPrompt)) {
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

			sdkVersion = await prompt({
				type: 'select',
				message: 'Which Titanium SDK would you like to use?',
				initial: sdk ? choices.find(s => s.name === sdk.name)?.name : undefined,
				choices
			});

			if (sdkVersion === undefined) {
				// sigint
				process.exit(0);
			}

			logger.log();

			sdk = sdks.find(s => s.name === sdkVersion);
		}
	}

	return {
		installPath,
		sdk,
		sdkPaths,
		sdks: sdks.reduce((obj, sdk) => {
			obj[sdk.name] = sdk;
			return obj;
		}, {}),
		tiappSdkVersion
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

	const results = await Promise.all(fetches);

	return results
		.flatMap(value => {
			return value ? value.releases.map(rel => {
				rel.type = value.type;
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
