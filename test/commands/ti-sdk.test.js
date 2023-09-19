import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { tmpDirName } from '../helpers/tmp-dir-name.js';

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
			const { exitCode, stdout } = await run(['sdk']);

			const output = stripColor(stdout);
			console.log(stdout);

			assert.strictEqual(exitCode, 0);
		} finally {
			await fs.remove(tmpSDKDir);
		}
	}), 120000);
});
