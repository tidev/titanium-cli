/*
 * titanium.js: Top-level include for the Titanium CLI
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require('fs'),
	path = require('path'),
	wrench = require('wrench'),
	colors = require('colors');

require('longjohn');

global.tierror = function (x) {
	var args = Array.prototype.slice.call(arguments);
	args[0] = ''.red && colors.mode != 'none' ? ('[ERROR] ' + args[0]).red : ('[ERROR] ' + args[0]);
	console.error.apply(null, args);
};

global.tiexception = function (ex) {
	if (ex.stack) {
		ex.stack.split('\n').forEach(console.error);
	} else {
		console.error(ex.toString());
	}
};

// Read the locale and bootstrap the CLI as necessary
(function() {
	var configFilePath = path.join(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'config.json'),
		config;
	
	function detectLocale(callback) {
		var exec = require('child_process').exec;
		if (process.platform == 'win32') {
			exec('reg query "HKCU\\Control Panel\\International" /v Locale', function(err, stdout, stderr) {
				if (err) return callback();
				var m = stdout.match(/Locale\s+REG_SZ\s+(.+)/);
				if (m) {
					m = m[1].substring(m[1].length - 4, m[1].length);
					exec('reg query "HKLM\\SOFTWARE\\Classes\\MIME\\Database\\Rfc1766" /v ' + m, function(err, stdout, stderr) {
						if (!err) {
							var m = stdout.match(/REG_SZ\s+([^;,\n]+?);/);
							if (m) return callback(m[1]);
						}
						callback();
					});
					return;
				}
			});
		} else {
			exec('locale', function (err, stdout, stderr) {
				callback(stdout.split('\n').shift().replace(/(LANG=["']?([^\."']+).*)/m, '$2'));
			});
		}
	}
	
	function setLocale(cfg) {
		detectLocale(function (locale) {
			cfg.user || (cfg.user = {});
			cfg.user.locale = locale && locale.trim().toLowerCase().replace(/_/g, '-') || 'en';
			run();
		});
	}
	
	// set path.existsSync to make old modules designed for <=0.6 happy
	path.existsSync = fs.existsSync || path.existsSync;
	
	if (path.existsSync(configFilePath)) {
		try {
			config = JSON.parse(fs.readFileSync(configFilePath));
		} catch(e) {
			run();
			return;
		}
		if (!config || !config.user || !config.user.locale) {
			setLocale(config);
		} else {
			run();
		}
	} else {
		setLocale({});
	}
})();

function run() {
	var config = require('./config').load(),
		appc = require('node-appc'),
		i18n = appc.i18n(__dirname),
		__ = i18n.__,
		__n = i18n.__n,
		env = appc.environ,
		afs = appc.fs,
		async = require('async'),
		cli = require('./cli'),
		pkginfo = appc.pkginfo.package(module, 'version', 'about');
	
	config.cli.colors || (colors.mode = 'none');
	
	cli.addAnalyticsEvent = appc.analytics.addEvent;
	cli.sendAnalytics = sendAnalytics;
	
	function sendAnalytics () {
		// sadly, this will never be called on Windows if the user presses ctrl+c
		appc.analytics.send(appc.util.mix({
			appId: pkginfo.about.id,
			appName: pkginfo.about.name,
			appGuid: 'cf5c67ed-1c3b-494b-afe0-01b958ef0f40',
			directory: path.join('~', '.titanium'),
			version: pkginfo.version,
			deployType: 'production',
			httpProxyServer: config.cli.httpProxyServer
		}, appc.auth.status()));
	}
	
	// when the app exits, submit analytics
	process.setMaxListeners(666);
	process.on('exit', sendAnalytics);
	
	// find all sdks
	env.detect(config.paths.sdks);
	
	// find all built-in commands
	env.scanCommands(env.commands, path.join(path.dirname(module.filename), 'commands'));
	
	// find all commands in the global commands path
	(function (paths) {
		if (paths) {
			Array.isArray(paths) || (paths = [paths]);
			paths.forEach(function (p) {
				env.scanCommands(env.commands, appc.fs.resolvePath(p));
			});
		}
	}(config.paths.commands));
	
	// detect if an sdk was specified at the command line
	var sdkver = config.app.sdk,
		q = process.argv.indexOf('--sdk');
	if (q == -1) {
		q = process.argv.indexOf('-s');
	}
	if (q != -1 && q + 1 < process.argv.length) {
		sdkver = process.argv[q + 1];
	}
	
	// find all commands for the active sdk
	var activeSdk = env.getSDK(sdkver);
	if (activeSdk) {
		if (afs.exists(activeSdk.path, 'node_modules')) {
			env.scanCommands(activeSdk.commands, path.join(activeSdk.path, 'cli', 'commands'));
			Object.keys(activeSdk.platforms).forEach(function (platform) {
				env.scanCommands(activeSdk.platforms[platform].commands, path.join(activeSdk.platforms[platform].path, 'cli', 'commands'));
			});
		}
	}
	
	// initialize the cli processor
	cli.env = env;
	cli.version = pkginfo.version;
	cli.flag('help', {
			abbr: 'h',
			callback: function (value, logger) {
				if (value) {
					cli.argv.$defaultedSubCmd && cli.argv._.shift();
					cli.argv._.unshift(cli.argv.$command);
					cli.argv.$command = 'help';
				}
			},
			desc: __('displays help')
		})
		.flag('version', {
			abbr: 'v',
			callback: function (value, logger) {
				if (value) {
					console.log(pkginfo.version);
					process.exit(0);
				}
			},
			desc: __('displays the current version')
		})
		.flag('colors', {
			callback: function (value, logger) {
				var c = value !== false;
				colors.mode = c ? 'console' : 'none';
				Object.keys(logger.transports).forEach(function (name) {
					logger.transports[name].colorize = c;
				});
			},
			default: true,
			desc: __('use colors in the terminal'),
			negate: true
		})
		.flag('quiet', {
			abbr: 'q',
			callback: function (value, logger) {
				logger.silence(config.cli.quiet = value);
			},
			default: false,
			desc: __('suppress all output')
		})
		.flag('prompt', {
			callback: function (value, logger) {
				config.cli.prompt = !!value;
			},
			default: true,
			desc: __('prompt for missing options'),
			negate: true
		})
		.flag('banner', {
			callback: function (value, logger) {
				logger.bannerEnabled(!!value);
			},
			default: true,
			desc: __('displays Titanium version banner'),
			negate: true
		})
		.then(function (logger) {
			// set the active SDK in the logger so the banner can display it
			activeSdk && (logger.activeSdk = activeSdk.name);
			
			// find all hooks in the user's config paths
			(function (paths) {
				if (paths) {
					Array.isArray(paths) || (paths = [paths]);
					paths.forEach(function (p) {
						cli.scanHooks(appc.fs.resolvePath(p));
					});
				}
			}(config.paths.hooks));
		
			function initCommands(ctx, cmds, sdk, platform) {
				Object.keys(cmds).forEach(function (name) {
					cli.command(name, {
						context: ctx,
						modulePath: cmds[name]
					}, sdk, platform);
				});
			}
		
			initCommands('Global command', env.commands);
			Object.keys(env.sdks).forEach(function (sdk) {
				initCommands('SDK ' + sdk + ' global command', env.sdks[sdk].commands, sdk);
				Object.keys(env.sdks[sdk].platforms).forEach(function (platform) {
					initCommands('SDK ' + sdk + ' platform ' + platform + ' command', env.sdks[sdk].platforms[platform].commands, sdk, platform);
				});
			});
			
			async.series([
				cli.parse,
				function (next) {
					var cmd = cli.argv.$command;
					if (!(cmd && cli.cmds[cmd] && (
						(cli.cmds[cmd].__global__ && cli.cmds[cmd].__global__.skipBanner) ||
						(cli.sdk != null && cli.cmds[cmd][cli.sdk.name] && cli.cmds[cmd][cli.sdk.name].__global__ && cli.cmds[cmd][cli.sdk.name].__global__.skipBanner)
					))) {
						logger.banner();
					}
					next();
				},
				cli.validate,
				function (finished) {
					var enc = process.env.LANG;
					if (logger.bannerWasRendered() && enc && !config.cli.hideCharEncWarning) {
						enc = enc.split('.');
						if (enc.length > 1 && enc[enc.length-1].toLowerCase() != 'utf-8') {
							console.log(__('Detected terminal character encoding as "%s". Some characters may not render properly.', enc[enc.length-1]).yellow);
							console.log(__('It is recommended that you change the character encoding to UTF-8.').yellow + '\n');
						}
					}
					
					cli.run();
					finished();
				}
			]);
		});
}