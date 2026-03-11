import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

describe('ti', () => {
	it(
		'should display the version using short flag',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['-v']);
			expect(stdout).toBe(pkgJson.version);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should display the version using long flag',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['--version']);
			expect(stdout).toBe(pkgJson.version);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should display the help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run();

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium/);
			expect(output).toMatch(/Commands:/);
			expect(output).toMatch(/Global Options:/);
			expect(output).toMatch(/-h, --help/);

			expect(exitCode).toBe(0);
		})
	);
});
