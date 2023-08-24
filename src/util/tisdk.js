import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import fs from 'fs-extra';
import { expand } from './expand.js';
import { arrayify } from './arrayify.js';
import * as version from './version.js';
import { TiError } from './tierror.js';
import { Tiapp } from './tiapp.js';

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

export async function getTitaniumSDKPaths(config) {
	const os = process.platform === 'darwin' ? 'osx' : process.platform;
	const sdkPaths = new Set();

	for (const p of locations[os]) {
		sdkPaths.add(expand(p, 'mobilesdk', os));
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

	return Array.from(sdkPaths);
}

let cache;

export async function detectTitaniumSDKs(config) {
	if (cache) {
		return cache;
	}

	const sdkPaths = await getTitaniumSDKPaths(config);
	const sdks = [];
	let latest = null;

	await Promise.all(
		sdkPaths.map(async sdkPath => {
			try {
				const dirs = await readdir(sdkPath);
				return await Promise.all(dirs.map(async name => {
					const path = join(sdkPath, name);
					try {
						const manifest = await fs.readJson(join(path, 'manifest.json'));

						// SDKs before 3.0.0 used Python and thus not supported
						if (version.gte(manifest.version, '3.0.0')) {
							if (!latest || version.gt(manifest.version, latest)) {
								latest = manifest.version;
							}
							manifest.path = path;
							manifest.platforms = Array.isArray(manifest.platforms)
								? manifest.platforms.reduce((platforms, name) => {
									platforms[name] = {
										path: join(path, name)
									};
									return platforms;
								}, {})
								: {};
							sdks.push(manifest);
						}
					} catch {
						// no manifest (too old)
					}
				}))
			} catch {
				// directory probably does not exist, ignore
			}
		})
	);

	sdks.sort((a, b) => version.compare(b.version, a.version));

	cache = {
		latest,
		sdks,
		sdkPaths: sdkPaths.map(p => dirname(dirname(p)))
	};

	return cache;
}

export async function initSDK(cwd, selectedSdk, config, logger) {
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
	const { latest, sdks, sdkPaths } = await detectTitaniumSDKs(config);
	if (!latest) {
		throw new TiError('No Titanium SDKs found', {
			after: `You can download the latest Titanium SDK by running: ${cyan('titanium sdk install')}`
		});
	}

	// determine version to use
	sdkVersion = (Boolean(selectedSdk) === selectedSdk ? null : selectedSdk) || sdkVersion || 'latest';
	if (sdkVersion === 'latest') {
		sdkVersion = latest;
	}

	// return the specified sdk
	const sdk = sdks.find(s => s.name === sdkVersion);
	if (!sdk) {
		throw new TiError(`Titanium SDK "${sdkVersion}" not found`, {
			after: `Available SDKs:\n${sdks.map(sdk => `  ${cyan(sdk.name)}`).join('\n')}`
		});
	}

	try {
		// check if the sdk is compatible with our version of node
		sdk.packageJson = await readJson(join(sdk.path, 'package.json'));

		const current = process.versions.node;
		const required = sdk.packageJson.vendorDependencies.node;
		const supported = version.satisfies(current, required, true);

		if (supported === false) {
			throw new TiError(`Titanium SDK v${sdk.name} is incompatible with Node.js v${current}`, {
				after: `Please install Node.js ${appc.version.parseMax(required)} in order to use this version of the Titanium SDK.`
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
		sdk,
		sdkPaths
	};
}
