/**
 * @overview
 * The main CLI logic. This orchestrates all argument parsing, command loading,
 * validation, and execution. The implementation is generic and should not
 * contain any Titanium specific knowledge.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * Copyright (c) 2010 hij1nx <http://www.twitter.com/hij1nx>
 * {@link https://github.com/hij1nx/complete}
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

/** @module lib/cli */
module.exports = CLI;

var	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	util = require('util'),
	fields = require('fields'),
	semver = require('semver'),
	appc = require('node-appc'),
	Context = require('./context'),
	Hook = require('./hook'),
	sprintf = require('sprintf').sprintf,

	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	series = appc.async.series,
	afs = appc.fs,
	mix = appc.util.mix;

/**
 * Creates a CLI object.
 * @class
 * @classdesc Command line interface system.
 * @extends Hook
 * @constructor
 * @param {Object} [params]
 */
function CLI(params) {
	// mixin the params
	mix(this, params);

	// call the Hook constructor
	Hook.call(this);

	// find all hooks in the user's config paths
	var paths = this.config.paths.hooks;
	(Array.isArray(paths) ? paths : [paths]).forEach(function (p) {
		p && this.scanHooks(afs.resolvePath(p));
	}, this);

	// define the start time used to measure the execution time.
	// the actual value set prior to executing the command
	this.startTime = null;

	// init the command line arguments
	this.argv = {
		_: [], // parsed arguments (reset each time the context's parse() is called)
		$: null, // resolved node script path
		$_: process.argv.slice(), // original arguments
		$0: process.argv.slice(0, 2).join(' ') // node process and original node script path
	};

	// strip the node executable from the args
	var args = this.argv.$_;
	if (args[0].replace(/\\/g, '/').split('/').pop() == process.execPath.replace(/\\/g, '/').split('/').pop()) {
		args.shift();
	}

	// find the executed file which may be symlinked, so need to keep walking symlinks
	var cd = path.dirname(file = args[0]),
		file;
	try {
		while (fs.lstatSync(file).isSymbolicLink()) {
			file = fs.readlinkSync(file);
			cd = path.resolve(cd, path.dirname(file));
			file = path.resolve(cd, path.basename(file));
		}
	} catch (e) {
		file = args[0];
	}
	this.argv.$ = path.basename(file);
	args.shift();

	// init the tab completion system for non-Windows platforms
	if (this.completion = process.platform != 'win32' && !!this.config.cli.completion) {
		this.initCompletion(this.argv.$);
		var i = args.indexOf('--compgen');
		if (this.completion = ~i) {
			// doing tab completion, squelch all output
			process.on('uncaughtException', function () {});
			if (this.completion) {
				args = args.slice(i + 2);
			} else {
				process.exit(0);
			}
		}
	}

	// create the global context
	this.global = new Context({ argv: this.argv });
};

util.inherits(CLI, Hook);

/**
 * Adds an analytics event that gets sent right before the process exits.
 * @param {String} name - The analytics event name
 * @param {*} data - The data payload
 * @param {String} type - The event type
 */
CLI.prototype.addAnalyticsEvent = function addAnalyticsEvent(name, data, type) {
	appc.analytics.addEvent(name, data, type);
};

/**
 * Adds a flag to the global context.
 * @see {@link Context#flag}
 * @param {String} name - The flag name
 * @param {Object} params - The flag parameters
 * @returns {CLI}
 */
CLI.prototype.flag = function flag(name, params) {
	this.global.flag(name, params);
	return this;
};

/**
 * Adds an option to the global context.
 * @see {@link Context#option}
 * @param {String} name - The option name
 * @param {Object} params - The option parameters
 * @returns {CLI}
 */
CLI.prototype.option = function flag(name, params) {
	this.global.option(name, params);
	return this;
};

/**
 * Initialize tab completion.
 * @param {String} program - The name of the CLI binary being executed
 * @private
 */
CLI.prototype.initCompletion = function initCompletion(program) {
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
};

/**
 * Executes the tasks for parsing command line arguments and running the
 * specified command. It runs the following tasks:
 *
 * 1. parseGlobalArgs()
 * 2. loadCommand()
 * 3. processCompletion()
 * 4. validate()
 * 5. executeCommand()
 *
 * @param {Function} [done] - Callback when the function finishes
 */
CLI.prototype.go = function (done) {
	series(this, [
		'parseGlobalArgs',
		'loadCommand',
		'processCompletion',
		'validate',
		'executeCommand'
	], done || function(){});
};

/**
 * Parses the command line arguments against the global context. This is mainly
 * to determine what Titanium SDK to use.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:global-args-parsed
 * @private
 */
CLI.prototype.parseGlobalArgs = function parse(next) {
	this.global.parse(this.argv.$_);
	this.emit('cli:global-args-parsed', { cli: this, args: this.argv }, next);
}

/**
 * Loads the appropiate command.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:command-loaded
 * @emits CLI#cli:command-config-loaded
 * @private
 */
CLI.prototype.loadCommand = function loadCommand(next) {
	var commands = this.commands = {},
		scannedCommandPaths = {};

	function scanCommands(dir) {
		if (!scannedCommandPaths[dir] && afs.exists(dir)) {
			var jsfile = /\.js$/,
				ignore = /^[\._]/,
				isDir = fs.statSync(dir).isDirectory();

			(isDir ? fs.readdirSync(dir) : [dir]).forEach(function (filename) {
				var file = isDir ? path.join(dir, filename) : filename;
				// we don't allow commands that start with _ or have spaces
				if (fs.statSync(file).isFile() && jsfile.test(filename) && (!isDir || !ignore.test(path.basename(file)))) {
					// we don't allow commands that start with _ or have spaces
					var name = filename.replace(jsfile, '').toLowerCase();
					commands[name] || (commands[name] = file);
				}
			});
			scannedCommandPaths[dir] = 1;
		}
	}

	// find all built-in commands
	scanCommands(path.join(__dirname, 'commands'));

	// find all commands in the config commands paths
	(function (paths) {
		(Array.isArray(paths) ? paths : [paths]).forEach(function (p) {
			p && scanCommands(afs.resolvePath(p));
		});
	}(this.config.paths.commands));

	// scan the sdk commands
	scanCommands(path.join(this.sdk.path, 'cli', 'commands'));
	Object.keys(this.sdk.platforms).forEach(function (platform) {
		scanCommands(path.join(this.sdk.platforms[platform].path, 'cli', 'commands'));
	}, this);

	// re-parse the cli args, but this time try to find the command and we also
	// want to skip option callbacks since we don't want to cause any issues with
	// callbacks being called more than once
	this.global.parse(this.argv.$_, Object.keys(commands), true);

	// if we didn't find any arguments, then force the help command
	this.argv._.length || this.argv._.push('help');

	var desiredCommand = this.argv.$command = this.argv._[0],
		cmdPath = commands[desiredCommand];

	// check if the desired command exists
	if (!cmdPath) {
		this.logger.banner();
		this.logger.error(__('"%s" is an unrecognized command.', desiredCommand) + '\n');
		appc.string.suggest(desiredCommand, Object.keys(commands), this.logger.log);
		this.logger.log(__("Run '%s' for available commands.", (this.argv.$ + ' help').cyan) + '\n');
		process.exit(1);
	}

	// load the command
	try {
		this.command = {
			name: desiredCommand,
			path: cmdPath,
			module: require(cmdPath),
			conf: null
		};
	} catch (ex) {
		this.logger.banner();
		this.logger.error(ex);
		process.exit(1);
	}

	// check if this command is compatible with this version of the CLI
	if (this.command.cliVersion && !semver.satisfies(this.version, this.command.cliVersion)) {
		this.logger.error(__('Command "%s" incompatible with this version of the CLI', desiredCommand));
		this.logger.error(__('Requires version %s, currently %s', this.command.cliVersion, this.version) + '\n');
		process.exit(1);
	}

	this.emit('cli:command-loaded', { cli: this, command: this.command }, function () {
		var conf = (typeof this.command.module.config == 'function' && this.command.module.config(this.logger, this.config, this)) || {};
		if (typeof conf == 'function') {
			conf(function (realConf) {
				this.command.conf = realConf;
				this.emit('cli:command-config-loaded', { cli: this, command: this.command }, function () {
					this.configureCommand(next);
				}.bind(this));
			}.bind(this));
		} else {
			this.command.conf = conf;
			this.emit('cli:command-config-loaded', { cli: this, command: this.command }, function () {
				this.configureCommand(next);
			}.bind(this));
		}
	}.bind(this));
};

/**
 * Processes the selected command's configuration.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:command-args-parsed
 * @private
 */
CLI.prototype.configureCommand = function configureCommand(next) {
	var conf = this.command.conf || (this.command.conf = {});

	// check if the command requires authentication and if so,
	// then add the username and password options
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

	// back up the existing args
	var _ = this.argv._.slice();

	// add this command to the global context, then parse the args in the returned
	// command context
	this.global.command(this.command).parse(this.argv.$_);

	// since the parse call above squashes the args array, we check the original if
	// it's the help command
	if (_.length && _[0] == 'help') {
		this.argv._ = _;
	}

	// now that all the args have been processed, we strip the first arg since it
	// was the command name
	this.argv._.shift();

	// fire the event that the args have been parsed and processed
	this.emit('cli:command-args-parsed', { cli: this, command: this.command, args: this.argv }, next);
};

/**
 * Performs tab completion, if enabled.
 * @param {Function} next - Callback when the function finishes
 * @private
 */
CLI.prototype.processCompletion = function processCompletion(next) {
	if (this.completion) {
		// TODO: complete words!
		console.log(args.join('|'));
		throw 'stop';
	}
	next();
};

/**
 * Validates the arguments.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:pre-validate
 * @emits CLI#cli:post-validate
 * @private
 */
CLI.prototype.validate = function validate(next) {
	this.emit('cli:pre-validate', { cli: this, command: this.command, args: this.argv }, function () {
		var argv = this.argv,
			conf = this.command.conf || {},
			options = conf.options,
			missingOptions = [],
			invalidOptions = [],
			args = conf.args,
			// missing args is only used when prompting is disabled
			missingArgs = [];

		// check missing required options and invalid option values
		options && Object.keys(options).forEach(function (name) {
			var opt = options[name],
				obj = mix({ name: name }, opt);
			if (opt.required && argv[name] === void 0) {
				missingOptions.push(obj);
			}
			if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) == -1) {
				invalidOptions.push(obj);
			}
		});

		// check missing required arguments
		Array.isArray(args) && args.forEach(function (arg, i) {
			// if the arg doesn't have a name, skip it
			if (arg.name) {
				if (i < argv._.length) {
					// map arguments into the argv object
					argv[arg.name] = argv._[i];
				} else if (arg.required) {
					// note: we are going to error even if the arg has a default value
					missingArgs.push(arg);
				} else {
					argv[arg.name] = arg.default || '';
				}
			}
		});

		series(this, [
			function (next) {
				if (this.config.cli.prompt) {
					// TODO: prompt for all options (including defaulted and invalid values)
					next();
				} else {
					next();
				}
			},
			function (next) {
				if (this.config.cli.prompt) {
					// TODO: prompt for missing arguments
					next();
				} else {
					next();
				}
			},
			function (next) {
				if (!this.config.cli.prompt) {
					if (missingOptions.length || missingArgs.length || invalidOptions.length) {
						this.logger.banner();
					}

					// if prompting is disabled, then we just print all the problems we encountered
					missingOptions.forEach(function (opt) {
						this.logger.error(__('Missing required option "%s"', '--' + opt.name) + '\n');
					}, this);

					missingArgs.forEach(function (arg) {
						this.logger.error(__('Missing required argument "%s"', arg.name) + '\n');
					}, this);

					invalidOptions.forEach(function (opt) {
						this.logger.error(__('Invalid %s value "%s"', opt.name, argv[opt.name]) + '\n');
						this.logger.log(__('Accepted values:'));
						opt.values.forEach(function (v) {
							this.logger.log('   ' + v.cyan);
						}, this);
						this.logger.log();
					}, this);

					if (missingOptions.length || missingArgs.length || invalidOptions.length) {
						this.logger.log(__("For help, run '%s'.", (this.argv.$ + ' help ' + this.argv.$command).cyan) + '\n');
						process.exit(1);
					}
				}
				next();
			},
			function (next) {
				// if this command requires you to be authenticated, try to log in
				if (!this.command.noAuth && !appc.auth.status().loggedIn) {
					appc.auth.login(argv.username, argv.password, function (result) {
						this.logger.banner();
						if (result.error) {
							this.logger.error(__('Login failed: %s', result.error) + '\n');
							process.exit(1);
						}
						this.logger.log(__('Logged in successfully') + '\n');
						next();
					}.bind(this), this.config.cli.httpProxyServer);
				} else {
					next();
				}
			},
			function (next) {
				try {
					var validate = this.command.module.validate;
					if (typeof validate == 'function' && validate(this.logger, this.config, this) === false) {
						// it's easier to just squelch the entire run() function
						this.command.run = function () {};
					}
				} catch (ex) {
					argv.exception = ex;
					argv._.unshift(argv.$command);
					this.command = {
						name: 'help',
						path: this.commands['help'],
						module: require(this.commands['help']),
						conf: null
					};
				}
				next(true);
			}
		], function (err) {
			this.emit('cli:post-validate', { cli: this, command: this.command, success: !err }, next);
		});
	}.bind(this));
};

/**
 * Executes the selected command.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:pre-execute
 * @emits CLI#cli:post-execute
 * @private
 */
CLI.prototype.executeCommand = function executeCommand(next) {
	this.emit('cli:pre-execute', { cli: this, command: this.command }, function () {
		try {
			this.startTime = Date.now();
			var run = this.command.module.run;
			if (typeof run == 'function') {
				run(this.logger, this.config, this, function (err, result) {
					// we need to wrap the post-execute emit in a try/catch so that any
					// exceptions it throws aren't confused with command errors
					try {
						this.emit('cli:post-execute', { cli: this, command: this.command, err: err, result: result }, next);
					} catch (ex) {
						this.logger.error(__('Error while firing "%s" event', 'post-execute'));
						if (ex.type == 'AppcException') {
							ex.dump(this.logger.error);
						} else {
							this.logger.error(ex);
						}
						console.error(e);
					}
				}.bind(this));
			}
		} catch (ex) {
			this.logger.error(__('Failed to run command "%s"', this.argv.$command));
			if (ex.type == 'AppcException') {
				ex.dump(this.logger.error);
			} else {
				this.logger.error(ex);
			}
			process.exit(1);
		}
	}.bind(this));
};

function createPrompter(missing, errorMsg, errorFormat) {
	return function (next) {
		// if there are missing required thing, either fail or prompt
		if (!missing.length) {
			next();
			return;
		}

		if (!config.cli.prompt) {
			missing.forEach(function (m) {
				//!m.defaulted && tierror(errorMsg + ' ' + sprintf(errorFormat, m.name));
			});
			console.log('');
			process.exit(1);
		}

		var queue = async.queue(function (opt, callback) {
			var pr = opt.prompt || {},
				p = (pr.label || appc.string.capitalize(opt.desc || '')).trim().replace(/\:$/, ''),
				def = pr.default || opt.default || '';

			if (typeof def == 'function') {
				def = def();
			} else if (Array.isArray(def)) {
				def = def.join(',');
			}

			fields.text({
				promptLabel: p,
				default: def,
				password: !!opt.password,
				validate: function (value, cb) {
					if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
						logger.error(pr.error);
						return false;
					}
					if (pr.validator) {
						try {
							pr.validator(value);
						} catch (ex) {
							if (ex.type == 'AppcException') {
								logger.error(ex.message);
								ex.details.forEach(function (line) {
									logger.error(line);
								});
							} else {
								logger.error(ex);
							}
							return false;
						}
					}
					return true;
				}
			}).prompt(function (err, value) {
				if (!err) {
					cli.argv[opt.name] = value;
				}
				callback(err);
			});
		}, 1);

		queue.drain = function () {
			next(null, true);
		};

		missing.forEach(function (opt) {
			queue.push(opt, function (err) {
				if (err) {
					logger.log('\n');
					process.exit(1);
				}
			});
		});
	}
}
/*
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
							loadCommandOld(c[sdk], sdk, null, next);
						} else {
							// TODO: add support for default subcommands within sdk/platform-level commands
							async.parallel(Object.keys(c[sdk]).map(function (platform) {
								return function (cb) {
									loadCommandOld(c[sdk][platform], sdk, platform, cb);
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
*/

/* Events */

/**
 * Fired after the CLI args have been parsed and checked in the global context.
 * @event CLI#cli:global-args-parsed
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} args - An object of all arguments found.
 */

/**
 * Fired after the command file has been require()'d.
 * @event CLI#cli:command-loaded
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 */

/**
 * Fired after the command's config() has been called.
 * @event CLI#cli:command-config-loaded
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 */

/**
 * Fired after the CLI args have been parsed and checked in the command context.
 * @event CLI#cli:command-args-parsed
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 * @property {Object} args - An object of all arguments found.
 */

/**
 * Fired before any validation takes place.
 * @event CLI#cli:pre-validate
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 * @property {Object} args - An object of all arguments found.
 */

/**
 * Fired after all validation is done.
 * @event CLI#cli:post-validate
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 * @property {Boolean} success - True if the command's validation passed.
 */

/**
 * Fired before the command is executed.
 * @event CLI#cli:pre-execute
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 */

/**
 * Fired after the command has been executed.
 *
 * NOTE: This event is not guaranteed to fire. Titanium SDKs before 3.2 will
 * never trigger this event because the API didn't account for async execution.
 * You will need to hook into the SDK specific events.
 *
 * @event CLI#cli:post-execute
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 * @property {*} result - The result of the run command, if any.
 */