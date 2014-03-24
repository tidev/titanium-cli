/**
 * Defines a context which tracks flags and options, then parses command line
 * arguments based on that knowledge.
 *
 * @module context
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * Copyright 2010 James Halliday (mail@substack.net)
 * {@link https://github.com/substack/node-optimist}
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 * @requires semver
 */

var semver = require('semver'),
	appc = require('node-appc'),
	fs = require('fs'),
	path = require('path'),
	vm = require('vm'),
	fields = require('fields'),
	string = appc.string,
	parallel = appc.async.parallel,
	AppcException = appc.exception,
	mix = appc.util.mix,
	__ = appc.i18n(__dirname).__;

module.exports = Context;

/**
 * Creates a context.
 * @class
 * @classdesc A container for flags, options, and commands.
 * @constructor
 * @param {Object} [params]
 */
function Context(params) {
	/**
	 * A map of all flags definitions.
	 * @type {Object}
	 */
	this.flags = {};

	/**
	 * A map of all options definitions.
	 * @type {Object}
	 */
	this.options = {};

	/**
	 * An array of all argument definitions.
	 * @type {Array}
	 */
	this.args = [];

	/**
	 * A map of all command contexts.
	 * @type {Object}
	 */
	this.commands = {};

	/**
	 * A map of all subcommand contexts.
	 * @type {Object}
	 */
	this.subcommands = {};

	/**
	 * A map of all platform contexts.
	 * @type {Object}
	 */
	this.platforms = {};

	/**
	 * Alias look up for flags and options.
	 * @type {Object}
	 */
	this.aliases = {};

	/**
	 * The name of this context.
	 * @type {String}
	 */
	this.name = params && params.name || '';

	/**
	 * The path to the module being require()'d.
	 * @type {String}
	 */
	this.path = params && params.path;

	/**
	 * The module definition returned from require().
	 * @type {Object}
	 */
	this.module = params && params.module;

	/**
	 * The title of this context to be display by the 'help' command; defaults to the context name.
	 * @type {String}
	 */
	this.title = params && params.title || string.capitalize(this.name);

	/**
	 * The description to be display by the 'help' command
	 * @type {String}
	 */
	this.desc = params && params.desc || this.desc;

	/**
	 * The extended description to be display by the 'help' command
	 * @type {String}
	 */
	this.extendedDesc = params && params.extendedDesc || this.extendedDesc;

	/**
	 * The parent context.
	 * @type {String}
	 */
	this.parent = params && params.parent || null;

	/**
	 * A context specific parsed argument values object.
	 * @type {String}
	 */
	this.argv = params && params.argv || {};
	Array.isArray(this.argv._) || (this.argv._ = []);

	/**
	 * The module's original configuration object containing flags, options, etc.
	 * @type {Object}
	 */
	this.conf = params && params.conf;
	if (this.conf) {
		this.conf.flags && this.flag(this.conf.flags);
		this.conf.options && this.option(this.conf.options);
		this.conf.args && (this.args = this.conf.args);
		this.conf.subcommands && this.subcommand(this.conf.subcommands);
	}
}

function createFlagOption(type, name, params, dontAddIfExists, squashCallbacks) {
	if (Object.prototype.toString.call(name) == '[object Object]') {
		Object.keys(name).forEach(function (k) {
			createFlagOption.call(this, type, k, name[k], params, dontAddIfExists);
		}, this);
	} else if (!dontAddIfExists || !this[type].hasOwnProperty(name)) {
		params || (params = {});
		if (squashCallbacks) {
			delete params.callback;
		}
		this[type][name] = params;

		if (params.alias) {
			// params.alias is either a string or an array<string>
			Array.isArray(params.alias) || (params.alias = [ params.alias ]);
			params.alias.forEach(function (alias) {
				if (!dontAddIfExists || !this.aliases.hasOwnProperty(alias)) {
					Array.isArray(this.aliases[alias]) || (this.aliases[alias] = []);
					this.aliases[alias].push(name);
				}
			}, this);
		}

		if (params.abbr && (!dontAddIfExists || !this.aliases.hasOwnProperty(params.abbr))) {
			Array.isArray(this.aliases[params.abbr]) || (this.aliases[params.abbr] = []);
			this.aliases[params.abbr].push(name);
		}

		// if this is a flag, we can go ahead and set the default. we cannot
		// do this for options though because it would make checking for
		// missing options impossible
		if (type == 'flags') {
			this.setArg(name, !!params.default);
		}
	}
	return this;
}

/**
 * Adds a flag to this context.
 * @param {String} name - The flag name
 * @param {Object} params - The flag parameters
 * @param {Boolean} dontAddIfExists - Only adds if it doesn't already exist
 * @returns {Context} The context the flag is added to
 * @example
 *   ctx.flag('quiet', {
 *       abbr: 'q',
 *       callback: function (value, logger) {
 *           logger.silence(config.cli.quiet = value);
 *       },
 *       default: false,
 *       desc: __('suppress all output')
 *   });
 * @example
 * ctx.flag({
 *     'prompt': {
 *         // params...
 *     },
 *     'quiet': {
 *         // params...
 *     }
 * });
 */
Context.prototype.flag = function flag() {
	return createFlagOption.apply(this, ['flags'].concat(Array.prototype.slice.call(arguments)));
};

/**
 * Adds an option to this context.
 * @param {String} name - The option name
 * @param {Object} params - The option params
 * @param {Boolean} dontAddIfExists - Only adds if it doesn't already exist
 * @returns {Context} The context the option is added to
 * @example
 * ctx.option('output', {
 *     abbr: 'o',
 *     default: 'report',
 *     desc: __('output format'),
 *     values: ['report', 'json']
 * });
 */
Context.prototype.option = function option() {
	return createFlagOption.apply(this, ['options'].concat(Array.prototype.slice.call(arguments)));
};

/**
 * Add a command to this context. This function is only called via
 * cli.scanCommands() for the global context.
 * @param {Object} obj - The command params object
 * @param {String} obj.name - The command name
 * @param {Object} [obj.conf] - The command configuration
 * @returns {Context} The command context
 */
Context.prototype.command = function command(obj) {
	obj.parent = this;

	var commandContext = this.commands[obj.name] = new Context(obj),
		conf = obj.conf;

	if (conf) {
		// set the flags and options
		conf.args && (commandContext.args = conf.args);
		conf.subcommands && commandContext.subcommand(conf.subcommands);

		// for each platform, set their options and flags
		conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
			var platformConf = conf.platforms[platform],
				platformContext = commandContext.platforms[platform] = new Context({ title: platformConf.title || platform, name: platform, parent: this });
			platformConf.flags && platformContext.flag(platformConf.flags);
			platformConf.options && platformContext.option(platformConf.options);
			platformConf.args && (platformContext.args = platformConf.args);
			platformConf.subcommands && platformContext.subcommand(platformConf.subcommands);
		}, this);
	}

	return commandContext;
};

/**
 * Add a subcommand to this context.
 * @param {String} name - The subcommand name
 * @param {Object} conf - The subcommand configuration
 * @returns {Context} The context the subcommand is added to
 */
Context.prototype.subcommand = function subcommand(name, conf) {
	if (Object.prototype.toString.call(name) == '[object Object]') {
		Object.keys(name).forEach(function (k) {
			subcommand.call(this, k, name[k]);
		}, this);
	} else {
		var subcommandContext = this.subcommands[name] = new Context({ name: name, parent: this });
		if (conf) {
			subcommandContext.conf = conf;
			conf.flags && subcommandContext.flag(conf.flags);
			conf.options && subcommandContext.option(conf.options);
			conf.args && (subcommandContext.args = conf.args);
			conf.desc && (subcommandContext.desc = conf.desc);
		}
	}
	return this;
};

/**
 * Assuming this context is a command context, loads the command module and evaluates
 * its configuration.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Object} cli.argv - The parsed CLI args
 * @param {String} cli.version - The CLI version derived from the package.json
 * @param {Function} callback - Callback for when the command and it's config is loaded
 */
Context.prototype.load = function load(logger, config, cli, callback) {
	if (this.loaded) {
		callback(null, this);
	} else if (!this.path) {
		logger.error(__('Unable to load "%s" command because command file path unknown', this.name) + '\n');
		process.exit(1);
	} else if (!fs.existsSync(this.path)) {
		logger.error(__('Unable to load "%s" command because command file path does not exist', this.name));
		logger.error(__('Command file: %s', this.path) + '\n');
		process.exit(1);
	} else {
		// load the command module
		try {
			vm.runInThisContext('(function (exports, require, module, __filename, __dirname) { ' + fs.readFileSync(this.path).toString() + '\n});', this.path, 0, false);
			this.module = require(this.path);
			this.conf = {};
			this.loaded = true;
		} catch (ex) {
			// if the command fails to load, then we simply ignore it exists
			callback(new AppcException(ex.toString().trim(), '   at ' + this.path), this);
			return;
		}

		// check if this command is compatible with this version of the CLI
		if (this.module.cliVersion && !semver.satisfies(appc.version.format(cli.version, 0, 3, true), this.module.cliVersion)) {
			logger.banner();
			logger.error(__('Command "%s" incompatible with this version of the CLI', this.name));
			logger.error(__('Requires version %s, currently %s', this.module.cliVersion, cli.version) + '\n');
			process.exit(1);
		}

		// load the commands configuration
		var conf = (typeof this.module.config == 'function' && this.module.config(logger, config, cli)),
			processConf = function processConf(conf) {
				this.conf = conf = conf || {};
				this.module.title && (this.title = this.module.title);
				this.module.desc && (this.desc = this.module.desc);
				this.module.extendedDesc && (this.extendedDesc = this.module.extendedDesc);
				this.requireAuth = !conf.noAuth;
				this.loaded = true;

				// old SDKs have their own --sdk option, but now it's global
				if (this.parent && conf.options) {
					delete conf.options.sdk;
				}

				// set the flags and options
				conf.flags && this.flag(conf.flags);
				conf.options && this.option(conf.options);
				conf.args && (this.args = conf.args);
				conf.subcommands && this.subcommand(conf.subcommands);

				// needed for backwards compatibility for Titanium SDKs 3.0.x and 3.1.x
				cli.sdk && Object.defineProperty(this, cli.sdk.name, {
					enumerable: false,
					value: {
						__global__: this
					}
				});

				if (!cli.argv) {
					return callback(null, this);
				}

				// parse the args to get the --platform
				var argv = this.parse(cli.argv.$_, Object.keys(this.commands)),
					isHelpCommand = cli.argv.$command == 'help';

				// since the parse call above squashes the args array, we check the original if
				// it's the help command (via --help)... generally they are the same anyways
				if (isHelpCommand) {
					argv._ = cli.argv._;
				}

				// remove the command from the list of args
				argv._.shift();

				var options = this.options,
					finish = function () {
						// apply missing option defaults
						Object.keys(options).forEach(function (name) {
							if (!argv.hasOwnProperty(name) && options[name].default) {
								argv[name] = options[name].default;
							}
						});

						// mix our new argv into the existing argv
						mix(cli.argv, argv);

						// complete the load() call
						callback(null, this);
					}.bind(this);

				if (options.platform) {
					var loadPlatform = function loadPlatform() {
						if (conf.platforms && conf.platforms.hasOwnProperty(argv.platform) && cli.sdk && cli.sdk.path) {
							var platformConf = conf.platforms[argv.platform],
								platformContext = new Context({
									title: platformConf.title || argv.platform,
									name: argv.platform,
									path: path.join(cli.sdk.path, argv.platform) || '',
									conf: platformConf,
									parent: this
								});

							this.platform = platformContext;

							// set the platforms for 3.0 and 3.1 builds
							this.platforms[this.platform.name] = this.platform;

							options = platformContext.options;
							mix(argv, platformContext.parse(cli.argv.$_, [this.name]));
							argv.$platform = argv.platform;

							// find all platform hooks
							cli.scanHooks(path.join(cli.sdk.path, platformContext.name, 'cli', 'hooks'));

							// TODO: add support for platform level subcommands (hasn't been needed yet)
						}
					}.bind(this);

					if (!isHelpCommand && argv.platform) {
						// --platform was set, the load only that platform
						loadPlatform();

					} else if (!isHelpCommand && options.platform.required) {
						if (argv.prompt) {
							// no --platform, but it's required, so prompt for it
							logger.banner();

							fields.select({
								title: __('Target platform to build for:'),
								complete: true,
								completeIgnoreCase: true,
								suggest: true,
								suggestThreshold: 2,
								numbered: true,
								margin: '',
								promptLabel: __('Enter # or platform name'),
								relistOnError: true,
								options: options.platform.values,
								validate: options.platform.prompt.validate || function (value) {
									// first run the sdk's platform validator
									if (options.platform.prompt.validator) {
										try {
											options.platform.prompt.validator(value);
										} catch (ex) {
											if (ex.type == 'AppcException') {
												ex.dump(logger);
											} else {
												logger.log();
												logger.error(ex.message || ex);
												logger.log();
											}
											return false;
										}
									} else if (!value.length || (options.platform.prompt.pattern && !options.platform.prompt.pattern.test(value))) {
										logger.error(options.platform.prompt.error);
										return false;
									}
									return true;
								}
							}).prompt(function (err, platform) {
								logger.log();
								if (err) {
									logger.log();
									process.exit(1);
								}

								// the option should probably have a callback, so fire it
								if (options.platform.callback) {
									platform = options.platform.callback(platform);
								}

								// set the platform we just prompted for
								argv.platform = platform;

								if (!conf.platforms || !conf.platforms.hasOwnProperty(platform)) {
									logger.error(__('Unable to find platform configuration for "%s"', platform));
									logger.log();
									process.exit(1);
								}

								loadPlatform();
								finish();
							});
						} else {
							logger.banner();
							logger.error(__('Missing required option "--platform"') + '\n');
							logger.log(__('Available Platforms:'));
							options.platform.values.forEach(function (v) {
								logger.log('   ' + v.cyan);
							});
							logger.log();
							process.exit(1);
						}
						return;

					} else if (conf.platforms && (isHelpCommand || (cli.sdk && cli.sdk.path))) {
						// no platform specified, load all platforms and set their options and flags
						Object.keys(conf.platforms).forEach(function (platform) {
							this.platforms[platform] = new Context({
								title: conf.platforms[platform].title || platform,
								name: platform,
								path: path.join(cli.sdk.path, platform) || '',
								conf: conf.platforms[platform],
								parent: this
							});
						}, this);
					}

				} else {
					// no platform option

					// check if this command has any subcommands, if so, parse the args again
					if (Object.keys(this.subcommands).length) {
						var subcmd = argv._.length && argv._[0] || conf.defaultSubcommand,
							subcommandContext = this.subcommands[subcmd];
						if (subcommandContext) {
							this.requireAuth = this.requireAuth || !conf.subcommands[subcmd].noAuth;

							// parse the args again to get any subcommand flags/options
							argv = subcommandContext.parse(cli.argv.$_, Object.keys(this.subcommands).concat(this.name));
							argv.$subcommand = subcmd;
							options = subcommandContext.options;
						}
					}

				}

				finish();
			}.bind(this),
			done = 0;

		if (typeof conf == 'function') {
			conf(function (realConf) {
				if (done++) return; // if callback is fired more than once, just ignore
				processConf(realConf);
			}.bind(this));
		} else {
			processConf(conf);
		}
	}
};

/**
 * Assuming this context is a command context, loads just the command module.
 * @param {Function} callback - Callback for when the command and it's config is loaded
 */
Context.prototype.loadModuleOnly = function loadModuleOnly(callback) {
	if (this.loaded) {
		callback(null, this);
	} else if (!this.path) {
		callback(new AppcException(__('Unable to load "%s" command because command file path unknown', this.name)));
	} else if (!fs.existsSync(this.path)) {
		callback(new AppcException(__('Unable to load "%s" command because command file path does not exist', this.name), __('Command file: %s', this.path)));
	} else {
		// load the command module
		try {
			vm.runInThisContext('(function (exports, require, module, __filename, __dirname) { ' + fs.readFileSync(this.path).toString() + '\n});', this.path, 0, false);
			this.module = require(this.path);
			callback(null, this);
		} catch (ex) {
			// if the command fails to load, then we simply ignore it exists
			callback(ex, this);
			return;
		}
	}
};

/**
 * Sets an argument and it's value in the argv object.
 * @param {String} name - The name of the argument
 * @param {String} value - The argument's value
 * @private
 */
Context.prototype.setArg = function setArg(name, value, skipCallbacks) {
	(this.aliases[name] || [ name ]).forEach(function (name) {
		var argv = this.argv,
			parts = name.split('.'),
			last = parts.pop(),
			val;

		// if name is some.nested.object, create the chain of objects
		parts.forEach(function (k) {
			argv.hasOwnProperty(k) || (argv[k] = {});
			argv = argv[k];
		});

		if (!skipCallbacks) {
			// see if this name is a flag and if so, fire the callback
			if (this.flags[name]) {
				if (this.flags[name].callback) {
					val = this.flags[name].callback(value);
					val !== void 0 && (value = val);
				}
			} else if (this.options[name]) {
				if (this.options[name].callback) {
					val = this.options[name].callback(value || '');
					val !== void 0 && (value = val);
				}
			}
		}

		// set the value
		if (argv[last] == void 0 || typeof argv[last] == 'boolean') {
			argv[last] = value;
		} else if (Array.isArray(argv[last])) {
			~argv[last].indexOf(value) || argv[last].push(value);
		} else if (argv[last] != value) {
			argv[last] = [ argv[last], value ];
		}
	}, this);
};

/**
 * Returns this context's flags and options as well as it's parents' flags and
 * options.
 * @returns {Object} Object with flags and options
 * @private
 */
Context.prototype.getFlagsOptions = function getFlagsOptions() {
	var result = {
		flags: {},
		options: {}
	};

	Object.keys(this.flags).forEach(function (name) {
		result.flags[name] = this.flags[name];
	}, this);

	Object.keys(this.options).forEach(function (name) {
		result.options[name] = this.options[name];
	}, this);

	if (this.parent) {
		var parent = this.parent.getFlagsOptions();
		Object.keys(parent.flags).forEach(function (name) {
			if (result.flags[name] === void 0) {
				result.flags[name] = parent.flags[name];
			}
		});
		Object.keys(parent.options).forEach(function (name) {
			if (result.options[name] === void 0) {
				result.options[name] = parent.options[name];
			}
		});
	}
	return result;
};

/**
 * Parses an array of command line arguments. This function is called multiple
 * times to determine certain info:
 *
 * 1. global context to find SDK version
 * 2. global context to find the command
 * 3. command context to determine if we are a subcommand
 * 4. subcommand context, if needed
 *
 * It's worth noting that unknown --key are treated as options. It's possible
 * that the parse will encounter a scenario like "ti --build-only build" where
 * it doesn't know what --build-only is, so that's why we allow an array of
 * commands being passed in.
 *
 * @param {Array} args - An array of all arguments minus the program name
 * @param {Array} [commands] - An array of command names
 * @param {Boolean} [skipCallbacks] - Flag to skip calling option callbacks
 * @returns {Object} The parsed arguments
 * @example
 * var argv = ctx.parse(process.argv);
 */
Context.prototype.parse = function parse(args, commands, skipCallbacks) {
	var argv = this.argv,
		i, j, len, arg, val, name, next, letters, broken,
		setArg = function (n, v) {
			this.setArg(n, v, skipCallbacks);
		}.bind(this);

	// Since argv is shared across multiple parse() calls, we need to reset it
	// each time we parse.
	argv._ = [];

	// check if there's actually any thing to parse
	if (!Array.isArray(args)) {
		return argv;
	}

	// if we have a parent, get it's flags and options and we'll mix them in
	if (this.parent) {
		// if the parent does NOT have a parent, then the parent is global and we
		// want to squash callbacks
		var squashCallbacks = !this.parent.parent,
			parentFlagsOptions = this.parent.getFlagsOptions();

		this.flag(parentFlagsOptions.flags, true, squashCallbacks);
		this.option(parentFlagsOptions.options, true, squashCallbacks);
	}

	//console.log('\nparsing: ' + args.join(' '));
	//console.log('flags: ' + Object.keys(this.flags).map(function (s){return s[!skipCallbacks && this.flags[s].callback ? 'green' : 'yellow'];}.bind(this)).join(', '));
	//console.log('options: ' + Object.keys(this.options).map(function (s){return s[!skipCallbacks && this.options[s].callback ? 'green' : 'yellow'];}.bind(this)).join(', '));
	//console.log('aliases: ' + Object.keys(this.aliases).map(function (s){return (s + ' => ' + this.aliases[s]).yellow;}.bind(this)).join(', ') + '\n');

	for (i = 0, len = args.length; i < len; i++) {
		arg = args[i];

		if (arg == '--') {
			// treat all options/flags after -- as regular arguments
			argv._.push.apply(argv._, args.slice(i + 1));
			break;
		} else if (arg.match(/^(?:--|—).+=/)) {
			// --option=value
			m = arg.match(/^(?:--|—)([^=]+)=([\s\S]*)/);
			setArg(m[1], m[2]);
		} else if (arg.match(/^(?:--|—)no-.+/)) {
			// --no-flag
			setArg(arg.match(/^(?:--|—)no-(.+)/)[1], false);
		} else if (arg.match(/^(?:--|—).+/)) {
			// --flag or --option
			name = arg.match(/^(?:--|—)(.+)/)[1];
			next = args[i + 1];
			if (!this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
				// --option value
				if (next != void 0 && !next.match(/^-/)) {
					// if we have an array of known commands and we haven't encountered
					// our first argument, then we don't know if this is truly an option
					// or flag, so we check if the value is a known command
					if (Array.isArray(commands) && this.argv._.length == 0 && commands.indexOf(next) != -1) {
						// treat this as a flag and the value as an argument/command
						setArg(name, true);
						argv._.push(next);
					} else {
						setArg(name, next);
					}
					i++;
				} else {
					// no next value, just set it to an empty string
					setArg(name, '');
				}
			} else if (/true|false/.test(next)) {
				// --flag true
				setArg(name, next == 'true');
				i++;
			} else {
				// --flag
				setArg(name, true);
			}
		} else if (arg.match(/^-[^-]+/)) {
			// -x or -xyz flags
			letters = arg.slice(1, -1).split('');
			broken = false;

			for (j = 0; j < letters.length; j++) {
				if (letters[j+1] && letters[j+1].match(/\W/)) {
					setArg(letters[j], arg.slice(j+2));
					broken = true;
					break;
				} else {
					setArg(letters[j], true);
				}
			}

			if (!broken) {
				name = arg.slice(-1)[0];
				next = args[i + 1];
				if (next && !next.match(/^-/) && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
					setArg(name, next);
					i++;
				} else if (next && /true|false/.test(next)) {
					setArg(name, next == 'true');
					i++;
				} else {
					setArg(name, true);
				}
			}
		} else {
			argv._.push(arg);
		}
	}

	//console.log('parsed args:');
	//dump(argv);

	// if this context has a name, then it's a command or subcommand and we'll
	// just trim the them from the args
	if (Array.isArray(commands) && this.name) {
		// we go to a max of 2: 1 command + 1 subcommand
		for (i = 0, j = 2, len = Math.min(argv._.length, j); i < len; i++) {
			if (commands.indexOf(argv._[i]) != -1) {
				argv._.splice(i--, 1);
				len = Math.min(argv._.length, --j);
				break;
			}
		}
	}

	// lastly we need to apply any name arguments
	if (Array.isArray(this.args)) {
		// if we're a subcommand, then we always reference the next arg
		j = argv._.length && this.name == argv._[0] ? 1 : 0;
		for (i = 0; i < this.args.length; i++) {
			arg = this.args[i];
			if (arg.name) {
				if (i + j < argv._.length) {
					val = skipCallbacks ? void 0 : arg.callback && arg.callback(argv._[i + j]);
					argv[arg.name] = val !== void 0 ? val : argv._[i + j];
				} else {
					// we force the arg to undefined just in case the arg has a
					// duplicate name of a global option as is the case with the
					// --version flag and the <version> argument in the SDK command
					argv[arg.name] = void 0;
				}
			}
		}
	}

	return argv;
};

/**
 * Displays the help screen for everthing encapsulated in this context
 * including subcommands, arguments, flags, options, and subcontexts.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {String} command - The command to show help for or null to list commands
 * @param {String} subcommand - The subcommand to show help for or null to list subcommands
 * @param {Function} finished - Callback when the command finishes
 */
Context.prototype.printHelp = function printHelp(logger, config, cli, command, subcommand, finished) {
	if (command) {
		// get the command context and print its help
		var commandContext = this.commands[command];
		parallel(this, [
			function (next) {
				if (commandContext.loaded) {
					next();
				} else {
					commandContext.load(logger, config, cli, next);
				}
			}
		], function (err) {
			var ctx = subcommand && commandContext.subcommands[subcommand] ? commandContext.subcommands[subcommand] : commandContext;
			ctx.printHelp(logger, config, cli, null, subcommand, function () {
				// print global flags and options
				this.printFlags(logger, config);
				this.printOptions(logger, config);
				finished();
			}.bind(this));
		});
	} else if (this.parent) {
		// now we're in the actual command or subcommand context
		this.printUsage(logger, config, cli);
		this.printDescription(logger, config);
		if (!subcommand || !this.subcommands[subcommand]) {
			this.printSubcommands(logger, config);
		}
		this.printPlatforms(logger, config, cli, subcommand);
		this.printArguments(logger, config);
		this.printFlags(logger, config);
		this.printOptions(logger, config);
		finished();
	} else {
		// no specific command, show list of commands
		parallel(this, Object.keys(this.commands).map(function (name) {
			var cmd = this.commands[name];
			return function (next) {
				if (cmd.loaded) {
					next(null, { name: name, desc: cmd.module.desc });
				} else {
					cmd.loadModuleOnly(function (err) {
						// note: it's possible that the command failed to load, but we only
						// care about the description
						next(null, { name: name, desc: cmd.module && cmd.module.desc || '' });
					}.bind(this));
				}
			};
		}.bind(this)), function (err, results) {
			// print global commands, flags, and options
			this.printUsage(logger, config, cli);
			this.printDescription(logger, config);
			this.printList(logger, config, __('Commands:'), results);
			this.printFlags(logger, config);
			this.printOptions(logger, config);
			finished();
		});
	}
};

/**
 * Prints lists of things for the help screen.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @private
 */
Context.prototype.printUsage = function printUsage(logger, config, cli, platform) {
	if (this.parent) {
		var width = config.get('cli.width', process.stdout.columns || 80),
			label = __('%s Usage', (platform && this.parent && this.parent.parent ? this.parent.title + ' ' + platform.conf.title : '')).trim() + ': ',
			padding = (new Array(label.length + 1)).join(' '),
			required = [ cli.argv.$ ],
			optional = [];

		function doFlags(conf) {
			if (conf && conf.flags && Object.keys(conf.flags).length) {
				Object.keys(conf.flags).sort().forEach(function (name) {
					var flag = conf.flags[name];
					if (!flag.hidden) {
						if (flag.required) {
							required.push(flag.negate ? '--no-' + name : '--' + name);
						} else {
							optional.push('[' + (flag.negate ? '--no-' : '--') + name + ']');
						}
					}
				}.bind(this));
			}
		}

		function doOptions(conf) {
			if (conf && conf.options && Object.keys(conf.options).length) {
				Object.keys(conf.options).sort().forEach(function (name) {
					var opt = conf.options[name],
						hint = opt.hint || __('value');
					if (!opt.hidden && (!platform || platform.name != name)) {
						if (opt.required) {
							required.push('--' + name + ' <' + hint + '>' + (opt.required ? '' : ']'));
						} else {
							optional.push('[--' + name + ' <' + hint + '>]');
						}
					}
				}.bind(this));
			}
		}

		function doArgs(conf) {
			if (conf && conf.args && Object.keys(conf.args).length) {
				conf.args.forEach(function (arg) {
					if (arg.name && !arg.hidden) {
						if (arg.required) {
							required.push('<' + arg.name + '>');
						} else {
							optional.push('[<' + arg.name + '>]');
						}
					}
				});
			}
		}

		if (this.parent.parent) {
			// show subcommand or platform
			this.parent.name && required.push(this.parent.name);

			if (platform) {
				required.push('--platform', platform.name);
				doFlags(platform.conf);
				//doFlags(platform.parent.conf);
				doOptions(platform.conf);
				//doOptions(platform.parent.conf);
				doArgs(platform.conf);
			} else {
				this.name && required.push(this.name);
				doFlags(this.conf);
				doFlags(this.parent.conf);
				doOptions(this.conf);
				doOptions(this.parent.conf);
				doArgs(this.conf);
			}
		} else {
			// show command usage
			this.name && required.push(this.name);

			// subcommands
			this.subcommands && Object.keys(this.subcommands).length && required.push('<subcommand>');

			doFlags(this.conf);
			doOptions(this.conf);
			doArgs(this.conf);
		}

		required = required.concat(optional);

		logger.log(label + string.wrap(required.join(' '), width - padding.length).split('\n').map(function (line) { return line.trim(); }).join('\n' + padding).cyan + '\n');
	} else {
		// global
		logger.log(__('Usage') + ': ' + (cli.argv.$ + ' <command> [options]').cyan + '\n');
	}
};

/**
 * Prints the description for the help screen.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @private
 */
Context.prototype.printDescription = function printDescription(logger, config) {
	var desc = this.extendedDesc || (this.desc && string.capitalize(this.desc) + (/[.!]$/.test(this.desc) ? '' : '.'));
	desc && logger.log(string.wrap(desc, config.get('cli.width', 100)) + '\n');
};

/**
 * Prints lists of things for the help screen.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {String} title - The title to display above the list of items
 * @param {Array} items - The list of items to display
 * @private
 */
Context.prototype.printList = function printList(logger, config, title, items) {
	if (items.length) {
		var maxlen = items.reduce(function (a, b) {
				return Math.max(a, b.name.length);
			}, 0),
			sortedItems = {},
			padding = (new Array(maxlen + 7)).join(' '),
			width = config.get('cli.width', process.stdout.columns || 80);

		logger.log(title);

		// sort the items
		items.forEach(function (i) {
			sortedItems[i.name] = i.desc || '';
		});
		Object.keys(sortedItems).sort().forEach(function (name) {
			logger.log('   %s   %s', appc.string.rpad(name, maxlen).cyan, sortedItems[name].split('\n\n').map(function (paragraph) {
				return string.wrap(paragraph, width - padding.length).split('\n').map(function (line) { return line.trim(); }).join('\n' + padding);
			}).join('\n\n'));
		});
		logger.log();
	}
};

/**
 * Displays all subcommands in this context.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @private
 */
Context.prototype.printSubcommands = function printSubcommands(logger, config) {
	if (this.conf && this.conf.subcommands && Object.keys(this.conf.subcommands).length) {
		this.printList(logger, config, __('%s Subcommands:', (this.parent && this.parent.parent? this.parent.title + ' ' : '') + (this.title || '')).trim(),
			Object.keys(this.conf.subcommands)
				.sort()
				.map(function (name) {
					return {
						name: name,
						desc: this.conf.subcommands[name].desc
					};
				}.bind(this))
		);
	}
};

/**
 * Displays all platforms and their options in this context.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {String} platform - The name of the platform
 * @private
 */
Context.prototype.printPlatforms = function printPlatforms(logger, config, cli, platform) {
	this.platforms && Object.keys(this.platforms).sort().forEach(function (name) {
		if (!platform || platform == name || (/^ios|ipad$/.test(platform) && name == 'iphone')) {
			var p = this.platforms[name];
			p.printUsage(logger, config, cli, p);
			p.printArguments(logger, config);
			p.printFlags(logger, config);
			p.printOptions(logger, config);
		}
	}, this);
};

/**
 * Displays all arguments in this context.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @private
 */
Context.prototype.printArguments = function printArguments(logger, config) {
	if (this.conf && this.conf.args && Object.keys(this.conf.args).length) {
		this.printList(
			logger,
			config,
			__(
				'%s Arguments:',
				(this.parent && this.parent.parent ? this.parent.title + ' ' : '') + (this.conf.title || this.title || '')
			).trim(),
			this.conf.args.filter(function (arg) {
				// make sure the argument has a name
				return !!arg.name && !arg.hidden;
			}).map(function (arg) {
				var d = arg.desc || '';
				if (arg.values) {
					d += ' ' + ('[' + arg.values.map(function (v) {
						return v == arg.default ? v.bold : v;
					}).join(', ') + ']').grey;
				}
				return {
					name: '<' + arg.name + '>',
					desc: d.trim()
				};
			})
		);
	}
};

/**
 * Displays all flags in this context.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @private
 */
Context.prototype.printFlags = function printFlags(logger, config) {
	if (this.conf && this.conf.flags && Object.keys(this.conf.flags).length) {
		this.printList(
			logger,
			config,
			__(
				'%s Flags:',
				(this.parent && this.parent.parent ? this.parent.title + ' ' : '') + (this.conf.title || this.title || '')
			).trim(),
			Object.keys(this.conf.flags).filter(function (name) {
				return !this.conf.flags[name].hidden;
			}.bind(this)).sort().map(function (name) {
				var flag = this.conf.flags[name];
				return {
					name: (flag.abbr ? '-' + flag.abbr + ', ' : '') + (flag.negate ? '--no-' + name : '--' + name) + (flag.alias ? '|--' + flag.alias + (flag.negate ? ', --no-' + flag.alt : '') : ''),
					desc: (flag.desc ? flag.desc + ' ' : '') + (flag.default != undefined && !flag.hideDefault ? ' ' + __('[default: %s]', flag.negate ? !flag.default : flag.default) : '').grey
				};
			}.bind(this))
		);
	}
};

/**
 * Displays all options in this context.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @private
 */
Context.prototype.printOptions = function printOptions(logger, config) {
	if (this.conf && this.conf.options && Object.keys(this.conf.options).length) {
		this.printList(
			logger,
			config,
			__(
				'%s Options:',
				(this.parent && this.parent.parent ? this.parent.title + ' ' : '') + (this.conf.title || this.title || '')
			).trim(),
			Object.keys(this.conf.options).filter(function (name) {
				return !this.conf.options[name].hidden;
			}.bind(this)).sort().map(function (name) {
				var opt = this.conf.options[name],
					n = (opt.abbr ? '-' + opt.abbr + ', ' : '') + '--' + name + (opt.alias ? ' | --' + opt.alias : '') + ' ' + (opt.hint ? '<' + opt.hint + '>' : __('<value>')),
					d = (opt.desc ? opt.desc + ' ' : '');

				if ((!config.cli.colors || !opt.values) && opt.default) {
					d += (' [' + __('default') + ': ' + opt.default + ']').grey;
				}

				if (opt.values) {
					d += (' [' + opt.values.map(function (v) {
						return v == opt.default ? v.bold : v;
					}).join(', ') + ']').grey;
				}

				return {
					name: n,
					desc: d
				};
			}.bind(this))
		);
	}
};
