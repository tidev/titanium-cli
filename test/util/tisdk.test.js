import { describe, it, expect } from 'vitest';
import { getTitaniumSDKPaths } from '../../src/util/tisdk.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiConfig } from '../../src/util/ticonfig.js';
import { tmpDirName } from '../helpers/tmp-dir-name.js';
import fs from 'fs-extra';

const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('tisdk', () => {
	it('should get user SDK paths', async () => {
		const tmpSDKDir = tmpDirName();
		const config = new TiConfig(goodConfig);

		try {
			let result = await getTitaniumSDKPaths(config);
			expect(result).toEqual({
				defaultInstallLocation: undefined,
				sdkPaths: []
			});

			config.set('paths.sdks', tmpSDKDir);
			config.set('sdk.defaultInstallLocation', tmpSDKDir);

			result = await getTitaniumSDKPaths(config);
			expect(result).toEqual({
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
