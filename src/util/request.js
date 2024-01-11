import { ticonfig } from './ticonfig.js';

export async function request(url, opts = {}) {
	const { Agent, ProxyAgent, request: req } = await import('undici');
	const proxyUrl = ticonfig.get('cli.httpProxyServer');
	const requestTls = {
		connect: {
			rejectUnauthorized: ticonfig.get('cli.rejectUnauthorized', true)
		}
	};

	const dispatcher = proxyUrl
		? new ProxyAgent({
			uri: proxyUrl,
			requestTls
		})
		: new Agent(requestTls);

	return await req(url, {
		dispatcher,
		reset: true,
		...opts,
		headers: {
			Connection: 'close',
			...opts.headers
		}
	});
}
