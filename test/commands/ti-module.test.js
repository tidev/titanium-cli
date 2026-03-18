import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('ti module', () => {
	it(
		'should show help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['module', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium module \[options\] \[command\]/);
			expect(output).toMatch(/Commands:/);
			expect(output).toMatch(/Module Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should show list help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['module', 'list', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium module list|ls/);
			expect(output).toMatch(/List Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should list no installed modules',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['module']);

			const output = stripColor(stdout);
			expect(output).toMatch(/No modules found/);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should list no installed modules as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['module', '--json']);

			const json = JSON.parse(stdout);
			expect(json).toEqual({});
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should list installed modules',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run([
				'module',
				'--config',
				JSON.stringify({
					paths: {
						modules: [join(fixturesDir, 'modules')],
					},
				}),
			]);

			const output = stripColor(stdout);
			expect(output).toMatch(
				output,
				new RegExp(`com.test.module
  Android
    1.0.0
      Path          = ${join(fixturesDir, 'modules', 'android', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}
      Author        = Your Name
      Description   = testModule
      Titanium SDK  = >=7.2.0

  CommonJS
    1.0
      Path          = ${join(fixturesDir, 'modules', 'commonjs', 'invalid-version', '1.0.1').replace(/\\/g, '\\\\')}
      Author        = Your Name
      Description   = testModule
      Titanium SDK  = >=7.2.0

    1.0.0
      Path          = ${join(fixturesDir, 'modules', 'commonjs', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}
      Author        = Your Name
      Description   = testModule
      Titanium SDK  = >=7.2.0

  iOS
    1.0.0
      Path          = ${join(fixturesDir, 'modules', 'iphone', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}
      Author        = Your Name
      Description   = testModule
      Titanium SDK  = >=7.2.0

  Windows
    1.0.0
      Path          = ${join(fixturesDir, 'modules', 'windows', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}
      Author        = Your Name
      Description   = testModule
      Titanium SDK  = >=7.2.0`)
			);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should list installed modules as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run([
				'module',
				'--config',
				JSON.stringify({
					paths: {
						modules: [join(fixturesDir, 'modules')],
					},
				}),
				'--json',
			]);

			const json = JSON.parse(stdout);
			expect(json).toEqual({
				'com.test.module': {
					android: {
						'1.0.0': {
							apiversion: 4,
							architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
							author: 'Your Name',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'testModule',
							guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
							license: 'Specify your license',
							minsdk: '7.2.0',
							moduleid: 'com.test.module',
							name: 'testModule',
							path: join(fixturesDir, 'modules', 'android', 'test-module', '1.0.0'),
							platform: 'android',
							version: '1.0.0',
						},
					},
					commonjs: {
						'1.0': {
							author: 'Your Name',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'testModule',
							guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
							license: 'Specify your license',
							minsdk: '7.2.0',
							moduleid: 'com.test.module',
							name: 'testModule',
							path: join(fixturesDir, 'modules', 'commonjs', 'invalid-version', '1.0.1'),
							platform: 'commonjs',
							version: '1.0',
						},
						'1.0.0': {
							author: 'Your Name',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'testModule',
							guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
							license: 'Specify your license',
							minsdk: '7.2.0',
							moduleid: 'com.test.module',
							name: 'testModule',
							path: join(fixturesDir, 'modules', 'commonjs', 'test-module', '1.0.0'),
							platform: 'commonjs',
							version: '1.0.0',
						},
					},
					ios: {
						'1.0.0': {
							apiversion: 2,
							architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
							author: 'Your Name',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'testModule',
							guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
							license: 'Specify your license',
							minsdk: '7.2.0',
							moduleid: 'com.test.module',
							name: 'testModule',
							path: join(fixturesDir, 'modules', 'iphone', 'test-module', '1.0.0'),
							platform: 'ios',
							version: '1.0.0',
						},
					},
					windows: {
						'1.0.0': {
							apiversion: 4,
							architectures: ['ARM', 'x86'],
							author: 'Your Name',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'testModule',
							guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
							license: 'Specify your license',
							minsdk: '7.2.0',
							moduleid: 'com.test.module',
							name: 'testModule',
							path: join(fixturesDir, 'modules', 'windows', 'test-module', '1.0.0'),
							platform: 'windows',
							version: '1.0.0',
						},
					},
				},
			});

			expect(exitCode).toBe(0);
		})
	);

	// it(
	// 	'should install module during detection',
	// 	initCLI(async ({ run }) => {
	// 		const { exitCode, _stdout } = await run(['module']);

	// 		assert.strictEqual(exitCode, 0);
	// 	})
	// );
});
