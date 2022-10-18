/**
 * The plugin command. Reports all installed CLI plugins.
 *
 * @module commands/plugin
 *
 * @see PluginSubcommands
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
	semver = require('semver');

/** Plugin command description. */
exports.desc = __('displays installed Titanium CLI plugins');

/** @namespace PluginSubcommands */
var PluginSubcommands = {};

/**
 * Returns the configuration for the plugin command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Plugin command configuration
 */
exports.config = function (logger, config, cli) {
	var subcommands = {};
	Object.keys(PluginSubcommands).forEach(function (s) {
		subcommands[s] = PluginSubcommands[s].conf(logger, config, cli);
	});
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: subcommands
	};
};

/**
 * Displays all installed modules.
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @param {Function} _finished - Callback when the command finishes
 */
exports.run = function (_logger, _config, _cli, _finished) {
	var action = _cli.argv._.shift();
	action || (action = 'list');
	action !== 'list' && _logger.banner();

	if (PluginSubcommands[action]) {
		PluginSubcommands[action].fn.apply(PluginSubcommands[action].fn, arguments);
	} else {
		_logger.error(__('Invalid subcommand "%s"', action) + '\n');
		appc.string.suggest(action, Object.keys(PluginSubcommands), _logger.log);
		_logger.log(__('Available subcommands:'));
		Object.keys(PluginSubcommands).forEach(function (a) {
			_logger.log('    ' + a.cyan);
		});
		_logger.log();
		_finished();
	}
};

/**
 * Displays a list of all installed modules.
 * @memberof PluginSubcommands
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @param {Function} _finished - Callback when the command finishes
 */
PluginSubcommands.list = {
	conf: function (logger, _config, _cli) {
		return {
			desc: __('print a list of installed CLI plugins'),
			options: {
				output: {
					abbr: 'o',
					default: 'report',
					desc: __('output format'),
					values: [ 'report', 'json' ],
					callback: function (value) {
						logger.jsonOutputEnabled(value !== 'report');
					}
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
				project: __('Project CLI Plugins'),
				config: __('Configured Path CLI Plugins'),
				global: __('Global CLI Plugins')
			},
			confPaths = _config.get('paths.plugins'),
			defaultInstallLocation = _cli.env.installPath,
			sdkLocations = _cli.env.os.sdkPaths.map(function (p) { return afs.resolvePath(p); });

		// attemp to detect if we're in a project folder by scanning for a tiapp.xml
		// until we hit the root
		if (fs.existsSync(p)) {
			while (path.dirname(p) !== p) {
				if (fs.existsSync(path.join(p, 'tiapp.xml'))) {
					fs.existsSync(p = path.join(p, 'plugins')) && searchPaths.project.push(p);
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

		// add any plugins from various sdk locations
		sdkLocations.indexOf(defaultInstallLocation) === -1 && sdkLocations.push(defaultInstallLocation);
		_cli.sdk && sdkLocations.push(afs.resolvePath(_cli.sdk.path, '..', '..', '..'));
		sdkLocations.forEach(function (p) {
			fs.existsSync(p = afs.resolvePath(p, 'plugins')) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && searchPaths.global.indexOf(p) === -1 && (searchPaths.global.push(p));
		});

		appc.tiplugin.scopedDetect(searchPaths, _config, null, function (results) {
			if (_cli.argv.output === 'json') {
				_logger.log(JSON.stringify(results, null, '\t'));
			} else {
				_logger.banner();

				_cli.emit('cli:check-plugins');

				Object.keys(results).forEach(function (scope) {
					var plugins = results[scope],
						names = Object.keys(plugins);

					if (scope === 'project' && projectDir === undefined && !names.length) {
						// no sense printing project plugins if there aren't any and the
						// user never asked to see them
						return;
					}

					_logger.log(scopeLabels[scope].bold);

					if (names.length) {
						names.forEach(function (name, i) {
							i && _logger.log(); // add some whitespace

							_logger.log(name.grey);

							function render(items, name, notFound) {
								if (items.length) {
									items.forEach(function (s, i) {
										var pre = i ? '               ' : '  ' + appc.string.rpad(name, 10) + ' = ';
										_logger.log(pre + s.name.cyan + (s.version ? (' (v' + s.version + ')').grey : '')
											+ (s.cliVersion && !semver.satisfies(_cli.version, s.cliVersion)
												? (' [' + __('requires CLI version %s or newer', s.cliVersion) + ']').red : ''));
									});
								} else {
									_logger.log('  ' + appc.string.rpad(name, 10) + ' = ' + notFound.cyan);
								}
							}

							Object.keys(plugins[name]).forEach(function (ver) {
								var info = plugins[name][ver];
								_logger.log('  ' + __('Version') + '    = ' + ver.cyan);
								_logger.log('  ' + __('Location') + '   = ' + info.pluginPath.cyan);
								render(info.commands, __('Commands'), __('No commands found'));
								render(info.hooks, __('Hooks'), __('No hooks found'));
								// manifest info?
							});
						});
					} else {
						_logger.log(__('No CLI plugins found').grey);
					}

					_logger.log();
				});
			}
			_finished();
		});
	}
};
