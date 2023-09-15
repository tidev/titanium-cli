import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { request } from '../../src/util/request.js';
import { ticonfig } from '../../src/util/ticonfig.js';
import { createServer } from 'node:http';
import { createProxy } from 'proxy';

let origProxyUrl;

describe('request', () => {
	beforeEach(() => {
		origProxyUrl = ticonfig.get('cli.httpProxyServer');
	});

	afterEach(() => {
		ticonfig.set('cli.httpProxyServer', origProxyUrl);
	});

	it('should fetch github page', async () => {
		const res = await request('https://github.com/tidev/titanium-cli');
		expect(res.statusCode).toEqual(200);
	});

	it('should fetch github page via proxy', async () => {
		const proxyServer = createProxy(createServer());
		proxyServer.listen(9999);

		try {
			ticonfig.set('cli.httpProxyServer', 'http://localhost:9999');

			const res = await request('https://github.com/tidev/titanium-cli');
			expect(res.statusCode).toEqual(200);
		} finally {
			proxyServer.close();
		}
	});
});
