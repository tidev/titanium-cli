import chalk from 'chalk';
import fs from 'fs-extra';
import { program, Argument, Command, Option } from 'commander';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unique } from './util/unique.js';
import { ticonfig } from './util/ticonfig.js';
import { initSDK } from './util/tisdk.js';
import { expand } from './util/expand.js';
import { arrayify } from './util/arrayify.js';
import * as version from './util/version.js';
import { Logger } from './util/logger.js';
import { capitalize } from './util/capitalize.js';
import wrapAnsi from 'wrap-ansi';
import { TiError } from './util/tierror.js';

const { cyan, gray } = chalk;

const commands = {
	config:  'get and set config options',
	info:    'display development environment information',
	module:  'displays installed Titanium modules',
	sdk:     'manages installed Titanium SDKs',
	setup:   'sets up the Titanium CLI'
};

const sdkCommands = {
	build:   'builds a project',
	clean:   'removes previous build directories',
	create:  'creates a new project',
	project: 'get and set tiapp.xml settings'
};

/**
 * The Titanium CLI v5 requires the `--sdk <version>` to equal the `<sdk-version>` in the
 * tiapp.xml. If they don't match, node-titanium-sdk's `ti.validateCorrectSDK()` will spawn a new
 * Titanium CLI process with the correct `--sdk`. Due to the design of the Titanium CLI, this
 * `GracefullyShutdown` error was thrown as an easy way to stop validating and skip executing the
 * command.
 *
 * Since this Titanium CLI shim will ALWAYS match the `<sdk-version>` in the tiapp.xml, this really
 * isn't used, but just in case, we'll define it and set it on the `CLI` instance.
 */
class GracefulShutdown extends Error {}

process.setMaxListeners(666);

export class CLI {
	static HOOK_PRIORITY_DEFAULT = 1000;

	/**
	 * Export of the graceful shutdown error.
	 * @type {Function}
	 */
	GracefulShutdown = GracefulShutdown;

	// init the command line arguments
	argv = {
		_: [], // parsed arguments (reset each time the context's parse() is called)
		$: 'titanium', // resolved node script path
		$_: process.argv.slice(), // original arguments
		$0: process.argv.slice(0, 2).join(' ') // node process and original node script path
	};

	/**
	 * The command module.
	 */
	command = null;

	config = ticonfig;

	env = {
		installPath: '',
		os: {
			name: process.platform === 'darwin' ? 'osx' : process.platform,
			sdkPaths: [],
			sdks: {}
		}
	};

	/**
	 * The hook system state.
	 * @type {Object}
	 */
	hooks = {
		erroredFilenames: [],
		errors: {},
		ids: {},
		incompatibleFilenames: [],
		loadedFilenames: [],
		post: {},
		pre: {},
		scannedPaths: {}
	};

	/**
	 * The new, improved slimmed down logger API.
	 * @type {Object}
	 */
	logger = new Logger();

	/**
	 * The time that executing the command starts. This value is set after validation and prompting
	 * has occurred.
	 * @type {Number}
	 */
	startTime = null;

	constructor() {
		const pkgJsonFile = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
		const { about, version } = fs.readJsonSync(pkgJsonFile);
		this.name = about.name;
		this.copyright = about.copyright;
		this.version = version;
		this.logger.setBanner({
			name: this.name,
			copyright: this.copyright,
			version: this.version
		});

		process.on('exit', () => {
			this.logger.trace(`Total run time ${process.uptime().toFixed(2)}s`);
		});
	}

	addHook(...args) {
		return this.on(...args);
	}

	applyArgv(cmd) {
		if (cmd.parent) {
			this.applyArgv(cmd.parent);
		}
		if (Array.isArray(cmd?.options)) {
			const argv = {};
			const cargv = cmd.opts();
			for (const o of cmd.options) {
				let name = o.name();
				if (o.negate) {
					name = name.replace(/^no-/, '');
				}
				argv[name] = cargv[o.attributeName()];
			}
			Object.assign(this.argv, argv);
		}
		this.argv._ = cmd.args;
	}

	applyConfig(cmdName, cmd, conf) {
		if (conf.skipBanner) {
			this.logger.skipBanner(true);
		}

		if (conf.flags) {
			for (const [name, meta] of Object.entries(conf.flags)) {
				this.logger.trace(`Adding "${cmdName}" flag: ${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`);
				cmd.option(`${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`, meta.desc);
			}
		}

		if (conf.options) {
			for (const [name, meta] of Object.entries(conf.options)) {
				const long = `--${name}`;
				const opt = new Option(`${meta.abbr ? `-${meta.abbr}, ` : ''}${long} [value]`, meta.desc);
				if (meta.hidden) {
					opt.hideHelp(true);
				}
				if (meta.default !== undefined) {
					opt.default(meta.default);
				}
				if (Array.isArray(meta.values)) {
					opt.choices(meta.values);
				}
				this.logger.trace(`Adding "${cmdName}" option: ${meta.abbr ? `-${meta.abbr}, ` : ''}${long} [value]`);
				cmd.addOption(opt);
				if (typeof meta.callback === 'function') {
					cmd.hook('preAction', (_, actionCommand) => {
						const opt = actionCommand.options.find(o => o.long === long);
						if (opt) {
							const value = actionCommand[opt.attributeName()] || opt.defaultValue;
							meta.callback(value);
						}
					});
				}
			}
		}

		if (Array.isArray(conf.args)) {
			for (const meta of conf.args) {
				const arg = new Argument(`[${meta.name}]`, meta.desc);
				if (meta.default !== undefined) {
					arg.default(meta.default);
				}
				if (Array.isArray(meta.values)) {
					arg.choices(meta.values);
				}
				this.logger.trace(`Adding "${cmdName}" arg: [${meta.name}]`);
				cmd.addArgument(arg);
			}
		}

		if (conf.subcommands) {
			for (const [name, subconf] of Object.entries(conf.subcommands)) {
				this.logger.trace(`Adding subcommand "${name}"${conf.defaultSubcommand === name ? ' (default)' : ''} to "${cmdName}"`);
				const subcmd = new Command(name);
				subcmd
					.addHelpText('beforeAll', (ctx) => {
						this.logger.bannerEnabled(true);
						this.logger.skipBanner(false);
						this.logger.banner();
					})
					.configureHelp({
						helpWidth: ticonfig.get('cli.width', 80),
						showGlobalOptions: true,
						sortSubcommands: true
					})
					.configureOutput({
						outputError(msg) {
							throw new TiError(msg.replace(/^error:\s*/, ''));
						}
					});
				this.applyConfig(name, subcmd, subconf);
				subcmd.action((...args) => this.executeCommand(args));
				cmd.addCommand(subcmd, {
					isDefault: conf.defaultSubcommand === name
				});
			}
		}
	}

	/**
	 * Defines a hook function that will emit an event before and after the hooked function is
	 * invoked.
	 *
	 * @param {String} name - The name of hook event.
	 * @param {Object} [ctx] - The `this` context to bind the callbacks to.
	 * @param {Function} [fn] - The function being hooked.
	 * @returns {Function}
	 * @access public
	 */
	createHook(name, ctx, fn) {
		let dataPayload = {};

		if (typeof ctx === 'function') {
			fn = ctx;
			ctx = null;
		} else if (ctx && typeof ctx === 'object' && !fn) {
			dataPayload = ctx;
			ctx = null;
		}

		return (...args) => {
			let data = Object.assign({}, dataPayload, {
				type: name,
				args,
				fn: fn,
				ctx: ctx
			});
			const callback = data.args.pop();
			const pres = this.hooks.pre[name] || [];
			const posts = this.hooks.post[name] || [];

			(async () => {
				// call all pre filters
				await pres
					// eslint-disable-next-line promise/no-nesting
					.reduce((promise, pre) => promise.then(async () => {
						if (pre.length >= 2) {
							await new Promise((resolve, reject) => {
								pre.call(ctx, data, (err, newData) => {
									if (err) {
										return reject(err);
									} else if (newData) {
										data = newData;
									}
									resolve();
								});
							});
						} else {
							await pre.call(ctx, data);
						}
					}), Promise.resolve());

				if (data.fn) {
					data.result = await new Promise(resolve => {
						// call the function
						data.args.push((...args) => resolve(args));
						data.fn.apply(data.ctx, data.args);
					});
				}

				// call all post filters
				await posts
					// eslint-disable-next-line promise/no-nesting
					.reduce((promise, post) => promise.then(async () => {
						if (post.length >= 2) {
							await new Promise((resolve, reject) => {
								post.call(ctx, data, (err, newData) => {
									if (err) {
										return reject(err);
									}
									if (newData && typeof newData === 'object' && newData.type) {
										data = newData;
									}
									resolve();
								});
							});
						} else {
							await post.call(ctx, data);
						}
					}), Promise.resolve());

				if (typeof callback === 'function') {
					callback.apply(data, data.result);
				}
			})().catch(err => {
				// this is the primary error handler
				if (typeof callback === 'function') {
					callback(err);
				} else {
					this.logger.error('Hook completion callback threw unhandled error:');
					this.logger.error(err.stack);
					process.exit(1);
				}
			});
		};
	}

	/**
	 * Emits an event along with a data payload.
	 *
	 * @param {String|Array.<String>} name - One or more events to emit.
	 * @param {Object} [data] - An optional data payload.
	 * @param {Function} [callback] A function to call once the emitting has finished. If no
	 * callback is specified, this function will return a promise instead.
	 * @returns {CLI|Promise}
	 * @access public
	 */
	emit(name, data, callback) {
		if (typeof data === 'function') {
			callback = data;
			data = null;
		}

		// create each hook and immediately fire them
		const promise = unique(arrayify(name, true))
			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
				const hook = this.createHook(name, data);
				hook((err, result) => {
					err ? reject(err) : resolve(result);
				});
			})), Promise.resolve(this));

		if (typeof callback !== 'function') {
			return promise;
		}

		promise
			.then(result => callback(null, result))
			.catch(callback);

		return this;
	}

	/**
	 * Executes the command's `run()` method.
	 *
	 * @param {Command} cmd - The commander command instance.
	 * @returns {Promise}
	 * @access private
	 */
	async executeCommand(args) {
		const cmd = args.pop();
		this.applyArgv(cmd);

		this.logger.banner();

		await this.validate();

		await this.emit('cli:pre-execute', { cli: this, command: this.command });
		this.startTime = Date.now();

		const { run } = this.command.module;
		if (typeof run !== 'function') {
			return;
		}

		this.logger.trace(`Executing command: ${this.command.name()}`);
		await new Promise((resolve, reject) => {
			try {
				const result = run(this.logger, this.config, this, async (err, result) => {
					// we need to wrap the post-execute emit in a try/catch so that any exceptions
					// it throws aren't confused with command errors
					try {
						await this.emit('cli:post-execute', { cli: this, command: this.command, err, result });
					} catch (ex) {
						return reject(ex);
					}

					if (err) {
						return reject(err);
					}

					resolve();
				});
				if (result instanceof Promise) {
					result.then(resolve, reject);
				}
			} catch (e) {
				reject(e);
			}
		});
	}

	fireHook(...args) {
		return this.emit(...args);
	}

	/**
	 * The main pipeline for running the CLI.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async go() {
		this.program = program
			.name('titanium')
			.addHelpText('beforeAll', (ctx) => {
				this.logger.bannerEnabled(true);
				this.logger.skipBanner(false);
				this.logger.banner();
			})
			.configureHelp({
				helpWidth: ticonfig.get('cli.width', 80),
				showGlobalOptions: true,
				sortSubcommands: true
			})
			.configureOutput({
				outputError(msg) {
					throw new TiError(msg.replace(/^error:\s*/, ''));
				}
			})
			.option('--no-banner', 'disable Titanium version banner')
			.option('--no-color', 'disable colors')
			.addOption(
				new Option('--no-colors')
					.hideHelp()
			)
			.option('--no-progress-bars', 'disable progress bars')
			.option('--no-prompt', 'disable interactive prompting')
			.option('--timestamp', 'displays a timestamp in front of log lines')
			.option('--config [json]', 'serialized JSON string to mix into the CLI config')
			.option('--config-file [file]', 'path to CLI config file')
			.addOption(
				new Option('-l, --log-level [level]', 'minimum logging level')
					.choices(this.logger.getLevels())
					.default('info')
			)
			.option('-d, --project-dir <path>', 'the directory containing the project', '.')
			.option('-q, --quiet', 'suppress all output')
			.option('-v, --version', 'displays the current version')
			.option('-s, --sdk [version]', 'Titanium SDK version to use (default: "latest")')
			.on('option:config', cfg => {
				try {
					config.apply(eval(`(${cfg})`));
					if (!config.cli?.colors) {
						chalk.level = 0;
					}
				} catch (e) {
					throw new Error(`Failed to parse --config: ${e.message}`);
				}
			})
			.on('option:config-file', file => config.load(file))
			.on('option:log-level', level => this.logger.setLevel(level))
			.on('option:no-banner', () => this.logger.bannerEnabled(false))
			.on('option:no-color', () => chalk.level = 0)
			.on('option:no-colors', () => chalk.level = 0)
			.on('option:quiet', () => this.logger.silence())
			.on('option:timestamp', () => this.logger.timestampEnabled(true))
			.on('option:version', () => {
				this.logger.log(this.version);
				process.exit(0);
			})
			.hook('preSubcommand', (_, cmd) => this.loadCommand(cmd))
			.action(() => program.help());

		const allCommands = [
			...Object.entries(commands),
			...Object.entries(sdkCommands)
		];
		for (const [name, summary] of allCommands) {
			program
				.command(name)
				.summary(summary)
				.action((...args) => this.executeCommand(args));
		}

		await this.emit('cli:go', { cli: this });
		await program.parseAsync();
	}

	/**
	 * Loads the SDK, inits SDK hooks, and loads the command module.
	 *
	 * @param {Command} cmd - The commander command instance.
	 * @returns {Promise}
	 */
	async loadCommand(cmd) {
		const cmdName = cmd.name();
		let desc = commands[cmdName] || sdkCommands[cmdName];
		if (!desc) {
			this.logger.warn(`Unknown command "${cmdName}"`);
			return;
		}

		this.command = cmd;
		this.applyArgv(cmd);
		const cwd = expand(this.argv['project-dir']);

		// load hooks
		const hooks = ticonfig.paths?.hooks;
		if (hooks) {
			const paths = arrayify(hooks, true);
			await Promise.all(paths.map(p => this.scanHooks(p)));
		}

		// load the sdk and its hooks
		const {
			installPath,
			sdk,
			sdkPaths,
			sdks
		} = await initSDK(cwd, this.argv.sdk, this.config, this.logger);
		this.env.installPath = installPath;
		this.env.os.sdkPaths = sdkPaths;
		this.env.sdks = sdks;
		this.sdk = sdk;

		// if we have an sdk and we're running a sdk command, then scan the sdk for hooks
		if (this.sdk && sdkCommands[cmdName]) {
			await this.scanHooks(expand(this.sdk.path, 'cli', 'hooks'));
		}

		// render the banner
		this.logger.setBanner({
			name: this.name,
			copyright: this.copyright,
			version: this.version,
			sdkVersion: this.sdk?.name
		});

		// display any bad CLI plugins
		if (this.hooks.incompatibleFilenames.length) {
			// display all hooks for debugging
			this.logger.warn(`Incompatible plugin hooks:\n${
				this.hooks.incompatibleFilenames.map(file => `  ${file}`).join('\n')
			}\n`);
		}
		if (Object.keys(this.hooks.errors).length) {
			this.logger.warn(`Bad plugin hooks that failed to load:\n${
				Object.values(this.hooks.errors)
					.map(e => (e.stack || e.toString())
						.trim()
						.split('\n')
						.map(line => `  ${line}`)
						.join('\n')
					)
					.join('\n')
			}\n`);
		}
		if (Object.keys(this.hooks.ids).some(id => this.hooks.ids[id].length > 1)) {
			this.logger.warn(`Conflicting plugins that were not loaded:\n${
				Object.entries(this.hooks.ids)
					.map(([id, conflicting]) => `  Hook ID: ${cyan(id)}\n${
						conflicting.map((c, i) => {
							return i === 0
								? `    Loaded: ${c.file} ${c.version ? `(version ${version})` : ''}`
								: `    Didn't load: ${c.file} ${c.version ? `(version ${version})` : ''}`
						}).join('\n')
					}`)
					.join('\n')
			}\n`);
		}

		const commandFile = sdkCommands[cmdName]
			? pathToFileURL(join(this.sdk.path, `cli/commands/${cmdName}.js`))
			: join(import.meta.url, `../commands/${cmdName}.js`);

		// load the command
		this.logger.trace(`Importing: ${commandFile}`);
		cmd.module = (await import(commandFile)) || {};

		if (typeof this.command.module.extendedDesc === 'string') {
			desc = this.command.module.extendedDesc;
		} else if (desc) {
			desc = capitalize(desc) + (/[.!]$/.test(desc) ? '' : '.');
		}
		desc = desc.replace(/__(.+?)__/g, (s, m) => { return cyan(m); });
		cmd.description(wrapAnsi(desc, ticonfig.get('cli.width', 80), { hard: true, trim: false }));

		// load the command's config
		if (typeof this.command.module.config === 'function') {
			const fn = await this.command.module.config(this.logger, this.config, this);
			const conf = typeof fn === 'function'
				? await new Promise(resolve => fn(resolve))
				: fn;

			this.applyConfig(cmdName, cmd, conf);
		}

		await this.emit('cli:command-loaded', { cli: this, command: this.command });
	}

	/**
	 * Registers an event callback.
	 *
	 * @param {String} name - The name of the event.
	 * @param {Function} callback - The listener to register.
	 * @returns {CLI}
	 * @access public
	 */
	on(name, callback) {
		let priority = CLI.HOOK_PRIORITY_DEFAULT;
		let i;

		if (typeof callback === 'function') {
			callback = { post: callback };
		} else if (callback && typeof callback === 'object') {
			priority = parseInt(callback.priority) || priority;
		}

		if (callback.pre) {
			const h = this.hooks.pre[name] || (this.hooks.pre[name] = []);
			callback.pre.priority = priority;
			// eslint-disable-next-line no-empty
			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback.pre);
		}

		if (callback.post) {
			const h = this.hooks.post[name] || (this.hooks.post[name] = []);
			callback.post.priority = priority;
			// eslint-disable-next-line no-empty
			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback.post);
		}

		return this;
	}

	/**
	 * Searches the specified directory for Titanium CLI plugin files.
	 *
	 * @param {String} dir - The directory to scan.
	 * @access public
	 */
	async scanHooks(dir) {
		dir = expand(dir);
		this.logger.trace(`Scanning hooks: ${dir}`);

		if (this.hooks.scannedPaths[dir]) {
			return;
		}

		try {
			const jsfile = /\.js$/;
			const ignore = /^[._]/;
			const files = fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map(n => join(dir, n)) : [ dir ];
			let appc;

			for (const file of files) {
				try {
					if (fs.statSync(file).isFile() && jsfile.test(file) && !ignore.test(basename(dirname(file)))) {
						const startTime = Date.now();
						const mod = await import(pathToFileURL(file));
						if (mod.id) {
							if (!Array.isArray(this.hooks.ids[mod.id])) {
								this.hooks.ids[mod.id] = [];
							}
							this.hooks.ids[mod.id].push({
								file: file,
								version: mod.version || null
							});

							// don't load duplicate ids
							if (this.hooks.ids[mod.id].length > 1) {
								continue;
							}
						}

						if (this.sdk && (!this.version || !mod.cliVersion || version.satisfies(this.version, mod.cliVersion))) {
							if (!appc) {
								const nodeAppc = pathToFileURL(join(this.sdk.path, 'node_modules', 'node-appc', 'index.js'));
								this.logger.trace(`Importing: ${join(this.sdk.path, 'node_modules', 'node-appc', 'index.js')}`);
								appc = (await import(nodeAppc)).default;
							}
							mod.init && mod.init(this.logger, this.config, this, appc);
							this.hooks.loadedFilenames.push(file);
							this.logger.trace(`Loaded CLI hook: ${file} (${Date.now() - startTime} ms)`);
						} else {
							this.hooks.incompatibleFilenames.push(file);
						}
					}
				} catch (e) {
					this.hooks.erroredFilenames.push(file);
					e.stack = e.stack.replace(/\n+/, '\n');
					this.hooks.errors[file] = e;
				}
			}
		} catch (err) {
			if (err.code !== 'ENOENT') {
				this.logger.trace(`Error scanning hooks: ${dir}`);
				this.logger.trace(err.stack);
			}
		}
	}

	/**
	 * Validates the arguments. First it checks against the built-in naive validation such as
	 * required or against a list of values. Next it calls each option's validator. After that it
	 * calls the command's validator. Lastly it calls each option's value callback.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async validate() {
		await this.emit('cli:pre-validate', { cli: this, command: this.command });

		// step 1: build a list of all options so we can sort them
		// const options = [];
		// for (const ctx of [ this.command, this.command?.platform ]) {
		// 	if (ctx?.conf.options) {
		// 		for (const [ name, opt ] of Object.entries(ctx.conf.options)) {
		// 			options.push({
		// 				// this is a sacrificial wrapper that we can throw away after firing and it
		// 				// handles the boilerplate of checking the callback and result
		// 				callback(value) {
		// 					let result;
		// 					if (typeof opt.callback === 'function') {
		// 						// technically `opt.callback()` can throw a `GracefulShutdown` error
		// 						// for both `build` and `clean` commands during the `project-dir`
		// 						// callback if the `<sdk-version>` in the tiapp.xml is not the same
		// 						// version loaded by the Titanium SDK, but luckily that will never :)
		// 						result = opt.callback(value || '');
		// 					}
		// 					delete this.callback;
		// 					return result !== undefined ? result : value;
		// 				},
		// 				name,
		// 				orig: opt,
		// 				values: !opt.skipValueCheck && Array.isArray(opt.values) ? opt.values : null
		// 			});
		// 		}
		// 	}
		// }

		// options.sort((a, b) => {
		// 	if (a.orig.order && b.orig.order) {
		// 		return a.orig.order - b.orig.order;
		// 	}
		// 	return a.orig.order ? -1 : b.orig.order ? 1 : 0;
		// });

		// const createQuestion = async (opt, error) => {
		// 	if (opt.values) {
		// 		return {
		// 			choices: opt.values.map(value => ({ value })),
		// 			error,
		// 			message: `Please select a valid ${opt.name}`,
		// 			name:    opt.name,
		// 			type:    'select'
		// 		};
		// 	}

		// 	if (typeof opt.orig?.prompt === 'function') {
		// 		return await new Promise(opt.orig.prompt);
		// 	}

		// 	return {
		// 		error,
		// 		message: `Please enter a valid ${opt.name}`,
		// 		name:    opt.name,
		// 		type:    'text'
		// 	};
		// };

		// step 2: determine invalid or missing options
		// for (const opt of options) {
		// 	const { name, orig, values } = opt;
		// 	const value = this.argv[name];

		// 	if (value === undefined) {
		// 		// we need to check if the option is required
		// 		// sometimes required options such as `--device-id` allow an undefined value in the
		// 		// case when the value is derived by the config or is autoselected
		// 		if (orig.required && (typeof orig.verifyIfRequired !== 'function' || await new Promise(orig.verifyIfRequired))) {
		// 			const question = await createQuestion(opt, `Missing required option "${name}"`);
		// 			this.argv[name] = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
		// 		}
		// 	} else if (values && !values.includes(value)) {
		// 		const question = await createQuestion(opt, `Invalid ${name} value "${value}"`);
		// 		this.argv[name] = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
		// 	} else if (typeof orig.validate === 'function') {
		// 		this.argv[name] = await new Promise((resolve, reject) => {
		// 			orig.validate(value, async (err, adjustedValue) => {
		// 				if (err) {
		// 					this.logger.trace(`Validation failed for option ${name}: ${err.toString()}`);
		// 					try {
		// 						const question = await createQuestion(opt, `Invalid ${name} value "${value}"`);
		// 						adjustedValue = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
		// 					} catch (e) {
		// 						return reject(e);
		// 					}
		// 				}
		// 				resolve(opt.callback(adjustedValue));
		// 			});
		// 		});
		// 	} else {
		// 		this.argv[name] = opt.callback(value);
		// 	}
		// }

		// note that we don't care about missing arguments because `build` and `clean` commands
		// don't have any arguments!

		// step 3: run the command's validate() function, if exists

		const { validate } = this.command.module;
		if (validate && typeof validate === 'function') {
			const fn = validate(this.logger, this.config, this);

			// fn should always be a function for `build` and `clean` commands
			if (typeof fn === 'function') {
				await new Promise(resolve => fn(resolve));
			}
		}

		await this.emit('cli:post-validate', { cli: this, command: this.command });

		// step 4: fire all option callbacks for any options we missed above
		// for (const opt of options) {
		// 	if (typeof opt.callback === 'function') {
		// 		const val = opt.callback(this.argv[opt.name] || '');
		// 		if (val !== undefined) {
		// 			this.argv[opt.name] = val;
		// 		}
		// 	}
		// }
	}
}

/*
// 	util = require('util'),
// 	fields = require('fields'),
// 	appc = require('node-appc'),
// 	Context = require('./context'),
// 	afs = appc.fs,

// // set global fields configuration
// fields.setup({
// 	formatters: {
// 		error: function (err) {
// 			if (err instanceof Error) {
// 				return ('[ERROR] ' + err.message).red + '\n';
// 			}
// 			err = '' + err;
// 			return '\n' + (/^(\[ERROR\])/i.test(err) ? err : '[ERROR] ' + err.replace(/^Error:/i, '').trim()).red;
// 		}
// 	}
// });

/**
 * Validates the arguments.
 * @param {Function} next - Callback when the function finishes
 * @emits CLI#cli:pre-validate
 * @emits CLI#cli:post-validate
 * @private
 * /
CLI.prototype.validate = function validate(next) {
	this.emit('cli:pre-validate', { cli: this, command: this.command }, function () {
		var argv = this.argv;

		// validation master plan
		// 1) determine all invalid or missing options
		// 2) determine all missing arguments
		// 3) run the command's validate() function, if exists
		// 4) fire all option callbacks (note that callbacks on global options are not fired)

		series(this, [
			function handleMissingAndInvalidOptions(nextValidationTask) {
				var options = {};

				// mix the command and platform specific options together
				[ this.command, this.command.platform ].forEach(function (ctx) {
					ctx && ctx.conf && ctx.conf.options && mix(options, ctx.conf.options);
				});

				if (!options || !Object.keys(options).length) {
					// no missing options
					return nextValidationTask();
				}

				var _t = this,
					done = false,
					prompting = argv.prompt,
					globalOptions = Object.keys(this.globalContext.options),
					orderedOptionNames = Object.keys(options).sort(function (a, b) {
						if (options[a].order && options[b].order) {
							return options[a].order < options[b].order ? -1 : options[a].order > options[b].order ? 1 : 0;
						} else if (options[a].order) {
							return -1;
						} else if (options[b].order) {
							return 1;
						}
						return 0;
					});

				function wireupPrePrompt(field, opt, name) {
					if (field === undefined) {
						if (!opt._err) {
							_t.logger.error(__('Invalid "%s" value "%s"', (opt.label || '--' + name), argv[name]) + '\n');
						} else if (opt._err instanceof Error) {
							_t.logger.error(opt._err.message + '\n');
						} else if (typeof opt._err === 'string') {
							_t.logger.error(opt._err + '\n');
						}
						return;
					}

					field.once('pre-prompt', function () {
						if (!opt._err) {
							_t.logger.error(__('Invalid "%s" value "%s"', (opt.label || '--' + name), argv[name]) + '\n');
						} else if (opt._err instanceof Error) {
							_t.logger.error(opt._err.message + '\n');
						} else if (typeof opt._err === 'string') {
							_t.logger.error(opt._err + '\n');
						}
					});
					return field;
				}

				// we use an async while loop that constantly checks for invalid and missing
				// options per loop. this isn't the most efficient thing in the world, but we
				// need to do this because prompted options may introduce new required options.
				async.whilst(
					function (cb) {
						return cb(null, !done);
					},
					function (callback) {
						// this is the main body of the while loop where we determine all invalid
						// and missing options

						var invalid = {},
							invalidCount = 0,
							missing = {},
							missingCount = 0;

						// we asynchronously test each option in order and in series
						appc.async.series(this, orderedOptionNames.map(function (name) {
							return function (cb) {
								if (prompting && (missingCount || invalidCount)) {
									return cb();
								}
								if (options[name].validated) {
									return cb();
								}

								// check missing required options and invalid options
								var opt = options[name],
									obj = mix(opt, { name: name }),
									p = globalOptions.indexOf(name);

								// if this command or platform option is the same name as a global option,
								// then we must remove the name from the list of global options so that
								// the real options aren't blacklisted
								if (p !== -1) {
									globalOptions.splice(p, 1);
								}

								if (argv[name] === undefined) {
									// check if the option is required
									if (opt.required || (opt.conf && opt.conf.required)) {
										// ok, we have a required option, but it's possible that this option
										// replaces some legacy option in which case we need to check if the
										// legacy options were defined

										if (typeof opt.verifyIfRequired === 'function') {
											opt.verifyIfRequired(function (stillRequired) {
												if (stillRequired) {
													missing[name] = obj;
													missingCount++;
												}
												cb();
											});
											return;
										}
										missing[name] = obj;
										missingCount++;
									}
								} else if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) === -1) {
									invalid[name] = obj;
									invalidCount++;
								} else if (!opt.validated && typeof opt.validate === 'function') {
									try {
										opt.validate(argv[name], function (err, value) {
											if (err) {
												obj._err = err;
												invalid[name] = obj;
												invalidCount++;
											} else {
												argv[name] = value;
												opt.validated = true;
												if (opt.callback) {
													var val = opt.callback(argv[name] || '');
													val !== undefined && (argv[name] = val);
													delete opt.callback;
												}
											}
											cb();
										});
									} catch (ex) {
										if (ex instanceof GracefulShutdown) {
											// simply return and cb() is never called which effectively cause the cli
											// to gracefully exit
											return;
										}
										throw ex;
									}
									return;
								} else if (opt.callback) {
									opt.validated = true;
									var val = opt.callback(argv[name] || '');
									val !== undefined && (argv[name] = val);
									delete opt.callback;
								}

								cb();
							};
						}), function () {
							// at this point, we know if we have any invalid or missing options

							if (!invalidCount && !missingCount) {
								done = true;
								return callback();
							}

							// we have an invalid option or missing option

							if (!prompting) {
								// if we're not prompting, output the invalid/missing options and exit
								this.logger.banner();

								if (Object.keys(invalid).length) {
									Object.keys(invalid).forEach(function (name) {
										var opt = invalid[name],
											msg = __('Invalid "%s" value "%s"', (opt.label || '--' + name), argv[opt.name]);

										if (typeof opt.helpNoPrompt === 'function') {
											opt.helpNoPrompt(this.logger, msg);
										} else {
											this.logger.error(msg + '\n');
											if (opt.values) {
												this.logger.log(__('Accepted values:'));
												opt.values.forEach(function (v) {
													this.logger.log('   ' + v.cyan);
												}, this);
												this.logger.log();
											}
										}
									}, this);
								}

								if (Object.keys(missing).length) {
									// if prompting is disabled, then we just print all the problems we encountered
									Object.keys(missing).forEach(function (name) {
										var msg = __('Missing required option: %s', '--' + name + ' <' + (missing[name].hint || __('value')) + '>');
										if (typeof missing[name].helpNoPrompt === 'function') {
											missing[name].helpNoPrompt(this.logger, msg);
										} else {
											this.logger.error(msg + '\n');
										}
									}, this);
								}

								this.logger.log(__('For help, run: %s', (this.argv.$ + ' help ' + this.argv.$command).cyan) + '\n');
								process.exit(1);
							}

							// we are prompting, so find the first invalid or missing option
							var opt;
							if (invalidCount) {
								var name = Object.keys(invalid).shift();
								opt = invalid[name];
								if (opt.prompt) {
									// option has a prompt function that will return us a field
									var fn = opt.prompt;
									opt.prompt = function (callback) {
										fn(function (field) {
											callback(wireupPrePrompt(field, opt, name));
										});
									};
								} else {
									// option doesn't have a prompt, so let's make a generic one
									opt.prompt = function (callback) {
										var field;

										// if the option has values, then display a pretty list
										if (opt.values) {
											field = fields.select({
												title: __('Please select a valid %s value:', name.cyan),
												promptLabel: __('Select a value by number or name'),
												margin: '',
												numbered: true,
												relistOnError: true,
												complete: true,
												suggest: true,
												options: opt.values
											});
										} else {
											var pr = opt.prompt || {};
											field = fields.text({
												promptLabel: __('Please enter a valid %s', name.cyan),
												password: !!opt.password,
												validate: opt.validate || function (value) {
													if (pr.validator) {
														try {
															pr.validator(value);
														} catch (ex) {
															if (ex.type === 'AppcException') {
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
										}

										callback(wireupPrePrompt(field, opt, name));
									};
								}
							} else {
								// must be a missing option
								opt = missing[Object.keys(missing).shift()];
							}

							// do the prompting
							this.prompt(opt, function (errs) {
								if (errs) {
									argv[opt.name] = undefined;
								} else {
									opt._err = null;
									opt.validated = true;
									if (opt.callback) {
										try {
											var val = opt.callback(argv[opt.name] || '');
											val !== undefined && (argv[opt.name] = val);
											delete opt.callback;
										} catch (ex) {
											if (ex instanceof GracefulShutdown) {
												// exit the validation and do NOT run the command
												_t.command.module.run = function () {};
												return next();
											}
											throw ex;
										}
									}
								}
								callback();
							});
						});
					}.bind(this),

					// while loop is done, go to the next validation task
					nextValidationTask
				);
			},

			function detectMissingArguments(nextValidationTask) {
				var args = (this.command.conf || {}).args,
					missingArgs = [];

				// TODO: update this to an async while loop similar to how options are handled above

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

				// if prompting, prompt for missing arguments
				if (!missingArgs.length) {
					return nextValidationTask();
				}

				if (!this.argv.prompt) {
					// if we're not prompting, output the missing arguments and exit
					this.logger.banner();

					missingArgs.forEach(function (arg) {
						this.logger.error(__('Missing required argument "%s"', arg.name) + '\n');
					}, this);

					this.logger.log(__('For help, run: %s', (this.argv.$ + ' help ' + this.argv.$command).cyan) + '\n');
					process.exit(1);
				}

				this.prompt(missingArgs, nextValidationTask);
			},

			function callCommandValidate(nextValidationTask) {
				var validate = this.command.module.validate;
				if (validate && typeof validate === 'function') {
					// call validate()
					var result = validate(this.logger, this.config, this),
						done = 0;
					if (result && typeof result === 'function') {
						result(function (r) {
							if (done++) {
								return;  // if callback is fired more than once, just ignore
							}
							if (r === false) {
								// squelch the run() function
								this.command.module.run = function () {};
							}
							this.emit('cli:post-validate', { cli: this, command: this.command }, nextValidationTask);
						}.bind(this));
						return;
					} else if (result === false) {
						// squelch the run() function
						this.command.module.run = function () {};
					}
				}
				this.emit('cli:post-validate', { cli: this, command: this.command }, nextValidationTask);
			},

			function callOptionCallbacks(nextValidationTask) {
				[ this.command, this.subcommand ].forEach(function (ctx) {
					if (ctx) {
						// call command/subcommand option callbacks
						var options = ctx.options;
						options && Object.keys(options).forEach(function (name) {
							if (options[name].callback) {
								var val = options[name].callback(argv[name] || '');
								val !== undefined && (argv[name] = val);
							}
						});

						// call platform specific option callbacks
						options = ctx.platform && ctx.platform.options;
						options && Object.keys(options).forEach(function (name) {
							if (options[name].callback) {
								var val = options[name].callback(argv[name] || '');
								val !== undefined && (argv[name] = val);
							}
						});
					}
				}, this);
				nextValidationTask();
			}
		], function (err) {
			if (err) {
				if (err.message !== 'cancelled') {
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
 * Prompts the user for the specified items.
 * @param {Array} items - items to prompt for
 * @param {Function} done - Callback when the function finishes
 * @private
 * @returns {void}
 * /
CLI.prototype.prompt = function prompt(items, done) {
	// sanity check
	if (!items || (Array.isArray(items) && (!items.length || !items.some(i => i)))) {
		return done();
	}

	var _t = this,
		errs = [],
		// create our async queue
		queue = async.queue(function (opt, callback) {
			if (opt.prompt && typeof opt.prompt === 'function') {
				opt.prompt(function (field) {
					if (!field) {
						return callback();
					}

					// if this option had a bad value and caused an error, then disable auto selecting
					if (opt._err && field.autoSelectOne) {
						field.autoSelectOne = false;
					}

					field.prompt(function (err, value) {
						if (err) {
							errs.push(err);
							if (err.message === 'cancelled') {
								return callback(err);
							}
						} else {
							// if we just prompted with a Select field, autoSelectOne is true, and
							// there is exactly one option, then do not display the extra line break
							var items = 0;
							if (field.options && field.autoSelectOne) {
								if (Array.isArray(field.options)) {
									items = field.options.length;
								} else if (typeof field.options === 'object') {
									Object.keys(field.options).forEach(function (key) {
										if (Array.isArray(field.options[key])) {
											items += field.options[key].length;
										}
									});
								}
							}
							items !== 1 && _t.logger.log();
							_t.argv[opt.name] = value;
						}
						callback();
					});
				});
			} else {
				var pr = opt.prompt || {},
					p = (pr.label || appc.string.capitalize(opt.desc || '')).trim().replace(/:$/, ''),
					def = pr.default || opt.default || '';

				if (typeof def === 'function') {
					def = def();
				} else if (Array.isArray(def)) {
					def = def.join(',');
				}

				fields.text({
					promptLabel: p,
					promptValues: opt.values,
					default: def || undefined,
					password: !!opt.password,
					validate: pr.validate || function (value) {
						if (pr.validator) {
							try {
								pr.validator(value);
							} catch (ex) {
								if (ex.type === 'AppcException') {
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
					} else {
						errs.push(err);
					}
					callback(err);
				});
			}
		}, 1);

	// when the queue is drained, then we're done
	queue.drain(function () {
		done(errs.length ? errs : null);
	});

	// queue up items to prompt for
	(Array.isArray(items) ? items : [ items ]).forEach(function (opt) {
		queue.push(opt, function (err) {
			if (err) {
				err.message === 'cancelled' && _t.logger.log(); // add an extra line for ctrl-c
				_t.logger.log();
				process.exit(1);
			}
		});
	});
};
*/
