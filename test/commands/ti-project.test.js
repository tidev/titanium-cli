import { describe, it } from 'node:test';
import assert from 'node:assert';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti project', () => {
	it('should show help', initMockSDKHome(async ({ run, tmpSDKDir }) => {
		const { exitCode, stdout } = await run(['project', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium project \[options\]/);
		assert.match(output, /Get and set tiapp.xml settings./);
		assert.match(output, /Project Arguments:/);
		assert.match(output, /Project Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));
});
