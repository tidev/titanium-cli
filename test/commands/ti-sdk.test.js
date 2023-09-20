import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { tmpDirName } from '../helpers/tmp-dir-name.js';
import { join } from 'node:path';

describe('ti sdk', { concurrency: true }, () => {
	it('should show help', initCLI(async (run) => {
		const { exitCode, stdout } = await run(['sdk', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium sdk/);
		assert.match(output, /Commands:/);
		assert.match(output, /SDK Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should show install help', initCLI(async (run) => {
		const { exitCode, stdout } = await run(['sdk', 'install', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium sdk install|i/);
		assert.match(output, /Install Arguments:/);
		assert.match(output, /Install Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should show list help', initCLI(async (run) => {
		const { exitCode, stdout } = await run(['sdk', 'list', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium sdk list|ls/);
		assert.match(output, /List Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should show uninstall help', initCLI(async (run) => {
		const { exitCode, stdout } = await run(['sdk', 'uninstall', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium sdk uninstall|rm/);
		assert.match(output, /Uninstall Arguments:/);
		assert.match(output, /Uninstall Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should install an SDK and remove it', initCLI(async (run) => {
		const tmpSDKDir = tmpDirName();
		try {
			await run(['config', 'paths.sdks', tmpSDKDir]);
			await run(['config', 'sdk.defaultInstallLocation', tmpSDKDir]);

			const sdkPath = join(tmpSDKDir, 'mobilesdk', 'win32', '12.2.0.GA');

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
			({ exitCode, stdout, stderr } = await run(['sdk', 'install', '12.2.0.GA', '--no-progress-bars']));
			try {
				assert.match(stdout, /successfully installed/);
			} catch (e) {
				console.log(stderr);
				throw e;
			}
			assert.strictEqual(exitCode, 0);

			// list sdks
			({ exitCode, stdout } = await run(['sdk', 'ls']));
			output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, new RegExp(`SDK Install Locations:\n\\s*${tmpSDKDir.replace(/\\/g, '\\\\')}`));
			assert.match(output, new RegExp(`Installed SDKs:\n\\s*12.2.0.GA\\s+12.2.0.GA\\s+${
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
					'12.2.0.GA': sdkPath
				},
				releases: {},
				sdks: {
					'12.2.0.GA': {
						name: '12.2.0.GA',
						manifest: {
							name: '12.2.0.GA',
							version: '12.2.0',
							moduleAPIVersion: {
								iphone: '2',
								android: '4'
							},
							timestamp: '9/15/2023 09:06',
							githash: '03d8a831eb',
							platforms: [
								'android'
							]
						},
						path: sdkPath,
						type: 'ga',
						version: '12.2.0'
					},
				}
			});
			assert.strictEqual(exitCode, 0);

			// remove the sdk
			({ exitCode, stdout } = await run(['sdk', 'uninstall', '12.2.0.GA', '--force']));
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
		} finally {
			await fs.remove(tmpSDKDir);
		}
	}), 240000);

	it('should list releases, branches, and builds', initCLI(async (run) => {
		const tmpSDKDir = tmpDirName();
		try {
			await run(['config', 'paths.sdks', tmpSDKDir]);
			await run(['config', 'sdk.defaultInstallLocation', tmpSDKDir]);

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
			assert.match(output, /\d+\.\d+\.\d+\.v\d+\s+\d+\/\d+\/\d+\s+\d+\.\d+ .B  \[unstable\]/);

			// list branches, stable, and unstable releases as json
			({ exitCode, stdout } = await run(['sdk', 'ls', '-bu', '--json']));
			const json = JSON.parse(stdout);
			assert(json.branches.branches.includes('master'));
			assert(json.branches.branches.includes('12_2_X'));
			assert(json.releases['12.2.0.GA']);

			assert.strictEqual(exitCode, 0);
		} finally {
			await fs.remove(tmpSDKDir);
		}
	}), 120000);
});
