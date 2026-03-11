import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Custom command', () => {
	it(
		'should load custom command',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run([
				'--config',
				JSON.stringify({
					paths: {
						commands: [join(__dirname, 'fixtures', 'custom')],
					},
				}),
			]);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium/);
			expect(output).toMatch(/Commands:/);
			expect(output).toMatch(/foo/);
			// expect(output).toMatch(/an example of a custom command/);
			expect(output).toMatch(/Global Options:/);
			expect(output).toMatch(/-h, --help/);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should run custom command',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run([
				'--config',
				JSON.stringify({
					paths: {
						commands: [join(__dirname, 'fixtures', 'custom')],
					},
				}),
				'foo',
			]);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Foo!/);

			expect(exitCode).toBe(0);
		})
	);
});
