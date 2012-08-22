/*
 * help.js: Titanium CLI help command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var string = require('node-appc').string,
	path = require('path');

require('pkginfo')(module, 'version', 'about');

exports.config = function (logger, config, cli) {
	return {
		desc: __('displays this help screen')
	};
};

exports.run = function (logger, config, cli) {
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
				return Math.max(a, (Array.isArray(b[0]) ? b[0][0] : b[0]).length);
			}, 0);
			console.log(heading);
			items.forEach(function (item) {
				if (Array.isArray(item)) {
					item.forEach(function (i) {
						console.log('   %s   %s', string.rpad(i[0], maxlen).cyan, i[1] || "");
					});
				} else {
					console.log('   %s   %s', string.rpad(item[0], maxlen).cyan, item[1] || "");
				}
			});
			console.log();
		}
	};
	
	function printOptionsFlags(ctx, title, skipSubcommands) {
		var subcommands = {},
			args = {},
			flags = {},
			options = {};
		
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
						.forEach(function (a) {
							s[p].flags[a].sdk = sdk;
							p != '__global__' && (s[p].flags[a].platform = p);
							flags[a] || (flags[a] = []);
							flags[a].push(s[p].flags[a]);
						});
					
					s[p].options && Object.keys(s[p].options)
						.filter(function (name) {
							return !s[p].options[name].hidden;
						})
						.sort()
						.forEach(function (a) {
							s[p].options[a].sdk = sdk;
							p != '__global__' && (s[p].options[a].platform = p);
							options[a] || (options[a] = []);
							options[a].push(s[p].options[a]);
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
							s.push([
								j > 0 ? n.replace(/./g, ' ') : n,
								subcommand.desc
							]);
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
						args[arg].forEach(function (i, j) {
							var n = '<' + i.name + '>';
							a.push([
								j > 0 ? n.replace(/./g, ' ') : n,
								i.desc + ' ' + (i.sdk ? ' [--sdk ' + i.sdk + (i.platform ? ' ' + '--platform ' + i.platform : '') + ']' : '')
							]);
						});
						return a;
					})
			);
		}
		
		if (flags) {
			printList((title ? title + ' ' : '') + __('Flags:'),
				Object.keys(flags)
					.map(function (name) {
						var f = [];
						flags[name].forEach(function (flag, j) {
							var n = (flag.abbr ? '-' + flag.abbr + ', ' : '') + '--' + name + (flag.negate ? ', --no-' + name : '') + (flag.alias ? '|--' + flag.alias + (flag.negate ? ', --no-' + flag.alt : '') : '');
							f.push([
								j > 0 ? n.replace(/./g, ' ') : n,
								flag.desc + ' ' + (flag.default ? '  ' + __('[default: %s]', flag.default) : '') + (flag.sdk ? ' [--sdk ' + flag.sdk + (flag.platform ? ' --platform ' + flag.platform : '') + ']' : '')
							]);
						});
						return f;
					})
			);
		}
		
		if (options) {
			printList((title ? title + ' ' : '') + __('Options:'),
				Object.keys(options)
					.map(function (name) {
						var o = [];
						options[name].forEach(function (opt, j) {
							var n = (opt.abbr ? '-' + opt.abbr + ', ' : '') + '--' + name + (opt.alias ? ' | --' + opt.alias : '') + ' ' + (opt.hint ? '<' + opt.hint + '>' : __('<value>')),
								extra = '';
							
							if (opt.values) {
								extra = '  [' + opt.values.map(function (v) {
										return v + (v == opt.default ? ' (' + __('default') + ')' : '');
									}).join(', ') + ']';
							} else if (opt.default) {
								extra = '  [' + __('default') + ': ' + opt.default + ']';
							}
							
							o.push([
								j > 0 ? n.replace(/./g, ' ') : n,
								opt.desc + extra
							]);
						});
						return o;
					})
			);
		}
	}
	
	if (command && command != '__global__' && cli.cmds[command]) {
		
		// command specific usage
		var cmd = cli.cmds[command],
			subcmd,
			required = [],
			optional = [];
		
		function load(ctx, sub) {
			try {
				var cmd = require(ctx.modulePath),
					conf = (cmd.config && cmd.config(logger, config, cli)) || {};
				
				if (sub && conf.subcommands) {
					subcmd = conf.subcommands[sub];
					required.unshift(subcmd ? sub : '<subcommand>');
				} else {
					for (var c in conf) {
						conf.hasOwnProperty(c) && (ctx[c] = conf[c]);
					}
					
					ctx.flags && Object.keys(ctx.flags).forEach(function (name) {
						var meta = ctx.flags[name];
						if (meta.required) {
							required.push('--' + name + (meta.alias ? '|--' + meta.alias : ''));
						} else {
							optional.push('[--' + name + (meta.alias ? '|--' + meta.alias : '') + ']');
						}
					});
					
					ctx.options && Object.keys(ctx.options).forEach(function (name) {
						var meta = ctx.options[name];
						if (meta.required) {
							required.push('--' + name + (meta.alias ? '|--' + meta.alias : '') + ' ' + (meta.hint ? '<' + meta.hint + '>' : __('<value>')));
						} else {
							optional.push('[--' + name + (meta.alias ? '|--' + meta.alias : '') + ' ' + (meta.hint ? '<' + meta.hint + '>' : __('<value>')) + ']');
						}
					});
				}
			} catch (ex) {}
		}
		
		function usage(ctx, sub) {
			Object.keys(ctx).forEach(function (sdk) {
				if (sdk === '__global__') {
					load(ctx[sdk], sub)
				} else {
					// a real sdk
					Object.keys(ctx[sdk]).forEach(function (platform) {
						load(ctx[sdk][platform], sub);
					});
				}
			});
		}
		
		subcommand && usage(cmd, subcommand);
		usage(cmd);
		
		required = required.concat(optional);
		
		if (subcmd) {
			subcmd.args && subcmd.args.forEach(function (arg) {
				required.push(arg.required ? '<' + arg.name + '>' : '[<' + arg.name + '>]')
			});
		} else {
			cmd.args && cmd.args.forEach(function (arg) {
				required.push(arg.required ? '<' + arg.name + '>' : '[<' + arg.name + '>]')
			});
		}
		
		console.log(__('Usage') + ': ' + (cli.argv.$ + ' ' + command + ' ' + required.join(' ')).cyan + '\n');
		
		var title = '',
			orderedSDKs = Object.keys(cmd).sort();
		
		// command/subcommand description
		if (subcmd) {
			subcmd.desc && console.log(subcmd.desc.substring(0, 1).toUpperCase() + subcmd.desc.substring(1) + (/\.$/.test(subcmd.desc) ? '' : '.') + '\n');
		} else {
			// since there can be more than one command implementation, we start with the most recent
			var desc = '';
			
			for (var i = 0; !desc && i < orderedSDKs.length; i++) {
				if (orderedSDKs[i] == '__global__') {
					desc = cmd[orderedSDKs[i]].desc;
				} else {
					var platforms = Object.keys(cmd[orderedSDKs[i]]).sort();
					for (var j = 0; !desc && j < platforms.length; j++) {
						desc = cmd[orderedSDKs[i]][platforms[j]].desc;
					}
				}
			}
			
			if (desc) {
				console.log(desc.substring(0, 1).toUpperCase() + desc.substring(1) + (/\.$/.test(desc) ? '' : '.') + '\n');
			}
		}
		
		// command title for option/flag heading
		for (var i = 0; !title && i < orderedSDKs.length; i++) {
			if (orderedSDKs[i] == '__global__') {
				title = cmd[orderedSDKs[i]].title;
			} else {
				var platforms = Object.keys(cmd[orderedSDKs[i]]).sort();
				for (var j = 0; !title && j < platforms.length; j++) {
					title = cmd[orderedSDKs[i]][platforms[j]].title;
				}
			}
		}
		
		// if we have a subcommand, display the subcommand details
		subcmd && printOptionsFlags({ __global__: subcmd }, subcmd.title || string.capitalize(subcommand));
		
		// display the current command's options/flags/args
		printOptionsFlags(cmd, title || cmd.title || string.capitalize(command), !!subcmd);
		
		// display the global options/flags... we have to hack a special __global__ object so options/flags aren't duplicated
		printOptionsFlags({ __global__: cli.cmds.__global__ }, __('Global'), !!subcmd);
	
	} else {
		
		// check if we even know what the command is
		if (command && command != '__global__') {
			console.log(('[ERROR] ' + __('Unrecognized command "%s"', command)).red + '\n');
		}
	
		// general usage
		console.log(__('Usage') + ': ' + (cli.argv.$ + ' <command> [options]').cyan + '\n');
		
		printList(__('Commands:'),
			Object.keys(cli.cmds)
				.filter(function (name) {
					return name != '__global__' && !cli.cmds[name].hidden;
				})
				.sort()
				.map(function (name) {
					return [[name, cli.cmds[name].desc]];
				})
		);
		
		printOptionsFlags(cli.cmds, __('Global'));
		
	}
};