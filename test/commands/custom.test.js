import { describe, it } from 'node:test';
import assert from 'node:assert';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Custom command', () => {
	it('should load custom command', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run([
			'--config', JSON.stringify({
				paths: {
					commands: [
						join(__dirname, 'fixtures', 'custom')
					]
				}
			})
		]);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium/);
		assert.match(output, /Commands:/);
		assert.match(output, /foo/);
		// assert.match(output, /an example of a custom command/);
		assert.match(output, /Global Options:/);
		assert.match(output, /-h, --help/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should run custom command', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run([
			'--config', JSON.stringify({
				paths: {
					commands: [
						join(__dirname, 'fixtures', 'custom')
					]
				}
			}),
			'foo'
		]);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Foo!/);

		assert.strictEqual(exitCode, 0);
	}));
});
