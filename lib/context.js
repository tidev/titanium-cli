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
 */

/** @module lib/context */
module.exports = Context;

/**
 * Creates a context.
 * @class
 * @classdesc A container for flags, options, and commands.
 * @constructor
 * @param {Object} [params]
 */
function Context(params) {
	this.flags = {};
	this.options = {};
	this.args = [];
	this.commands = {};
	this.subcommands = {};
	this.platforms = {};
	this.aliases = {};
	this.name = params && params.name;
	this.cliVersion = params && params.cliVersion;
	this.parent = params && params.parent || null;

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
 * @param {String} name - The command name
 * @param {Object} conf - The command configuration
 * @returns {Context}
 * @example
 * ctx.command('config', '/usr/local/lib/node_modules/titanium/lib/commands/config.js');
 */
Context.prototype.command = function command(cmd) {
	var commandContext = this.commands[cmd.name] = new Context({ name: cmd.name, parent: this }),
		conf = cmd.conf;

	if (conf) {
		// set the flags and options
		conf.flags && commandContext.flag(conf.flags);
		conf.options && commandContext.option(conf.options);
		conf.args && (commandContext.args = conf.args);
		conf.subcommands && commandContext.subcommand(conf.subcommands);

		// for each platform, set their options and flags
		conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
			var platformConf = conf.platforms[platform],
				platformContext = this.platforms[platform] = new Context({ parent: this });
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
