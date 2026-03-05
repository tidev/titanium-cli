import { arrayify } from './arrayify.js';
import { prompt } from './prompt.js';
import { detectTitaniumSDKs, TiappXML } from 'node-titanium-sdk/titanium';
import { join } from 'node:path';

const sortTypes = ['local', 'nightly', 'beta', 'rc', 'ga'];

export const typeLabels = {
	local: 'Local Build',
	nightly: 'Nightly Build',
	beta: 'Beta',
	rc: 'Release Candidate',
	ga: 'Production Stable',
};

export async function initSDK({
	config,
	cwd,
	debugLogger,
	logger,
	promptingEnabled,
	selectedSdk,
	showSDKPrompt,
}) {
	let sdkVersion;
	let tiappSdkVersion;

	// try to read the tiapp.xml
	const tiapp = new TiappXML();
	try {
		const tiappFile = join(cwd, 'tiapp.xml');
		await tiapp.load(tiappFile);
		debugLogger.trace(`Loaded ${tiappFile}`);
		sdkVersion = tiappSdkVersion = await tiapp.select1('//sdk-version', 'latest');
		debugLogger.trace(
			`<sdk-version> is ${tiappSdkVersion ? `set to ${tiappSdkVersion}` : 'undefined'}`
		);
	} catch {
		// might not be a project dir or bad tiapp.xml
	}

	const configSdkPaths = config.get('paths.sdks');

	// detect SDKs
	const { installPath, latest, sdks, sdkPaths } = await detectTitaniumSDKs({
		searchPaths: [
			config.get('sdk.defaultInstallLocation'),
			...(Array.isArray(configSdkPaths) ? arrayify(configSdkPaths, true) : []),
		],
	});
	let sdk = null;

	if (Object.keys(sdks).length) {
		// determine version to use
		sdkVersion =
			(Boolean(selectedSdk) === selectedSdk ? null : selectedSdk) || sdkVersion || 'latest';
		if (sdkVersion === 'latest') {
			sdkVersion = latest;
		}

		sdk = sdks[sdkVersion];

		if (promptingEnabled && ((selectedSdk && !sdk) || showSDKPrompt)) {
			logger.banner();

			const sdkTypes = {};
			for (const s of Object.values(sdks)) {
				if (!sdkTypes[s.type]) {
					sdkTypes[s.type] = [];
				}
				sdkTypes[s.type].push(s.name);
			}

			const choices = [];
			for (const t of Object.keys(sdkTypes)
				.sort((a, b) => sortTypes.indexOf(b) - sortTypes.indexOf(a))
				.reverse()) {
				for (const s of sdkTypes[t]) {
					choices.push({ label: s, value: s, description: typeLabels[t] });
				}
			}

			sdkVersion = await prompt({
				type: 'select',
				message: 'Which Titanium SDK would you like to use?',
				initial: sdk ? choices.find((s) => s.value === sdk.name)?.value : undefined,
				choices,
			});

			if (sdkVersion === undefined) {
				// sigint
				process.exit(0);
			}

			logger.log();

			sdk = sdks[sdkVersion];
		}
	}

	return {
		installPath: config.get('sdk.defaultInstallLocation') || installPath,
		sdk,
		sdkPaths,
		sdks: Object.values(sdks).reduce((obj, sdk) => {
			obj[sdk.name] = sdk;
			return obj;
		}, {}),
		tiappSdkVersion,
	};
}
