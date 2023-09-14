import { describe, expect, it } from 'vitest';
import { Tiapp } from '../../src/util/tiapp.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures/tiapp');

describe('Tiapp', () => {
	it('should load a tiapp with an sdk version', async () => {
		const tiapp = new Tiapp();
		await tiapp.load(join(fixturesDir, 'hassdk.xml'));

		const value = await tiapp.select1('//sdk-version', '0.0.0');
		expect(value).toEqual('1.2.3');
	});

	it('should load a tiapp without an sdk version', async () => {
		const tiapp = new Tiapp();
		await tiapp.load(join(fixturesDir, 'nosdk.xml'));

		let value = await tiapp.select1('//sdk-version', '0.0.0');
		expect(value).toEqual('0.0.0');

		value = await tiapp.select1('//sdk-version');
		expect(value).toEqual(undefined);
	});

	it('should load a tiapp without a pin', async () => {
		const tiapp = new Tiapp();
		await tiapp.load(join(fixturesDir, 'nopin.xml'));

		const value = await tiapp.select1('//sdk-version', '0.0.0');
		expect(value).toEqual('1.2.3');
	});

	it('should error if file does not exist', async () => {
		const tiapp = new Tiapp();
		await expect(tiapp.load(join(fixturesDir, 'does_not_exist')))
			.rejects.toMatch(/File not found:/);
	});

	it('should error selecting if no file loaded', async () => {
		const tiapp = new Tiapp();
		await expect(tiapp.select1())
			.rejects.toMatch(/No tiapp.xml loaded/);
	});

	it('should error loading if file is malformed', async () => {
		const tiapp = new Tiapp();
		await expect(tiapp.load(join(fixturesDir, 'bad.xml')))
			.rejects.toMatch(/xmldom warning/);
	});
});
