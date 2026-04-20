import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

describe('ti info', () => {
	it(
		'should show help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium info/);
			expect(output).toMatch(/Info Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);

	it(
		'should show all info',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Operating System/);
			expect(output).toMatch(
				new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`)
			);
			expect(output).toMatch(new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
			expect(output).toMatch(/Titanium SDKs/);
			expect(output).toMatch(/Java/);
			expect(output).toMatch(/Issues/);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should show all info as JSON',
		initCLI(async ({ run }) => {
			let { exitCode, stdout } = await run(['info', '--json']);

			let json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'os')).toBe(true);
			expect(Object.hasOwn(json, 'node')).toBe(true);
			expect(Object.hasOwn(json, 'npm')).toBe(true);
			expect(Object.hasOwn(json, 'titanium')).toBe(true);
			expect(Object.hasOwn(json, 'titaniumCLI')).toBe(true);
			expect(Object.hasOwn(json, 'java')).toBe(true);

			// legacy
			({ exitCode, stdout } = await run(['info', '--output', 'json']));

			json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'os')).toBe(true);
			expect(Object.hasOwn(json, 'node')).toBe(true);
			expect(Object.hasOwn(json, 'npm')).toBe(true);
			expect(Object.hasOwn(json, 'titanium')).toBe(true);
			expect(Object.hasOwn(json, 'titaniumCLI')).toBe(true);
			expect(Object.hasOwn(json, 'java')).toBe(true);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "os" info',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'os']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Operating System/);
			expect(output).not.toMatch(
				new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`)
			);
			expect(output).not.toMatch(
				new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`)
			);
			expect(output).not.toMatch(/Titanium SDKs/);
			expect(output).not.toMatch(/Java/);
			expect(output).toMatch(/Issues/);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "os" info as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'os', '--json']);

			const json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'os')).toBe(true);
			expect(Object.hasOwn(json, 'node')).toBe(false);
			expect(Object.hasOwn(json, 'npm')).toBe(false);
			expect(Object.hasOwn(json, 'titanium')).toBe(false);
			expect(Object.hasOwn(json, 'titaniumCLI')).toBe(false);
			expect(Object.hasOwn(json, 'java')).toBe(false);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "nodejs" info',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'nodejs']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).not.toMatch(/Operating System/);
			expect(output).toMatch(
				new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`)
			);
			expect(output).not.toMatch(
				new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`)
			);
			expect(output).not.toMatch(/Titanium SDKs/);
			expect(output).not.toMatch(/Java/);
			expect(output).toMatch(/Issues/);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "nodejs" info as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'nodejs', '--json']);

			const json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'os')).toBe(false);
			expect(Object.hasOwn(json, 'node')).toBe(true);
			expect(json.node.version).toBe(process.versions.node);
			expect(Object.hasOwn(json, 'npm')).toBe(true);
			expect(Object.hasOwn(json, 'titanium')).toBe(false);
			expect(Object.hasOwn(json, 'titaniumCLI')).toBe(false);
			expect(Object.hasOwn(json, 'java')).toBe(false);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "titanium" info',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'titanium']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).not.toMatch(/Operating System/);
			expect(output).not.toMatch(
				new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`)
			);
			expect(output).toMatch(new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
			expect(output).toMatch(/Titanium SDKs/);
			expect(output).not.toMatch(/Java/);
			expect(output).toMatch(/Issues/);

			expect(exitCode).toBe(0);
		}),
		60000
	);

	it(
		'should only show "java" info',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['info', '--types', 'java']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).not.toMatch(/Operating System/);
			expect(output).not.toMatch(
				new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`)
			);
			expect(output).not.toMatch(
				new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`)
			);
			expect(output).not.toMatch(/Titanium SDKs/);
			expect(output).toMatch(/Java/);
			expect(output).toMatch(/Issues/);

			expect(exitCode).toBe(0);
		}),
		60000
	);
});
