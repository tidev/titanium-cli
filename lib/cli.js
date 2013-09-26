/**
 * The main CLI logic. This orchestrates all argument parsing, command loading,
 * validation, and execution. The implementation is generic and should not
 * contain any Titanium specific knowledge.
 *
 * @module cli
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
 *
 * @requires async
 * @requires fields
 * @requires node-appc
 * @requires sprintf
 */

module.exports = CLI;

var	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	util = require('util'),
	fields = require('fields'),
	appc = require('node-appc'),
	Context = require('./context'),
	Hook = require('./hook'),
	sprintf = require('sprintf').sprintf,
	__ = appc.i18n(__dirname).__,
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

	// scan all built-in hooks
	this.scanHooks(path.join(__dirname, '..', 'hooks'));

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
	if (args[0].replace(/\\/g, '/').split('/').pop().replace(/\.exe$/, '') == process.execPath.replace(/\\/g, '/').split('/').pop().replace(/\.exe$/, '')) {
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

	// set the cli version for all contexts
	Context.prototype.cliVersion = this.version;

	// create the global context
	this.globalContext = new Context({ title: __('Global') });

	// needed for backwards compatibility for Titanium SDKs 3.0.x and 3.1.x
	Object.defineProperty(this, 'cmds', {
		enumerable: false,
		value: this.globalContext.commands
	});

	// init scanned command paths lookup
	this.scannedCommandPaths = {};

	// find all built-in commands
	this.scanCommands(path.join(__dirname, 'commands'));

	// find all commands in the config commands paths
	(function (_t, paths) {
		(Array.isArray(paths) ? paths : [paths]).forEach(function (p) {
			p && _t.scanCommands(afs.resolvePath(p));
		});
	}(this, this.config.get('paths.commands')));

	// init the tab completion system for non-Windows platforms
	if (this.completion = (process.platform != 'win32' && !!this.config.cli.completion)) {
		this.initCompletion(this.argv.$);
		var i = this.argv.$_.indexOf('--compgen');
		if (this.completion = ~i) {
			// doing tab completion, squelch all output
			process.on('uncaughtException', function () {});
			if (this.completion) {
				this.argv.$_ = this.argv.$_.slice(i + 2);
			} else {
				process.exit(0);
			}
		}
	}
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
 * Scans a directory for all commands or a single file.
 * @param {String} dir - The directory to scan
 * @private
 */
CLI.prototype.scanCommands = function scanCommands(dir) {
	if (!this.scannedCommandPaths[dir] && fs.existsSync(dir)) {
		var jsfile = /\.js$/,
			ignore = /^[\._]/,
			isDir = fs.statSync(dir).isDirectory();

		(isDir ? fs.readdirSync(dir) : [dir]).forEach(function (filename) {
			var file = isDir ? path.join(dir, filename) : filename;
			// we don't allow commands that start with _ or have spaces
			if (fs.existsSync(file) && fs.statSync(file).isFile() && jsfile.test(filename) && (!isDir || !ignore.test(path.basename(file)))) {
				// we don't allow commands that start with _ or have spaces
				var name = filename.replace(jsfile, '').toLowerCase();
				this.globalContext.command({
					name: name,
					path: file
				});
			}
		}, this);
		this.scannedCommandPaths[dir] = 1;
	}
};

/**
 * Configures global context's flags and options.
 * @param {Object} conf - The context's configuration
 * @returns {CLI}
 */
CLI.prototype.configure = function config(conf) {
	this.globalContext.conf = conf = conf || {};
	conf.flags && this.globalContext.flag(conf.flags);
	conf.options && this.globalContext.option(conf.options);
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
			].join('\n').replace(/\{\{NAME\}\}/g, program);

	if (process.platform !== 'darwin') {
		bashrc = path.join(process.env.HOME, '.bashrc');
	} else {
		while (i < l) {
			if (fs.existsSync(bashrc = path.join(process.env.HOME, files[i++]))) {
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
 * 1. loadCommand()
 * 2. processCompletion()
 * 3. login()
 * 4. validate()
 * 5. executeCommand()
 *
 * @param {Function} [done] - Callback when the function finishes
 */
CLI.prototype.go = function (done) {
	series(this, [
		'loadCommand',
		'processCompletion',
		'login',
		'validate',
		'executeCommand'
	], done || function(){});
};

/**
 * Loads the appropiate command.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:command-loaded
 * @private
 */
CLI.prototype.loadCommand = function loadCommand(next) {
	// re-parse the cli args, but this time try to find the command and we also
	// want to skip option callbacks since we don't want to cause any issues with
	// callbacks being called more than once
	mix(this.argv, this.globalContext.parse(this.argv.$_, Object.keys(this.globalContext.commands), true));

	// if we didn't find any arguments, then force the help command
	if (!this.argv._.length || this.argv._[0] == 'help' || this.argv.$command == 'help') {
		if (!this.argv._.length || this.argv._[0] != 'help') {
			this.argv._.unshift('help');
		}
		this.argv.$command == 'help';
	}

	var desiredCommand = this.argv.$command = this.argv._[0],
		command = this.command = this.globalContext.commands[desiredCommand];

	// check if the desired command exists
	if (!command) {
		// if we're doing completion, perhaps we have an incomplete command name?
		if (this.completion) {
			var arg = this.argv.$_.length && this.argv.$_[this.argv.$_.length - 1];
			arg && Object.keys(this.globalContext.commands).forEach(function (cmd) {
				if (cmd.indexOf(arg) == 0) {
					console.log(cmd);
				}
			});
			process.exit(0);
		}

		this.logger.banner();
		this.logger.error(__('"%s" is an unrecognized command.', desiredCommand) + '\n');
		appc.string.suggest(desiredCommand, Object.keys(this.globalContext.commands), this.logger.log);
		this.logger.log(__("Run '%s' for available commands.", (this.argv.$ + ' help').cyan) + '\n');
		process.exit(1);
	}

	// load the command
	command.load(this.logger, this.config, this, function (err, command) {
		if (err) {
			this.logger.banner();
			this.logger.error(__('Failed to load command "%s"', command.name));
			this.logger.error(err.message.trim() + '\n');
			this.logger.log(err.stack.trim().grey + '\n');
			process.exit(1);
		}
		this.emit('cli:command-loaded', { cli: this, command: command }, next);
	}.bind(this));
};

/**
 * Performs tab completion, if enabled.
 * @param {Function} next - Callback when the function finishes
 * @private
 */
CLI.prototype.processCompletion = function processCompletion(next) {
	if (this.completion) {
		// TODO: complete words!
		console.log(this.argv.$_.join('|'));
		throw 'stop';
	}
	next();
};

/**
 * Prompts for Appcelerator Network login if required by the command and not
 * already logged in.
 * @param {Function} next - Callback when the function finishes
 * @private
 */
CLI.prototype.login = function login(next) {
	// remove username and password from the options since we don't need them
	// beyond validation. note that because of this, they will not show up in
	// the help screen.
	if (this.command.conf.options) {
		delete this.command.conf.options.username;
		delete this.command.conf.options.password;
	}

	// if this command requires authentication, then prompt for their username
	// and password, or show an error message
	if (this.command.requireAuth && !appc.auth.status().loggedIn) {
		var argv = this.argv,
			proxy = this.config.get('cli.httpProxyServer'),
			logger = this.logger,
			loginUrl = this.config.get('cli.auth.loginUrl'),
			attempts = 1,
			prompt = function prompt(err) {
				logger.banner();

				// if their --username and --password failed, show an error
				if (err) {
					logger.error(__('Login failed: %s', err.toString().replace(/\u001b\[\d+m/g, '').trim()) + '\n');
				}

				// if prompting is disabled, then show an error and exit
				if (!this.config.cli.prompt) {
					err || logger.error(__('Authentication required') + '\n');
					logger.log(__("To login, run '%s'.", (this.argv.$ + ' login').cyan) + '\n');
					process.exit(1);
				}

				// create a set containing the username and password, then prompt for it
				fields.set({
					username: fields.text({
						promptLabel: 'Username',
						default: argv.username || this.config.user && this.config.user.email,
						required: true,
						validate: function (value, callback) {
							if (!value) {
								logger.error('Please enter your username');
								return false;
							}
							argv.username = value;
							return true;
						}.bind(this)
					}),
					password: fields.text({
						promptLabel: 'Password',
						password: true,
						required: true,
						validate: function (value, callback) {
							if (!value) {
								logger.error('Please enter a password');
								return false;
							}
							argv.password = value;
							return true;
						}.bind(this),
						next: function (err, value, go2) {
							// try to login
							appc.auth.login({
								username: argv.username,
								password: argv.password,
								loginUrl: loginUrl,
								proxy: proxy,
								callback: function (err, result) {
									if (err) {
										logger.error(__('Login failed: %s', err.toString().replace(/\u001b\[\d+m/g, '').trim()));
										// if they fail too many times, then just exit
										if (++attempts > 3) {
											logger.log();
											process.exit(1);
										}
										go2('username');
									} else {
										go2(); // done
									}
								}
							});
						}
					})
				}, {
					fieldSeparator: ''
				}).prompt(function (err, value) {
					logger.log();
					if (err && err.message == 'cancelled') {
						logger.log();
						process.exit(1);
					}
					next();
				});
			}.bind(this);

		// did they already specify the --username and --password?
		if (argv.username && argv.password) {
			appc.auth.login(argv.username, argv.password, function (result) {
				if (result.error) {
					// login failed, proceed with prompting
					prompt(result.error);
				} else {
					// login success
					next();
				}
			}, proxy);
		} else {
			// no --username and --password, proceed with prompting
			prompt();
		}
	} else {
		next();
	}
};

/**
 * Validates the arguments.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:pre-validate
 * @emits CLI#cli:post-validate
 * @private
 */
CLI.prototype.validate = function validate(next) {
	this.emit('cli:pre-validate', { cli: this, command: this.command }, function () {
		var argv = this.argv,
			conf = this.command.conf || {},
			options = {},
			missingOptions = {},
			invalidOptions = {},
			globalOptions = Object.keys(this.globalContext.options).concat(['username', 'password']),
			args = conf.args,
			// missing args is only used when prompting is disabled
			missingArgs = [],
			loggedIn = appc.auth.status().loggedIn;

		series(this, [
			function (next) {
				// mix the command and platform specific options together
				[this.command, this.command.platform].forEach(function (ctx) {
					ctx && ctx.conf && ctx.conf.options && mix(options, ctx.conf.options);
				});

				// check missing required options and invalid options
				// the missingOptions is used to determine if there is at least one missing
				// required option and if we're doing a build using Titanium SDK < 3.2, we
				// will use the missingOptions to prompt the old way. The new way recomputes
				// missing options after each missing option is prompted for.
				options && Object.keys(options).forEach(function (name) {
					var opt = options[name],
						obj = mix({ name: name }, opt),
						p = globalOptions.indexOf(name);

					if (argv[name] == undefined) {
						if (opt.required || (opt.conf && opt.conf.required)) {
							missingOptions[name] = obj;
						}
					} else if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) == -1) {
						invalidOptions[name] = obj;
					}

					// if this command or platform option is the same name as a global option,
					// then we must remove the name from the list of global options so that
					// the real options aren't blacklisted
					if (p != -1) {
						globalOptions.splice(p, 1);
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

				next();
			},

			function (next) {
				// if prompting, prompt for invalid options
				if (!this.config.cli.prompt || !Object.keys(invalidOptions).length) {
					return next();
				}

				// invalid options are always based on a list of valid values, so
				// we can just use a select prompt to ask for valid values

				var opts = {},
					_t = this;

				Object.keys(invalidOptions).forEach(function (name) {
					var opt = invalidOptions[name],
						field = opts[name] = fields.select({
							title: __('Please select a valid %s value', name.cyan),
							promptLabel: __('Select a value by number or name'),
							margin: '',
							numbered: true,
							relistOnError: true,
							complete: true,
							suggest: true,
							options: opt.values
						});

					field.on('pre-prompt', function () {
						_t.logger.error(__('Invalid %s value "%s"', name, argv[name]) + '\n');
					});
				});

				fields.set(opts).prompt(function (err, data) {
					if (err) {
						if (err.message != 'cancelled') {
							_t.logger.error(err);
						}
						_t.logger.log();
						process.exit(1);
					}
					mix(argv, data);
					next();
				});
			},

			function (next) {
				// if prompting, prompt for missing options
				if (!this.config.cli.prompt || !Object.keys(missingOptions).length) {
					return next();
				}

				if (appc.version.gte(this.sdk.manifest.version, '3.2.0')) {
					// Titanium SDK >= 3.2 prompts using the "new" prompt library and
					// we use a while loop to process each missing option. As soon as
					// a missing option has been prompted for, we recompute the missing
					// options just in case a missing option (i.e. --target) adds new
					// dependencies.

					// if there aren't any options, continue
					if (!options || !Object.keys(options).length) return next();

					var done = false;
					async.whilst(
						function () { return !done; },
						function (callback) {
							// find the missing options
							var missing = {};
							Object.keys(options).forEach(function (name) {
								if (globalOptions.indexOf(name) == -1) {
									var opt = options[name],
										obj = mix({ name: name }, opt);

									if ((opt.required || (opt.conf && opt.conf.required)) && argv[name] === void 0) {
										missing[name] = obj;
									}
								}
							});

							// sort and get the first missing option
							var names = Object.keys(missing).sort(function (a, b) {
								if (options[a].order && options[b].order) {
									return options[a].order < options[b].order ? -1 : options[a].order > options[b].order ? 1 : 0;
								} else if (options[a].order) {
									return -1;
								} else if (options[b].order) {
									return 1;
								}
								return 0;
							});

							name = names.shift();
							if (name) return this.prompt(missing[name], callback);

							// didn't find any more missing options
							done = true;
							callback();
						}.bind(this),
						function () {
							next();
						}
					);
				} else {
					// Titanium SDK < 3.2 handles options and their defaults the old way, so
					// we have to treat the prompting the old way
					this.prompt(Object.keys(missingOptions).map(function (name) {
						var opt = missingOptions[name],
							obj = mix({ name: name }, opt);
						if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) == -1) {
							obj.invalid = true;
						}
						return obj;
					}), next);
				}
			},

			function (next) {
				// if prompting, prompt for missing arguments
				if (this.config.cli.prompt && missingArgs.length) {
					this.prompt(missingArgs, next);
				} else {
					next();
				}
			},

			function (next) {
				// run the command's validation
				var validate = this.command.module.validate;
				if (validate && typeof validate == 'function') {
					// call validate()
					var result = validate(this.logger, this.config, this),
						done = 0;
					if (result && typeof result == 'function') {
						result(function (r) {
							if (done++) return; // if callback is fired more than once, just ignore
							if (r === false) {
								// squelch the run() function
								this.command.module.run = function () {};
							}
							this.emit('cli:post-validate', { cli: this, command: this.command }, next);
						}.bind(this));
						return;
					} else if (result === false) {
						// squelch the run() function
						this.command.module.run = function () {};
					}
				}
				this.emit('cli:post-validate', { cli: this, command: this.command }, next);
			},

			function (next) {
				// call option callbacks
				[this.command, this.subcommand].forEach(function (ctx) {
					if (ctx) {
						// call command/subcommand option callbacks
						var options = ctx.options;
						options && Object.keys(options).forEach(function (name) {
							if (options[name].callback) {
								var val = options[name].callback(argv[name] || '');
								val !== void 0 && (argv[name] = val);
							}
						});

						// call platform specific option callbacks
						options = ctx.platform && ctx.platform.options;
						options && Object.keys(options).forEach(function (name) {
							if (options[name].callback) {
								var val = options[name].callback(argv[name] || '');
								val !== void 0 && (argv[name] = val);
							}
						});
					}
				}, this);
				next();
			},

			function (next) {
				// if NOT prompting, display all missing options, invalid options, and missing arguments
				if (!this.config.cli.prompt) {
					var invalidOptions = [];

					// check invalid option values
					options && Object.keys(options).forEach(function (name) {
						var opt = options[name];
						if (argv[name] !== void 0 && Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) == -1) {
							invalidOptions.push(mix({ name: name }, opt));
						}
					});

					if (Object.keys(missingOptions).length || invalidOptions.length || missingArgs.length) {
						this.logger.banner();
						this.logger.bannerEnabled() || this.logger.log();
					}

					// if prompting is disabled, then we just print all the problems we encountered
					Object.keys(missingOptions).forEach(function (name) {
						this.logger.error(__('Missing required option "%s"', '--' + name) + '\n');
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

					if (Object.keys(missingOptions).length || invalidOptions.length || missingArgs.length) {
						this.logger.log(__("For help, run '%s'.", (this.argv.$ + ' help ' + this.argv.$command).cyan) + '\n');
						process.exit(1);
					}
				}
				next();
			}
		], function (err) {
			if (err) {
				if (err.message != 'cancelled') {
					this.logger.error(__('Failed to complete all validation tasks') + '\n');
					this.logger.error(err);
				}
				this.logger.log();
				process.exit(1);
			}
			next();
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
			var run = this.command.module.run,
				done = 0;
			if (typeof run == 'function') {
				run(this.logger, this.config, this, function (err, result) {
					if (done++) return; // if callback is fired more than once, just ignore

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
						process.exit(1);
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

/**
 * Prompts the user for the specified items.
 * @param {Array} items
 * @param {Function} done - Callback when the function finishes
 * @private
 */
CLI.prototype.prompt = function prompt(items, done) {
	var _t = this,
		// create our async queue
		queue = async.queue(function (opt, callback) {
			if (opt.prompt && typeof opt.prompt == 'function') {
				opt.prompt(function (field) {
					if (!field) return callback();
					field.prompt(function (err, value) {
						if (err && err.message == 'cancelled') {
							return callback(err);
						} else if (!err) {
							_t.argv[opt.name] = value;
						}
						callback();
					});
				});
			} else {
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
					promptValues: opt.values,
					default: def || void 0,
					password: !!opt.password,
					validate: pr.validate || function (value, cb) {
						if (pr.validator) {
							try {
								pr.validator(value);
							} catch (ex) {
								if (ex.type == 'AppcException') {
									ex.dump(_t.logger);
								} else {
									_t.logger.error(ex);
								}
								return false;
							}
						} else if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
							_t.logger.error(pr.error);
							return false;
						}
						return true;
					}
				}).prompt(function (err, value) {
					if (!err) {
						_t.argv[opt.name] = value;
					}
					callback(err);
				});
			}
		}.bind(this), 1);

	// when the queue is drained, then we're done
	queue.drain = function () {
		_t.logger.log();
		done(null, true);
	};

	// queue up items to prompt for
	(Array.isArray(items) ? items : [items]).forEach(function (opt) {
		queue.push(opt, function (err) {
			if (err) {
				_t.logger.log('\n');
				process.exit(1);
			}
		});
	});
/*
	var _t = this,
		set = fields.set(null, {
			stopOnError: false
		}),
		fieldsToPrompt = {};

	async.parallel(items.filter(function (opt) {
		return opt && opt.name;
	}).map(function (opt) {
		return function (next) {
			if (opt.prompt && typeof opt.prompt == 'function') {
				// this option will do the prompting for us
				opt.prompt(function (field) {
					if (field) {
						fieldsToPrompt[opt.name] = field;
						field.opt = opt;
					}
					next();
				});
			} else {
				// this option doesn't do the prompting, so we will do text only prompting
				var pr = opt.prompt || {},
					p = (pr.label || appc.string.capitalize(opt.desc || '')).trim().replace(/\:$/, ''),
					def = pr.default || opt.default || '';

				if (typeof def == 'function') {
					def = def();
				} else if (Array.isArray(def)) {
					def = def.join(',');
				}

				fieldsToPrompt[opt.name] = fields.text({
					promptLabel: p,
					promptValues: opt.values,
					default: def || void 0,
					password: !!opt.password,
					validate: pr.validate || function (value, cb) {
						if (pr.validator) {
							try {
								pr.validator(value);
							} catch (ex) {
								if (ex.type == 'AppcException') {
									ex.dump(_t.logger);
								} else {
									_t.logger.error(ex);
								}
								return false;
							}
						} else if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
							_t.logger.error(pr.error);
							return false;
						}
						return true;
					}
				});

				next();
			}
		};
	}), function () {
		set.fields = fieldsToPrompt;

		set.on('post-prompt', function (field, err, value) {
			if (field.opt && !err) {
				_t.argv[field.opt.name] = value;
			}
		});

		set.prompt(function (err, values) {
			done(err, true);
		});
	});*/
};

/* Events */

/**
 * Fired after the command file has been require()'d.
 * @event CLI#cli:command-loaded
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
 */

/**
 * Fired before any validation takes place.
 * @event CLI#cli:pre-validate
 * @type {object}
 * @property {Object} cli - The CLI instance.
 * @property {Object} command - The command descriptor.
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