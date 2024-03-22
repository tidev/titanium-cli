/**
 * Looks for proxy settings in some common places like ENV vars, Mac's
 * `networksetup`.
 */
export async function detect() {
	if (process.platform === 'darwin') {
		const { $ } = await import('execa');

		for (const iface of ['Ethernet', 'Wi-Fi']) {
			// while this runs for both interfaces, only one will typically be active
			try {
				const { stdout } = await $`networksetup -getsecurewebproxy ${iface}`;
				if (stdout.includes('Enabled: Yes')) {
					return parseNetSetup(stdout);
				}
			} catch {}

			try {
				const { stdout } = await $`networksetup -getwebproxy ${iface}`;
				if (stdout.includes('Enabled: Yes')) {
					return parseNetSetup(stdout);
				}
			} catch {}
		}

	} else if (process.env.https_proxy !== undefined) {
		// if both configured, https proxy is preferentially returned
		return parseEnv(process.env.https_proxy);

	} else if (process.env.http_proxy !== undefined) {
		return parseEnv(process.env.http_proxy);
	}

	return false;
}

function parseNetSetup(str) {
	const m = str.replace(/\n/g, '').match(/Enabled: YesServer: ((?:http|https)+:\/\/.*)Port: (\d*)Authenticated Proxy Enabled: (\S*)/);
	return {
		valid: !!m,
		server: m?.[1] || '',
		port: m?.[2] || '',
		fullAddress: `${m?.[1] || ''}${m?.[2] ? `:${m[2]}` : ''}`,
		authenticated: m?.[3] || ''
	};
}

function parseEnv(env) {
	try {
		const url = new URL(env);
		return {
			valid: true,
			server: url.hostname,
			port: url.port,
			fullAddress: url.href,
			authenticated: false
		};
	} catch {}
}
