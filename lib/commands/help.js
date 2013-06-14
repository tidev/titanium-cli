/**
 * @overview
 * The help command. Displays the general help screen listing all available
 * commands as well as detailed information for a specific command.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */

/**
 * The help command. Displays the general help screen listing all available
 * commands as well as detailed information for a specific command.
 * @module lib/commands/help
 */

var appc = require('node-appc'),
	__ = appc.i18n(__dirname).__,
	afs = appc.fs,
	string = appc.string,
	async = require('async'),
	path = require('path');

/** Help command description. */
exports.desc = __('displays this help screen');

/**
 * Returns the configuration for the help command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Help command configuration
 */
exports.config = function (logger, config, cli) {
	return {
		noAuth: true
	};
};

/**
 * Displays help information or detailed information about a specific command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
	if (!afs.exists(require('../config').getConfigPath())) {
		logger.log(__('Titanium CLI has not yet been configured.').yellow);
		logger.log(__('Run %s to configure the Titanium CLI.', 'titanium setup').split('titanium setup').map(function (s) { return s.yellow; }).join('titanium setup'.cyan) + '\n');
	}

	var argv = cli.argv,
		command = argv._.shift(),
		subcommand;

	while (command == 'help') {
		command = argv._.shift();
	}
	subcommand = argv._.shift();

	if (argv.exception) {
		logger.exception(argv.exception);
	}

	function printList(heading, items) {
		if (items.length) {
			var maxlen = items.reduce(function (a, b) {
				return Math.max(a, b.name.length);
			}, 0);
			logger.log(heading);

			// sort the items
			var sortedItems = {};
			items.forEach(function (i) {
				sortedItems[i.name] = i.desc || '';
			});

			Object.keys(sortedItems).sort().forEach(function (name) {
				if (sortedItems[name]) {
					logger.log('   %s   %s', string.rpad(name, maxlen).cyan, sortedItems[name]);
				} else {
					logger.log('   %s', string.rpad(name, maxlen).cyan);
				}
			});
			logger.log();
		}
	};

	function printOptionsFlags(ctx, title, skipSubcommands) {

		// TODO: need to do deep analysis of this context

		var subcommands = {},
			args = {},
			flags = {},
			options = {},
			platforms = {};

		dump(ctx);
/*
		Object.keys(ctx).sort().forEach(function (sdk) {
			var s = ctx[sdk];
			if (sdk == '__global__') {
				s.subcommands && Object.keys(s.subcommands)
					.filter(function (name) {
						return !s.subcommands[name].hidden;
					})
					.sort()
					.forEach(function (a) {
						subcommands[a] || (subcommands[a] = []);
						subcommands[a].push(s.subcommands[a]);
					});

				s.args && s.args
					.forEach(function (a) {
						if (a.name) {
							args[a.name] || (args[a.name] = []);
							args[a.name].push(a);
						}
					});

				s.flags && Object.keys(s.flags)
					.filter(function (name) {
						return !s.flags[name].hidden;
					})
					.sort()
					.forEach(function (a) {
						flags[a] || (flags[a] = []);
						flags[a].push(s.flags[a]);
					});

				s.options && Object.keys(s.options)
					.filter(function (name) {
						return !s.options[name].hidden;
					})
					.sort()
					.forEach(function (a) {
						options[a] || (options[a] = []);
						options[a].push(s.options[a]);
					});
			} else {
				Object.keys(s).forEach(function (p) {
					s[p].args && s[p].args
						.forEach(function (a) {
							if (a.name) {
								a.sdk = sdk;
								p != '__global__' && (a.platform = p);
								args[a.name] || (args[a.name] = []);
								args[a.name].push(a);
							}
						});

					s[p].flags && Object.keys(s[p].flags)
						.filter(function (name) {
							return !s[p].flags[name].hidden;
						})
						.sort()
						.forEach(function (name) {
							s[p].flags[name].sdk = sdk;
							p != '__global__' && (s[p].flags[name].platform = p);
							flags[name] || (flags[name] = []);
							flags[name].push(s[p].flags[name]);
						});

					s[p].options && Object.keys(s[p].options)
						.filter(function (name) {
							return !s[p].options[name].hidden;
						})
						.sort()
						.forEach(function (name) {
							s[p].options[name].sdk = sdk;
							p != '__global__' && (s[p].options[name].platform = p);
							options[name] || (options[name] = []);
							options[name].push(s[p].options[name]);
						});

					s[p].platforms && Object.keys(s[p].platforms).sort().forEach(function (platform) {
						var q = s[p].platforms[platform];
						platforms[q.title] || (platforms[q.title] = {
							flags: {},
							options: {}
						});

						q.flags && Object.keys(q.flags)
							.filter(function (name) {
								return !q.flags[name].hidden;
							})
							.sort()
							.forEach(function (name) {
								q.flags[name].sdk = sdk;
								p != '__global__' && (q.flags[name].platform = p);
								platforms[q.title].flags[name] || (platforms[q.title].flags[name] = []);
								platforms[q.title].flags[name].push(q.flags[name]);
							});

						q.options && Object.keys(q.options)
							.filter(function (name) {
								return !q.options[name].hidden;
							})
							.sort()
							.forEach(function (name) {
								q.options[name].sdk = sdk;
								p != '__global__' && (q.options[name].platform = p);
								platforms[q.title].options[name] || (platforms[q.title].options[name] = []);
								platforms[q.title].options[name].push(q.options[name]);
							});
					});
				});
			}
		});

		if (subcommands && !skipSubcommands) {
			printList(__('Subcommands:'),
				Object.keys(subcommands)
					.sort()
					.map(function (name) {
						var s = [];
						subcommands[name].forEach(function (subcommand, j) {
							var n = name;
							s.push({
								name: j > 0 ? n.replace(/./g, ' ') : n,
								desc: subcommand.desc || ''
							});
						});
						return s;
					})
			);
		}

		if (args) {
			printList((title ? title + ' ' : '') + __('Arguments:'),
				Object.keys(args)
					.map(function (arg) {
						var a = [];
						args[arg].forEach(function (i) {
							a.push({
								name: '<' + i.name + '>',
								desc: (i.desc ? i.desc + ' ' : ''),
								params: i.sdk ? ' [--sdk ' + i.sdk + (i.platform ? ' ' + '--platform ' + i.platform : '') + ']' : ''
							});
						});
						return a;
					})
			);
		}

		function printFlags(_title, _flags) {
			if (_flags) {
				printList(_title,
					Object.keys(_flags)
						.map(function (name) {
							var f = [];
							_flags[name].forEach(function (flag) {
								var n = (flag.abbr ? '-' + flag.abbr + ', ' : '') + '--' + name + (flag.negate ? ', --no-' + name : '') + (flag.alias ? '|--' + flag.alias + (flag.negate ? ', --no-' + flag.alt : '') : ''),
									s = (flag.desc ? flag.desc + ' ' : '') + (flag.default != undefined ? ' ' + __('[default: %s]', flag.default) : '').grey;

								f.push({
									name: n,
									desc: s,
									params: flag.sdk ? ' [--sdk ' + flag.sdk + (flag.platform ? ' --platform ' + flag.platform : '') + ']' : ''
								});
							});
							return f;
						})
				);
			}
		}

		function printOptions(_title, _options) {
			if (_options) {
				printList(_title,
					Object.keys(_options)
						.sort()
						.map(function (name) {
							var o = [];
							_options[name].forEach(function (opt) {
								var n = (opt.abbr ? '-' + opt.abbr + ', ' : '') + '--' + name + (opt.alias ? ' | --' + opt.alias : '') + ' ' + (opt.hint ? '<' + opt.hint + '>' : __('<value>')),
									s = (opt.desc ? opt.desc + ' ' : '');

								if ((!config.cli.colors || !opt.values) && opt.default) {
									s += (' [' + __('default') + ': ' + opt.default + ']').grey;
								}

								if (opt.values) {
									s += (' [' + opt.values.map(function (v) {
											return v == opt.default ? v.bold : v;
										}).join(', ') + ']').grey;
								}

								o.push({
									name: n,
									desc: s,
									params: opt.sdk ? ' [--sdk ' + opt.sdk + (opt.platform ? ' --platform ' + opt.platform : '') + ']' : ''
								});
							});
							return o;
						})
				);
			}
		}

		platforms && Object.keys(platforms).forEach(function (platform) {
			printFlags(platform + ' ' + (title ? title + ' ' : '') + __('Flags:'), platforms[platform].flags);
			printOptions(platform + ' ' + (title ? title + ' ' : '') + __('Options:'), platforms[platform].options);
		});
		printFlags((title ? title + ' ' : '') + __('Flags:'), flags);
		printOptions((title ? title + ' ' : '') + __('Options:'), options);
*/
	}

	// check if we have a valid command
	if (command && cli.commands[command]) {

		// command specific usage
/*		var cmdObj = cli.commands[command],
			subcmd;

		function buildUsage(ctx, sub) {
			var conf = ctx,
				required = [],
				optional = [];

			if (sub && conf.subcommands) {
				subcmd = conf.subcommands[sub];
				required.unshift(subcmd ? sub : '<subcommand>');
			} else {
				conf.flags && Object.keys(conf.flags).forEach(function (name) {
					var meta = conf.flags[name];
					if (!meta.hidden) {
						if (meta.required) {
							required.push('--' + name + (meta.alias ? '|--' + meta.alias : ''));
						} else {
							optional.push('[--' + name + (meta.alias ? '|--' + meta.alias : '') + ']');
						}
					}
				});

				conf.options && Object.keys(conf.options).forEach(function (name) {
					var meta = conf.options[name];
					if (!meta.hidden) {
						if (meta.required) {
							required.push('--' + name + (meta.alias ? '|--' + meta.alias : '') + ' ' + (meta.hint ? '<' + meta.hint + '>' : __('<value>')));
						} else {
							optional.push('[--' + name + (meta.alias ? '|--' + meta.alias : '') + ' ' + (meta.hint ? '<' + meta.hint + '>' : __('<value>')) + ']');
						}
					}
				});

				conf.args && conf.args.forEach(function (arg) {
					if (arg.required) {
						required.push('<' + arg.name + '>');
					} else {
						optional.push('[<' + arg.name + '>]');
					}
				});
			}

			ctx.usage = {
				required: required,
				optional: optional
			};
		}

		function load(ctx, sub, callback) {
			var cmd = require(ctx.modulePath);
			if (conf = cmd.config && cmd.config(logger, config, cli)) {
				if (typeof conf == 'function') {
					conf(function (c) {
						Object.keys(c).forEach(function (i) {
							ctx[i] = c[i];
						});
						cmd.title && (ctx.title = cmd.title);
						cmd.desc && (ctx.desc = cmd.desc);
						cmd.extendedDesc && (ctx.extendedDesc = cmd.extendedDesc);
						buildUsage(ctx, sub);
						callback(null, ctx);
					});
					return;
				}
				Object.keys(conf).forEach(function (i) {
					ctx[i] = conf[i];
				});
				cmd.title && (ctx.title = cmd.title);
				cmd.desc && (ctx.desc = cmd.desc);
				cmd.extendedDesc && (ctx.extendedDesc = cmd.extendedDesc);
				buildUsage(ctx, sub);
			}
			callback(null, ctx);
		}

		var tasks = [];

		function buildUsageTasks(ctx, sub, callback) {
			Object.keys(ctx).forEach(function (sdk) {
				if (sdk === '__global__') {
					tasks.push(function (callback) {
						load(ctx[sdk], sub, callback);
					});
				} else {
					// a real sdk
					Object.keys(ctx[sdk]).forEach(function (platform) {
						tasks.push(function (callback) {
							ctx[sdk][platform].contextSDK = sdk;
							load(ctx[sdk][platform], sub, callback);
						});
					});
				}
			});
		}

		subcommand && buildUsageTasks(cmdObj, subcommand);
		buildUsageTasks(cmdObj);

		async.series(tasks, function (err, results) {
			var usages = {},
				label = __('Usage') + ': ';

			results && results.forEach(function (ctx) {
				var required = ctx.usage.required.concat(ctx.usage.optional);

				if (subcmd) {
					subcmd.args && subcmd.args.forEach(function (arg) {
						required.push(arg.required ? '<' + arg.name + '>' : '[<' + arg.name + '>]')
					});
				} else {
					cmdObj.args && cmdObj.args.forEach(function (arg) {
						required.push(arg.required ? '<' + arg.name + '>' : '[<' + arg.name + '>]')
					});
				}

				opts = required.join(' ');
				if (usages[opts]) {
					usages[opts].push(ctx.contextSDK);
				} else {
					usages[opts] = [ ctx.contextSDK ];
				}
			});

			Object.keys(usages).forEach(function (usage, i, arr) {
				if (arr.length == 1) {
					logger.log(label + (cli.argv.$ + ' ' + command + ' ' + usage).cyan);
				} else {
					usages[usage].forEach(function (sdk) {
						logger.log((i == 0 ? label : label.replace(/./g, ' ')) + (cli.argv.$ + ' ' + command + ' ' + (sdk ? '--sdk ' + sdk + ' ' : '') + usage).cyan);
					});
				}
			});
			logger.log();

			var title = '',
				orderedSDKs = Object.keys(cmdObj).sort().reverse();

			// command/subcommand description
			if (subcmd) {
				subcmd.desc && logger.log(subcmd.desc.substring(0, 1).toUpperCase() + subcmd.desc.substring(1) + (/\.$/.test(subcmd.desc) ? '' : '.') + '\n');
			} else {
				// since there can be more than one command implementation, we start with the most recent
				var desc = '',
					i = config.app && config.app.sdk ? orderedSDKs.indexOf(config.app.sdk) : -1,
					lines;

				i >= 0 || (i = 0);
				for (; !desc && i < orderedSDKs.length; i++) {
					if (orderedSDKs[i] == '__global__') {
						desc = cmdObj[orderedSDKs[i]].extendedDesc || (string.capitalize(cmdObj[orderedSDKs[i]].desc) + (/[.!]$/.test(desc) ? '' : '.'));
					} else {
						var platforms = Object.keys(cmdObj[orderedSDKs[i]]).sort(),
							j = 0,
							cmd;
						for (; !desc && j < platforms.length; j++) {
							cmd = cmdObj[orderedSDKs[i]][platforms[j]];
							desc = cmd.extendedDesc || (cmd.desc ? string.capitalize(cmd.desc || '') + (/[.!]$/.test(cmd.desc) ? '' : '.') : '');
						}
					}
				}

				if (desc) {
					var width = parseInt(config.cli && config.cli.width) || 80;
					desc.split('\n').forEach(function (line) {
						var i = 0,
							j = 0,
							k,
							next;
						while (i < line.length) {
							if (line.charAt(i) == '\u001b') {
								// fast forward!
								i += 5;
							} else {
								i++;
								if (++j >= width) {
									// backpedal
									for (k = i; k >= 0; k--) {
										if (/[ .,:;!?]/.test(line[k])) {
											if (k + 1 < line.length) {
												line = line.substring(0, line[k] != ' ' ? k : k + 1) + '\n' + line.substring(k + 1);
												i = k + 1;
												j = 0;
											}
											break;
										}
									}
								}
							}
						}
						logger.log(line);
					});
					logger.log();
				}
			}

			// command title for option/flag heading
			for (var i = 0; !title && i < orderedSDKs.length; i++) {
				if (orderedSDKs[i] == '__global__') {
					title = cmdObj[orderedSDKs[i]].title;
				} else {
					var platforms = Object.keys(cmdObj[orderedSDKs[i]]).sort();
					for (var j = 0; !title && j < platforms.length; j++) {
						title = cmdObj[orderedSDKs[i]][platforms[j]].title;
					}
				}
			}

			// if we have a subcommand, display the subcommand details
			subcmd && printOptionsFlags({ __global__: subcmd }, subcmd.title || string.capitalize(subcommand));

			// display the current command's options/flags/args
			printOptionsFlags(cmdObj, title || cmdObj.title || string.capitalize(command), !!subcmd);

			// display the global options/flags... we have to hack a special __global__ object so options/flags aren't duplicated
			printOptionsFlags({ __global__: cli.commands.__global__ }, __('Global'), !!subcmd);

			finished();
		});
*/
	} else {

		// check if we even know what the command is
		if (command) {
			logger.log(('[ERROR] ' + __('Unrecognized command "%s"', command)).red + '\n');
			string.suggest(command, Object.keys(cli.commands), logger.log);
		}

		// general usage
		logger.log(__('Usage') + ': ' + (cli.argv.$ + ' <command> [options]').cyan + '\n');

		async.parallel(Object.keys(cli.commands)
			.map(function (name) {
				return function (callback) {
					try {
						callback(null, {
							name: name,
							desc: require(cli.commands[name]).desc
						});
					} catch (ex) {
						callback();
					}
				};
			}),
		function (err, results) {
			printList(__('Commands:'), results.filter(function (r) { return !!r; }));
			printOptionsFlags(cli.global, __('Global'));
			finished();
		});
	}
};
