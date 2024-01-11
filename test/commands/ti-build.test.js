import { describe, it } from 'node:test';
import assert from 'node:assert';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti build', () => {
	it('should show help', initMockSDKHome(async ({ run, tmpSDKDir }) => {
		const { exitCode, stdout } = await run(['build', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium build \[options\]/);
		assert.match(output, /Builds an existing app or module project./);
		assert.match(output, /Build Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));
});
