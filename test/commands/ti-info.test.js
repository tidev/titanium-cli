import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = fs.readJsonSync(join(__dirname, '../../package.json'));

describe('ti info', () => {
	it('should show help', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium info/);
		assert.match(output, /Info Options:/);
		assert.match(output, /Global Options:/);

		assert.strictEqual(exitCode, 0);
	}));

	it('should show all info', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Operating System/);
		assert.match(output, new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`));
		assert.match(output, new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
		assert.match(output, /Titanium SDKs/);
		assert.match(output, /Java Development Kit/);
		assert.match(output, /Issues/);

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should show all info as JSON', initCLI(async ({ run }) => {
		let { exitCode, stdout } = await run(['info', '--json']);

		let json = JSON.parse(stdout);
		assert(Object.hasOwn(json, 'os'));
		assert(Object.hasOwn(json, 'node'));
		assert(Object.hasOwn(json, 'npm'));
		assert(Object.hasOwn(json, 'titanium'));
		assert(Object.hasOwn(json, 'titaniumCLI'));
		assert(Object.hasOwn(json, 'jdk'));

		// legacy
		({ exitCode, stdout } = await run(['info', '--output', 'json']));

		json = JSON.parse(stdout);
		assert(Object.hasOwn(json, 'os'));
		assert(Object.hasOwn(json, 'node'));
		assert(Object.hasOwn(json, 'npm'));
		assert(Object.hasOwn(json, 'titanium'));
		assert(Object.hasOwn(json, 'titaniumCLI'));
		assert(Object.hasOwn(json, 'jdk'));

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "os" info', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'os']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Operating System/);
		assert.doesNotMatch(output, new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`));
		assert.doesNotMatch(output, new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
		assert.doesNotMatch(output, /Titanium SDKs/);
		assert.doesNotMatch(output, /Java Development Kit/);
		assert.match(output, /Issues/);

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "os" info as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'os', '--json']);

		const json = JSON.parse(stdout);
		assert(Object.hasOwn(json, 'os'));
		assert(!Object.hasOwn(json, 'node'));
		assert(!Object.hasOwn(json, 'npm'));
		assert(!Object.hasOwn(json, 'titanium'));
		assert(!Object.hasOwn(json, 'titaniumCLI'));
		assert(!Object.hasOwn(json, 'jdk'));

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "nodejs" info', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'nodejs']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.doesNotMatch(output, /Operating System/);
		assert.match(output, new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`));
		assert.doesNotMatch(output, new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
		assert.doesNotMatch(output, /Titanium SDKs/);
		assert.doesNotMatch(output, /Java Development Kit/);
		assert.match(output, /Issues/);

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "nodejs" info as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'nodejs', '--json']);

		const json = JSON.parse(stdout);
		assert(!Object.hasOwn(json, 'os'));
		assert(Object.hasOwn(json, 'node'));
		assert.strictEqual(json.node.version, process.versions.node);
		assert(Object.hasOwn(json, 'npm'));
		assert(!Object.hasOwn(json, 'titanium'));
		assert(!Object.hasOwn(json, 'titaniumCLI'));
		assert(!Object.hasOwn(json, 'jdk'));

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "titanium" info', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'titanium']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.doesNotMatch(output, /Operating System/);
		assert.doesNotMatch(output, new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`));
		assert.match(output, new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
		assert.match(output, /Titanium SDKs/);
		assert.doesNotMatch(output, /Java Development Kit/);
		assert.match(output, /Issues/);

		assert.strictEqual(exitCode, 0);
	}), 60000);

	it('should only show "jdk" info', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['info', '--types', 'jdk']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.doesNotMatch(output, /Operating System/);
		assert.doesNotMatch(output, new RegExp(`Node.js\n\\s*Node.js Version\\s*= ${process.versions.node}`));
		assert.doesNotMatch(output, new RegExp(`Titanium CLI\n\\s*CLI Version\\s*= ${pkgJson.version}`));
		assert.doesNotMatch(output, /Titanium SDKs/);
		assert.match(output, /Java Development Kit/);
		assert.match(output, /Issues/);

		assert.strictEqual(exitCode, 0);
	}), 60000);
});
