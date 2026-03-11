import { initCLI } from '../helpers/init-cli.js';
import { stripColor } from '../helpers/strip-color.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ti config', () => {
	it(
		'should show help',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium config \[options\] \[key\] \[value\]/);
			expect(output).toMatch(/Config Arguments:/);
			expect(output).toMatch(/Config Options:/);
			expect(output).toMatch(/Global Options:/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should show all config settings',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config']);

			const output = stripColor(stdout);
			expect(output).toMatch(/cli.colors\s+= (?:true|false)/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should show all config settings as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', '--json']);

			const json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'cli')).toBe(true);
			expect(Object.hasOwn(json.cli, 'colors')).toBe(true);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should get all config settings matching a namespace',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', 'cli']);

			const output = stripColor(stdout);
			expect(output).toMatch(/cli.colors\s+= (?:true|false)/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should get all config settings matching a namespace as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', 'cli', '--json']);

			const json = JSON.parse(stdout);
			expect(Object.hasOwn(json, 'colors')).toBe(true);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should get a single config setting',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', 'cli.colors']);

			const output = stripColor(stdout);
			expect(output).toMatch(/true|false/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should get a single config setting as JSON',
		initCLI(async ({ run }) => {
			const { exitCode, stdout } = await run(['config', 'cli.colors', '--json']);

			expect(stdout).toMatch(/true|false/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should error if key is invalid',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', '123']);

			const output = stripColor(stderr);
			expect(output).toMatch(/Invalid key "123"/);
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should error if setting is not found',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', 'does_not_exist']);

			const output = stripColor(stderr);
			expect(output).toMatch(/Key "does_not_exist" not found/);
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should error as JSON if setting is not found',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', 'does_not_exist', '--json']);

			const json = JSON.parse(stderr);
			expect(json).toEqual({
				success: false,
				error: 'Key "does_not_exist" not found',
			});
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should set a single config setting',
		initCLI(async ({ run }) => {
			let { exitCode, stdout } = await run(['config', 'foo', 'bar']);

			let output = stripColor(stdout);
			expect(output).toMatch(/foo saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'foo']));
			output = stripColor(stdout);
			expect(output).toMatch(/bar/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should set a nested config setting',
		initCLI(async ({ run }) => {
			let { exitCode, stdout } = await run(['config', 'foo.bar', 'baz']);

			let output = stripColor(stdout);
			expect(output).toMatch(/foo.bar saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config']));
			output = stripColor(stdout);
			expect(output).toMatch(/foo.bar\s+= "baz"/);
			expect(exitCode).toBe(0);
		})
	);

	it(
		'should delete a single config setting',
		initCLI(async ({ run }) => {
			let { exitCode, stdout, stderr } = await run(['config', 'foo', 'bar']);

			let output = stripColor(stdout);
			expect(output).toMatch(/foo saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'foo']));
			output = stripColor(stdout);
			expect(output).toMatch(/bar/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'foo', '--remove']));
			output = stripColor(stdout);
			expect(output).toMatch(/"foo" removed/);
			expect(exitCode).toBe(0);

			({ exitCode, stderr } = await run(['config', 'foo']));
			output = stripColor(stderr);
			expect(output).toMatch(/Key "foo" not found/);
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should delete a nested config setting',
		initCLI(async ({ run }) => {
			let { exitCode, stdout, stderr } = await run(['config', 'foo.bar', 'baz']);

			let output = stripColor(stdout);
			expect(output).toMatch(/foo.bar saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config']));
			output = stripColor(stdout);
			expect(output).toMatch(/foo.bar\s+= "baz"/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'foo', '--remove']));
			output = stripColor(stdout);
			expect(output).toMatch(/"foo" removed/);
			expect(exitCode).toBe(0);

			({ exitCode, stderr } = await run(['config', 'foo']));
			output = stripColor(stderr);
			expect(output).toMatch(/Key "foo" not found/);
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should error deleting without a key',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', '--remove']);

			const output = stripColor(stderr);
			expect(output).toMatch(/Missing key of the config setting to remove/);

			expect(exitCode).toBe(1);
		})
	);

	it(
		'should error deleting with too many args',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', 'foo', 'bar', '--remove']);

			const output = stripColor(stderr);
			expect(output).toMatch(/Too many arguments for "--remove" flag/);

			expect(exitCode).toBe(1);
		})
	);

	it(
		'should error setting an unsupported path',
		initCLI(async ({ run }) => {
			const { exitCode, stderr } = await run(['config', 'paths.foo', 'bar']);

			const output = stripColor(stderr);
			expect(output).toMatch(/Unsupported key "paths.foo"/);
			expect(exitCode).toBe(1);
		})
	);

	it(
		'should set a path setting',
		initCLI(async ({ run }) => {
			const fooPath = join(tmpdir(), 'foo');
			const barPath = join(tmpdir(), 'bar');
			const bazPath = join(tmpdir(), 'baz');

			let { exitCode, stdout } = await run(['config', 'paths.modules', fooPath]);
			let output = stripColor(stdout);
			expect(output).toMatch(/paths.modules saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
			let json = JSON.parse(stdout);
			expect(json).toEqual([fooPath]);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--json']));
			json = JSON.parse(stdout);
			expect(json).toEqual({ success: true });
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths']));
			output = stripColor(stdout);
			expect(output).toMatch(new RegExp(`= "${barPath.replace(/\\/g, '\\\\\\\\')}"`));
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', bazPath, '--append']));
			output = stripColor(stdout);
			expect(output).toMatch(/paths.modules saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules']));
			output = stripColor(stdout);
			expect(output).toMatch(
				output,
				new RegExp(`${barPath.replace(/\\/g, '\\\\')}\n${bazPath.replace(/\\/g, '\\\\')}`)
			);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
			json = JSON.parse(stdout);
			expect(json).toEqual([barPath, bazPath]);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--remove']));
			output = stripColor(stdout);
			expect(output).toMatch(/paths.modules saved/);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', '--json']));
			json = JSON.parse(stdout);
			expect(json).toEqual([bazPath]);
			expect(exitCode).toBe(0);

			({ exitCode, stdout } = await run(['config', 'paths.modules', barPath, '--remove']));
			output = stripColor(stdout);
			expect(output).toMatch(/paths.modules saved/);
			expect(exitCode).toBe(0);
		}),
		10000
	);
});
