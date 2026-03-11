import { detect } from '../../src/util/proxy.js';
import { afterEach, describe, expect, it } from 'vitest';

describe('proxy', () => {
	afterEach(() => {
		delete process.env.http_proxy;
		delete process.env.https_proxy;
	});

	it('should detect if proxy is present', async () => {
		let result = await detect();
		if (typeof result === 'object') {
			expect(Object.hasOwn(result, 'valid')).toBe(true);
		} else {
			expect(result).toBe(false);
		}

		process.env.http_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			expect(Object.hasOwn(result, 'valid')).toBe(true);
		} else {
			expect(result).toBe(false);
		}
		delete process.env.http_proxy;

		process.env.https_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			expect(Object.hasOwn(result, 'valid')).toBe(true);
		} else {
			expect(result).toBe(false);
		}
		delete process.env.https_proxy;
	});
});
