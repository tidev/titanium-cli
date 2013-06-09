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
	this.commands = {};
	this.aliases = {};
	this.flags = {};
	this.argv = params && params.argv || {};
	this.cliVersion = params && params.cliVersion;

	Array.isArray(this.argv._) || (this.argv._ = []);

	params && params.flags && this.flag(params.flags);
	params && params.options && this.option(params.options);
}

function createFlagOption(type, name, params) {
	if (Object.prototype.toString.call(name) == '[object Object]') {
		Object.keys(name).forEach(function (k) {
			createFlagOption.call(this, type, k, name[k]);
		}, this);
	} else {
		params || (params = {});
		this[type][name] = params;

		if (params.alias) {
			// params.alias is either a string or an array<string>
			Array.isArray(params.alias) || (params.alias = [ params.alias ]);
			params.alias.forEach(function (alias) {
				Array.isArray(this.aliases[alias]) || (this.aliases[alias] = []);
				this.aliases[alias].push(name);
			}, this);
		}

		if (params.abbr) {
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
	var commandContext = this.commands[cmd.name] = new Context({ argv: this.argv }),
		conf = cmd.conf;

	if (conf) {
		// set the flags and options
		conf.flags && commandContext.flag(conf.flags);
		conf.options && commandContext.option(conf.options);

		// for each platform, set their options and flags
		conf.platforms && Object.keys(conf.platforms).forEach(function (platform) {
			var platformConf = conf.platforms[platform];

			platformConf.flags && commandContext.flag(platformConf.flags);
			platformConf.options && commandContext.option(platformConf.options);
		});
	}

	return commandContext;
};

/**
 * Sets an argument and it's value in the argv object.
 * @param {String} name - The name of the argument
 * @param {String} value - The argument's value
 * @private
 */
Context.prototype.setArg = function setArg(name, value, skipOptionCallbacks) {
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

		if (!skipOptionCallbacks) {
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
 * Parses an array of command line arguments. This function is called multiple
 * times to determine specific bits of information:
 *
 * 1. Determine the SDK version
 * 2. Detect what command is being run
 * 3. Fully parse the args now that we know all possible flags/options
 *
 * It's worth noting that unknown --key are treated as options. It's possible
 * that the parse will encounter a scenario like "ti --build-only build" where
 * it doesn't know what --build-only is, so that's why we allow an array of
 * commands being passed in.
 *
 * @param {Array} args - Array of all arguments minus the program name
 * @param {Array} [commands] - Array of all command names
 * @param {Boolean} [skipOptionCallbacks] - Flag to skip calling option callbacks
 * @returns {Context}
 * @example
 * ctx.parse(process.argv);
 */
Context.prototype.parse = function parse(args, commands, skipOptionCallbacks) {
	var argv = this.argv,
		i, len, arg, name, next, letters, broken,
		setArg = function (n, v) {
			this.setArg(n, v, skipOptionCallbacks);
		}.bind(this);

	// Since argv is shared across multiple parse() calls, we need to reset it
	// each time we parse.
	this.argv._ = [];

	Array.isArray(args) || (args = []);

	for (i = 0, len = args.length; i < len; i++) {
		arg = args[i];

		if (arg == '--') {
			// treat all options/flags after -- as regular arguments
			argv._.push.apply(argv._, args.slice(i + 1));
		} else if (arg.match(/^(?:--|—).+=/)) {
			// --option=value
			m = arg.match(/^(?:--|—)([^=]+)=([\s\S]*)/);
			this.setArg(m[1], m[2]);
		} else if (arg.match(/^(?:--|—)no-.+/)) {
			// --no-flag
			this.setArg(arg.match(/^(?:--|—)no-(.+)/)[1], false);
		} else if (arg.match(/^(?:--|—).+/)) {
			// --flag or --option
			name = arg.match(/^(?:--|—)(.+)/)[1];
			next = args[i + 1];
			if (next != void 0 && !next.match(/^-/) && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
				// --option value

				// if we have an array of known commands and we haven't encountered
				// our first argument, then we don't know if this is truly an option
				// or flag, so we check if the value is a known command
				if (Array.isArray(commands) && !this.argv._.length && commands.indexOf(next) != -1) {
					// treat this as a flag and the value as an argument/command
					this.setArg(name, true);
					argv._.push(next);
				} else {
					this.setArg(name, next);
				}
				i++;
			} else if (next == void 0 && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
				// do nothing
			} else if (/true|false/.test(next)) {
				// --flag true
				this.setArg(name, next == 'true');
				i++;
			} else {
				// --flag
				this.setArg(name, true);
			}
		} else if (arg.match(/^-[^-]+/)) {
			// -x or -xyz flags
			letters = arg.slice(1, -1).split('');
			broken = false;

			for (j = 0; j < letters.length; j++) {
				if (letters[j+1] && letters[j+1].match(/\W/)) {
					this.setArg(letters[j], arg.slice(j+2));
					broken = true;
					break;
				} else if (!this.aliases[letters[j]] || this.flags[this.aliases[letters[j]]]) {
					this.setArg(letters[j], true);
				}
			}

			if (!broken) {
				name = arg.slice(-1)[0];
				next = args[i + 1];
				if (next && !next.match(/^-/) && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
					this.setArg(name, next);
					i++;
				} else if (next == void 0 && !this.flags[name] && (this.aliases[name] ? !this.flags[this.aliases[name]] : true)) {
					// do nothing
				} else if (next && /true|false/.test(next)) {
					this.setArg(name, next == 'true');
					i++;
				} else {
					this.setArg(name, true);
				}
			}
		} else {
			argv._.push(arg);
		}
	}

	return this;
};
