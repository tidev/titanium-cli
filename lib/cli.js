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

var	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	prompt = require('prompt'),
	logger = require('./logger'),
	config = require('./config'),
	semver = require('semver'),
	appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = appc.fs,
	hitch = appc.util.hitch,
	mix = appc.util.mix,
	cli = module.exports,
	aliases = {},
	flags = {},
	cmds = cli.cmds = {
		__global__:{
			context: 'Global command',
			options: {},
			flags: {}
		}
	},
	hooks = cli.hooks = {
		pre: {},
		post: {},
		scannedPaths: {},
		loadedFilenames: [],
		incompatibleFilenames: [],
		erroredFilenames: []
	},
	sprintf = require('sprintf').sprintf;

// TODO: hook priority constants
cli.HOOK_PRIORITY_DEFAULT = 1000;

cli.addHook = function (name, opts) {
	var priority = cli.HOOK_PRIORITY_DEFAULT,
		add = function (type) {
			if (opts[type]) {
				var h = hooks[type][name] || (hooks[type][name] = []);
				opts[type].priority = priority;
				for (var i = 0; i < h.length && priority >= h[i].priority; i++) {}
				h.splice(i, 0, opts[type]);
			}
		};
	
	if (typeof opts == 'function') {
		opts = { post: opts };
	} else if (Object.prototype.toString.call(opts) == '[object Object]') {
		priority = parseInt(opts.priority) || priority;
	}
	
	add('pre');
	add('post');
};

cli.createHook = function (name, ctx, fn) {
	var dataPayload = {};
	
	if (typeof ctx == 'function') {
		fn = ctx;
		ctx = null;
	} else if (Object.prototype.toString.call(ctx) == '[object Object]' && !fn) {
		dataPayload = ctx;
		ctx = null;
	}
	
	return function () {
		var data = mix(dataPayload, {
				type: name,
				args: Array.prototype.slice.call(arguments),
				fn: fn,
				ctx: ctx
			}),
			callback = data.args.pop(),
			pres = hooks.pre[name] || [],
			posts = hooks.post[name] || [];
		
		// call all pre filters
		async.series(pres.map(function (pre) {
			return function (cb) {
				pre.call(ctx, data, function (e) {
					e && (data = e);
					cb();
				});
			};
		}), function () {
			var next = function (result) {
				data.result = result;
				// call all post filters
				async.series(posts.map(function (post) {
					return function (cb) {
						post.call(ctx, data, function (err, _data) {
							_data && (data = _data);
							cb(err, data);
						});
					};
				}), function (err, results) {
					callback && callback(err, results, data.result);
				});
			};
			
			if (data.fn) {
				// call the function
				data.args.push(next);
				data.fn.apply(data.ctx, data.args);
			} else {
				// just fire the event
				next();
			}
		});
	};
};

cli.fireHook = function (name, data, callback) {
	if (Object.prototype.toString.call(data) == '[object Object]') {
		cli.createHook(name, data)(callback);
	} else if (typeof data == 'function') {
		cli.createHook(name)(data);
	} else if (typeof callback == 'function') {
		cli.createHook(name)(callback);
	}
};

cli.scanHooks = function (dir) {
	if (!hooks.scannedPaths[dir] && afs.exists(dir)) {
		fs.readdirSync(dir).forEach(function (filename) {
			var file = path.join(dir, filename);
			if (/\.js$/.test(filename) && fs.lstatSync(file).isFile() && !/^[._]/.test(filename)) {
				try {
					var mod = require(file);
					if (!cli.version || !mod.cliVersion || semver.satisfies(cli.version, mod.cliVersion)) {
						hooks.loadedFilenames.push(file);
						mod.init && mod.init(logger, config, cli, appc);
					} else {
						hooks.incompatibleFilenames.push(file);
					}
				} catch (ex) {
					hooks.erroredFilenames.push(file);
				}
			}
		});
	}
	hooks.scannedPaths[dir] = 1;
};

cli.flag = cli.flags = createFlagOptionFunction('flags');

cli.option = cli.options = createFlagOptionFunction('options');

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

cli.parse = function (finished) {
	var args = process.argv.slice(),
		argv = cli.argv = {
			_: [],
			$0: process.argv.slice(0, 2).join(' '),
			$_: process.argv.slice(2),
			$command: null,
			$defaulted: {}
		},
		idx,
		file,
		cd,
		completion = !!config.cli.completion;
	
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
	
	// make sure the bash completion stuff is installed
	completion && initCompletion(argv.$);
	idx = args.indexOf('--compgen');
	completion = completion && ~idx;
	
	if (completion) {
		// doing tab completion, squelch all output
		process.on('uncaughtException', function () {});
		if (completion) {
			args = args.slice(idx + 2);
		} else {
			process.exit(0);
		}
	}
	
	// set the default values
	var _global = cmds.__global__;
	_global.flags && Object.keys(_global.flags).forEach(function (name) {
		setArg(name, _global.flags[name].default || false);
	});
	_global.options && Object.keys(_global.options).forEach(function (name) {
		_global.options[name].hasOwnProperty('default') && setArg(name, _global.options[name].default);
	});
	
	var checkCommand = function () {
		if (!cli.argv.$command || (cli.argv.$command == 'help' && !cmds[cli.argv.$command].loaded)) {
			cli.argv.$command = 'help';
			loadCommand(cmds[cli.argv.$command].__global__, null, null, done);
		} else {
			done();
		}
	}.bind(this);
	
	var done = function () {
		// if we didn't find a command, then show the help
		var command = cli.argv.$command = cli.argv.$command || 'help';
		
		// try to determine what sdk version we're dealing with
		if (command = cmds[command]) {
			var c = command.__global__,
				checkSDK = c && c.options && c.options.hasOwnProperty('sdk');
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
				// at this point we should be using an sdk, hopefully we find one
				argv.sdk = argv.sdk || config.app.sdk;
				cli.sdk = cli.env.getSDK(argv.sdk || 'latest');
			}
		}
		
		if (completion) {
			// TODO: complete words!
			console.log(args.join('|'));
			throw 'stop';
		}
		
		finished();
	}.bind(this);
	
	if (args.length) {
		// process the args
		processArg(args, 0, checkCommand);
	} else {
		checkCommand();
	}
};

cli.validate = function (callback) {
	var argv = cli.argv,
		command = cmds[argv.$command],
		sdk = cli.sdk,
		keys = {},
		missingOptions = [],
		valuedOptions = [],
		missingArguments = [];
	
	if (sdk === null) {
		tierror(__('Invalid Titanium SDK "%s"', argv.sdk) + '\n');
		appc.string.suggest(argv.sdk, Object.keys(cli.env.sdks), console.log);
		console.log(__("Run '%s' for available SDKs.", (cli.argv.$ + ' sdk list').cyan) + '\n');
		process.exit(1);
	}
	
	if (sdk !== undefined && sdk !== null && !command.hasOwnProperty(sdk.name)) {
		tierror(__('Command "%s" not supported by SDK version %s', argv.$command, sdk.name) + '\n');
		process.exit(1);
	}
	
	function processOptionsFlags(ctx) {
		function fireCallback(name, items) {
			// set the default value if it wasn't parsed from the command line
			if (items[name].default && argv[name] === undefined) {
				argv[name] = items[name].default;
			}
			
			// mark this option as being processed
			keys[name] = 1;
			
			// if this option/flag has a callback, call it to see if it needs to modify the value
			if (items[name].callback) {
				var abbr = items[name].abbr;
				if (argv.hasOwnProperty(name)) {
					argv[name] = items[name].callback(argv[name], logger, cli) || argv[name];
				} else if (argv.hasOwnProperty(abbr)) {
					argv[abbr] = items[name].callback(argv[abbr], logger, cli) || argv[abbr];
				}
			}
		}
		
		if (ctx.options) {
			Object.keys(ctx.options).forEach(function (name) {
				fireCallback(name, ctx.options);
			});
			
			// since options can have values, we need to find all missing options that don't have defaults and
			// mark all options that have values for validation
			Object.keys(ctx.options).forEach(function (name) {
				var opt = ctx.options[name],
					obj;
				if ((!argv.hasOwnProperty(name) || argv[name] == void 0 || argv.$defaulted[name] || opt.values) && (!opt.platform || opt.platform == argv.platform)) {
					obj = appc.util.mix({ name: name }, opt);
					if (argv[name] == void 0 && opt.required) {
						argv.$defaulted[name] && (obj.defaulted = true);
						missingOptions.push(obj);
					}
					opt.values && !opt.skipValueCheck && valuedOptions.push(obj);
				}
			});
		}
		
		ctx.flags && Object.keys(ctx.flags).forEach(function (name) {
			fireCallback(name, ctx.flags);
		});
	}
	
	// process the options
	command.__global__ && processOptionsFlags(command.__global__);
	
	// get the command's module
	if (sdk && command[sdk.name]) {
		// we have a sdk-level command
		var cmd = command[sdk.name],
			platform;
		
		// process the options
		processOptionsFlags(cmd.__global__);
		
		argv.$module = cmd.__global__.modulePath;
				
		// find any sdk-level hooks
		cli.scanHooks(afs.resolvePath(sdk.path, 'cli', 'hooks'));
		
		// note: if the command has a platform, but it wasn't passed in at the command line and it was prompted,
		// then we've already passed this point and the default option values have NOT been set for platform level
		// commands. also, hooks have NOT been scanned for. so, each platform specific command that requires a
		// platform will need to set all default values in the prompt validator function and scan for hooks.
		if (argv.platform && cmd.__global__.platforms) {
			platform = cmd.__global__.platforms[argv.platform];
			if (platform) {
				cli.scanHooks(afs.resolvePath(sdk.platforms[argv.platform].path, 'cli', 'hooks'));
				processOptionsFlags(platform);
				platform.modulePath && (argv.$module = platform.modulePath);
			}
		}
	} else {
		// it's a global command
		argv.$module = (command.__global__ || {}).modulePath;
	}
	
	if (!argv.$module || !afs.exists(argv.$module)) {
		tierror(__('Unable to find command "%s"', argv.$command) + '\n');
		process.exit(1);
	}
	
	// validate unique argument names
	function checkArgumentNames(ctx) {
		ctx.args && ctx.args.forEach(function (arg, i) {
			if (!arg.name) {
				// note: we don't i18n developer errors
				tierror('Command "' + argv.$command + '" has an unnamed argument at index ' + i + '\n');
				console.log('Please give the argument in the source file: ' + ctx.modulePath + '\n');
				process.exit(1);
			}
			
			if (keys[arg.name]) {
				// note: we don't i18n developer errors
				tierror('Command "' + argv.$command + '" has a conflicting argument name "' + arg.name + '"\n');
				console.log('Please rename the argument in the source file: ' + ctx.modulePath + '\n');
				process.exit(1);
			}
			
			if (i < argv._.length) {
				// map arguments into the argv object
				argv[arg.name] = argv._[i];
			} else if (arg.required) {
				// note: we are going to error even if the arg has a default value
				missingArguments.push(arg);
			} else {
				argv[arg.name] = arg.default || '';
			}
		});
	}
	
	if (sdk) {
		Object.keys(command[sdk.name]).forEach(function (ver) {
			var obj = command[sdk.name][ver];
			checkArgumentNames(obj);
		});
	} else if (command.__global__) {
		checkArgumentNames(command.__global__);
	}
	
	async.series([
		createPrompter(missingOptions, __('Missing required option'), '"--%s"'),
		createPrompter(missingArguments, __('Missing required argument'), '"%s"')
	], function (err, prompted) {
		(prompted[0] || prompted[1]) && console.log('');
		
		async.series([
			function (next) {
				var status = appc.auth.status();
				if (((sdk && !command[sdk.name].noAuth) || (!sdk && command.__global__ && !command.__global__.noAuth)) && !status.loggedIn) {
					appc.auth.login(cli.argv.username, cli.argv.password, function(result) {
						logger.banner();
						if (result.error) {
							logger.error(__('Login failed: %s', result.error) + '\n');
							process.exit(1);
						}
						logger.log(__('Logged in successfully') + '\n');
						next();
					}, config.cli.httpProxyServer);
				} else {
					next();
				}
			}
		], function () {
			// for each arg, check if it has values and that they are valid
			valuedOptions.forEach(function (v) {
				if (argv.hasOwnProperty(v.name) && v.values && v.values.indexOf(argv[v.name]) == -1) {
					tierror(__("Invalid %s value '%s'", '--' + v.name, argv[v.name]) + '\n');
					console.log(__('Accepted values:'));
					v.values.forEach(function (p) {
						console.log('   ' + p.cyan);
					});
					console.log();
					process.exit(1);
				}
			});
			
			try {
				var mod = require(argv.$module);
				if (mod.validate && mod.validate(logger, config, cli) === false) {
					cli.run = function () {}; // easier to just squeltch the entire run() function
				}
			} catch (ex) {
				argv.exception = ex;
				argv._.unshift(argv.$command);
				argv.$module = (cmds['help']['__global__'] || {}).modulePath;
			}
			callback();
		});
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

// flag/option function creator
function createFlagOptionFunction(type) {
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
				// check if context is undefined
				context || (context = cmds['__global__']);
				context[type] || (context[type] = {});
				context[type][name] = params;
			}
			
			if (params.alias) {
				// params.alias is either a string or an array<string>
				Array.isArray(params.alias) || (params.alias = [ params.alias ]);
				params.alias.forEach(function (alias) {
					Array.isArray(aliases[alias]) || (aliases[alias] = []);
					aliases[alias].push(name);
				});
			}
			
			if (params.abbr) {
				Array.isArray(aliases[params.abbr]) || (aliases[params.abbr] = []);
				aliases[params.abbr].push(name);
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

function createPrompter(missing, errorMsg, errorFormat) {
	return function (next) {
		// if there are missing required thing, either fail or prompt
		if (!missing.length) {
			next();
			return;
		}
		
		if (!config.cli.prompt) {
			missing.forEach(function (m) {
				!m.defaulted && tierror(errorMsg + ' ' + sprintf(errorFormat, m.name));
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
			var pr = m.prompt || {},
				p = (pr.label || appc.string.capitalize(m.desc || '')).trim().replace(/\:$/, ''),
				def = pr.default || m.default || '';
			
			if (typeof def == 'function') {
				def = def();
			} else if (Array.isArray(def)) {
				def = def.join(',');
			}
			
			schema.properties[m.name] = {
				conform: pr.validator,
				default: def,
				errorMsg: pr.error,
				hidden: !!m.password,
				description: p.bold.grey + ': ',
				pattern: pr.pattern,
				required: true
			};
		});
		
		// overwrite prompt settings and render function
		prompt.colors = false;
		prompt.delimiter = prompt.message = '';
		prompt._performValidation = function (name, prop, against, schema, line, callback) {
			var result = { valid: false },
				msg,
				errorMsg = prop.schema.errorMsg;
			
			try {
				if (prop.schema.required && prop.schema.conform) {
					prop.schema.conform(against[prop.path[0]]);
					result.valid = true;
				}
				result.valid || (result = validate(against, schema));
			} catch (err) {
				if (err.type == 'AppcException') {
					logger.error(err.message);
					err.details.forEach(function (line) {
						logger.log(line);
					});
					return false;
				} else {
					return (line !== -1) ? callback(err) : false;
				}
			}
			
			if (!result.valid) {
				if (errorMsg) {
					logger.error(errorMsg);
				} else {
					msg = line !== -1 ? 'Invalid input for ' : 'Invalid command-line input for ';
					logger.error(msg + name.stripColors);
					prop.schema.message && logger.error(prop.schema.message);
				}
				
				prompt.emit('invalid', prop, line);
			}
			
			return result.valid;
		};
		
		// start prompting for input
		if (!prompt.started) {
			prompt.start();
		}
		prompt.get(schema, function (err, result) {
			if (err) {
				logger.log('\n');
				process.exit(1);
			}
			for (var r in result) {
				cli.argv[r] = result[r].toString().trim();
			}
			next(null, true);
		});
	}
}

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
	
	console.log(__("Run %s for available commands.", (cli.argv.$ + ' help').cyan) + '\n');
	
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
			if (afs.exists(bashrc)) {
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

function setArg(key, value, isDefault) {
	var keys = key.split('.'),
		argv = cli.argv;
	
	key = keys.pop();
	
	keys.forEach(function (k) {
		argv.hasOwnProperty(k) || (argv[k] = {});
		argv = argv[k];
	});
	
	if (argv[key] === undefined || typeof argv[key] === 'boolean') {
		argv[key] = value;
	} else if (Array.isArray(argv[key])) {
		~argv[key].indexOf(value) || argv[key].push(value);
	} else {
		argv[key] = value;
	}
	
	if (isDefault) {
		argv.$defaulted[key] = argv[key];
	} else {
		delete argv.$defaulted[key];
	}
	
	var alias = aliases[key];
	if (alias) {
		if (Array.isArray(alias)) {
			alias.forEach(function (a) {
				argv[a] = argv[key];
				if (isDefault) {
					argv.$defaulted[a] = argv[a];
				} else {
					delete argv.$defaulted[a];
				}
			});
		} else {
			argv[alias] = argv[key];
			if (isDefault) {
				argv.$defaulted[alias] = argv[alias];
			} else {
				delete argv.$defaulted[alias];
			}
		}
	}
	
	// handler is currently only used for global flags
	var flags = cmds.__global__.flags;
	if (flags && flags[key] && flags[key].callback) {
		argv[key] = flags[key].callback(value, logger) || value;
	}
	if (flags && flags[alias] && flags[alias].callback) {
		argv[alias] = argv[key] = flags[alias].callback(value, logger) || value;
	}
}

function processConf(ctx, sdk, platform, conf) {
	var status = appc.auth.status();
	conf.noAuth = conf.noAuth || false;
	if (!conf.noAuth && !status.loggedIn) {
		conf.options || (conf.options = {});
		conf.options.username = {
			default: config.user && config.user.email,
			desc: __('user to log in as, if not already logged in'),
			prompt: {
				default: config.user && config.user.email,
				label: __('Username'),
				error: __('Invalid username'),
				pattern: /\S+/
			},
			required: true
		};
		conf.options.password = {
			desc: __('the password to log in with'),
			prompt: {
				label: __('Password'),
				error: __('Invalid password'),
				pattern: /\S+/
			},
			password: true,
			required: true
		};
	}
	
	// declare the module as loaded so help doesn't try to reload it
	conf.loaded = true;
	
	Object.keys(conf).forEach(function (c) {
		ctx[c] = conf[c];
	});
	
	// set the global options and flags
	conf.options && Object.keys(conf.options).forEach(function (name) {
		var opt = conf.options[name];
		cli.option(name, opt, ctx, sdk, platform);
	});
	
	conf.flags && Object.keys(conf.flags).forEach(function (name) {
		var fl = conf.flags[name];
		cli.flag(name, fl, ctx, sdk, platform);
	});
	
	// for each platform, set their options and flags
	conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
		var platformConf = conf.platforms[platform];
		
		platformConf.options && Object.keys(platformConf.options).forEach(function (name) {
			var opt = platformConf.options[name];
			opt.platform = platform;
			cli.option(name, opt, ctx.platforms[platform], sdk, platform);
		});
		
		platformConf.flags && Object.keys(platformConf.flags).forEach(function (name) {
			var fl = platformConf.flags[name];
			fl.platform = platform;
			cli.flag(name, fl, ctx.platforms[platform], sdk, platform);
		});
	});
}

function loadCommand(ctx, sdk, platform, callback) {
	try {
		var cmd = require(ctx.modulePath),
			conf;
		
		if (cli.version && cmd.cliVersion && !semver.satisfies(cli.version, cmd.cliVersion)) {
			throw new appc.exception(
				__('Command "%s" incompatible with this version of the Titanium CLI', cli.argv.$command),
				__('Requires version %s, currently %s', cmd.cliVersion, cli.version)
			);
		}
		
		conf = (cmd.config && cmd.config(logger, config, cli)) || {};
		
		if (typeof conf == 'function') {
			conf(function (realConf) {
				processConf(ctx, sdk, platform, realConf);
				callback();
			});
			return;
		}
		
		processConf(ctx, sdk, platform, conf);
	} catch (ex) {
		logger.banner();
		if (ex.type == 'AppcException') {
			logger.error(ex.message);
			ex.details.forEach(function (line) {
				logger.warn(line);
			});
		} else {
			logger.error(ex);
		}
	}
	callback();
}

function processArg(args, i, finished) {
	var arg = args[i];
	
	function nextArg() {
		if (++i < args.length) {
			processArg(args, i, finished);
		} else {
			finished();
		}
	}
	
	if (arg === '--') {
		// treat all options/flags after -- as regular arguments
		cli.argv._.push.apply(cli.argv._, args.slice(i + 1));
		finished();
		return;
	} else if (arg.match(/^(?:--|—).+=/)) {
		// --option=value
		var m = arg.match(/^(?:--|—)([^=]+)=(.*)/);
		setArg(m[1], m[2]);
	} else if (arg.match(/^(?:--|—)no-.+/)) {
		// --no-flag
		var key = arg.match(/^(?:--|—)no-(.+)/)[1];
		setArg(key, false);
	} else if (arg.match(/^(?:--|—).+/)) {
		// --flag or --option
		var key = arg.match(/^(?:--|—)(.+)/)[1],
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
		// -x or -xyz flags
		var letters = arg.slice(1, -1).split(''),
			broken = false;
		
		for (var j = 0; j < letters.length; j++) {
			if (letters[j+1] && letters[j+1].match(/\W/)) {
				setArg(letters[j], arg.slice(j+2));
				broken = true;
				break;
			} else if (!aliases[letters[j]] || flags[aliases[letters[j]]]) {
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
		cli.argv._.push(arg);
		
		// if we have already processed more than one argument, then just continue
		if (cli.argv._.length == 1) {
			if (!cli.argv.$command) {
				// the first argument! it's gotta be a command!
				cli.argv.$command = cli.argv._.shift();
				
				// add this command's options and flags to the pool.
				// note that there could be multiple version of the same command, so we need
				// to walk everything. last option/flag wins.
				var c = assertAndFetchCommand(cli.argv.$command);
				async.parallel(Object.keys(c).map(function (sdk) {
					return function (callback) {
						var next = function () {
							if (c[sdk].subcommands && c[sdk].defaultSubcommand && c[sdk].subcommands[c[sdk].defaultSubcommand] && (i + 1 >= args.length || /^-/.test(args[i + 1]))) {
								// the next arg is not a subcommand, yet we have a default subcommand, so we inject it!
								args.splice(i + 1, 0, c[sdk].defaultSubcommand);
								cli.argv.$defaultedSubCmd = true;
							}
							callback();
						};
						if (sdk === '__global__') {
							loadCommand(c[sdk], sdk, null, next);
						} else {
							// TODO: add support for default subcommands within sdk/platform-level commands
							async.parallel(Object.keys(c[sdk]).map(function (platform) {
								return function (cb) {
									loadCommand(c[sdk][platform], sdk, platform, cb);
								};
							}), next);
						}
					};
				}), nextArg);
				return;
			} else if (!cli.argv.$subcommand) {
				// check if we're running a subcommand
				var match = false,
					command = cmds[cli.argv.$command],
					subcommand = cli.argv._[0];
				
				function loadSubcommand(ctx, sdk, platform) {
					if (ctx.subcommands && ctx.subcommands.hasOwnProperty(subcommand)) {
						var subcmd = ctx.subcommands[subcommand],
							o = subcmd.options,
							f = subcmd.flags,
							c = command.__global__;
						
						if (subcmd.noAuth) {
							c.noAuth = true;
							if (c.options) {
								delete c.options.username;
								delete c.options.password;
							}
						}
						
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
						
						return true;
					}
				}
				
				Object.keys(command).forEach(function (sdk) {
					if (sdk === '__global__') {
						match = loadSubcommand(command[sdk], sdk);
					} else {
						Object.keys(command[sdk]).forEach(function (platform) {
							match = match || loadSubcommand(command[sdk][platform], sdk, platform);
						});
					}
				});
				
				match && (cli.argv.$subcommand = subcommand);
			}
		}
	}
	
	nextArg();
}
