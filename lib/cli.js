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
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	prompt = require('prompt'),
	logger = require('./logger'),
	config = require('./config'),
	appc = require('node-appc'),
	aliases = {},
	flags = {},
	cmds = cli.cmds = {
		__global__:{
			context: 'Global command',
			options: {},
			flags: {}
		}
	};

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
	
	appc.string.suggest(cmd, Object.keys(cmds).filter(function (c) {
		return c != '__global__';
	}), console.log);
	
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
	
	function setArg(key, val, gflag) {
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
		
		// handler is currently only used for global flags
		gflag && gflag.callback && gflag.callback(val, logger);
	}
	
	// set the default values
	var _global = cmds.__global__,
		globalFlags = _global.flags || {};
	Object.keys(globalFlags).forEach(function (name) {
		setArg(name, globalFlags[name].default || false);
	});
	_global.options && Object.keys(_global.options).forEach(function (name) {
		_global.options[name].hasOwnProperty('default') && setArg(name, _global.options[name].default);
	});
	
	for (var i = 0; i < args.length; i++) {
		var arg = args[i];
		
		if (arg === '--') {
			// treat all options/flags after -- as regular arguments
			argv._.push.apply(argv._, args.slice(i + 1));
			break;
		} else if (arg.match(/^--.+=/)) {
			// --option=value
			var m = arg.match(/^--([^=]+)=(.*)/);
			setArg(m[1], m[2]);
		} else if (arg.match(/^--no-.+/)) {
			// --no-flag
			var key = arg.match(/^--no-(.+)/)[1];
			setArg(key, false, globalFlags[key]);
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
				setArg(key, next === 'true', globalFlags[key]);
				i++;
			} else {
				// --flag
				setArg(key, true, globalFlags[key]);
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
							
							if (!conf.noAuth) {
								conf.options || (conf.options = {});
								conf.options.user = {
									desc: __('user to log in as, if not already logged in')
									// TODO: required: true
								};
								conf.options.password = {
									desc: __('the password to log in with'),
									password: true
									// TODO: required: true
								};
							}
							
							// declare the module as loaded so help doesn't try to reload it
							conf.loaded = true;
							
							Object.keys(conf).forEach(function (c) {
								ctx[c] = conf[c];
							});
							
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
							
							conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
								var platformConf = conf.platforms[platform];
								
								platformConf.options && Object.keys(platformConf.options).forEach(function (name) {
									var opt = platformConf.options[name];
									cli.option(name, opt, ctx, sdk, platform);
									opt.hasOwnProperty('default') && setArg(name, opt.default);
								});
								
								platformConf.flags && Object.keys(platformConf.flags).forEach(function (name) {
									var fl = platformConf.flags[name];
									cli.flag(name, fl, ctx, sdk, platform);
									fl.hasOwnProperty('default') && setArg(name, fl.default || false);
								});
							});
						} catch (ex) {
							logger.error(ex);
						}
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
							var subcmd = ctx.subcommands[subcommand],
								o = subcmd.options,
								f = subcmd.flags;
							
							o && Object.keys(o).forEach(function (name) {
								var opt = o[name];
								cli.option(name, opt, subcmd, sdk, platform);
								opt.hasOwnProperty('default') && setArg(name, opt.default);
							});
							
							f && Object.keys(f).forEach(function (name) {
								var fl = f[name];
								cli.flag(name, fl, subcmd, sdk, platform);
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

cli.validate = function (callback) {
	var argv = cli.argv,
		command,
		platform = argv.platform,
		sdk;
	
	function processOptions(ctx) {
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
	
	// at this point we now have the command and we need to register the command's options/flags
	command = cmds[argv.$command];
	
	// does this command require an sdk? need to crawl it
	if (command) {
		command.__global__ && processOptions(command.__global__);
		
		var checkSDK = command.__global__ && command.__global__.options && command.__global__.options.hasOwnProperty('sdk');
		if (!checkSDK) {
			// no global command, try any sdk version
			for (var sdkver in command) {
				var g = command[sdkver].__global__ || {};
				if (!(checkSDK = g.options && g.options.hasOwnProperty('sdk'))) {
					for (var plat in command[sdkver]) {
						var p = command[sdkver][plat] || {};
						if (checkSDK = p.options && p.options.hasOwnProperty('sdk')) {
							break;
						}
					}
				}
				if (checkSDK) {
					break;
				}
			}
		}
		
		if (checkSDK) {
			sdk = cli.env.getSDK(argv.sdk || 'latest');
			
			if (!sdk) {
				tierror(__('Invalid Titanium SDK "%s"', argv.sdk) + '\n');
				appc.string.suggest(argv.sdk, Object.keys(cli.env.sdks), console.log);
				console.log(__("Run '%s' for available SDKs.", (cli.argv.$ + ' sdk list').cyan) + '\n');
				process.exit(1);
			}
			
			if (!command.hasOwnProperty(sdk.name)) {
				tierror(__('Command "%s" not support by SDK version %s', argv.$command, sdk.name) + '\n');
				process.exit(1);
			}
		}
	}
	
	// get the missing global options
	var missing = [],
		valued = [],
		scanOptions = function (opts) {
			opts && Object.keys(opts).forEach(function (name) {
				var obj = {
					name: name,
					opt: opts[name]
				};
				opts[name].required && (!argv.hasOwnProperty(name) || argv[name] == void 0)&& missing.push(obj);
				opts[name].values && !opts[name].skipValueCheck && (!argv.hasOwnProperty(name) || argv[name] == void 0) && valued.push(obj);
			});
		};
	
	scanOptions(cmds.__global__.options);
	
	// get the command's module
	if (sdk && command[sdk.name]) {
		processOptions(command[sdk.name].__global__);
		
		// check required command options
		var cmd = command[sdk.name];
		scanOptions(cmd.__global__.options);
		platform && cmd[platform] && scanOptions(cmd[platform].options);
		platform = platform || '__global__';
		argv.$module = (cmd[platform] ? cmd[platform] : cmd['__global__']).modulePath;
	} else {
		argv.$module = (command['__global__'] || {}).modulePath;
	}
	
	if (!argv.$module || !appc.fs.exists(argv.$module)) {
		tierror(__('Unable to find command "%s"', argv.$command) + '\n');
		process.exit(1);
	}
	
	async.series([
		function (next) {
			// if there are missing required options, either fail or prompt
			if (!missing.length) {
				next();
				return;
			}
			
			if (!config.cli.prompt) {
				missing.forEach(function (m) {
					tierror(__('Missing required option "%s"', '--' + m.name) + '\n');
				});
				console.log('');
				process.exit(1);
			}
			
			var validate = require('revalidator').validate,
				schema = {
					properties: {}
				};
			
			// build out the prompt schema
			missing.forEach(function (m) {
				var pr = m.opt.prompt || {},
					p = (pr.label || appc.string.capitalize(m.opt.desc)).trim().replace(/\:$/, ''),
					def = pr.default;
				
				if (def) {
					def = Array.isArray(def) ? def.join(',') : def;
				} else {
					def = m.opt.default;
				}
				
				schema.properties[m.name] = {
					conform: pr.validator,
					default: def,
					errorMsg: pr.error,
					hidden: !!m.opt.password,
					description: p.bold.grey + ': ',
					pattern: pr.pattern,
					required: true
				};
			});
			
			// overwrite prompt settings and render function
			prompt.colors = false;
			prompt.delimiter = prompt.message = '';
			prompt._performValidation = function (name, prop, against, schema, line, callback) {
				var valid = { valid: false },
					msg,
					errorMsg = prop.schema.errorMsg;
				
				try {
					valid = validate(against, schema);
				} catch (err) {
					if (err.type == 'AppcException') {
						errorMsg = err.message;
					} else {
						return (line !== -1) ? callback(err) : false;
					}
				}
				
				if (!valid.valid) {
					if (errorMsg) {
						logger.error(errorMsg);
					} else {
						msg = line !== -1 ? 'Invalid input for ' : 'Invalid command-line input for ';
						logger.error(msg + name.stripColors);
						prop.schema.message && logger.error(prop.schema.message);
					}
					
					prompt.emit('invalid', prop, line);
				}
				
				return valid.valid;
			};
			
			// start prompting for input
			prompt.start().get(schema, function (err, result) {
				if (err) {
					tierror(err);
					process.exit(1);
				} else {
					for (var r in result) {
						argv[r] = result[r].toString().trim();
					}
					console.log('');
					next()
				}
			});
		}
	], function () {
		// for each arg, check if it has values and that they are valid
		valued.forEach(function (v) {
			if (argv.hasOwnProperty(v.name) && v.opt.values.indexOf(argv[v.name]) == -1) {
				tierror(__('Invalid value "%s"', v.name) + '\n');
				console.log(__('Possible values:') + '\n');
				v.opt.values.forEach(function (p) {
					console.log('    ' + p.cyan);
				});
				console.log();
				process.exit(1);
			}
		});
		
		try {
			var mod = require(argv.$module);
			mod.validate && mod.validate(logger, config, cli);
		} catch (ex) {
			argv.exception = ex;
			argv._.unshift(argv.$command);
			argv.$module = (cmds['help']['__global__'] || {}).modulePath;
		}
		
		callback();
	});
};

cli.run = function () {
	try {
		cli.startTime = Date.now();
		require(cli.argv.$module).run(logger, config, cli);
	} catch (ex) {
		tierror(__('Unable to run command "%s"', cli.argv.$command) + '\n');
		tiexception(ex);
	}
};
