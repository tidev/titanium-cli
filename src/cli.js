import chalk from 'chalk';
import fs from 'fs-extra';
import { program, Command, Option } from 'commander';
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
import { detect } from './util/detect.js';
import prompts from 'prompts';
import { applyCommandConfig } from './util/apply-command-config.js';
import { TiHelp } from './util/tihelp.js';

const { blue, bold, cyan, gray, green, magenta, red, yellow } = chalk;
const { prompt } = prompts;

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
		},
		getOSInfo: async (callback) => {
			const { data } = await detect(this.logger, config, this, { nodejs: true, os: true });
			const { node, npm, os } = data;
			if (typeof callback === 'function') {
				callback({
					os: os.name,
					platform: process.platform.replace('darwin', 'osx'),
					osver: os.version,
					ostype: os.architecture,
					oscpu: os.numcpus,
					memory: os.memory,
					node: node.version,
					npm: npm.version
				});
			}
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
	logger = new Logger(ticonfig.get('cli.logLevel'));

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

	/**
	 * This method is called by the SDK and we need to keep it.
	 *
	 * @access public
	 * @deprecated
	 */
	addAnalyticsEvent() {
		// noop
	}

	/**
	 * Alias for `on()`. This method has been deprecated for years, yet it is
	 * still used, so we must keep it.
	 *
	 * @access public
	 * @deprecated
	 */
	addHook(...args) {
		return this.on(...args);
	}

	/**
	 * Applies commander's argv for current command and all parent command
	 * contexts into this CLI's argv.
	 *
	 * @access private
	 */
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
	}

	/**
	 * Adds the config flags, options, arguments, and subcommands to a command.
	 *
	 * @param {String} cmdName - The name of the command.
	 * @param {Command} cmd - The commander command.
	 * @param {Object} conf - The command configuration.
	 * @access private
	 */
	applyConfig(cmdName, cmd, conf) {
		if (conf.skipBanner) {
			this.logger.skipBanner(true);
		}

		this.command.conf = conf;

		applyCommandConfig.call(this, cmdName, cmd, conf);

		if (conf.platforms) {
			this.command.createHelp = () => {
				return Object.assign(new TiHelp(this, conf.platforms), this.command.configureHelp());
			};
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

		promise.then(result => callback(null, result), callback);

		return this;
	}

	/**
	 * Executes the command's `run()` method.
	 *
	 * @param {Command} cmd - The commander command instance.
	 * @returns {Promise}
	 * @access private
	 */
	async executeCommand(args, isSubcommand) {
		const cmd = args.pop();
		this.argv._ = cmd.args;

		if (isSubcommand) {
			// Titanium CLI 6 and older had a CLI arg parser that did not
			// support subcommands of subcommands. We now use Commander and it
			// does. The problem is the commands expect the args to be relative
			// to the subcommand and Commander returns them as relative to most
			// specific subcommand subcommand. This means we need to drill down
			// all of the command contexts until we find the top most subcommand
			// and get its args.
			let ctx = cmd;
			while (ctx.parent) {
				ctx = ctx.parent;
			}
			// get rid of the subcommand
			this.argv._.unshift(ctx.args[1]);
		}

		this.applyArgv(cmd);

		this.logger.banner();

		await this.validate();

		await this.emit('cli:pre-execute', { cli: this, command: this.command });
		this.startTime = Date.now();

		const { run } = this.command.module;
		if (typeof run !== 'function') {
			return;
		}

		if (sdkCommands[this.command.name()]) {
			// the SDK still uses the `colors` package, so we need to add the
			// colors to the string prototype
			Object.defineProperties(String.prototype, {
				blue: { get() { return blue(this); } },
				bold: { get() { return bold(this); } },
				cyan: { get() { return cyan(this); } },
				gray: { get() { return gray(this); } },
				green: { get() { return green(this); } },
				grey: { get() { return gray(this); } },
				magenta: { get() { return magenta(this); } },
				red: { get() { return red(this); } },
				yellow: { get() { return yellow(this); } }
			});
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

	/**
	 * Alias for `emit()`. This method has been deprecated for years, yet it is
	 * still used, so we must keep it.
	 *
	 * @access public
	 * @deprecated
	 */
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
		Command.prototype.createHelp = () => {
			return Object.assign(new TiHelp(this), this.command.configureHelp());
		};

		this.command = program
			.name('titanium')
			.addHelpText('beforeAll', () => {
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
			.option('-s, --sdk [version]', `Titanium SDK version to use ${gray('(default: "latest")')}`)
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

		this.command.title = 'Global';

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
	 * @access private
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
		this.env.getSDK = version => {
			if (!version || version === 'latest') {
				return sdk;
			}
			const values = Object.values(sdks);
			return values.find(s => s.name === version) ||
				values.find(s => s.version === version) ||
				null;
		};
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
	 * Validates the arguments. First it checks against the built-in naive
	 * validation such as required or against a list of values. Next it calls
	 * each option's validator. After that it calls the command's validator.
	 * Lastly it calls each option's value callback.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async validate() {
		await this.emit('cli:pre-validate', { cli: this, command: this.command });

		// step 1: build a list of all options so we can sort them
		const options = [];
		for (const ctx of [ this.command, this.command?.platform ]) {
			if (ctx?.conf.options) {
				for (const [ name, opt ] of Object.entries(ctx.conf.options)) {
					options.push({
						// this is a sacrificial wrapper that we can throw away after firing and it
						// handles the boilerplate of checking the callback and result
						callback(value) {
							let result;
							if (typeof opt.callback === 'function') {
								// technically `opt.callback()` can throw a `GracefulShutdown` error
								// for both `build` and `clean` commands during the `project-dir`
								// callback if the `<sdk-version>` in the tiapp.xml is not the same
								// version loaded by the Titanium SDK, but luckily that will never :)
								result = opt.callback(value || '');
							}
							delete this.callback;
							return result !== undefined ? result : value;
						},
						name,
						orig: opt,
						values: /*!opt.skipValueCheck &&*/ Array.isArray(opt.values) ? opt.values : null
					});
				}
			}
		}

		options.sort((a, b) => {
			if (a.orig.order && b.orig.order) {
				return a.orig.order - b.orig.order;
			}
			return a.orig.order ? -1 : b.orig.order ? 1 : 0;
		});

		const ask = async (opt, error) => {
			if (opt.values) {
				const choices = opt.values.map(value => ({ value }));
				if (choices.length === 1) {
					return choices[0].value;
				}
				const { value } = await prompt({
					choices,
					error,
					message: `Please select a valid ${opt.name}`,
					name:    'value',
					type:    'select'
				});
				return value;
			}

			if (typeof opt.orig?.prompt === 'function') {
				return await new Promise(opt.orig.prompt);
			}

			const { value } = await prompt({
				error,
				message: `Please select a valid ${opt.name}`,
				name:    'value',
				type:    'text'
			});
			return value;
		};

		// step 2: determine invalid or missing options
		for (const opt of options) {
			const { name, orig, values } = opt;
			const value = this.argv[name];

			if (value === undefined) {
				// we need to check if the option is required
				// sometimes required options such as `--device-id` allow an undefined value in the
				// case when the value is derived by the config or is autoselected
				if (orig.required && (typeof orig.verifyIfRequired !== 'function' || await new Promise(orig.verifyIfRequired))) {
					this.argv[name] = await ask(opt, `Missing required option "${name}"`);
				}
			} else if (values && !values.includes(value)) {
				this.argv[name] = await ask(opt, `Invalid ${name} value "${value}"`);
			} else if (typeof orig.validate === 'function') {
				this.argv[name] = await new Promise((resolve, reject) => {
					orig.validate(value, async (err, adjustedValue) => {
						if (err) {
							this.logger.trace(`Validation failed for option ${name}: ${err.toString()}`);
							try {
								adjustedValue = await ask(opt, `Invalid ${name} value "${value}"`);
							} catch (e) {
								return reject(e);
							}
						}
						resolve(opt.callback(adjustedValue));
					});
				});
			} else if (typeof opt.callback === 'function') {
				this.argv[name] = opt.callback(value);
			}
		}

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
		for (const opt of options) {
			if (typeof opt.callback === 'function') {
				const val = opt.callback(this.argv[opt.name] || '');
				if (val !== undefined) {
					this.argv[opt.name] = val;
				}
			}
		}
	}
}
