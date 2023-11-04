import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TiConfig } from '../../src/util/ticonfig.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { copyFile, mkdir, readFile, rmdir, unlink } from 'node:fs/promises';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig');

describe('TiConfig', () => {
	it('should load a config file', () => {
		new TiConfig(join(fixturesDir, 'good.json'));
	});

	it('should error load a bad config file', () => {
		assert.throws(
			() => {
				new TiConfig(join(fixturesDir, 'bad.json'));
			},
			{
				name: 'Error',
				message: /^Unable to parse config file/
			}
		);
	});

	it('should error if file does not exist', () => {
		assert.throws(
			() => {
				new TiConfig(join(fixturesDir, 'does_not_exist'));
			},
			{
				name: 'Error',
				message: /^Unable to open config file/
			}
		);
	});

	it('should get values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		assert.strictEqual(cfg.get('user.name'), 'Titanium');
		assert.strictEqual(cfg.get('does.not.exist'), undefined);
		assert.strictEqual(cfg.get('does.not.exist', 'Foo'), 'Foo');
		assert.strictEqual(cfg.user.name, 'Titanium');
		assert.strictEqual(cfg.get().user.name, 'Titanium');
		assert.strictEqual(cfg.get('foo', 'bar'), 'bar');
	});

	it('should get the config path', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		assert.match(cfg.getConfigPath(), /good\.json/);
	});

	it('should apply values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		cfg.apply({
			truthy: 'true',
			falsey: 'false',
			undef: undefined,
			nil: 'null'
		});
		assert.strictEqual(cfg.get('truthy'), true);
		assert.strictEqual(cfg.get('falsey'), false);
		assert.strictEqual(cfg.get('undef'), '');
		assert.strictEqual(cfg.get('nil'), null);
	});

	it('should set values', () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		cfg.set('foo', 'bar');
		assert.strictEqual(cfg.get('foo'), 'bar');
		assert.strictEqual(cfg.foo, 'bar');

		cfg.set('wiz.pow', 'baz');
		assert.deepStrictEqual(cfg.get('wiz.pow'), 'baz');
		assert.deepStrictEqual(cfg.get('wiz'), { pow: 'baz' });
		assert.deepStrictEqual(cfg.wiz, { pow: 'baz' });

		cfg.set('user.favorite.food', 'pizza');
		assert.strictEqual(cfg.user.favorite.food, 'pizza');

		cfg.set('bar');
		assert.strictEqual(cfg.get('bar'), '');

		cfg.set('bar', 'null');
		assert.strictEqual(cfg.get('bar'), null);

		cfg.set('bar', null);
		assert.strictEqual(cfg.get('bar'), null);

		cfg.set('bar', true);
		assert.strictEqual(cfg.get('bar'), true);

		cfg.set('bar', 'true');
		assert.strictEqual(cfg.get('bar'), true);

		cfg.set('bar', false);
		assert.strictEqual(cfg.get('bar'), false);

		cfg.set('bar', 'false');
		assert.strictEqual(cfg.get('bar'), false);

		cfg.set('bar', 123);
		assert.strictEqual(cfg.get('bar'), 123);

		cfg.set('bar', 1.23);
		assert.strictEqual(cfg.get('bar'), '1.23');
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
			assert.strictEqual(json.user.name, 'Titanium');
			assert.strictEqual(json.foo, 'bar');
			assert.deepStrictEqual(json.wiz, { pow: 123 });
			assert.strictEqual(json.baz, undefined);
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

			assert.throws(
				() => {
					cfg.save();
				},
				{
					name: 'Error',
					message: /Unable to write config file/
				}
			);
		} finally {
			await rmdir(dir);
		}
	});

	it('should access error saving the file', async () => {
		const cfg = new TiConfig(join(fixturesDir, 'good.json'));
		assert.throws(
			() => {
				cfg.setConfigPath(join(tmpdir(), 'titanium-cli/foo/bar/config.json'));
				cfg.save();
			},
			{
				name: 'Error',
				message: /Unable to write config file/
			}
		);
	});
});
