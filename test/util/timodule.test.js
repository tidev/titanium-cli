import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detect } from '../../src/util/timodule.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiConfig } from '../../src/util/ticonfig.js';
import fs from 'fs-extra';
import { tmpDirName } from '../helpers/tmp-dir-name.js';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/timodule');
const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('timodule', () => {
	it('should find nothing if no search paths', async () => {
		let results = await detect();
		assert.deepStrictEqual(results, {});

		results = await detect(null);
		assert.deepStrictEqual(results, {});

		results = await detect({});
		assert.deepStrictEqual(results, {});

		results = await detect(
			{ global: null },
			new TiConfig(goodConfig)
		);
		assert.deepStrictEqual(results, {
			global: {}
		});
	});

	it('should find nothing if search path is empty', async () => {
		const results = await detect(
			{ empty: join(fixturesDir, 'empty') },
			new TiConfig(goodConfig)
		);
		assert.deepStrictEqual(results, {
			empty: {}
		});
	});

	it('should find modules in a search path', async () => {
		const tmpModulesDir = join(tmpDirName(), 'modules');
		try {
			await fs.copy(join(fixturesDir, 'modules'), tmpModulesDir);

			const results = await detect(
				{ global: tmpModulesDir },
				new TiConfig(goodConfig)
			);

			assert(Object.hasOwn(results, 'global'));
			assert(Object.hasOwn(results.global, 'android'));
			assert(Object.hasOwn(results.global, 'commonjs'));
			assert(Object.hasOwn(results.global, 'ios'));

			assert(Object.hasOwn(results.global.android, 'com.test.module'));
			let mod = results.global.android['com.test.module'];
			assert(Object.hasOwn(mod, '1.0.0'));
			assert(Object.hasOwn(mod['1.0.0'], 'version'));
			assert.strictEqual(mod['1.0.0'].version, '1.0.0');
			assert(Object.hasOwn(mod['1.0.0'], 'platform'));
			assert.deepStrictEqual(mod['1.0.0'].platform, ['android']);
			assert(Object.hasOwn(mod['1.0.0'], 'manifest'));
			assert.deepStrictEqual(mod['1.0.0'].manifest, {
				version: '1.0.0',
				apiversion: 4,
				architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
				description: 'testModule',
				author: 'Your Name',
				license: 'Specify your license',
				copyright: 'Copyright (c) 2018 by Your Company',
				name: 'testModule',
				moduleid: 'com.test.module',
				guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
				platform: 'android',
				minsdk: '7.2.0'
			});

			assert(Object.hasOwn(results.global.commonjs, 'com.test.module'));
			mod = results.global.commonjs['com.test.module'];
			assert(Object.hasOwn(mod, '1.0.0'));
			assert(Object.hasOwn(mod['1.0.0'], 'version'));
			assert.strictEqual(mod['1.0.0'].version, '1.0.0');
			assert(Object.hasOwn(mod['1.0.0'], 'platform'));
			assert.deepStrictEqual(mod['1.0.0'].platform, ['commonjs']);
			assert(Object.hasOwn(mod['1.0.0'], 'manifest'));
			assert.deepStrictEqual(mod['1.0.0'].manifest, {
				version: '1.0.0',
				description: 'testModule',
				author: 'Your Name',
				license: 'Specify your license',
				copyright: 'Copyright (c) 2018 by Your Company',
				name: 'testModule',
				moduleid: 'com.test.module',
				guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
				platform: 'commonjs',
				minsdk: '7.2.0'
			});

			assert(Object.hasOwn(mod, '1.0'));
			assert(Object.hasOwn(mod['1.0'], 'version'));
			assert.strictEqual(mod['1.0'].version, '1.0');
			assert(Object.hasOwn(mod['1.0'], 'platform'));
			assert.deepStrictEqual(mod['1.0'].platform, ['commonjs']);
			assert(Object.hasOwn(mod['1.0'], 'manifest'));
			assert.deepStrictEqual(mod['1.0'].manifest, {
				version: '1.0',
				description: 'testModule',
				author: 'Your Name',
				license: 'Specify your license',
				copyright: 'Copyright (c) 2018 by Your Company',
				name: 'testModule',
				moduleid: 'com.test.module',
				guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
				platform: 'commonjs',
				minsdk: '7.2.0'
			});

			assert(Object.hasOwn(results.global.ios, 'com.test.module'));
			mod = results.global.ios['com.test.module'];
			assert(Object.hasOwn(mod, '1.0.0'));
			assert(Object.hasOwn(mod['1.0.0'], 'version'));
			assert.strictEqual(mod['1.0.0'].version, '1.0.0');
			assert(Object.hasOwn(mod['1.0.0'], 'platform'));
			assert.deepStrictEqual(mod['1.0.0'].platform, ['ios']);
			assert(Object.hasOwn(mod['1.0.0'], 'manifest'));
			assert.deepStrictEqual(mod['1.0.0'].manifest, {
				version: '1.0.0',
				apiversion: 2,
				architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
				description: 'testModule',
				author: 'Your Name',
				license: 'Specify your license',
				copyright: 'Copyright (c) 2018 by Your Company',
				name: 'testModule',
				moduleid: 'com.test.module',
				guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
				platform: 'ios',
				minsdk: '7.2.0'
			});
		} finally {
			await fs.remove(tmpModulesDir);
		}
	}, 60000);
});
