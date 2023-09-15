import { afterEach, describe, expect, it } from 'vitest';
import { detect } from '../../src/util/proxy.js';

describe('proxy', () => {
	afterEach(() => {
		delete process.env.http_proxy;
		delete process.env.https_proxy;
	});

	it('should detect if proxy is present', async () => {
		let result = await detect();
		if (typeof result === 'object') {
			expect(result).toHaveProperty('valid');
		} else {
			expect(result).toEqual(false);
		}

		process.env.http_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			expect(result).toHaveProperty('valid');
		} else {
			expect(result).toEqual(false);
		}
		delete process.env.http_proxy;

		process.env.https_proxy = 'https://user:pass@localhost:8888';
		result = await detect();
		if (typeof result === 'object') {
			expect(result).toHaveProperty('valid');
		} else {
			expect(result).toEqual(false);
		}
		delete process.env.https_proxy;
	});
});
