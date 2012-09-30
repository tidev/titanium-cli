/*
 * modules.js: Titanium CLI modules command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc');

exports.config = function (logger, config, cli) {
	return {
		title: __('Modules'),
		desc: __('manages installed Titanium Modules'),
		skipBanner: true,
		subcommands: {
			list: {
				desc: __('print a list of installed modules'),
				noAuth: true,
				options: {
					output: {
						abbr: 'o',
						default: 'report',
						desc: __('output format'),
						values: ['report', 'json']
					},
					'project-dir': {
						desc: __('the directory of the project to analyze'),
						default: '.'
					}
				}
			}
		}
	};
};

exports.validate = function (logger, config, cli) {
	if (!cli.argv._.length) {
		throw __('Missing subcommand');
	}
};

exports.run = function (logger, config, cli) {
	var subcmd = cli.argv._.shift();
	subcmd != 'list' && logger.banner();
	
	switch (subcmd) {
		case 'list':
			list(logger, cli.argv, cli.env);
			break;
	}
};

function list(logger, argv, env) {
	appc.timodule.detect(argv['project-dir'], this.logger, function (modules) {
		if (argv.output == 'json') {
			logger.log(JSON.stringify(modules, null, '\t'));
		} else {
			logger.banner()
			if (!Object.keys(modules).length) {
				logger.log(__('No modules installed') + '\n');
				return;
			}
			
			Object.keys(modules).sort().forEach(function (name) {
				logger.log(name.bold);
				Object.keys(modules[name]).sort().forEach(function (version) {
					var info = modules[name][version];
					logger.log(version.grey);
					logger.log('   Install Location = ' + info.modulePath.cyan);
					Object.keys(info.platforms).sort().forEach(function (platform, i) {
						logger.log((i ? new Array(23).join(' ')
							: '   Platforms        = ') + platform.cyan);
					});
				});
				logger.log();
			});
		}
	});
}