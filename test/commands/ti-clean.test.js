import { describe, it } from 'node:test';
import assert from 'node:assert';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti clean', () => {
	it('should show help', initMockSDKHome(async ({ run, tmpSDKDir }) => {
		const { exitCode, stdout } = await run(['clean', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium clean \[options\]/);
		assert.match(output, /Removes previous build directories./);
		assert.match(output, /Clean Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));
});
