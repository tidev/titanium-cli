/**
 * The module command. Reports all installed modules.
 *
 * @module commands/module
 *
 * @see ModuleSubcommands
 *
 * @copyright
 * Copyright TiDev, Inc. 04/07/2022-Present
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */
'use strict';

var appc = require('node-appc'),
	__ = appc.i18n(__dirname).__,
	afs = appc.fs,
	fs = require('fs'),
	path = require('path'),

	// if a platform is not in this map, then we just print the capitalized platform name
	platformNames = {
		android: 'Android',
		blackberry: 'BlackBerry',
		commonjs: 'CommonJS',
		iphone: 'iPhone',
		ios: 'iOS',
		mobileweb: 'Mobile Web',
		tizen: 'Tizen'
	};

/** Module command description. */
exports.desc = __('displays installed Titanium modules');

/** @namespace ModuleSubcommands */
var ModuleSubcommands = {};

/**
 * Returns the configuration for the module command.
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @returns {Object} Module command configuration
 */
exports.config = function (_logger, _config, _cli) {
	var subcommands = {};
	Object.keys(ModuleSubcommands).forEach(function (s) {
		subcommands[s] = ModuleSubcommands[s].conf(_logger, _config, _cli);
	});
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: subcommands
	};
};

/**
 * Displays all installed modules.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
	var action = cli.argv._.shift();
	action || (action = 'list');
	action !== 'list' && logger.banner();

	if (ModuleSubcommands[action]) {
		ModuleSubcommands[action].fn.apply(ModuleSubcommands[action].fn, arguments);
	} else {
		logger.error(__('Invalid subcommand "%s"', action) + '\n');
		appc.string.suggest(action, Object.keys(ModuleSubcommands), logger.log);
		logger.log(__('Available subcommands:'));
		Object.keys(ModuleSubcommands).forEach(function (a) {
			logger.log('    ' + a.cyan);
		});
		logger.log();
		finished();
	}
};

/**
 * Displays a list of all installed modules.
 * @memberof ModuleSubcommands
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @param {Function} _finished - Callback when the command finishes
 */
ModuleSubcommands.list = {
	conf: function (_logger, _config, _cli) {
		return {
			desc: __('print a list of installed modules'),
			options: {
				output: {
					abbr: 'o',
					default: 'report',
					desc: __('output format'),
					values: [ 'report', 'json' ]
				},
				'project-dir': {
					desc: __('the directory of the project to search')
				}
			}
		};
	},
	fn: function list(_logger, _config, _cli, _finished) {
		var projectDir = _cli.argv['project-dir'],
			p = afs.resolvePath(projectDir || '.'),
			searchPaths = {
				project: [],
				config: [],
				global: []
			},
			scopeLabels = {
				project: __('Project Modules'),
				config: __('Configured Path Modules'),
				global: __('Global Modules')
			},
			confPaths = _config.get('paths.modules'),
			defaultInstallLocation = _cli.env.installPath,
			sdkLocations = _cli.env.os.sdkPaths.map(function (p) { return afs.resolvePath(p); });

		// attemp to detect if we're in a project folder by scanning for a tiapp.xml
		// until we hit the root
		if (fs.existsSync(p)) {
			while (path.dirname(p) !== p) {
				if (fs.existsSync(path.join(p, 'tiapp.xml'))) {
					fs.existsSync(p = path.join(p, 'modules')) && searchPaths.project.push(p);
					break;
				}
				p = path.dirname(p);
			}
		}

		// set our paths from the config file
		Array.isArray(confPaths) || (confPaths = [ confPaths ]);
		confPaths.forEach(function (p) {
			p && fs.existsSync(p = afs.resolvePath(p)) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && (searchPaths.config.push(p));
		});

		// add any modules from various sdk locations
		sdkLocations.indexOf(defaultInstallLocation) === -1 && sdkLocations.push(defaultInstallLocation);
		_cli.sdk && sdkLocations.push(afs.resolvePath(_cli.sdk.path, '..', '..', '..'));
		sdkLocations.forEach(function (p) {
			fs.existsSync(p = afs.resolvePath(p, 'modules')) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && searchPaths.global.indexOf(p) === -1 && (searchPaths.global.push(p));
		});

		appc.timodule.scopedDetect(searchPaths, _config, null, function (results) {
			if (_cli.argv.output === 'json') {
				// alias ios to iphone for backwards compatibility
				if (results.global && results.global.ios) {
					results.global.iphone = results.global.ios;
				}
				_logger.log(JSON.stringify(results, null, '\t'));
			} else {
				_logger.banner();

				Object.keys(results).forEach(function (scope) {
					var modules = results[scope],
						platforms = Object.keys(modules);

					if (scope === 'project' && projectDir === undefined && !platforms.length) {
						// no sense printing project modules if there aren't any and the
						// user never asked to see them
						return;
					}

					_logger.log(scopeLabels[scope].bold);

					if (platforms.length) {
						platforms.forEach(function (platform, i) {
							i && _logger.log(); // add some whitespace

							var platformName = platformNames[platform.toLowerCase()] || appc.string.capitalize(platform);
							_logger.log(platformName.grey);

							Object.keys(modules[platform]).forEach(function (name) {
								_logger.log('  ' + name);
								Object.keys(modules[platform][name]).forEach(function (ver) {
									_logger.log('    ' + appc.string.rpad(ver, 7).cyan + ' ' + modules[platform][name][ver].modulePath);
								});
							});
						});
					} else {
						_logger.log(__('No modules found').grey);
					}

					_logger.log();
				});
			}
			_finished();
		});
	}
};
