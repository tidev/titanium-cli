import { $ } from 'execa';

/**
 * Looks for proxy settings in some common places like ENV vars, Mac's
 * `networksetup`.
 *
 * @param {Function} callback - Function to run when a value has been determined
 */
export async function detect() {
	if (process.platform === 'darwin') {
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
	const p = env.split(':');

	// must account for proxies in the form http://user:pass@example.com:8080
	if (p && p.length && p.length > 1) {
		return {
			valid: true,
			server: p[0] + ':' + p[1],
			port: (p.length > 2) ? p[2] : '',
			fullAddress: p[0] + ':' + p[1] + ((p.length > 2) ? p[2] : ''),
			authenticated: false
		};
	}
}
