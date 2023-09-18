import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { run } from '../helpers/run.js';
import { stripColor } from '../helpers/strip-color.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = fs.readJsonSync(join(__dirname, '../../package.json'));

describe('ti', () => {
	it('should display the version using short flag', async () => {
		const { exitCode, stdout } = await run(['-v']);
		assert.strictEqual(stdout, pkgJson.version);
		assert.strictEqual(exitCode, 0);
	});

	it('should display the version using long flag', async () => {
		const { exitCode, stdout } = await run(['--version']);
		assert.strictEqual(stdout, pkgJson.version);
		assert.strictEqual(exitCode, 0);
	});

	it('should display the help', async () => {
		const { exitCode, stdout } = await run();

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium/);
		assert.match(output, /Commands:/);
		assert.match(output, /Global Options:/);
		assert.match(output, /-h, --help/);

		assert.strictEqual(exitCode, 0);
	});
});
