/*
 * titanium.js: Top-level include for the Titanium CLI
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('./config').load(),
	appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	env = appc.environ,
	afs = appc.fs,
	fs = require('fs'),
	async = require('async'),
	colors = require('colors'),
	path = require('path'),
	cli = require('./cli'),
	pkginfo = appc.pkginfo.package(module, 'version', 'about');

require('longjohn');

config.cli.colors || (colors.mode = 'none');

global.tierror = function () {
	var args = Array.prototype.slice.call(arguments);
	args[0] = ('[ERROR] ' + args[0]).red;
	console.error.apply(null, args);
};

global.tiexception = function (ex) {
	if (ex.stack) {
		ex.stack.split('\n').forEach(console.error);
	} else {
		console.error(ex.toString());
	}
};

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
		deployType: 'production'
	}, appc.auth.status()));
}

// when the app exits, submit analytics
process.on('exit', sendAnalytics);

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

// initialize the cli processor
cli.env = env;
cli.version = pkginfo.version;
cli.flag('help', {
		abbr: 'h',
		callback: function (value, logger) {
			if (value) {
				cli.argv._.unshift(cli.argv.$command)
				cli.argv.$command = 'help';
			}
		},
		desc: __('displays help')
	})
	.flag('version', {
		abbr: 'v',
		callback: function (value, logger) {
			value && (cli.argv.$command = 'version');
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
		// find all hooks in the user's config paths
		(function (paths) {
			if (paths) {
				Array.isArray(paths) || (paths = [paths]);
				paths.forEach(function (p) {
					env.scanHooks(appc.fs.resolvePath(p));
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
				cli.run();
				finished();
			}
		]);
	});
