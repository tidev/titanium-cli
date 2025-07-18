import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getTitaniumSDKPaths } from '../../src/util/tisdk.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiConfig } from '../../src/util/ticonfig.js';
import { tmpDirName } from '../helpers/tmp-dir-name.js';
import fs from 'fs-extra';

const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('tisdk', () => {
	it('should get user sdk paths', async () => {
		const tmpSDKDir = tmpDirName();
		const config = new TiConfig(goodConfig);

		try {
			let result = await getTitaniumSDKPaths(config);
			assert.deepStrictEqual(result, {
				defaultInstallLocation: undefined,
				sdkPaths: []
			});

			config.set('paths.sdks', tmpSDKDir);
			config.set('sdk.defaultInstallLocation', tmpSDKDir);

			result = await getTitaniumSDKPaths(config);
			assert.deepStrictEqual(result, {
				defaultInstallLocation: tmpSDKDir,
				sdkPaths: [tmpSDKDir]
			});
		} finally {
			await fs.remove(tmpSDKDir);
		}
	});

	// detectTitaniumSDKs

	// initSDK
});
