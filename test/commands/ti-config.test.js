import { describe, it } from 'node:test';
import assert from 'node:assert';
import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ti config', () => {
	it('should show help', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', '-h']);

		const output = stripColor(stdout);
		assert.match(output, /Titanium Command-Line Interface/);
		assert.match(output, /Usage: titanium config \[options\] \[key\] \[value\]/);
		assert.match(output, /Config Arguments:/);
		assert.match(output, /Config Options:/);
		assert.match(output, /Global Options:/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should show all config settings', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config']);

		const output = stripColor(stdout);
		assert.match(output, /cli.colors\s+= (?:true|false)/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should show all config settings as json', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', '--json']);

		const json = JSON.parse(stdout);
		assert(Object.hasOwn(json, 'cli'));
		assert(Object.hasOwn(json.cli, 'colors'));
		assert.strictEqual(exitCode, 0);
	}));

	it('should get all config settings matching a namespace', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', 'cli']);

		const output = stripColor(stdout);
		assert.match(output, /cli.colors\s+= (?:true|false)/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should get all config settings matching a namespace as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', 'cli', '--json']);

		const json = JSON.parse(stdout);
		assert(Object.hasOwn(json, 'colors'));
		assert.strictEqual(exitCode, 0);
	}));

	it('should get a single config setting', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', 'cli.colors']);

		const output = stripColor(stdout);
		assert.match(output, /true|false/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should get a single config setting as JSON', initCLI(async ({ run }) => {
		const { exitCode, stdout } = await run(['config', 'cli.colors', '--json']);

		assert.match(stdout, /true|false/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should error if key is invalid', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', '123']);

		const output = stripColor(stderr);
		assert.match(output, /Invalid key "123"/);
		assert.strictEqual(exitCode, 1);
	}));

	it('should error if setting is not found', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', 'does_not_exist']);

		const output = stripColor(stderr);
		assert.match(output, /Key "does_not_exist" not found/);
		assert.strictEqual(exitCode, 1);
	}));

	it('should error as JSON if setting is not found', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', 'does_not_exist', '--json']);

		const json = JSON.parse(stderr);
		assert.deepStrictEqual(json, {
			success: false,
			error: 'Key "does_not_exist" not found'
		});
		assert.strictEqual(exitCode, 1);
	}));

	it('should set a single config setting', initCLI(async ({ run }) => {
		let { exitCode, stdout } = await run(['config', 'foo', 'bar']);

		let output = stripColor(stdout);
		assert.match(output, /foo saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'foo']));
		output = stripColor(stdout);
		assert.match(output, /bar/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should set a nested config setting', initCLI(async ({ run }) => {
		let { exitCode, stdout } = await run(['config', 'foo.bar', 'baz']);

		let output = stripColor(stdout);
		assert.match(output, /foo.bar saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config']));
		output = stripColor(stdout);
		assert.match(output, /foo.bar\s+= "baz"/);
		assert.strictEqual(exitCode, 0);
	}));

	it('should delete a single config setting', initCLI(async ({ run }) => {
		let { exitCode, stdout, stderr } = await run(['config', 'foo', 'bar']);

		let output = stripColor(stdout);
		assert.match(output, /foo saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'foo']));
		output = stripColor(stdout);
		assert.match(output, /bar/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'foo', '--remove']));
		output = stripColor(stdout);
		assert.match(output, /"foo" removed/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stderr } = await run(['config', 'foo']));
		output = stripColor(stderr);
		assert.match(output, /Key "foo" not found/);
		assert.strictEqual(exitCode, 1);
	}));

	it('should delete a nested config setting', initCLI(async ({ run }) => {
		let { exitCode, stdout, stderr } = await run(['config', 'foo.bar', 'baz']);

		let output = stripColor(stdout);
		assert.match(output, /foo.bar saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config']));
		output = stripColor(stdout);
		assert.match(output, /foo.bar\s+= "baz"/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'foo', '--remove']));
		output = stripColor(stdout);
		assert.match(output, /"foo" removed/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stderr } = await run(['config', 'foo']));
		output = stripColor(stderr);
		assert.match(output, /Key "foo" not found/);
		assert.strictEqual(exitCode, 1);
	}));

	it('should error deleting without a key', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', '--remove']);

		const output = stripColor(stderr);
		assert.match(output, /Missing key of the config setting to remove/);

		assert.strictEqual(exitCode, 1);
	}));

	it('should error deleting with too many args', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', 'foo', 'bar', '--remove']);

		const output = stripColor(stderr);
		assert.match(output, /Too many arguments for "--remove" flag/);

		assert.strictEqual(exitCode, 1);
	}));

	it('should error setting an unsupported path', initCLI(async ({ run }) => {
		const { exitCode, stderr } = await run(['config', 'paths.foo', 'bar']);

		const output = stripColor(stderr);
		assert.match(output, /Unsupported key "paths.foo"/);
		assert.strictEqual(exitCode, 1);
	}));

	it('should set a path setting', initCLI(async ({ run }) => {
		const fooPath = join(tmpdir(), 'foo');
		const barPath = join(tmpdir(), 'bar');
		const bazPath = join(tmpdir(), 'baz');

		let { exitCode, stdout } = await run(['config', 'paths.modules', fooPath]);
		let output = stripColor(stdout);
		assert.match(output, /paths.modules saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
		let json = JSON.parse(stdout);
		assert.deepStrictEqual(json, [fooPath]);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--json']));
		json = JSON.parse(stdout);
		assert.deepStrictEqual(json, { success: true });
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths']));
		output = stripColor(stdout);
		assert.match(output, new RegExp(`= "${barPath.replace(/\\/g, '\\\\\\\\')}"`));
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', bazPath, '--append']));
		output = stripColor(stdout);
		assert.match(output, /paths.modules saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules']));
		output = stripColor(stdout);
		assert.match(output, new RegExp(`${barPath.replace(/\\/g, '\\\\')}\n${bazPath.replace(/\\/g, '\\\\')}`));
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
		json = JSON.parse(stdout);
		assert.deepStrictEqual(json, [barPath, bazPath]);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--remove']));
		output = stripColor(stdout);
		assert.match(output, /paths.modules saved/);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
		json = JSON.parse(stdout);
		assert.deepStrictEqual(json, [bazPath]);
		assert.strictEqual(exitCode, 0);

		({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--remove']));
		output = stripColor(stdout);
		assert.match(output, /paths.modules saved/);
		assert.strictEqual(exitCode, 0);
	}));

});
