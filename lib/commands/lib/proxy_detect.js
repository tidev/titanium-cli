var exec = require('child_process').exec;

/**
 * Looks for proxy settings in some common places like ENV vars, Mac's networksetup
 * @param {Function} callback - Function to run when a value has been determined
 */
exports.detect = function(callback) {
	if (process.platform === 'darwin') {
		['Ethernet', 'Wi-Fi'].forEach(function(svc) {
			// while this runs for both interfaces, only one will typically be active
			exec("networksetup -getsecurewebproxy \"" + svc + "\"", function (err, stdout, stderr) {
				// if both http & https are configured, the https proxy is preferentially returned
				if (stdout.indexOf("Enabled: Yes") !== -1) {
					callback(parseNetSetup(stdout));
				}
			});
			exec("networksetup -getwebproxy \"" + svc + "\"", function (err, stdout, stderr) {
				if (stdout.indexOf("Enabled: Yes") !== -1) {
					callback(parseNetSetup(stdout));
				}
			});
		});
	} else {
		if (process.env['https_proxy'] != undefined) {
			// if both configured, https proxy is preferentially returned
			callback(parseEnv(process.env['https_proxy']));
		} else if (process.env['http_proxy'] != undefined) {
			callback(parseEnv(process.env['http_proxy']));
		}
	}
	callback(false);
};

function parseNetSetup(str) {
	var m = str.replace(/\n/g, '').match(/Enabled: YesServer: ((?:http|https)+:\/\/.*)Port: (\d*)Authenticated Proxy Enabled: (\S*)/);
	return {
		valid: m !== null,
		server: (m && m[1]) ? m[1] : '',
		port: (m && m[2]) ? m[2] : '',
		fullAddress: ((m && m[1]) ? m[1] : '') + ((m && m[2]) ? ':' + m[2] : ''),
		authenticated: (m && m[3]) ? m[3] : ''
	};
}
function parseEnv(env) {
	var p = env.split(':');
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