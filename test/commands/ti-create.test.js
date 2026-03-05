import { initMockSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('ti create', () => {
	it(
		'should show help',
		initMockSDKHome(async ({ run }) => {
			const { exitCode, stdout } = await run(['create', '-h']);

			const output = stripColor(stdout);
			assert.match(output, /Titanium Command-Line Interface/);
			assert.match(output, /Usage: titanium create \[options\]/);
			assert.match(
				output,
				/Creates a new Titanium application, native module, or Apple Watch™ app./
			);
			assert.match(output, /Create Options:/);
			assert.match(output, /Create --type=app Options:/);
			assert.match(output, /Create --type=module Options:/);
			assert.match(output, /Global Options:/);

			assert.strictEqual(exitCode, 0);
		})
	);
});
