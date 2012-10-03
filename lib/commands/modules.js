/*
 * modules.js: Titanium CLI modules command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	mix = appc.util.mix,
	async = require('async');

exports.config = function (logger, config, cli) {
	return {
		title: __('Modules'),
		desc: __('manages installed Titanium Modules'),
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
						values: ['report', 'json']
					},
					'project-dir': {
						desc: __('the directory of the project to analyze'),
						default: '.'
					}
				}
			},
			activate: {
				desc: __('activate a module, deactivating any active versions of the module in the process'),
				noAuth: true,
				options: {
					'project-dir': {
						desc: __('the directory of the project to analyze'),
						default: '.'
					}
				},
				args: [
					{
						name: 'module',
						desc: __('the name of the module to activate'),
						required: true
					},
					{
						name: 'module-version',
						desc: __('the version of the module to activate'),
						required: true
					}
				]
			},
			deactivate: {
				desc: __('deactivate a module, making all versions of the module unavailable'),
				noAuth: true,
				options: {
					'project-dir': {
						desc: __('the directory of the project to analyze'),
						default: '.'
					}
				}
			}
		}
	};
};

exports.validate = function(logger, config, cli) {
	switch(cli.argv.$subcommand) {
		case 'activate':
			if (cli.argv._.length !== 3) {
				logger.banner();
				logger.error(__('Module name and version are required') + '\n');
				process.exit(1);
			}
			break;
		case 'deactivate':
			if (cli.argv._.length !== 2) {
				logger.banner();
				logger.error(__('Module name is required') + '\n');
				process.exit(1);
			}
			break;
	}
};

exports.run = function (logger, config, cli) {
	var subcmd = cli.argv._.shift();
	subcmd != 'list' && logger.banner();
	
	switch (subcmd) {
		case 'list':
			list(logger, cli.argv, cli.env);
			break;
		case 'activate':
			activate(logger, cli.argv, cli.env);
			break;
		case 'deactivate':
			deactivate(logger, cli.argv, cli.env);
			break;
	}
};

function list(logger, argv, env) {
	
	var globalModules,
		projectModules;
	async.parallel([
		function(next) {
			appc.timodule.getGlobalModules(function(modules) {
				next(null, modules);
			});
		},
		function(next) {
			appc.timodule.getProjectModules(argv['project-dir'], function(modules) {
				next(null, modules);
			});
		}
	], function(err, results) {
		results = mix(results[0], results[1]);
		if (argv.output == 'json') {
			logger.log(JSON.stringify(results, null, '\t'));
		} else {
			logger.banner();
			if (!Object.keys(results).length) {
				logger.log(__('No modules installed') + '\n');
				return;
			}
			Object.keys(results).sort().forEach(function (name) {
				logger.log(name.bold);
				Object.keys(results[name]).sort().forEach(function (version) {
					var info = results[name][version];
					logger.log(version.grey + (info.activated ? ' (activated)'.grey : ''));
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

function activate(logger, argv, env) {
	async.parallel([
		function(next) {
			appc.timodule.getGlobalModules(function(modules) {
				next(null, modules);
			});
		},
		function(next) {
			appc.timodule.getProjectModules(argv['project-dir'], function(modules) {
				next(null, modules);
			});
		}
	], function(err, results) {
		var module = argv._[0],
			version = argv._[1],
			globalResults = results[0],
			projectResults = results[1];
		
		logger.banner();
		if (globalResults[module]) {
			if (globalResults[module][version]) {
				appc.timodule.activateGlobalModule(module, version);
				logger.log(__('Module %s version %s was activated successfully', module.cyan, version.cyan) + '\n');
			} else {
				logger.error(__('Invalid module version %s', version) + '\n');
				process.exit(1);
			}
		} else if (projectResults[module]) {
			if (projectResults[module][version]) {
				appc.timodule.activateProjectModule(argv['project-dir'], module, version);
				logger.log(__('Module %s version %s was activated successfully', module.cyan, version.cyan) + '\n');
			} else {
				logger.error(__('Invalid module version %s', version) + '\n');
				process.exit(1);
			}
		} else {
			logger.error(__('Unknown module %s', module) + '\n');
			process.exit(1);
		}
	});
}

function deactivate(logger, argv, env) {
	async.parallel([
		function(next) {
			appc.timodule.getGlobalModules(function(modules) {
				next(null, modules);
			});
		},
		function(next) {
			appc.timodule.getProjectModules(argv['project-dir'], function(modules) {
				next(null, modules);
			});
		}
	], function(err, results) {
		var module = argv._[0],
			globalResults = results[0],
			projectResults = results[1];
		
		logger.banner();
		if (globalResults[module]) {
			appc.timodule.deactivateGlobalModule(module);
			logger.log(__('Module %s was deactivated successfully', module.cyan) + '\n');
		} else if (projectResults[module]) {
			appc.timodule.deactivateProjectModule(argv['project-dir'], module);
			logger.log(__('Module %s was deactivated successfully', module.cyan) + '\n');
		} else {
			logger.error(__('Unknown module %s', module) + '\n');
			process.exit(1);
		}
	});
}