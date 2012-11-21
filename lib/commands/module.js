/*
 * modules.js: Titanium CLI modules command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = appc.fs,
	path = require('path'),
	platformNames = {
		android: 'Android',
		blackberry: 'BlackBerry',
		commonjs: 'CommonJS',
		iphone: 'iPhone',
		ios: 'iOS',
		mobileweb: 'Mobile Web'
	};

exports.desc = __('manages installed Titanium Modules');

exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: {
			list: {
				desc: __('print a list of installed modules'),
				noAuth: true,
				options: {
					output: {
						abbr: 'o',
						default: 'report',
						desc: __('output format'),
						values: ['report', 'json', 'grid']
					},
					'project-dir': {
						desc: __('the directory of the project to analyze')
					}
				}
			}
		}
	};
};

exports.run = function (logger, config, cli) {
	var subcmd = cli.argv._.shift();
	subcmd != 'list' && logger.banner();
	switch (subcmd) {
		case 'list':
			list(logger, cli.argv, cli.env, config, cli.env.getSDK(config.app.sdk));
			break;
	}
};

function renderModules(title, noneText, modules, logger) {
	logger.log(title.bold + '\n');
	if (Object.keys(modules).length) {
		Object.keys(modules).forEach(function (platform, i) {
			i && logger.log(); // add some whitespace
			
			var platformName = platformNames[platform.toLowerCase()] || appc.string.capitalize(platform);
			logger.log(platformName.grey);
			
			Object.keys(modules[platform]).forEach(function (name) {
				logger.log('  ' + name);
				Object.keys(modules[platform][name]).forEach(function (ver) {
					logger.log('    ' + appc.string.rpad(ver.cyan, 7).cyan + ' ' + modules[platform][name][ver].modulePath);
				});
			});
		});
	} else {
		logger.log(__('No project modules found').grey);
	}
	logger.log();
}

function list(logger, argv, env, config, sdk) {
	var projectDir = argv['project-dir'],
		p = afs.resolvePath(projectDir || '.'),
		searchPaths = [p];
	
	if (afs.exists(p)) {
		while (path.dirname(p) != p) {
			if (afs.exists(path.join(p, 'tiapp.xml'))) {
				projectDir = p;
				break;
			}
			p = path.dirname(p);
		}
	}
	
	sdk && searchPaths.push(afs.resolvePath(sdk.path, '..', '..', '..'));
	config.paths && Array.isArray(config.paths.modules) && (searchPaths = searchPaths.concat(config.paths.modules));
	
	appc.timodule.detect(searchPaths, null, function (modules) {
		if (argv.output == 'json') {
			logger.log(JSON.stringify(modules, null, '\t'));
		} else {
			logger.banner()
			if (Object.keys(modules).length) {
				searchPaths && renderModules(__('Search Path Modules'), __('No project modules found'), modules.project, logger);
				renderModules(__('Global Modules'), __('No global modules found'), modules.global, logger);
			} else {
				logger.log(__('No modules installed') + '\n');
			}
		}
	});
}