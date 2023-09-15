import { describe, expect, it } from 'vitest';
import { detect } from '../../src/util/detect.js';
import { TiConfig } from '../../src/util/ticonfig.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const goodConfig = join(fileURLToPath(import.meta.url), '../fixtures/ticonfig/good.json');

describe('detect', () => {
	it('should detect all development environment', async () => {
		const mockCLI = {
			version: '1.2.3'
		};
		const results = await detect(null, new TiConfig(goodConfig), mockCLI);
		expect(results).toHaveProperty('data');
		expect(results).toHaveProperty('platformInfo');
		expect(results.data.titaniumCLI).toBeInstanceOf(Object);
		expect(results.data.titaniumCLI).toHaveProperty('version');
		expect(results.data.titaniumCLI.version).toEqual('1.2.3');
	}, 60000);

	it('should detect just Titanium development environment', async () => {
		const mockCLI = {
			version: '1.2.3'
		};
		const results = await detect(null, new TiConfig(goodConfig), mockCLI, { titanium: true });
		expect(results).toHaveProperty('data');
		expect(results).toHaveProperty('platformInfo');
		expect(results.data.titaniumCLI).toBeInstanceOf(Object);
		expect(results.data.titaniumCLI).toHaveProperty('version');
		expect(results.data.titaniumCLI.version).toEqual('1.2.3');
		expect(results.data.os).toEqual(undefined);
		expect(results.data.node).toEqual(undefined);
		expect(results.data.npm).toEqual(undefined);
		expect(results.data.jdk).toEqual(undefined);
	}, 60000);
});
