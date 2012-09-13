/*
 * titanium.js: Top-level include for the Titanium CLI
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('./config').load(),
	appc = require('node-appc'),
	env = appc.environ,
	async = require('async'),
	colors = require('colors'),
	path = require('path'),
	cli = require('./cli');

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

appc.analytics.addEvent('clicked something', { value: 'hi there' });

// initialze i18n
require('i18n').configure({
	directory: path.join(module.filename, '..', '..', 'locales'),
	register: global
});

// when the app exits, submit analytics
process.on('exit', function () {
	// sadly, this will never be called on Windows if the user presses ctrl+c
	var info = appc.pkginfo.package(module, 'version', 'about');
	
	appc.analytics.send({
		appId: info.about.id,
		appName: info.about.name,
		appGuid: info.about.guid,
		directory: path.join('~', '.titanium'),
		version: info.version,
		deployType: 'production'
	});
});

// find all built-in commands
env.scanCommands(env.commands, path.join(path.dirname(module.filename), 'commands'));

// initialize the cli processor
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
		desc: __('prompt for missing options')
	})
	.then(function (logger) {
		this.env = env;
		
		function initCommands(ctx, cmds, sdk, platform) {
			Object.keys(cmds).forEach(function (name) {
				cli.command(name, {
					context: ctx,
					modulePath: cmds[name]
				}, sdk, platform);
			});
		}
		
		initCommands('Global command', env.commands);
		//initCommands('Project command', env.project.commands);
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
				if (!cmd || !cli.cmds[cmd] || !cli.cmds[cmd].__global__ || !cli.cmds[cmd].__global__.skipBanner) {
					logger.banner();
				}
				/*
				projectDir = argv['project-dir'] || '';
				if (projectDir) {
					projectDir = util.resolvePath(projectDir);
					util.exists(projectDir) || (projectDir = process.cwd());
					util.exists(projectDir) && scanCommands(env.project.commands, path.join(projectDir, 'modules', 'cli', 'commands'));
				}
				*/
				next();
			},
			cli.validate,
			function (finished) {
				cli.run();
				finished();
			}
		]);
	});
