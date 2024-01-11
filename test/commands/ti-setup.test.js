import { describe, it } from 'node:test';
import assert from 'node:assert';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';

describe('ti setup', () => {
	it('should show help', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['setup', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium setup \[options\] \[screen\]/);
		assert.match(output, /Setup Arguments:/);
		assert.match(output, /Setup Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));
});
