import { TiConfig } from '../../src/util/ticonfig.js';
import { cp, mkdir, readFile, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig');

describe('TiConfig', () => {
	it('should load a config file', () => {
		new TiConfig(join(fixturesDir, 'good.json'));
	});

	it('should error load a bad config file', () => {
		expect(() => {
			new TiConfig(join(fixturesDir, 'bad.json'));
		}).toThrow(/Unable to parse config file/);
	});

	it('should error if file does not exist', () => {
		expect(() => {
			new TiConfig(join(fixturesDir, 'does_not_exist'));
		}).toThrow(/Unable to open config file/);
	});

	it('should get values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		expect(cfg.get('user.name')).toBe('Titanium');
		expect(cfg.get('does.not.exist')).toBe(undefined);
		expect(cfg.get('does.not.exist', 'Foo')).toBe('Foo');
		expect(cfg.user.name).toBe('Titanium');
		expect(cfg.get().user.name).toBe('Titanium');
		expect(cfg.get('foo', 'bar')).toBe('bar');
		expect(cfg.get('cli.width', 80)).toBe(80);
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
			nil: 'null',
			empty: '',
		});
		expect(cfg.get('truthy')).toBe(true);
		expect(cfg.get('falsey')).toBe(false);
		expect(cfg.get('undef')).toBe('');
		expect(cfg.get('nil')).toBe(null);
		expect(cfg.get('empty')).toBe('');
	});

	it('should set values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		cfg.set('foo', 'bar');
		expect(cfg.get('foo')).toBe('bar');
		expect(cfg.foo).toBe('bar');

		cfg.set('wiz.pow', 'baz');
		expect(cfg.get('wiz.pow')).toBe('baz');
		expect(cfg.get('wiz')).toEqual({ pow: 'baz' });
		expect(cfg.wiz).toEqual({ pow: 'baz' });

		cfg.set('user.favorite.food', 'pizza');
		expect(cfg.user.favorite.food).toBe('pizza');

		cfg.set('bar');
		expect(cfg.get('bar')).toBe('');

		cfg.set('bar', 'null');
		expect(cfg.get('bar')).toBe(null);

		cfg.set('bar', null);
		expect(cfg.get('bar')).toBe(null);

		cfg.set('bar', true);
		expect(cfg.get('bar')).toBe(true);

		cfg.set('bar', 'true');
		expect(cfg.get('bar')).toBe(true);

		cfg.set('bar', false);
		expect(cfg.get('bar')).toBe(false);

		cfg.set('bar', 'false');
		expect(cfg.get('bar')).toBe(false);

		cfg.set('bar', 123);
		expect(cfg.get('bar')).toBe(123);

		cfg.set('bar', 1.23);
		expect(cfg.get('bar')).toBe('1.23');

		cfg.set('bar', '');
		expect(cfg.get('bar')).toBe('');
		expect(cfg.get('bar', 123)).toBe(123);
	});

	it('should save the config', async () => {
		const tmpFile = join(tmpdir(), 'ticonfig.json');
		await cp(join(fixturesDir, 'good.json'), tmpFile);

		try {
			const cfg = new TiConfig(tmpFile);
			cfg.set('foo', 'bar');
			cfg.set('wiz.pow', 123);
			cfg.save();

			const json = JSON.parse(await readFile(tmpFile, 'utf-8'));
			expect(json.user.name).toBe('Titanium');
			expect(json.foo).toBe('bar');
			expect(json.wiz).toEqual({ pow: 123 });
			expect(json.baz).toBe(undefined);
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
			}).toThrow(/Unable to write config file/);
		} finally {
			await rmdir(dir);
		}
	});

	it('should access error saving the file', async () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		expect(() => {
			cfg.setConfigPath(join(tmpdir(), 'titanium-cli/foo/bar/config.json'));
			cfg.save();
		}).toThrow(/Unable to write config file/);
	});
});
