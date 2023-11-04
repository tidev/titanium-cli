import { describe, it } from 'node:test';
import assert from 'node:assert';
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
		assert(Object.hasOwn(results, 'data'));
		assert(Object.hasOwn(results, 'platformInfo'));
		assert(Object.hasOwn(results.data.titaniumCLI, 'version'));
		assert.strictEqual(results.data.titaniumCLI.version, '1.2.3');
	}, 60000);

	it('should detect just Titanium development environment', async () => {
		const mockCLI = {
			version: '1.2.3'
		};
		const results = await detect(null, new TiConfig(goodConfig), mockCLI, { titanium: true });
		assert(Object.hasOwn(results, 'data'));
		assert(Object.hasOwn(results, 'platformInfo'));
		assert(Object.hasOwn(results.data.titaniumCLI, 'version'));
		assert.strictEqual(results.data.titaniumCLI.version, '1.2.3');
		assert.strictEqual(results.data.os, undefined);
		assert.strictEqual(results.data.node, undefined);
		assert.strictEqual(results.data.npm, undefined);
		assert.strictEqual(results.data.jdk, undefined);
	}, 60000);
});
