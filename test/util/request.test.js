import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { request } from '../../src/util/request.js';
import { ticonfig } from '../../src/util/ticonfig.js';
import { createServer } from 'node:http';
import { createProxy } from 'proxy';

let origProxyUrl;

describe('request', () => {
	beforeEach(() => {
		origProxyUrl = ticonfig.get('cli.httpProxyServer');
		ticonfig.set('cli.httpProxyServer', undefined);
	});

	afterEach(() => {
		ticonfig.set('cli.httpProxyServer', origProxyUrl);
	});

	it('should fetch TiDev page', async () => {
		const res = await request('https://github.com');
		await res.body.text();
		assert.strictEqual(res.statusCode, 200);
	});

	it('should fetch TiDev page via proxy', async () => {
		const connections = {};
		const server = createServer();
		server.on('connection', function (conn) {
			const key = `${conn.remoteAddress}:${conn.remotePort}`;
			connections[key] = conn;
			conn.on('close', () => {
				delete connections[key];
			});
		});
		createProxy(server).listen(9999);

		try {
			ticonfig.set('cli.httpProxyServer', 'http://localhost:9999');

			const res = await request('https://github.com');
			await res.body.text();
			assert.strictEqual(res.statusCode, 200);
		} finally {
			for (const conn of Object.values(connections)) {
				conn.destroy();
			}
			await new Promise(resolve => server.close(resolve));
		}
	}, 10000);
});
