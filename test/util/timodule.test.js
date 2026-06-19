import { describe, it, expect } from 'vitest';
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
		expect(results).toEqual({});

		results = await detect(null);
		expect(results).toEqual({});

		results = await detect({});
		expect(results).toEqual({});

		results = await detect(
			{ global: null },
			new TiConfig(goodConfig)
		);
		expect(results).toEqual({
			global: {}
		});
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
		const tmpModulesDir = join(tmpDirName(), 'modules');
		try {
			await fs.copy(join(fixturesDir, 'modules'), tmpModulesDir);

			const results = await detect(
				{ global: tmpModulesDir },
				new TiConfig(goodConfig)
			);

			expect(Object.hasOwn(results, 'global')).toBe(true);
			expect(Object.hasOwn(results.global, 'android')).toBe(true);
			expect(Object.hasOwn(results.global, 'commonjs')).toBe(true);
			expect(Object.hasOwn(results.global, 'ios')).toBe(true);

			expect(Object.hasOwn(results.global.android, 'com.test.module')).toBe(true);
			let mod = results.global.android['com.test.module'];
			expect(Object.hasOwn(mod, '1.0.0')).toBe(true);
			expect(Object.hasOwn(mod['1.0.0'], 'version')).toBe(true);
			expect(mod['1.0.0'].version).toBe('1.0.0');
			expect(Object.hasOwn(mod['1.0.0'], 'platform')).toBe(true);
			expect(mod['1.0.0'].platform).toEqual(['android']);
			expect(Object.hasOwn(mod['1.0.0'], 'manifest')).toBe(true);
			expect(mod['1.0.0'].manifest).toEqual({
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

			expect(Object.hasOwn(results.global.commonjs, 'com.test.module')).toBe(true);
			mod = results.global.commonjs['com.test.module'];
			expect(Object.hasOwn(mod, '1.0.0')).toBe(true);
			expect(Object.hasOwn(mod['1.0.0'], 'version')).toBe(true);
			expect(mod['1.0.0'].version).toBe('1.0.0');
			expect(Object.hasOwn(mod['1.0.0'], 'platform')).toBe(true);
			expect(mod['1.0.0'].platform).toEqual(['commonjs']);
			expect(Object.hasOwn(mod['1.0.0'], 'manifest')).toBe(true);
			expect(mod['1.0.0'].manifest).toEqual({
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

			expect(Object.hasOwn(mod, '1.0')).toBe(true);
			expect(Object.hasOwn(mod['1.0'], 'version')).toBe(true);
			expect(mod['1.0'].version).toBe('1.0');
			expect(Object.hasOwn(mod['1.0'], 'platform')).toBe(true);
			expect(mod['1.0'].platform).toEqual(['commonjs']);
			expect(Object.hasOwn(mod['1.0'], 'manifest')).toBe(true);
			expect(mod['1.0'].manifest).toEqual({
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

			expect(Object.hasOwn(results.global.ios, 'com.test.module')).toBe(true);
			mod = results.global.ios['com.test.module'];
			expect(Object.hasOwn(mod, '1.0.0')).toBe(true);
			expect(Object.hasOwn(mod['1.0.0'], 'version')).toBe(true);
			expect(mod['1.0.0'].version).toBe('1.0.0');
			expect(Object.hasOwn(mod['1.0.0'], 'platform')).toBe(true);
			expect(mod['1.0.0'].platform).toEqual(['ios']);
			expect(Object.hasOwn(mod['1.0.0'], 'manifest')).toBe(true);
			expect(mod['1.0.0'].manifest).toEqual({
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
