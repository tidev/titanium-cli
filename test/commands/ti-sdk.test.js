import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import { initCLI } from '../helpers/init-cli.js';
import { initSDKHome, initMockSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/sdk');
const sdkName = '12.2.0.GA';
const os = process.platform === 'darwin' ? 'osx' : process.platform;
const sdkFilename = `mobilesdk-${sdkName}-${os}.zip`;
const platforms = ['android'];
if (process.platform === 'darwin') {
	platforms.unshift('iphone');
}

describe('ti sdk', () => {
	describe('help', () => {
		it('should show help', initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['sdk', '-h']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /Usage: titanium sdk/);
			assert.match(output, /Commands:/);
			assert.match(output, /SDK Options:/);
			assert.match(output, /Global Options:/);

			assert.strictEqual(exitCode, 0);
		}));

		it('should show install help', initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['sdk', 'install', '-h']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /Usage: titanium sdk install|i/);
			assert.match(output, /Install Arguments:/);
			assert.match(output, /Install Options:/);
			assert.match(output, /Global Options:/);

			assert.strictEqual(exitCode, 0);
		}));

		it('should show list help', initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['sdk', 'list', '-h']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /Usage: titanium sdk list|ls/);
			assert.match(output, /List Options:/);
			assert.match(output, /Global Options:/);

			assert.strictEqual(exitCode, 0);
		}));

		it('should show uninstall help', initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['sdk', 'uninstall', '-h']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /Usage: titanium sdk uninstall|rm/);
			assert.match(output, /Uninstall Arguments:/);
			assert.match(output, /Uninstall Options:/);
			assert.match(output, /Global Options:/);

			assert.strictEqual(exitCode, 0);
		}));
	});

	describe('install', () => {
		it('should install an SDK and remove it', initSDKHome(async ({ run, tmpHome, tmpSDKDir }) => {
			const sdkPath = join(tmpSDKDir, 'mobilesdk', os, sdkName);

			// list sdks (no sdks installed)
			let { exitCode, stdout, stderr } = await run(['sdk']); // no `ls` to test default subcommand
			let output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /No Titanium SDKs found/);

			// list sdks as json (no sdks installed)
			({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
			let json = JSON.parse(stdout);
			assert.deepStrictEqual(json, {
				branch: {},
				branches: {
					defaultBranch: 'master',
					branches: []
				},
				defaultInstallLocation: tmpSDKDir,
				installLocations: [tmpSDKDir],
				installed: {},
				releases: {},
				sdks: {}
			});
			assert.strictEqual(exitCode, 0);

			// install an sdk
			({ exitCode, stdout, stderr } = await run(['sdk', 'install', sdkName, '--no-progress-bars', '--keep-files']));
			assert.match(stdout, /successfully installed/);
			assert.strictEqual(exitCode, 0);

			// find the downloaded file and move it to the tmp dir for subsequent tests
			const src = join(tmpHome, '.titanium', 'downloads', sdkFilename);
			if (fs.existsSync(src)) {
				await fs.remove(src);
			} else {
				throw new Error(`SDK file does not exist: ${src}`);
			}

			// list sdks
			({ exitCode, stdout } = await run(['sdk', 'ls']));
			output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, new RegExp(`Installed SDKs:\n\\s*${sdkName}\\s+${sdkName}\\s+${
				sdkPath.replace(/\\/g, '\\\\')
			}`));
			assert.strictEqual(exitCode, 0);

			// list sdks as json
			({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
			json = JSON.parse(stdout);
			assert.deepStrictEqual(json, {
				branch: {},
				branches: {
					defaultBranch: 'master',
					branches: []
				},
				defaultInstallLocation: tmpSDKDir,
				installLocations: [tmpSDKDir],
				installed: {
					[sdkName]: sdkPath
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
								android: '4'
							},
							timestamp: '9/15/2023 09:06',
							githash: '03d8a831eb',
							platforms
						},
						path: sdkPath,
						type: 'ga',
						version: sdkName.replace(/.GA$/, '')
					},
				}
			});
			assert.strictEqual(exitCode, 0);

			// remove the sdk
			({ exitCode, stdout } = await run(['sdk', 'uninstall', sdkName, '--force']));
			assert.match(stdout, /removed/);
			assert.strictEqual(exitCode, 0);

			// verify removed
			({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
			json = JSON.parse(stdout);
			assert.deepStrictEqual(json, {
				branch: {},
				branches: {
					defaultBranch: 'master',
					branches: []
				},
				defaultInstallLocation: tmpSDKDir,
				installLocations: [tmpSDKDir],
				installed: {},
				releases: {},
				sdks: {}
			});
			assert.strictEqual(exitCode, 0);
		}), 240000);

		it('should install an SDK from a local zip', initSDKHome(async ({ run, tmpSDKDir }) => {
			const sdkZipFile = join(fixturesDir, 'mock-sdk.zip');
			const sdkName = '0.0.0.GA';
			const sdkPath = join(tmpSDKDir, 'mobilesdk', os, sdkName);
			let { exitCode, stdout } = await run(['sdk', 'install', sdkZipFile, '--no-progress-bars']);
			assert.match(stdout, /successfully installed/);
			assert.strictEqual(exitCode, 0);

			({ exitCode, stdout } = await run(['sdk', 'ls', '--json']));
			const json = JSON.parse(stdout);
			assert.deepStrictEqual(json, {
				branch: {},
				branches: {
					defaultBranch: 'master',
					branches: []
				},
				defaultInstallLocation: tmpSDKDir,
				installLocations: [tmpSDKDir],
				installed: {
					[sdkName]: sdkPath
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
								windows: '6'
							},
							githash: '1234567890',
							platforms: ['android']
						},
						path: sdkPath,
						type: 'ga',
						version: sdkName.replace(/.GA$/, '')
					},
				}
			});
			assert.strictEqual(exitCode, 0);
		}), 120000);

		it('should error if local zip does not exist', initSDKHome(async ({ run }) => {
			const { exitCode, stderr } = await run(['sdk', 'install', pathToFileURL(join(fixturesDir, 'does_not_exist')), '--no-progress-bars']);
			assert.match(stderr, /Specified file does not exist/);
			assert.strictEqual(exitCode, 1);
		}));

		it('should error if local zip is not a .zip', initSDKHome(async ({ run }) => {
			const { exitCode, stderr } = await run(['sdk', 'install', join(fixturesDir, 'not_a_zip'), '--no-progress-bars']);
			assert.match(stderr, /Specified file is not a zip file/);
			assert.strictEqual(exitCode, 1);
		}));

		it('should install an SDK from a URL', initSDKHome(async ({ run }) => {
			const { exitCode, stderr } = await run(['sdk', 'install', pathToFileURL(join(fixturesDir, 'does_not_exist')), '--no-progress-bars']);
			assert.match(stderr, /Specified file does not exist/);
			assert.strictEqual(exitCode, 1);
		}));

		it('should install an SDK from a branch', initSDKHome(async ({ run }) => {
			// TODO
		}));

		it('should error if SDK release not found', initSDKHome(async ({ run }) => {
			const { exitCode, stderr } = await run(['sdk', 'install', 'foo', '--no-progress-bars']);
			assert.match(stderr, /Unable to find any Titanium SDK releases or CI builds that match "foo"/);
			assert.strictEqual(exitCode, 1);
		}));
	});

	describe('list', () => {
		it('should list releases, branches, and builds', initSDKHome(async ({ run, tmpSDKDir }) => {
			// list branches
			let { exitCode, stdout } = await run(['sdk', 'list', '-b']);
			let output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /Branches:\n\s*master/);

			// list stable releases
			({ exitCode, stdout } = await run(['sdk', 'list', '-r']));
			output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /Releases:/);
			assert.match(output, /12\.2\.0\.GA\s+9\/15\/23/);

			// list stable and unstable releases
			({ exitCode, stdout } = await run(['sdk', 'list', '-u']));
			output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /Releases:/);
			assert.match(output, /12\.2\.0\.GA\s+9\/15\/23/);
			assert.match(output, /12\.2\.0\.RC\s+8\/11\/23/);

			// list branch builds
			({ exitCode, stdout } = await run(['sdk', 'list', '--branch', 'master']));
			output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /'master' Branch Builds:/);
			assert.match(output, /\d+\.\d+\.\d+\.v\d+\s+\d+\/\d+\/\d+\s+\d+(\.\d+)? .B  \[unstable\]/);

			// list branches, stable, and unstable releases as json
			({ exitCode, stdout } = await run(['sdk', 'ls', '-bu', '--json']));
			const json = JSON.parse(stdout);
			assert(json.branches.branches.includes('master'));
			assert(json.branches.branches.includes('12_2_X'));
			assert(json.releases[sdkName]);

			assert.strictEqual(exitCode, 0);
		}), 60000);

		it('should not find any sdks in empty sdk home directory', initSDKHome(async ({ run, tmpSDKDir }) => {
			const { exitCode, stdout } = await run(['sdk', 'list']);
			const output = stripColor(stdout);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /No Titanium SDKs found/);
			assert.strictEqual(exitCode, 0);
		}), 60000);

		it('should list sdks in sdk home directory', initMockSDKHome(async ({ run, tmpSDKDir }) => {
			const { exitCode, stdout } = await run(['sdk', 'list']);
			const output = stripColor(stdout);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, /Installed SDKs:/);
			assert.match(output, new RegExp(`0.0.0.GA\\s+0.0.0.GA\\s+${join(tmpSDKDir, 'mobilesdk', os, '0.0.0.GA').replace(/\\/g, '\\\\')}`));
			assert.strictEqual(exitCode, 0);
		}), 60000);
	});

	describe('select', () => {
		it('should show message for select command', initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['sdk', 'select']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /The "select" subcommand is no longer required./);

			assert.strictEqual(exitCode, 0);
		}));
	});
});
