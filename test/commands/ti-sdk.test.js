import { initCLI } from '../helpers/init-cli.js';
import { initSDKHome, initMockSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';
import { exists } from 'node-titanium-sdk/util';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/sdk');
const sdkName = '12.2.0.GA';
const sdkVersion = '12.2.0';
const os = process.platform === 'darwin' ? 'osx' : process.platform;
const sdkFilename = `mobilesdk-${sdkName}-${os}.zip`;
const platforms = ['android'];
if (process.platform === 'darwin') {
	platforms.unshift('iphone');
}

describe('ti sdk', () => {
	describe('help', () => {
		it(
			'should show help',
			initCLI(async ({ run }) => {
				const { exitCode, stdout } = await run(['sdk', '-h']);

				const output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(/Usage: titanium sdk/);
				expect(output).toMatch(/Commands:/);
				expect(output).toMatch(/SDK Options:/);
				expect(output).toMatch(/Global Options:/);

				expect(exitCode).toBe(0);
			})
		);

		it(
			'should show install help',
			initCLI(async ({ run }) => {
				const { exitCode, stdout } = await run(['sdk', 'install', '-h']);

				const output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(/Usage: titanium sdk install|i/);
				expect(output).toMatch(/Install Arguments:/);
				expect(output).toMatch(/Install Options:/);
				expect(output).toMatch(/Global Options:/);

				expect(exitCode).toBe(0);
			})
		);

		it(
			'should show list help',
			initCLI(async ({ run }) => {
				const { exitCode, stdout } = await run(['sdk', 'list', '-h']);

				const output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(/Usage: titanium sdk list|ls/);
				expect(output).toMatch(/List Options:/);
				expect(output).toMatch(/Global Options:/);

				expect(exitCode).toBe(0);
			})
		);

		it(
			'should show uninstall help',
			initCLI(async ({ run }) => {
				const { exitCode, stdout } = await run(['sdk', 'uninstall', '-h']);

				const output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(/Usage: titanium sdk uninstall|rm/);
				expect(output).toMatch(/Uninstall Arguments:/);
				expect(output).toMatch(/Uninstall Options:/);
				expect(output).toMatch(/Global Options:/);

				expect(exitCode).toBe(0);
			})
		);
	});

	describe('install', () => {
		it(
			'should install an SDK and remove it',
			initSDKHome(async ({ run, tmpHome, tmpSDKDir }) => {
				const sdkPath = join(tmpSDKDir, 'mobilesdk', os, sdkName);

				// list SDKs (no SDKs installed)
				// eslint-disable-next-line no-unused-vars
				let { exitCode, stdout, stderr } = await run(['sdk']); // no `ls` to test default subcommand
				let output = stripColor(`${stdout}\n${stderr}`);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/No Titanium SDKs found/);

				// list SDKs as JSON (no SDKs installed)
				({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
				let json = JSON.parse(stdout);
				expect(json.installLocations.includes(tmpSDKDir)).toBe(true);
				expect(json).toEqual({
					branch: {},
					branches: {
						defaultBranch: 'main',
						branches: [],
					},
					defaultInstallLocation: tmpSDKDir,
					installLocations: json.installLocations,
					installed: {},
					releases: {},
					sdks: {},
				});
				expect(exitCode).toBe(0);

				// install an SDK
				({ exitCode, stdout, stderr } = await run([
					'sdk',
					'install',
					sdkName,
					'--no-progress-bars',
					'--keep-files',
				]));
				expect(`${stdout}\n${stderr}`).toMatch(/successfully installed/);
				expect(exitCode).toBe(0);

				// find the downloaded file and move it to the tmp dir for subsequent tests
				const src = join(tmpHome, '.titanium', 'downloads', sdkFilename);
				if (await exists(src)) {
					await rm(src, { force: true, recursive: true });
				} else {
					throw new Error(`SDK file does not exist: ${src}`);
				}

				// list SDKs
				({ exitCode, stdout, stderr } = await run(['sdk', 'ls']));
				output = stripColor(`${stdout}\n${stderr}`);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(
					new RegExp(
						`Installed SDKs:\n\\s*${sdkName}\\s+${sdkVersion}\\s+${sdkPath.replace(/\\/g, '\\\\')}`
					)
				);
				expect(exitCode).toBe(0);

				// list SDKs as JSON
				({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
				json = JSON.parse(stdout);
				expect(json).toEqual({
					branch: {},
					branches: {
						defaultBranch: 'main',
						branches: [],
					},
					defaultInstallLocation: tmpSDKDir,
					installLocations: json.installLocations,
					installed: {
						[sdkName]: sdkPath,
					},
					releases: {},
					sdks: {
						[sdkName]: {
							name: sdkName,
							manifest: {
								name: sdkName,
								version: sdkName.replace(/.GA$/, ''),
								moduleAPIVersion: {
									iphone: '2',
									android: '4',
								},
								timestamp: '9/15/2023 09:06',
								githash: '03d8a831eb',
								platforms,
							},
							path: sdkPath,
							type: 'ga',
							version: sdkName.replace(/.GA$/, ''),
						},
					},
				});
				expect(exitCode).toBe(0);

				// remove the SDK
				({ exitCode, stdout } = await run(['sdk', 'uninstall', sdkName, '--force']));
				expect(stdout).toMatch(/removed/);
				expect(exitCode).toBe(0);

				// verify removed
				({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
				json = JSON.parse(stdout);
				expect(json).toEqual({
					branch: {},
					branches: {
						defaultBranch: 'main',
						branches: [],
					},
					defaultInstallLocation: tmpSDKDir,
					installLocations: json.installLocations,
					installed: {},
					releases: {},
					sdks: {},
				});
				expect(exitCode).toBe(0);
			}),
			240000
		);

		it(
			'should install an SDK from a local zip',
			initSDKHome(async ({ run, tmpSDKDir }) => {
				const sdkZipFile = join(fixturesDir, 'mock-sdk.zip');
				const sdkName = '0.0.0.GA';
				const sdkPath = join(tmpSDKDir, 'mobilesdk', os, sdkName);
				let { exitCode, stdout, stderr } = await run([
					'sdk',
					'install',
					sdkZipFile,
					'--no-progress-bars',
				]);
				expect(`${stdout}\n${stderr}`).toMatch(/successfully installed/);
				expect(exitCode).toBe(0);

				({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
				const json = JSON.parse(stdout);
				expect(json).toEqual({
					branch: {},
					branches: {
						defaultBranch: 'main',
						branches: [],
					},
					defaultInstallLocation: tmpSDKDir,
					installLocations: json.installLocations,
					installed: {
						[sdkName]: sdkPath,
					},
					releases: {},
					sdks: {
						[sdkName]: {
							name: sdkName,
							manifest: {
								name: sdkName,
								version: sdkName.replace(/.GA$/, ''),
								moduleAPIVersion: {
									iphone: '2',
									android: '4',
									windows: '6',
								},
								githash: '1234567890',
								platforms: ['android'],
							},
							path: sdkPath,
							type: 'ga',
							version: sdkName.replace(/.GA$/, ''),
						},
					},
				});
				expect(exitCode).toBe(0);
			}),
			120000
		);

		it(
			'should error if local zip does not exist',
			initSDKHome(async ({ run }) => {
				const result = await run([
					'sdk',
					'install',
					pathToFileURL(join(fixturesDir, 'does_not_exist')).toString(),
					'--no-progress-bars',
				]);
				const { exitCode, stderr } = result;
				expect(stderr).toMatch(/Specified file does not exist/);
				expect(exitCode).toBe(1);
			})
		);

		it(
			'should error if local zip is not a .zip',
			initSDKHome(async ({ run }) => {
				const { exitCode, stderr } = await run([
					'sdk',
					'install',
					join(fixturesDir, 'not_a_zip'),
					'--no-progress-bars',
				]);
				expect(stderr).toMatch(/Specified file is not a zip file/);
				expect(exitCode).toBe(1);
			})
		);

		it.skip(
			'should install an SDK from a URL',
			initSDKHome(async ({ _run }) => {
				// const { exitCode, stderr } = await run(['sdk', 'install', 'https://titaniumsdk.com/', '--no-progress-bars']);
				// expect(stderr).toMatch(/Specified file does not exist/);
				// expect(exitCode).toBe(1);
			})
		);

		it(
			'should install an SDK from a branch',
			initSDKHome(async ({ _run }) => {
				// TODO
			})
		);

		it(
			'should error if SDK release not found',
			initSDKHome(async ({ run }) => {
				const { exitCode, stderr } = await run(['sdk', 'install', 'foo', '--no-progress-bars']);
				expect(stderr).toMatch(
					stderr,
					/Unable to find any Titanium SDK releases or CI builds that match "foo"/
				);
				expect(exitCode).toBe(1);
			})
		);
	});

	describe('list', () => {
		it(
			'should list releases, branches, and builds',
			initSDKHome(async ({ run, tmpSDKDir }) => {
				// list branches
				let { exitCode, stdout } = await run(['sdk', 'list', '-b']);
				let output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/Branches:\n\s*(main|master)/);

				// list stable releases
				({ exitCode, stdout } = await run(['sdk', 'list', '-r']));
				output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/Releases:/);
				expect(output).toMatch(/12\.2\.0\.GA\s+9\/15\/23/);

				// list stable and unstable releases
				({ exitCode, stdout } = await run(['sdk', 'list', '-u']));
				output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/Releases:/);
				expect(output).toMatch(/12\.2\.0\.GA\s+9\/15\/23/);
				expect(output).toMatch(/12\.2\.0\.RC\s+8\/11\/23/);

				// list branch builds
				({ exitCode, stdout } = await run(['sdk', 'list', '--branch', 'main']));
				output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/'main' Branch Builds:/);
				// expect(output).toMatch(/\d+\.\d+\.\d+\.v\d+\s+\d+\/\d+\/\d+\s+\d+(\.\d+)? .B  \[unstable\]/);

				// list branches, stable, and unstable releases as JSON
				({ exitCode, stdout } = await run(['sdk', 'ls', '-bu', '--json']));
				const json = JSON.parse(stdout);
				expect(
					json.branches.branches.includes('main') || json.branches.branches.includes('master')
				).toBe(true);
				expect(json.branches.branches).toContain('12_6_X');
				expect(json.releases[sdkName]).toBeDefined();

				expect(exitCode).toBe(0);
			}),
			60000
		);

		it(
			'should not find any SDKs in empty SDK home directory',
			initSDKHome(async ({ run, tmpSDKDir }) => {
				const { exitCode, stdout } = await run(['sdk', 'list']);
				const output = stripColor(stdout);
				expect(output).toMatch(
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/No Titanium SDKs found/);
				expect(exitCode).toBe(0);
			}),
			60000
		);

		it(
			'should list SDKs in SDK home directory',
			initMockSDKHome(async ({ run, tmpSDKDir }) => {
				const { exitCode, stdout } = await run(['sdk', 'list']);
				const output = stripColor(stdout);
				expect(output).toMatch(
					output,
					new RegExp(`SDK Install Locations:\n[\\s\\S]*${tmpSDKDir.replace(/\\/g, '\\\\')}`)
				);
				expect(output).toMatch(/Installed SDKs:/);
				expect(output).toMatch(
					output,
					new RegExp(
						`0.0.0.GA\\s+0.0.0\\s+${join(tmpSDKDir, 'mobilesdk', os, '0.0.0.GA').replace(/\\/g, '\\\\')}`
					)
				);
				expect(exitCode).toBe(0);
			}),
			60000
		);
	});

	describe('select', () => {
		it(
			'should show message for select command',
			initCLI(async ({ run }) => {
				const { exitCode, stdout } = await run(['sdk', 'select']);

				const output = stripColor(stdout);
				expect(output).toMatch(/Titanium Command-Line Interface/);
				expect(output).toMatch(/The "select" subcommand is no longer required./);

				expect(exitCode).toBe(0);
			})
		);
	});
});
