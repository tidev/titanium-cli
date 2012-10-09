/*
 * plugins.js: Titanium CLI plugins command
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

exports.desc = __('manages installed Titanium Plugins');

exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: {
			list: {
				desc: __('print a list of installed plugins'),
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
			list(logger, config, cli.argv, cli.env);
			break;
	}
};

function renderPlugins(title, noneText, plugins, logger) {
	logger.log(title.bold + '\n');
	if (plugins && Object.keys(plugins).length) {
		Object.keys(plugins).forEach(function (name, i) {
			i && logger.log(); // add some whitespace
			logger.log(name);
			
			Object.keys(plugins[name]).forEach(function (ver) {
				var p = plugins[name][ver];
				logger.log('  ' + (ver == '-' ? '' : ver.cyan + ' ') + p.pluginPath);
			});
		});
	} else {
		logger.log(__('No project plugins found').grey);
	}
	logger.log();
}

function list(logger, config, argv, env) {
	var projectDir = argv['project-dir'],
		p = afs.resolvePath(projectDir || '.');
	if (afs.exists(p)) {
		while (path.dirname(p) != p) {
			if (afs.exists(path.join(p, 'tiapp.xml'))) {
				projectDir = p;
				break;
			}
			p = path.dirname(p);
		}
	}
	
	appc.tiplugin.detect(projectDir, config, null, function (plugins) {
		if (argv.output == 'json') {
			logger.log(JSON.stringify(plugins, null, '\t'));
		} else {
			logger.banner()
			if (Object.keys(plugins).length) {
				projectDir && renderPlugins(__('Project Plugins'), __('No project plugins found'), plugins.project, logger);
				renderPlugins(__('User Path Plugins'), __('No plugins found in the user path'), plugins.user, logger);
				renderPlugins(__('Global Plugins'), __('No global plugins found'), plugins.global, logger);
			} else {
				logger.log(__('No plugins installed') + '\n');
			}
		}
	});
}
