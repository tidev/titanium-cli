/*
 * titanium.js: Top-level include for the Titanium CLI
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('./config').load(),
	appc = require('node-appc'),
	env = appc.environ,
	colors = require('colors'),
	path = require('path'),
	cli = require('./cli');

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
		directory: '~/.titanium',
		version: info.version,
		deployType: 'production'
	});
});

// find all built-in commands
env.scanCommands(env.commands, path.join(path.dirname(module.filename), 'commands'));

// initialize the cli processor
cli.flag('help', {
		abbr: 'h',
		callback: function (value, logger, cli) {
			if (value) {
				cli.argv._.unshift(cli.argv.$command)
				cli.argv.$command = 'help';
			}
		},
		desc: __('displays help'),
		optional: true
	})
	.flag('version', {
		abbr: 'v',
		callback: function (value, logger, cli) {
			value && (cli.argv.$command = 'version');
		},
		desc: __('displays the current version'),
		optional: true
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
		negate: true,
		optional: true
	})
	.flag('quiet', {
		abbr: 'q',
		callback: function (value, logger, cli) {
			logger.silence(config.cli.quiet = value);
		},
		default: false,
		desc: __('suppress all output'),
		optional: true
	})
	.then(function (logger) {
		cli.env = env;
		
		function initCommands(cmds, sdk, platform) {
			Object.keys(cmds).forEach(function (name) {
				cli.command(name, {
					modulePath: cmds[name]
				}, sdk, platform);
			});
		}
		
		initCommands(env.commands);
		initCommands(env.project.commands);
		Object.keys(env.sdks).forEach(function (sdk) {
			initCommands(env.sdks[sdk].commands, sdk);
			Object.keys(env.sdks[sdk].platforms).forEach(function (platform) {
				initCommands(env.sdks[sdk].platforms[platform].commands, sdk, platform);
			});
		});
	})
	.parse()
	.then(function (logger) {
		logger.banner(); // TODO: check if this command wants a banner
		/*
		projectDir = argv['project-dir'] || '';
		if (projectDir) {
			projectDir = util.resolvePath(projectDir);
			util.exists(projectDir) || (projectDir = process.cwd());
			util.exists(projectDir) && scanCommands(env.project.commands, path.join(projectDir, 'modules', 'cli', 'commands'));
		}
		*/
	})
	.validate(function () {
		cli.run();
	});
