import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { describe, expect, it } from 'vitest';

describe('ti setup', () => {
	it(
		'should show help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['setup', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium setup \[options\] \[screen\]/);
			expect(output).toMatch(/Setup Arguments:/);
			expect(output).toMatch(/Setup Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);
});
