import { describe, expect, it } from 'vitest';
import { detect } from '../../src/util/timodule.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiConfig } from '../../src/util/ticonfig.js';
import fs from 'fs-extra';
import { tmpdir } from 'node:os';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/timodule');
const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('timodule', () => {
	it('should find nothing if no search paths', async () => {
		let results = await detect();
		expect(results).toEqual({});

		results = await detect(null);
		expect(results).toEqual({});

		results = await detect({});
		expect(results).toEqual({});

		results = await detect(
			{ global: null },
			new TiConfig(goodConfig)
		);
		expect(results).toEqual({});
	});

	it('should find nothing if search path is empty', async () => {
		const results = await detect(
			{ empty: join(fixturesDir, 'empty') },
			new TiConfig(goodConfig)
		);
		expect(results).toEqual({
			empty: {}
		});
	});

	it('should find modules in a search path', async () => {
		const tmpModulesDir = join(tmpdir(), `titanium-cli-${Math.floor(Math.random() * 1e6)}`);
		try {
			await fs.copy(join(fixturesDir, 'modules'), tmpModulesDir);

			const results = await detect(
				{ global: tmpModulesDir },
				new TiConfig(goodConfig)
			);

			expect(results).toHaveProperty('global');
			expect(results.global).toHaveProperty('android');
			expect(results.global).toHaveProperty('commonjs');
			expect(results.global).toHaveProperty('ios');

			expect(results.global.android).toHaveProperty('com.test.module');
			let mod = results.global.android['com.test.module'];
			expect(mod).toHaveProperty('1.0.0');
			expect(mod['1.0.0']).toHaveProperty('version', '1.0.0');
			expect(mod['1.0.0']).toHaveProperty('platform', ['android']);
			expect(mod['1.0.0']).toHaveProperty('manifest', {
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

			expect(results.global.commonjs).toHaveProperty('com.test.module');
			mod = results.global.commonjs['com.test.module'];
			expect(mod).toHaveProperty('1.0.0');
			expect(mod['1.0.0']).toHaveProperty('version', '1.0.0');
			expect(mod['1.0.0']).toHaveProperty('platform', ['commonjs']);
			expect(mod['1.0.0']).toHaveProperty('manifest', {
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

			expect(mod).toHaveProperty('1.0');
			expect(mod['1.0']).toHaveProperty('version', '1.0');
			expect(mod['1.0']).toHaveProperty('platform', ['commonjs']);
			expect(mod['1.0']).toHaveProperty('manifest', {
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

			expect(results.global.ios).toHaveProperty('com.test.module');
			mod = results.global.ios['com.test.module'];
			expect(mod).toHaveProperty('1.0.0');
			expect(mod['1.0.0']).toHaveProperty('version', '1.0.0');
			expect(mod['1.0.0']).toHaveProperty('platform', ['ios']);
			expect(mod['1.0.0']).toHaveProperty('manifest', {
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
	});
});
