/**
 * @overview
 * Main entry point for the Titanium CLI. Responsible for loading the CLI
 * configuration, initializing the i18n system, wiring up analytics, defining
 * global options and flags, and running the main CLI logic.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

/** @module lib/titanium */

var fs = require('fs'),
	path = require('path'),
	colors = require('colors');

// set path.existsSync to make old modules designed for <=0.6 happy
path.existsSync = fs.existsSync || path.existsSync;

require('longjohn');

// read the locale and bootstrap the CLI as necessary
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

	if (fs.existsSync(configFilePath)) {
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
		__ = appc.i18n(__dirname).__,
		env = appc.environ,
		afs = appc.fs,
		logger = require('./logger'),
		pkginfo = appc.pkginfo.package(module, 'version', 'about');

	config.cli.colors || (colors.mode = 'none');

	// when the app exits, submit analytics
	process.setMaxListeners(666);
	process.on('exit', function () {
		// sadly, this will never be called on Windows if the user presses ctrl+c
		appc.analytics.send(appc.util.mix({
			appId: pkginfo.about.id,
			appName: pkginfo.about.name,
			appGuid: 'cf5c67ed-1c3b-494b-afe0-01b958ef0f40',
			directory: path.join('~', '.titanium'),
			version: pkginfo.version,
			deployType: 'production',
			httpProxyServer: config.cli.httpProxyServer,
			showErrors: false // TODO: wire up to a config option
		}, appc.auth.status()));
	});

	// find all Titanium sdks
	env.detectTitaniumSDKs(config.paths.sdks);

	// initialize the cli processor
	var cli = new (require('./cli'))({
		config: config,
		env: env,
		logger: logger,
		version: pkginfo.version
	});

	// define the global flags
	cli.flag({
		'help': {
			abbr: 'h',
			callback: function (value) {
				if (value) {
					//cli.argv.$defaultedSubCmd && cli.argv._.shift();
					cli.argv._.unshift('help');
					cli.argv.$command = 'help';
				}
			},
			desc: __('displays help')
		},
		'version': {
			abbr: 'v',
			callback: function (value) {
				if (value) {
					console.log(pkginfo.version);
					process.exit(0);
				}
			},
			desc: __('displays the current version')
		},
		'colors': {
			callback: function (value) {
				var c = value !== false;
				colors.mode = c ? 'console' : 'none';
				Object.keys(logger.transports).forEach(function (name) {
					logger.transports[name].colorize = c;
				});
			},
			default: true,
			desc: __('use colors in the terminal'),
			negate: true
		},
		'quiet': {
			abbr: 'q',
			callback: function (value) {
				logger.silence(config.cli.quiet = value);
			},
			default: false,
			desc: __('suppress all output')
		},
		'prompt': {
			callback: function (value) {
				config.cli.prompt = !!value;
			},
			default: true,
			desc: __('enable interactive prompting'),
			negate: true
		},
		'banner': {
			callback: function (value) {
				logger.bannerEnabled(!!value);
			},
			default: true,
			desc: __('displays Titanium version banner'),
			negate: true
		}
	});

	// define the global options
	cli.option('sdk', {
		abbr: 's',
		callback: function (value) {
			// a null sdk version will always select the latest sdk
			return value.toLowerCase() == 'latest' ? null : value;
		},
		default: 'latest',
		desc: __('Titanium SDK version to use to bootstrap SDK-level commands and parse the tiapp.xml; actual Titanium SDK used determined by %s in the tiapp.xml', '<sdk-version>'.cyan)
	});

	// after the global args are parsed, we should be able to figure out which
	// Titanium SDK we're using
	cli.on('cli:global-args-parsed', function (data, finished) {
		var sdkName = cli.argv.sdk || config.app.sdk,
			sdk = cli.sdk = env.getSDK(sdkName),
			// get a list of all valid sdks 3.0 and newer
			sdks = Object.keys(env.sdks).filter(function (v) {
				return appc.version.gte(v, '3.0.0');
			});

		// check that we have an sdk
		if (!sdk) {
			logger.banner();
			if (sdks.length) {
				logger.error(__('Invalid Titanium SDK "%s"', sdkName) + '\n');
				appc.string.suggest(sdkName, sdks, logger.log);
				logger.log(__('Available Titanium SDKs:'));
				sdks.forEach(function (sdk) {
					logger.log('    ' + sdk.cyan);
				});
				logger.log();
			} else {
				// you need to install an sdk!
				logger.log(__('No Titanium SDKs found!') + '\n');
				logger.log(__("You can download the latest Titanium SDK by running '%s'", (cli.argv.$ + ' sdk install --default').cyan) + '\n');
			}
			process.exit(1);
		}

		// check that the sdk isn't too old
		if (appc.version.lt(sdk.manifest && sdk.manifest.version || sdk.name, '3.0.0')) {
			logger.banner();
			logger.error(__('Specified Titanium SDK "%s" is too old', sdkName) + '\n');
			logger.log(__("You can download the latest Titanium SDK by running '%s'", (cli.argv.$ + ' sdk install --default').cyan) + '\n');
			process.exit(1);
		}

		// update the argv value
		cli.argv.sdk = sdk.name;

		// tell the logger the sdk name so it can display it in the banner
		logger.activeSdk = sdk.name;

		finished();
	});

	// just before validation begins is the earliest we know whether the banner
	// should be displayed, so we hook into the pre-validate hook
	cli.on('cli:pre-validate', function (data, finished) {
		if (!cli.command.conf.skipBanner) {
			logger.banner();
			if (logger.bannerWasRendered()) {
				// check if the analytics files are writable
				var pp = ['~/.titanium/analytics.json', '~/.titanium/analytics_session.json'].filter(function (p) {
					return !afs.isFileWritable(p);
				}).shift();
				if (pp) {
					console.warn(__('Required file %s is not writable.', pp).split(pp).map(function (p) { return p.yellow; }).join(pp.cyan));
					console.warn(__('Please ensure the Titanium CLI has access to modify this file.').yellow + '\n');
				}

				// check that the terminal has the correct encoding
				var enc = process.env.LANG;
				if (enc && !config.cli.hideCharEncWarning) {
					enc = enc.split('.');
					if (enc.length > 1 && enc[enc.length-1].toLowerCase() != 'utf-8') {
						console.warn(__('Detected terminal character encoding as "%s". Some characters may not render properly.', enc[enc.length-1]).yellow);
						console.warn(__('It is recommended that you change the character encoding to UTF-8.').yellow + '\n');
					}
				}
			}
		}
		finished();
	});

	// run the cli
	cli.go();
}