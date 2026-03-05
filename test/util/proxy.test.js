import { detect } from '../../src/util/proxy.js';
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';

describe('proxy', () => {
	afterEach(() => {
		delete process.env.http_proxy;
		delete process.env.https_proxy;
	});

	it('should detect if proxy is present', async () => {
		let result = await detect();
		if (typeof result === 'object') {
			assert(Object.hasOwn(result, 'valid'));
		} else {
			assert.strictEqual(result, false);
		}

		process.env.http_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			assert(Object.hasOwn(result, 'valid'));
		} else {
			assert.strictEqual(result, false);
		}
		delete process.env.http_proxy;

		process.env.https_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			assert(Object.hasOwn(result, 'valid'));
		} else {
			assert.strictEqual(result, false);
		}
		delete process.env.https_proxy;
	});
});
