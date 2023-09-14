import { ticonfig } from './ticonfig.js';

export async function request(url) {
	const opts = {
		connect: {
			rejectUnauthorized: ticonfig.get('cli.rejectUnauthorized', true)
		}
	};

	const proxyUrl = ticonfig.get('cli.httpProxyServer');

	const { Agent, ProxyAgent, request: req } = await import('undici');

	const dispatcher = proxyUrl
		? new ProxyAgent({
			uri: proxyUrl,
			requestTls: opts
		})
		: new Agent(opts);

	return await req(url, { dispatcher });
}
