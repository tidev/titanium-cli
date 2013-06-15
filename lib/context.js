/**
 * @overview
 * Defines a context which tracks flags and options, then parses command line
 * arguments based on that knowledge.
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
 */

/**
 * Defines a context which tracks flags and options, then parses command line
 * arguments based on that knowledge.
 * @module lib/context
 */

var semver = require('semver'),
	appc = require('node-appc'),
	afs = appc.fs,
	string = appc.string,
	parallel = appc.async.parallel,
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
	this.name = params && params.name;

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
	 * The module's original configuration object containing flags, options, etc.
	 * @type {Object}
	 */
	this.conf = params && params.conf;

	/**
	 * The title of this context to be display by the 'help' command; defaults to the context name.
	 * @type {String}
	 */
	this.title = params && params.title || this.name;

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

	params && params.flags && this.flag(params.flags);
	params && params.options && this.option(params.options);
}

function createFlagOption(type, name, params, dontAddIfExists) {
	if (Object.prototype.toString.call(name) == '[object Object]') {
		Object.keys(name).forEach(function (k) {
			createFlagOption.call(this, type, k, name[k], params);
		}, this);
	} else if (!dontAddIfExists || !this[type].hasOwnProperty(name)) {
		params || (params = {});
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

		if (type == 'flags') {
			this.setArg(name, !!params.default);
		} else if (params.hasOwnProperty('default')) {
			this.setArg(name, params.default);
		}
	}
	return this;
}

/**
 * Adds a flag to this context.
 * @param {String} name - The flag name
 * @param {Object} params - The flag parameters
 * @param {Boolean} dontAddIfExists - Only adds if it doesn't already exist
 * @returns {Context}
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
 * Adds a flag to this context.
 * @param {String} name - The option name
 * @param {Object} params - The option params
 * @param {Boolean} dontAddIfExists - Only adds if it doesn't already exist
 * @returns {Context}
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
 * Add a command to this context.
 * @param {Object} obj - The command decriptor containing the name, path, etc
 * @returns {Context} The command context
 */
Context.prototype.command = function command(obj) {
	obj.parent = this;

	var commandContext = this.commands[obj.name] = new Context(obj),
		conf = obj.conf;

	if (conf) {
		// set the flags and options
		conf.flags && commandContext.flag(conf.flags);
		conf.options && commandContext.option(conf.options);
		conf.args && (commandContext.args = conf.args);
		conf.subcommands && commandContext.subcommand(conf.subcommands);

		// for each platform, set their options and flags
		conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
			var platformConf = conf.platforms[platform],
				platformContext = this.platforms[platform] = new Context({ title: platform, parent: this });
			platformConf.flags && platformContext.flag(platformConf.flags);
			platformConf.options && platformContext.option(platformConf.options);
			platformConf.args && (platformContext.args = platformConf.args);
			platformConf.subcommands && platformContext.subcommand(platformConf.subcommands);
		}, this);
	}

	return commandContext;
};

/**
 * Assuming this context is a command context, loads the command module and evaluates
 * its configuration.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} callback - Callback for when the command and it's config is loaded
 */
Context.prototype.load = function loadCommand(logger, config, cli, callback) {
	if (this.loaded) {
		callback(this);
	} else if (!this.path) {
		logger.error(__('Unable to load "%s" command because command file path unknown', this.name) + '\n');
		process.exit(1);
	} else if (!afs.exists(this.path)) {
		logger.error(__('Unable to load "%s" command because command file path does not exist', this.name));
		logger.error(__('Command file: %s', this.path) + '\n');
		process.exit(1);
	} else {
		// load the command module
		try {
			this.module = require(this.path);
			this.conf = null;
			this.loaded = true;
		} catch (ex) {
			// if the command fails to load, then we simply ignore it exists
			callback(new AppcException(__('Failed to load command "%s"', this.name), ex));
			return;
		}

		// check if this command is compatible with this version of the CLI
		if (this.module.cliVersion && !semver.satisfies(cli.version, this.cliVersion)) {
			logger.error(__('Command "%s" incompatible with this version of the CLI', this.name));
			logger.error(__('Requires version %s, currently %s', this.module.cliVersion, cli.version) + '\n');
			process.exit(1);
		}

		// load the commands configuration
		var conf = (typeof this.module.config == 'function' && this.module.config(logger, config, cli)),
			processConf = function (conf) {
				this.conf = conf || {};
				this.requireAuth = !conf.noAuth;
				this.loaded = true;

				function addAuthOptions() {
					conf.options || (conf.options = {});
					conf.options.username && (conf.options.username = {
						default: config.user && config.user.email,
						desc: __('user to log in as, if not already logged in')
					});
					conf.options.password || (conf.options.password = {
						desc: __('the password to log in with')
					});
				}

				// check if the command requires authentication and if so, then add the
				// username and password options so that the parser handles things correctly
				this.requireAuth && addAuthOptions();

				// parse the args in the returned command context
				var argv = this.parse(cli.argv.$_, Object.keys(this.commands));

				// since the parse call above squashes the args array, we check the original if
				// it's the help command... generally they are the same anyways
				if (cli.argv.$command == 'help') {
					argv._ = cli.argv._;
				}

				// remove the command from the list of args
				argv._.shift();

				// check if this command has any subcommands, if so, parse the args again
				var subcommandContext;
				if (Object.keys(this.subcommands).length) {
					var subcmd = argv._.length && argv._[0] || conf.defaultSubcommand;
					if (subcommandContext = this.subcommands[subcmd]) {
						// if the subcommand requires authentication, add the username
						// and password options
						this.requireAuth = this.requireAuth || !conf.subcommands[subcmd].noAuth;
						this.requireAuth && addAuthOptions();
			
						// parse the args again to get any subcommand flags/options
						argv = subcommandContext.parse(cli.argv.$_, Object.keys(this.subcommands).concat(this.name));
						argv.$subcommand = subcmd;
					}
				}

				// mix our new argv into the existing argv
				mix(cli.argv, argv);

				if (conf) {
					// set the flags and options
					conf.flags && this.flag(conf.flags);
					conf.options && this.option(conf.options);
					conf.args && (this.args = conf.args);
					conf.subcommands && this.subcommand(conf.subcommands);
			
					// for each platform, set their options and flags
					conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
						var platformConf = conf.platforms[platform],
							platformContext = this.platforms[platform] = new Context({ title: platform, parent: this });
						platformConf.flags && platformContext.flag(platformConf.flags);
						platformConf.options && platformContext.option(platformConf.options);
						platformConf.args && (platformContext.args = platformConf.args);
						platformConf.subcommands && platformContext.subcommand(platformConf.subcommands);
					}, this);
				}

				callback(this);
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
 * Add a subcommand to this context.
 * @param {String} name - The subcommand name
 * @param {Object} conf - The subcommand configuration
 */
Context.prototype.subcommand = function subcommand(name, conf) {
	if (Object.prototype.toString.call(name) == '[object Object]') {
		Object.keys(name).forEach(function (k) {
			subcommand.call(this, k, name[k]);
		}, this);
	} else {
		var subcommandContext = this.subcommands[name] = new Context({ name: name, parent: this });
		if (conf) {
			conf.flags && subcommandContext.flag(conf.flags);
			conf.options && subcommandContext.option(conf.options);
			conf.args && (subcommandContext.args = conf.args);
			conf.desc && (subcommandContext.desc = conf.desc);
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
					val = this.options[name].callback(value);
					val !== void 0 && (value = val);
				}
			}
		}

		// set the value
		if (argv[last] == void 0 || typeof argv[last] == 'boolean') {
			argv[last] = value;
		} else if (Array.isArray(argv[last])) {
			~argv[last].indexOf(value) || argv[last].push(value);
		} else {
			argv[last] = value;
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
		var parentFlagsOptions = this.parent.getFlagsOptions();
		this.flag(parentFlagsOptions.flags, true);
		this.option(parentFlagsOptions.options, true);
	}

	for (i = 0, len = args.length; i < len; i++) {
		arg = args[i];

		if (arg == '--') {
			// treat all options/flags after -- as regular arguments
			argv._.push.apply(argv._, args.slice(i + 1));
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
			if (next != void 0 && !next.match(/^-/) && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
				// --option value

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
			} else if (next == void 0 && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
				// do nothing
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
				} else if (!this.aliases[letters[j]] || this.flags[this.aliases[letters[j]]]) {
					setArg(letters[j], true);
				}
			}

			if (!broken) {
				name = arg.slice(-1)[0];
				next = args[i + 1];
				if (next && !next.match(/^-/) && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
					setArg(name, next);
					i++;
				} else if (next == void 0 && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
					// do nothing
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
	// check if we even know what the command is
	if (command && !this.commands[command]) {
		logger.log(('[ERROR] ' + __('Unrecognized command "%s"', command)).red + '\n');
		string.suggest(command, Object.keys(this.commands), logger.log);
		command = subcommand = null;
	}

	// general usage
	logger.log(__('Usage') + ': ' + (cli.argv.$ + ' <command> [options]').cyan + '\n');

	if (command) {
		// we are getting help on a command
		command = this.commands[command];

		parallel(this, [
			function (next) {
				if (command.loaded) {
					next();
				} else {
					command.load(logger, config, cli, next);
				}
			}
		], function () {

// WHY THE FUCK AREN'T THESE SUBCOMMANDS SHOWING UP!??!?!?!?!

			command.printSubcommands(logger);
			finished();
		});
	} else {
		// no specific command, show list of commands
		parallel(this, Object.keys(this.commands).map(function (name) {
			var cmd = this.commands[name];
			return function (next) {
				if (cmd.loaded) {
					next(null, { name: name, desc: cmd.module.desc });
				} else {
					cmd.load(logger, config, cli, function () {
						next(null, { name: name, desc: cmd.module.desc });
					});
				}
			};
		}.bind(this)), function (err, results) {
			this.printList(logger, __('Commands:'), results);
			this.printFlags(logger);
			this.printOptions(logger, config);
			finished();
		});
	}
};

/**
 * Prints lists of things for the help screen.
 * @param {String} title - The title to display above the list of items
 * @param {Array} items - The list of items to display
 * @private
 */
Context.prototype.printList = function printList(logger, title, items) {
	if (items.length) {
		var maxlen = items.reduce(function (a, b) {
			return Math.max(a, b.name.length);
		}, 0);
		logger.log(title);

		// sort the items
		var sortedItems = {};
		items.forEach(function (i) {
			sortedItems[i.name] = i.desc || '';
		});

		Object.keys(sortedItems).sort().forEach(function (name) {
			if (sortedItems[name]) {
				logger.log('   %s   %s', appc.string.rpad(name, maxlen).cyan, sortedItems[name]);
			} else {
				logger.log('   %s', appc.string.rpad(name, maxlen).cyan);
			}
		});
		logger.log();
	}
};

/**
 * Displays all subcommands in this context.
 * @param {Object} logger - The logger instance
 * @private
 */
Context.prototype.printSubcommands = function printSubcommands(logger) {
	if (this.subcommands) {
		this.printList(logger, __('Subcommands:'),
			Object.keys(this.subcommands)
				.sort()
				.map(function (name) {
					return {
						name: name,
						desc: this.subcommands[name].desc
					};
				}.bind(this))
		);
	}
};

/**
 * Displays all flags in this context.
 * @param {Object} logger - The logger instance
 * @private
 */
Context.prototype.printFlags = function printFlags(logger) {
	this.printList(logger, __('%s Flags:', this.title || '').trim(), Object.keys(this.flags).sort().map(function (name) {
		var flag = this.flags[name];
		return {
			name: (flag.abbr ? '-' + flag.abbr + ', ' : '') + (flag.negate ? '--no-' + name : '--' + name) + (flag.alias ? '|--' + flag.alias + (flag.negate ? ', --no-' + flag.alt : '') : ''),
			desc: (flag.desc ? flag.desc + ' ' : '') + (flag.default != undefined ? ' ' + __('[default: %s]', flag.default) : '').grey
		};
	}.bind(this)));
};

/**
 * Displays all options in this context.
 * @param {Object} logger - The logger instance
 * @private
 */
Context.prototype.printOptions = function printOptions(logger, config) {
	this.printList(logger, __('%s Options:', this.title || '').trim(), Object.keys(this.options).sort().map(function (name) {
		var opt = this.options[name],
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
	}.bind(this)));
};
