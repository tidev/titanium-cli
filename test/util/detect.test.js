import { detect } from '../../src/util/detect.js';
import { TiConfig } from '../../src/util/ticonfig.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('detect', () => {
	it('should detect all development environment', async () => {
		const mockCLI = {
			version: '1.2.3',
		};
		const results = await detect(null, new TiConfig(goodConfig), mockCLI);
		expect(Object.hasOwn(results, 'data')).toBe(true);
		expect(Object.hasOwn(results, 'platformInfo')).toBe(true);
		expect(Object.hasOwn(results.data.titaniumCLI, 'version')).toBe(true);
		expect(results.data.titaniumCLI.version).toBe('1.2.3');
	}, 60000);

	it('should detect just Titanium development environment', async () => {
		const mockCLI = {
			version: '1.2.3',
		};
		const results = await detect(null, new TiConfig(goodConfig), mockCLI, { titanium: true });
		expect(Object.hasOwn(results, 'data')).toBe(true);
		expect(Object.hasOwn(results, 'platformInfo')).toBe(true);
		expect(Object.hasOwn(results.data.titaniumCLI, 'version')).toBe(true);
		expect(results.data.titaniumCLI.version).toBe('1.2.3');
		expect(results.data.os).toBe(undefined);
		expect(results.data.node).toBe(undefined);
		expect(results.data.npm).toBe(undefined);
		expect(results.data.jdk).toBe(undefined);
	}, 60000);
});
