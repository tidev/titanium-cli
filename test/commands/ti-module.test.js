import { describe, it, expect } from 'vitest';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('ti module', () => {
	it('should show help', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['module', '-h']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Titanium Command-Line Interface/);
		expect(output).toMatch(/Usage: titanium module \[options\] \[command\]/);
		expect(output).toMatch(/Commands:/);
		expect(output).toMatch(/Module Options:/);
		expect(output).toMatch(/Global Options:/);

		expect(exitCode).toBe(0);
	}));

	it('should show list help', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['module', 'list', '-h']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Titanium Command-Line Interface/);
		expect(output).toMatch(/Usage: titanium module list|ls/);
		expect(output).toMatch(/List Options:/);
		expect(output).toMatch(/Global Options:/);

		expect(exitCode).toBe(0);
	}));

	it('should list no installed modules', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['module']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Configured Path Modules/);
		expect(output).toMatch(/Global Modules/);

		expect(exitCode).toBe(0);
	}));

	it('should list no installed modules as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['module', '--json']);

		const json = JSON.parse(stdout);
		expect(json).toEqual({
			project: {},
			config: {},
			global: {}
		});

		expect(exitCode).toBe(0);
	}));

	it('should list installed modules', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run([
			'module',
			'--config',
			JSON.stringify({
				paths: {
					modules: [
						join(fixturesDir, 'module')
					]
				}
			})
		]);

		const output = stripColor(stdout);
		expect(output).toMatch(new RegExp(`Configured Path Modules
  Android
    com.test.module
      1.0.0   ${join(fixturesDir, 'module', 'android', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}

  CommonJS
    com.test.module
      1.0     ${join(fixturesDir, 'module', 'commonjs', 'invalid-version', '1.0.1').replace(/\\/g, '\\\\')}
      1.0.0   ${join(fixturesDir, 'module', 'commonjs', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}

  iOS
    com.test.module
      1.0.0   ${join(fixturesDir, 'module', 'iphone', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}

  Windows
    com.test.module
      1.0.0   ${join(fixturesDir, 'module', 'windows', 'test-module', '1.0.0').replace(/\\/g, '\\\\')}

Global Modules
  No modules found`));

		expect(exitCode).toBe(0);
	}));

	it('should list installed modules as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run([
			'module',
			'--config',
			JSON.stringify({
				paths: {
					modules: [
						join(fixturesDir, 'module')
					]
				}
			}),
			'--json'
		]);

		const json = JSON.parse(stdout);
		expect(json).toEqual({
			project: {},
			config: {
				android: {
					'com.test.module': {
						'1.0.0': {
							version: '1.0.0',
							modulePath: join(fixturesDir, 'module', 'android', 'test-module', '1.0.0'),
							manifest: {
								version: '1.0.0',
								apiversion: 4,
								architectures: [
									'arm64-v8a',
									'armeabi-v7a',
									'x86'
								],
								description: 'testModule',
								author: 'Your Name',
								license: 'Specify your license',
								copyright: 'Copyright (c) 2018 by Your Company',
								name: 'testModule',
								moduleid: 'com.test.module',
								guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
								platform: 'android',
								minsdk: '7.2.0'
							},
							platform: [
								'android'
							]
						}
					}
				},
				commonjs: {
					'com.test.module': {
						'1.0': {
							version: '1.0',
							modulePath: join(fixturesDir, 'module', 'commonjs', 'invalid-version', '1.0.1'),
							manifest: {
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
							},
							platform: [
								'commonjs'
							]
						},
						'1.0.0': {
							version: '1.0.0',
							modulePath: join(fixturesDir, 'module', 'commonjs', 'test-module', '1.0.0'),
							manifest: {
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
							},
							platform: [
								'commonjs'
							]
						}
					}
				},
				ios: {
					'com.test.module': {
						'1.0.0': {
							version: '1.0.0',
							modulePath: join(fixturesDir, 'module', 'iphone', 'test-module', '1.0.0'),
							manifest: {
								version: '1.0.0',
								apiversion: 2,
								architectures: [
									'armv7',
									'arm64',
									'i386',
									'x86_64'
								],
								description: 'testModule',
								author: 'Your Name',
								license: 'Specify your license',
								copyright: 'Copyright (c) 2018 by Your Company',
								name: 'testModule',
								moduleid: 'com.test.module',
								guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
								platform: 'ios',
								minsdk: '7.2.0'
							},
							platform: [
								'ios'
							]
						}
					}
				},
				windows: {
					'com.test.module': {
						'1.0.0': {
							version: '1.0.0',
							modulePath: join(fixturesDir, 'module', 'windows', 'test-module', '1.0.0'),
							manifest: {
								version: '1.0.0',
								apiversion: 4,
								architectures: [
									'ARM',
									'x86'
								],
								description: 'testModule',
								author: 'Your Name',
								license: 'Specify your license',
								copyright: 'Copyright (c) 2018 by Your Company',
								name: 'testModule',
								moduleid: 'com.test.module',
								guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
								platform: 'windows',
								minsdk: '7.2.0'
							},
							platform: [
								'windows'
							]
						}
					}
				}
			},
			global: {}
		});

		expect(exitCode).toBe(0);
	}));

	it('should install module during detection', initCLI(async ({ run }) => {
		const { exitCode, _stdout } = await run(['module']);

		expect(exitCode).toBe(0);
	}));
});
