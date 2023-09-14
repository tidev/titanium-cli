import { describe, expect, it } from 'vitest';
import { TiConfig } from '../../src/util/ticonfig.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chmod, copyFile, mkdir, readFile, rmdir, unlink } from 'node:fs/promises';
import fs from 'node:fs';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig');

describe('TiConfig', () => {
	it('should load a config file', () => {
		new TiConfig(join(fixturesDir, 'good.json'));
	});

	it('should error load a bad config file', () => {
		expect(() => {
			new TiConfig(join(fixturesDir, 'bad.json'));
		}).toThrowError(/Unable to parse config file/);
	});

	it('should error if file does not exist', () => {
		expect(() => {
			new TiConfig(join(fixturesDir, 'does_not_exist'));
		}).toThrowError(/Unable to open config file/);
	});

	it('should get values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		expect(cfg.get('user.name')).toEqual('Titanium');
		expect(cfg.get('does.not.exist')).toEqual(undefined);
		expect(cfg.get('does.not.exist', 'Foo')).toEqual('Foo');
		expect(cfg.user.name).toEqual('Titanium');
		expect(cfg.get().user.name).toEqual('Titanium');
		expect(cfg.get('foo', 'bar')).toEqual('bar');
	});

	it('should get the config path', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		expect(cfg.getConfigPath()).toMatch(/good\.json/);
	});

	it('should apply values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		cfg.apply({
			truthy: 'true',
			falsey: 'false',
			undef: undefined,
			nil: 'null'
		});
		expect(cfg.get('truthy')).toEqual(true);
		expect(cfg.get('falsey')).toEqual(false);
		expect(cfg.get('undef')).toEqual('');
		expect(cfg.get('nil')).toEqual(null);
	});

	it('should set values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		cfg.set('foo', 'bar');
		expect(cfg.get('foo')).toEqual('bar');
		expect(cfg.foo).toEqual('bar');

		cfg.set('wiz.pow', 'baz');
		expect(cfg.get('wiz.pow')).toEqual('baz');
		expect(cfg.get('wiz')).toEqual({ pow: 'baz' });
		expect(cfg.wiz).toEqual({ pow: 'baz' });

		cfg.set('user.favorite.food', 'pizza');
		expect(cfg.user.favorite.food).toEqual('pizza');

		cfg.set('bar');
		expect(cfg.get('bar')).toEqual('');

		cfg.set('bar', 'null');
		expect(cfg.get('bar')).toEqual(null);

		cfg.set('bar', null);
		expect(cfg.get('bar')).toEqual(null);

		cfg.set('bar', true);
		expect(cfg.get('bar')).toEqual(true);

		cfg.set('bar', 'true');
		expect(cfg.get('bar')).toEqual(true);

		cfg.set('bar', false);
		expect(cfg.get('bar')).toEqual(false);

		cfg.set('bar', 'false');
		expect(cfg.get('bar')).toEqual(false);

		cfg.set('bar', 123);
		expect(cfg.get('bar')).toEqual(123);

		cfg.set('bar', 1.23);
		expect(cfg.get('bar')).toEqual('1.23');
	});

	it('should save the config', async () => {
		const tmpFile = join(tmpdir(), 'ticonfig.json');
		await copyFile(
			join(fixturesDir, 'good.json'),
			tmpFile
		);

		try {
			const cfg = new TiConfig(tmpFile);
			cfg.set('foo', 'bar');
			cfg.set('wiz.pow', 123);
			cfg.save();

			const json = JSON.parse(await readFile(tmpFile, 'utf-8'));
			expect(json.user.name).toEqual('Titanium');
			expect(json.foo).toEqual('bar');
			expect(json.wiz).toEqual({ pow: 123 });
			expect(json.baz).toEqual(undefined);
		} finally {
			await unlink(tmpFile);
		}
	});

	it('should error saving the file', async () => {
		const dir = join(tmpdir(), 'ticonfig');

		try {
			await mkdir(dir);

			const cfg = new TiConfig(join(fixturesDir, 'good.json'));
			cfg.setConfigPath(dir);

			expect(() => {
				cfg.save();
			}).toThrowError(/Unable to write config file/);
		} finally {
			await rmdir(dir);
		}
	});

	it('should access error saving the file', async () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		expect(() => {
			cfg.setConfigPath(join(tmpdir(), 'titanium-cli/foo/bar/config.json'));
			cfg.save();
		}).toThrowError(/Unable to write config file/);
	});
});
