/*
 * cli.js: Titanium CLI processor
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 *
 * Portions derived from optimist under the MIT license.
 * Copyright 2010 James Halliday (mail@substack.net)
 * https://github.com/substack/node-optimist
 *
 * Portions derived from complete under the MIT license.
 * Copyright (c) 2010 hij1nx <http://www.twitter.com/hij1nx>
 * https://github.com/hij1nx/complete
 */

var	cli = exports,
	fs = require('fs'),
	path = require('path'),
	logger = require('./logger'),
	config = require('./config'),
	appc = require('node-appc'),
	aliases = {},
	flags = {},
	cmds = cli.cmds = {
		__global__:{
			options: {},
			flags: {}
		}
	};

cli.startTime = Date.now();

// TODO: cache the commands/options/flags

// flag/option function creator
function create(type) {
	var fn = function (name, params, context, sdk, platform) {
		if (typeof name == 'object') {
			platform = sdk;
			sdk = context;
			context = params;
			Object.keys(name).forEach(function (k) {
				fn(k, name[k], context, sdk, platform);
			});
		} else {
			params = params || {};
			
			if (context !== null) {
				context || (context = cmds['__global__']);
				context[type] || (context[type] = {});
				context[type][name] = params;
			}
			
			if (params.alias) {
				Array.isArray(params.alias) || (params.alias = [ params.alias ]);
				Array.isArray(aliases[params.alias]) || (aliases[params.alias] = []);
				params.alias.forEach(function (alias) {
					~aliases[alias].indexOf(name) || aliases[alias].push(name);
				});
			}
			
			if (params.abbr) {
				Array.isArray(aliases[params.abbr]) || (aliases[params.abbr] = []);
				~aliases[params.abbr].indexOf(name) || aliases[params.abbr].push(name);
			}
			
			// need to special case flags so the parse won't be stupid
			if (type === 'flags') {
				flags[name] = 1;
			}
		}
		return cli;
	};
	return fn;
}

cli.flag = cli.flags = create('flags');

cli.option = cli.options = create('options');

cli.command = cli.commands = function (name, params, sdk, platform) {
	if (typeof name == 'object') {
		platform = sdk;
		sdk = params;
		Object.keys(name).forEach(function (k) {
			cli.command(k, name[k], sdk, platform);
		});
	} else {
		cmds[name] || (cmds[name] = {});
		
		if (sdk) {
			platform = platform || '__global__';
			cmds[name][sdk] || (cmds[name][sdk] = {});
			cmds[name][sdk][platform] = params;
		} else {
			cmds[name].__global__ = params;
		}
		
		params.options && Object.keys(params.options).forEach(function (name) {
			cli.option(name, params.options[name], cmds[name], sdk, platform);
		});
		
		params.flags && Object.keys(params.flags).forEach(function (name) {
			cli.flag(name, params.flags[name], cmds[name], sdk, platform);
		});
	}
	
	return cli;
};

// helper function that allows arbitrary code to run in the cli chain
cli.then = function (fn) {
	fn && fn.call && fn.call(cli, logger);
	return cli;
};

// finds and returns a command if it exists, otherwise crashes and shows an error (and possibly suggestions)
function assertAndFetchCommand(cmd) {
	if (cmds.hasOwnProperty(cmd)) {
		return cmds[cmd];
	}
	
	logger.banner();
	
	tierror(__('"%s" is an unrecognized command.', cmd) + '\n');
	
	var suggestions = Object.keys(cmds).filter(function (c) {
		if (c != '__global__' && (c.indexOf(cmd) == 0 || appc.string.levenshtein(cmd, c) <= 3)) {
			return c;
		}
	});
	
	if (suggestions.length) {
		console.log(__('Did you mean this?'));
		suggestions.forEach(function (s) {
			console.log('    ' + s.cyan);
		});
		console.log();
	}
	
	console.log(__("Run '%s' for available commands.", (cli.argv.$ + ' help').cyan) + '\n');
	
	process.exit(1);
}

function initCompletion(program) {
	var bashrc,
		files = ['.bash_profile', '.bash_login', '.profile'],
		l = files.length,
		i = 0,
		dir = path.join(process.env.HOME, '.node-completion'),
		file = path.join(dir, program),
		source = [
				'',
				'# {{{',
				'# Node Completion - Auto-generated, do not touch.',
				'shopt -s progcomp',
				'for f in $(command ls ~/.node-completion); do',
				'  f="$HOME/.node-completion/$f"',
				'  test -f "$f" && . "$f"',
				'done',
				'# }}}',
				''
			].join('\n'),
		completion = [
				'__{{NAME}}_comp() {',
				'  COMPREPLY=()',
				'  COMPREPLY=($({{NAME}} --compgen "${COMP_WORDS[@]}"))',
				'  return 0',
				'}',
				'',
				'complete -F __{{NAME}}_comp {{NAME}} 2>/dev/null',
				''
			].join('\n').replace(/{{NAME}}/g, program);
	
	if (process.platform !== 'darwin') {
		bashrc = path.join(process.env.HOME, '.bashrc');
	} else {
		for (; i < l; i++) {
			bashrc = path.join(process.env.HOME, files[i]);
			if (appc.fs.exists(bashrc)) {
				break;
			} else {
				bashrc = '';
			}
		}
		
		// If none exist, create a .bash_profile.
		bashrc || (bashrc = path.join(process.env.HOME, '.bash_profile'));
	}
	
	fs.readFile(bashrc, 'utf8', function (err, data) {
		data = data || '';
		if ((err && err.code === 'ENOENT') || !~data.indexOf('# Node Completion')) {
			data += source;
			fs.writeFile(bashrc, data);
		}
	});
	
	fs.mkdir(dir, 0755, function () {
		fs.stat(file, function (err) {
			if (err && err.code === 'ENOENT') {
				fs.writeFile(file, completion);
			}
		});
	});
}

cli.parse = function (args) {
	var argv = cli.argv = {
			_: [],
			$0: process.argv.slice(0, 2).join(' '),
			$command: null
		},
		idx,
		file,
		cd;
	
	args = args || process.argv.slice();
	args[0].slice(-4) === 'node' && args.shift();
	cd = path.dirname(file = args[0]);
	
	try {
		while (fs.lstatSync(file).isSymbolicLink()) {
			file = fs.readlinkSync(file);
			cd = path.resolve(cd, path.dirname(file));
			file = path.resolve(cd, path.basename(file));
		}
	} catch (e) {
		file = args[0];
	}
	
	argv.$ = path.basename(file);
	args.shift();
	idx = args.indexOf('--compgen');
	
	// make sure the bash completion stuff is installed
	initCompletion(argv.$);
	
	if (~idx) {
		// doing tab completion, squelch all output
		process.on('uncaughtException', function () {});
		
		if (config.cli.completion) {
			args = args.slice(idx + 2);
		} else {
			process.exit(0);
		}
	}
	
	function setArg(key, val) {
		var keys = key.split('.'),
			num = Number(val),
			value = typeof val !== 'string' || isNaN(num) ? val : num,
			obj = argv;
		
		key = keys.pop();
		
		keys.forEach(function (k) {
			obj.hasOwnProperty(k) || (obj[k] = {});
			obj = obj[k];
		});
		
		if (obj[key] === undefined || typeof obj[key] === 'boolean') {
			obj[key] = value;
		} else if (Array.isArray(obj[key])) {
			~obj[key].indexOf(value) || obj[key].push(value);
		} else {
			obj[key] = value;
		}
		
		(aliases[key] || []).forEach(function (x) {
			Array.isArray(x) || (x = [x]);
			x.forEach(function (y) {
				argv[y] = argv[key];
			});
		});
	}
	
	// set the default values
	var _global = cmds.__global__;
	_global.flags && Object.keys(_global.flags).forEach(function (name) {
		setArg(name, _global.flags[name].default || false);
	});
	_global.options && Object.keys(_global.options).forEach(function (name) {
		_global.options[name].hasOwnProperty('default') && setArg(name, _global.options[name].default);
	});
	
	for (var i = 0; i < args.length; i++) {
		var arg = args[i];
		
		if (arg === '--') {
			argv._.push.apply(argv._, args.slice(i + 1));
			break;
		} else if (arg.match(/^--.+=/)) {
			// --option=value
			var m = arg.match(/^--([^=]+)=(.*)/);
			setArg(m[1], m[2]);
		} else if (arg.match(/^--no-.+/)) {
			// --no-flag
			var key = arg.match(/^--no-(.+)/)[1];
			setArg(key, false);
		} else if (arg.match(/^--.+/)) {
			// --flag or --option
			var key = arg.match(/^--(.+)/)[1],
				next = args[i + 1];
			if (next !== undefined && !next.match(/^-/) && !flags[key] && (aliases[key] ? !flags[aliases[key]] : true)) {
				// --option value
				setArg(key, next);
				i++;
			} else if (next === undefined && !flags[key] && (aliases[key] ? !flags[aliases[key]] : true)) {
				// do nothing
			} else if (/true|false/.test(next)) {
				// --flag true
				setArg(key, next === 'true');
				i++;
			} else {
				// --flag
				setArg(key, true);
			}
		} else if (arg.match(/^-[^-]+/)) {
			var letters = arg.slice(1, -1).split(''),
				broken = false;
			
			for (var j = 0; j < letters.length; j++) {
				if (letters[j+1] && letters[j+1].match(/\W/)) {
					setArg(letters[j], arg.slice(j+2));
					broken = true;
					break;
				} else {
					setArg(letters[j], true);
				}
			}
			
			if (!broken) {
				var key = arg.slice(-1)[0],
					next = args[i + 1];
				if (next && !next.match(/^-/) && !flags[key] && (aliases[key] ? !flags[aliases[key]] : true)) {
					setArg(key, next);
					i++;
				} else if (next === undefined && !flags[key] && (aliases[key] ? !flags[aliases[key]] : true)) {
					// do nothing
				} else if (next && /true|false/.test(next)) {
					setArg(key, next === 'true');
					i++;
				} else {
					setArg(key, true);
				}
			}
		} else {
			var n = Number(arg);
			argv._.push(isNaN(n) ? arg : n);
			
			if (argv._.length === 1) {
				if (!argv.$command) {
					// the first argument! it's gotta be a command!
					argv.$command = argv._.shift();
					
					function loadCommand(ctx, sdk, platform) {
						try {
							var cmd = require(ctx.modulePath),
								conf = (cmd.config && cmd.config(logger, config, cli)) || {};
							
							if (conf.requireAuth) {
								conf.options.user = {
									desc: __('user to log in as, if not already logged in')
								};
								conf.options.password = {
									desc: __('the password to log in with'),
									promptHidden: true
								};
							}
							
							for (var c in conf) {
								conf.hasOwnProperty(c) && (ctx[c] = conf[c]);
							}
							
							conf.options && Object.keys(conf.options).forEach(function (name) {
								var opt = conf.options[name];
								cli.option(name, opt, ctx, sdk, platform);
								opt.hasOwnProperty('default') && setArg(name, opt.default);
							});
							
							conf.flags && Object.keys(conf.flags).forEach(function (name) {
								var fl = conf.flags[name];
								cli.flag(name, fl, ctx, sdk, platform);
								fl.hasOwnProperty('default') && setArg(name, fl.default || false);
							});
						} catch (ex) {}
					}
					
					// add this command's options and flags to the pool.
					// note that there could be multiple version of the same command, so we need
					// to walk everything. last option/flag wins.
					var c = assertAndFetchCommand(argv.$command);
					Object.keys(c).forEach(function (sdk) {
						if (sdk === '__global__') {
							loadCommand(c[sdk], sdk);
						} else {
							Object.keys(c[sdk]).forEach(function (platform) {
								loadCommand(c[sdk][platform], sdk, platform);
							});
						}
					});
				} else if (!argv.$subcommand) {
					// check if we're running a subcommand
					var match = false,
						subcommand = argv._[0];
					
					function loadSubcommand(ctx, sdk, platform) {
						if (ctx.subcommands && ctx.subcommands.hasOwnProperty(subcommand)) {
							var o = ctx.subcommands[subcommand].options,
								f = ctx.subcommands[subcommand].flags;
							
							o && Object.keys(o).forEach(function (name) {
								var opt = o[name];
								cli.option(name, opt, ctx, sdk, platform);
								opt.hasOwnProperty('default') && setArg(name, opt.default);
							});
							
							f && Object.keys(f).forEach(function (name) {
								var fl = f[name];
								cli.flag(name, fl, ctx, sdk, platform);
								fl.hasOwnProperty('default') && setArg(name, fl.default || false);
							});
							
							match = true;
						}
					}
					
					var c = cmds[argv.$command];
					Object.keys(c).forEach(function (sdk) {
						if (sdk === '__global__') {
							loadSubcommand(c[sdk], sdk);
						} else {
							Object.keys(c[sdk]).forEach(function (platform) {
								loadSubcommand(c[sdk][platform], sdk, platform);
							});
						}
					});
					
					match && (argv.$subcommand = argv._[0]);
				}
			}
		}
	}
	
	// if we didn't find a command, then show the help
	argv.$command = argv.$command || 'help';
	
	if (~idx && config.cli.completion) {
		// TODO: complete words!
		console.log(args.join('|'));
		
		throw 'stop';
	}
	
	return cli;
};

cli.validate = function () {
	var argv = cli.argv,
		sdk = argv.sdk || 'latest',
		platform = argv.platform,
		module;
	
	function apply(ctx) {
		function call(name, items) {
			if (items[name].callback) {
				var abbr = items[name].abbr;
				argv.hasOwnProperty(name) && items[name].callback(argv[name], logger, cli);
				argv.hasOwnProperty(abbr) && items[name].callback(argv[abbr], logger, cli);
			}
		}
		ctx.options && Object.keys(ctx.options).forEach(function (name) {
			call(name, ctx.options);
		});
		ctx.flags && Object.keys(ctx.flags).forEach(function (name) {
			call(name, ctx.flags);
		});
	}
	
	apply(cmds.__global__);
	cmds[argv.$command] && apply(cmds[argv.$command]);
	
	if (sdk === 'latest') {
		sdk = Object.keys(cmds[argv.$command]).filter(function (c) {
			return c !== '__global__';
		}).sort().pop();
	}
	
	if (sdk && !(sdk in cmds[argv.$command])) {
		tierror(__('Command "%s" not support by SDK version %s', argv.$command, sdk) + '\n');
		process.exit(1);
	}
	
	if (cmds[argv.$command][sdk]) {
		platform = platform || '__global__';
		argv.$module = (cmds[argv.$command][sdk][platform] ? cmds[argv.$command][sdk][platform] : cmds[argv.$command][sdk]['__global__']).modulePath;
	} else {
		argv.$module = (cmds[argv.$command]['__global__'] || {}).modulePath;
	}
	
	if (!argv.$module || !appc.fs.exists(argv.$module)) {
		tierror(__('Unable to find command "%s"', argv.$command) + '\n');
		process.exit(1);
	}
	
	// TODO: validate options
	
	try {
		var mod = require(argv.$module);
		mod.validate && mod.validate(logger, config, cli);
	} catch (ex) {
		argv.exception = ex;
		argv._.unshift(argv.$command);
		argv.$module = (cmds['help']['__global__'] || {}).modulePath;
	}
	
	// TODO: if validation fails or param is missing, prompt or exit
	
	return cli;
};

cli.run = function () {
	try {
		require(cli.argv.$module).run(logger, config, cli);
	} catch (ex) {
		tierror(__('Unable to run command "%s"', cli.argv.$command) + '\n');
		tiexception(ex);
	}
};
