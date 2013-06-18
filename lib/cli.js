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

/**
 * The main CLI logic. This orchestrates all argument parsing, command loading,
 * validation, and execution. The implementation is generic and should not
 * contain any Titanium specific knowledge.
 * @module lib/cli
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

	// create the global context
	this.globalContext = new Context({ cliVersion: this.version, title: __('Global') });

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
 * 4. login()
 * 5. validate()
 * 6. executeCommand()
 *
 * @param {Function} [done] - Callback when the function finishes
 */
CLI.prototype.go = function (done) {
	series(this, [
		'parseGlobalArgs',
		'loadCommand',
		'processCompletion',
		'login',
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
	this.emit('cli:global-args-parsed', {
		cli: this,
		argv: mix({}, this.argv, this.globalContext.parse(this.argv.$_))
	}, next);
}

/**
 * Scans a directory for all commands or a single file.
 * @param {String} dir - The directory to scan
 * @private
 */
CLI.prototype.scanCommands = function scanCommands(dir) {
	if (!this.scannedCommandPaths[dir] && afs.exists(dir)) {
		var jsfile = /\.js$/,
			ignore = /^[\._]/,
			isDir = fs.statSync(dir).isDirectory();

		(isDir ? fs.readdirSync(dir) : [dir]).forEach(function (filename) {
			var file = isDir ? path.join(dir, filename) : filename;
			// we don't allow commands that start with _ or have spaces
			if (fs.statSync(file).isFile() && jsfile.test(filename) && (!isDir || !ignore.test(path.basename(file)))) {
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
 * Loads the appropiate command.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:command-loaded
 * @private
 */
CLI.prototype.loadCommand = function loadCommand(next) {
	// re-parse the cli args, but this time try to find the command and we also
	// want to skip option callbacks since we don't want to cause any issues with
	// callbacks being called more than once
	this.argv = mix(this.argv, this.globalContext.parse(this.argv.$_, Object.keys(this.globalContext.commands), true));

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
		this.logger.banner();
		this.logger.error(__('"%s" is an unrecognized command.', desiredCommand) + '\n');
		appc.string.suggest(desiredCommand, Object.keys(this.globalContext.commands), this.logger.log);
		this.logger.log(__("Run '%s' for available commands.", (this.argv.$ + ' help').cyan) + '\n');
		process.exit(1);
	}

	// load the command
	command.load(this.logger, this.config, this, function (command) {
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
		console.log(args.join('|'));
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
			proxy = this.config.cli.httpProxyServer,
			logger = this.logger,
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
						next: function (value, go2) {
							// try to login
							appc.auth.login(argv.username, argv.password, function (result) {
								if (result.error) {
									logger.error(__('Login failed: %s', result.error.toString().replace(/\u001b\[\d+m/g, '').trim()));
									// if they fail too many times, then just exit
									if (++attempts > 3) {
										logger.log();
										process.exit(1);
									}
									go2('username');
								} else {
									go2(); // done
								}
							}, proxy);
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
	this.emit('cli:pre-validate', { cli: this, command: this.command, args: this.argv }, function () {
		var argv = this.argv,
			conf = this.command.conf || {},
			options = conf.options,
			missingOptions = [],
			invalidOptions = [],
			args = conf.args,
			// missing args is only used when prompting is disabled
			missingArgs = [],
			loggedIn = appc.auth.status().loggedIn;

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
				// if prompting, prompt for options
				if (this.config.cli.prompt && missingOptions.length) {
					// we purposely do not use missingOptions so that all options are prompted for
					this.prompt(Object.keys(options).filter(function (name) {
						// don't prompt for the sdk, username, & password since
						// we're already past the point of no return
						return !/^sdk|username|password$/.test(name);
					}).map(function (name) {
						var opt = options[name],
							obj = mix({ name: name }, opt);
						if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) == -1) {
							obj.invalid = true;
						}
						return obj;
					}), next);
				} else {
					next();
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
				// if NOT prompting, display all missing options, invalid options, and missing arguments
				if (!this.config.cli.prompt) {
					if (missingOptions.length || invalidOptions.length || missingArgs.length) {
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

					if (missingOptions.length || invalidOptions.length || missingArgs.length) {
						this.logger.log(__("For help, run '%s'.", (this.argv.$ + ' help ' + this.argv.$command).cyan) + '\n');
						process.exit(1);
					}
				}
				next();
			},
			function (next) {
				// run the command's validation
				try {
					var validate = this.command.module.validate;
					if (typeof validate == 'function' && validate(this.logger, this.config, this) === false) {
						// it's easier to just squelch the entire run() function
						this.command.run = function () {};
					}
					next();
				} catch (ex) {
					argv.exception = ex;
					argv._.$command = 'help';
					this.command = this.globalContext.commands.help.load(this.logger, this.config, this, next);
				}
			}
		], function () {
			// validation passed
			this.emit('cli:post-validate', { cli: this, command: this.command }, next);
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
				default: def,
				password: !!opt.password,
				validate: pr.validate || function (value, cb) {
					if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
						_t.logger.error(pr.error);
						return false;
					}
					if (pr.validator) {
						try {
							pr.validator(value);
						} catch (ex) {
							if (ex.type == 'AppcException') {
								ex.dump(_t.logger.error);
							} else {
								_t.logger.error(ex);
							}
							return false;
						}
					}
					return true;
				}
			}).prompt(function (err, value) {
				if (!err) {
					_t.argv[opt.name] = value;
				}
				callback(err);
			});
		}, 1);

	// when the queue is drained, then we're done
	queue.drain = function () {
		_t.logger.log();
		done(null, true);
	};

	// queue up items to prompt for
	items.forEach(function (opt) {
		queue.push(opt, function (err) {
			if (err) {
				_t.logger.log('\n');
				process.exit(1);
			}
		});
	});
};

/**
 * Helper function to renders an array of items into columns.
 * @param {Array} items - The items to render
 * @param {String} margin - The left margin
 * @param {Number} maxwidth - The the maximum width before wrapping
 * @returns {String} The rendered columns
 */
CLI.prototype.renderColumns = function renderColumns(items, margin, maxwidth) {
	var margin = (margin || ''),
		longest = items.reduce(function (a, b) { return Math.max(a, b.stripColors.length);}, 0) + 6,
		width = maxwidth ? Math.min(maxwidth, process.stdout.columns || 80): (process.stdout.columns || 80),
		i, j, spaces,
		len = items.length,
		cols = Math.floor((width - margin.length) / longest),
		rows = Math.ceil(len / cols),
		buffer = '';

	for (i = 0; i < rows; i++) {
		buffer += margin;
		for (j = 0; j < len; j += rows) {
			if (j + i < len) {
				buffer += items[i + j];
				spaces = longest - items[i + j].stripColors.length;
				if (spaces > 0) {
					buffer += (new Array(spaces)).join(' ');
				}
			}
		}
		buffer += '\n';
	}

	return buffer;
};

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