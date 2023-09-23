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
import { prompt } from './util/prompt.js';
import { applyCommandConfig } from './util/apply-command-config.js';
import { TiHelp } from './util/tihelp.js';

const { blue, bold, cyan, gray, green, magenta, red, yellow } = chalk;

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
			const { detect } = await import('./util/detect.js');
			const { data } = await detect(this.logger, ticonfig, this, { nodejs: true, os: true });
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
		const { version } = fs.readJsonSync(pkgJsonFile);
		this.name = 'Titanium Command-Line Interface';
		this.copyright = 'Copyright TiDev, Inc. 4/7/2022-Present. All Rights Reserved.';
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
			const argv = this.argv;
			const cargv = cmd.opts();
			for (const o of cmd.options) {
				let name = o.name();
				if (o.negate) {
					name = name.replace(/^no-/, '');
				}
				if (argv[name] === undefined) {
					argv[name] = cargv[o.attributeName()];
				}
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
		const events = unique(arrayify(name, true));

		const promise = events
			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
				const hook = this.createHook(name, data);
				hook((err, result) => {
					err ? reject(err) : resolve(result);
				});
			})), Promise.resolve(this));

		if (typeof callback !== 'function') {
			return promise;
		}

		// eslint-disable-next-line promise/catch-or-return
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
	async executeCommand(actionArgs) {
		const cmd = actionArgs.pop();
		actionArgs.pop(); // discard argv

		this.argv._ = actionArgs;

		this.command = cmd;
		this.applyArgv(cmd);

		this.logger.banner();

		if (sdkCommands[this.command.name()]) {
			// the SDK still uses the `colors` package, so we need to add the
			// colors to the string prototype
			const assignColors = proto => Object.defineProperties(proto, {
				blue: { get() { return blue(`${this}`); } },
				bold: { get() { return bold(`${this}`); } },
				cyan: { get() { return cyan(`${this}`); } },
				gray: { get() { return gray(`${this}`); } },
				green: { get() { return green(`${this}`); } },
				grey: { get() { return gray(`${this}`); } },
				magenta: { get() { return magenta(`${this}`); } },
				red: { get() { return red(`${this}`); } },
				yellow: { get() { return yellow(`${this}`); } }
			});

			assignColors(String.prototype);
			assignColors(Number.prototype);
			assignColors(Boolean.prototype);
		}

		await this.validate();

		await this.emit('cli:pre-execute', { cli: this, command: this.command });
		this.startTime = Date.now();

		const run = this.command.module?.run;
		if (typeof run !== 'function') {
			return;
		}

		this.logger.trace(`Executing command: ${this.command.name()}`);
		const result = await new Promise((resolve, reject) => {
			const r = run(this.logger, this.config, this, async (err, result) => {
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
			if (r instanceof Promise) {
				r.then(resolve).catch(reject);
			}
		});

		if (result instanceof Promise) {
			await result;
		}
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
			.allowUnknownOption()
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
			.addOption(
				// completely ignored, we just need the parser to not choke
				new Option('--color')
					.hideHelp()
			)
			.addOption(
				new Option('--colors')
					.hideHelp()
			)
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
			.option('-d, --project-dir <path>', 'the directory containing the project')
			.option('-q, --quiet', 'suppress all output')
			.option('-v, --version', 'displays the current version')
			.option('-s, --sdk [version]', `Titanium SDK version to use ${gray('(default: "latest")')}`)
			.on('option:config', cfg => {
				try {
					this.config.apply((0, eval)(`(${cfg})`));
					if (!this.config.cli?.colors) {
						chalk.level = 0;
					}
				} catch (e) {
					throw new Error(`Failed to parse --config: ${e.message}`);
				}
			})
			.on('option:config-file', file => this.config.load(file))
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
			.hook('preAction', async (_, cmd) => {
				// command is already loaded via `preSubcommand`, but reapply argv due
				// to commander using an `EventEmitter` to set option values
				this.applyArgv(cmd);

				const { conf } = cmd;
				if (!conf) {
					return;
				}

				// if the command has a --platform option, then we need to load the platform-specific configuration
				if (conf.options?.platform) {
					this.argv.$platform = this.argv.platform;
				}

				// any keys in the conf object that aren't explicitly 'flags',
				// 'options', 'args', or 'subcommands' is probably a option branch
				// that changes the available flags/options
				const skipRegExp = /^(flags|options|args|subcommands)$/;
				const optionBranches = Object.keys(conf)
					.filter(name => conf.options && conf.options[name] && !skipRegExp.test(name))
					.sort((a, b) => {
						// if we have multiple option groups, then try to process them in order
						if (!conf.options[a] || !conf.options[a].order) {
							return 1;
						}
						if (!conf.options[b] || !conf.options[b].order) {
							return -1;
						}
						return conf.options[b].order - conf.options[a].order;
					});

				for (const name of optionBranches) {
					const option = conf.options[name];
					const optionBranch = conf[name];

					// if --<option> was passed in, then mix in the option branch's flags/options
					if (this.argv[name]) {
						const src = optionBranch[this.argv[name]];
						Object.assign(conf.flags, src.flags);
						Object.assign(conf.options, src.options);
						await applyCommandConfig.call(this, cmd.name(), cmd, {
							flags: src.flags,
							options: src.options
						});
					}

					if (this.argv[name] !== undefined || !option.required) {
						// v6 would re-parse, but that is unsupported
						continue;
					}

					this.logger.banner();

					if (!this.argv.prompt || !option.prompt || !option.values) {
						this.logger.error(`Missing required option "--${name}"\n`);
						if (option.values) {
							this.logger.log('Allowed values:');
							for (const v of option.values) {
								this.logger.log(`   ${cyan(v)}`);
							}
							this.logger.log();
						}
						process.exit(1);
					}

					// we need to prompt
					const field = await new Promise(resolve => option.prompt(resolve));
					await new Promise(resolve => {
						field.prompt(async (err, value) => {
							this.logger.log(); // add a little whitespace after prompting

							if (err) {
								// we purposely do NOT show the error
								this.logger.log();
								process.exit(1);
							}

							// the option should probably have a callback, so fire it
							if (conf.options[name].callback) {
								value = conf.options[name].callback(value);
							}

							this.argv[name] = value;

							// mix in the option branch's flags/options
							const src = optionBranch[value];
							Object.assign(conf.flags, src.flags);
							Object.assign(conf.options, src.options);
							await applyCommandConfig.call(this, cmd.name(), cmd, {
								flags: src.flags,
								options: src.options
							});

							// v6 would re-parse, but that is unsupported

							resolve();
						});
					});
				}

				// apply missing option defaults
				if (conf.options) {
					for (const name of Object.keys(conf.options)) {
						if (!Object.hasOwn(this.argv, name) && conf.options[name].default) {
							this.argv[name] = conf.options[name].default;
						}
					}
				}
			})
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
				.allowUnknownOption()
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

		const cwd = expand(this.argv['project-dir'] || '.');

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
		} = await initSDK({
			cmdName,
			config: this.config,
			cwd,
			logger: this.logger,
			promptingEnabled: this.argv.prompt && !this.argv.$_.includes('-h') && !this.argv.$_.includes('--help'),
			selectedSdk: this.argv.sdk
		});
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
		this.argv.sdk = sdk?.name;

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
								: `    Didn't load: ${c.file} ${c.version ? `(version ${version})` : ''}`;
						}).join('\n')
					}`)
					.join('\n')
			}\n`);
		}

		if (sdkCommands[cmdName] && !this.sdk) {
			throw new TiError('No Titanium SDKs found', {
				after: `You can download the latest Titanium SDK by running: ${cyan('titanium sdk install')}`
			});
		}

		const commandFile = sdkCommands[cmdName]
			? pathToFileURL(join(this.sdk.path, `cli/commands/${cmdName}.js`))
			: join(import.meta.url, `../commands/${cmdName}.js`);

		// load the command
		this.logger.trace(`Importing: ${commandFile}`);
		cmd.module = (await import(commandFile)) || {};

		if (typeof cmd.module.extendedDesc === 'string') {
			desc = cmd.module.extendedDesc;
		} else if (desc) {
			desc = capitalize(desc) + (/[.!]$/.test(desc) ? '' : '.');
		}
		desc = desc.replace(/__(.+?)__/gs, (s, m) => cyan(m));
		cmd.description(wrapAnsi(desc, ticonfig.get('cli.width', 80), { hard: true, trim: false }));

		// load the command's config
		if (typeof cmd.module.config === 'function') {
			const fn = await cmd.module.config(this.logger, this.config, this);
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
			const files = fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map(n => join(dir, n)) : [dir];
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

		await this.handleMissingAndInvalidOptions();

		const fn = this.command.module?.validate;
		if (fn && typeof fn === 'function') {
			const result = fn(this.logger, this.config, this);

			// fn should always be a function for `build` and `clean` commands
			if (typeof result === 'function') {
				await new Promise(resolve => result(resolve));
			} else if (result === false) {
				this.command.module.run = () => {};
			}
		}
		await this.emit('cli:post-validate', { cli: this, command: this.command });

		// fire all option callbacks for any options we missed above
		for (const ctx of [this.command, this.command?.platform]) {
			if (ctx?.conf?.options) {
				for (const [name, opt] of Object.entries(ctx.conf.options)) {
					if (typeof opt.callback === 'function') {
						const val = opt.callback(this.argv[name] || '');
						if (val !== undefined) {
							this.argv[name] = val;
						}
					}
				}
			}
		}
	}

	async handleMissingAndInvalidOptions() {
		const options = {};

		for (const ctx of [this.command, this.command?.platform]) {
			if (ctx?.conf?.options) {
				Object.assign(options, ctx.conf.options);
			}
		}

		if (!Object.keys(options).length) {
			return;
		}

		const orderedOptionNames = Object.keys(options).sort((a, b) => {
			if (options[a].order && options[b].order) {
				return options[a].order - options[b].order;
			}
			if (options[a].order) {
				return -1;
			}
			if (options[b].order) {
				return 1;
			}
			return 0;
		});

		const prompting = this.argv.prompt;

		// this while loop is essentially a pump that processes missing/invalid
		// options one at a time, recalculating them each iteration
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const invalid = {};
			let invalidCount = 0;
			const missing = {};
			let missingCount = 0;

			for (const name of orderedOptionNames) {
				if (prompting && (missingCount || invalidCount)) {
					continue;
				}

				const opt = options[name];

				if (opt.validated) {
					continue;
				}

				const obj = Object.assign(opt, { name: name });

				// check missing required options and invalid options
				if (this.argv[name] === undefined) {
					// check if the option is required
					if (opt.required || (opt.conf && opt.conf.required)) {
						// ok, we have a required option, but it's possible that this option
						// replaces some legacy option in which case we need to check if the
						// legacy options were defined

						if (typeof opt.verifyIfRequired === 'function') {
							await new Promise(resolve => {
								opt.verifyIfRequired(stillRequired => {
									if (stillRequired) {
										missing[name] = obj;
										missingCount++;
									}
									resolve();
								});
							});
							continue;
						}
						missing[name] = obj;
						missingCount++;
					}
				} else if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(this.argv[name]) === -1) {
					invalid[name] = obj;
					invalidCount++;
				} else if (!opt.validated && typeof opt.validate === 'function') {
					try {
						await new Promise(resolve => {
							opt.validate(this.argv[name], (err, value) => {
								if (err) {
									obj._err = err;
									invalid[name] = obj;
									invalidCount++;
								} else {
									this.argv[name] = value;
									opt.validated = true;
									if (opt.callback) {
										var val = opt.callback(this.argv[name] || '');
										val !== undefined && (this.argv[name] = val);
										delete opt.callback;
									}
								}
								resolve();
							});
						});
					} catch (ex) {
						if (!(ex instanceof GracefulShutdown)) {
							throw ex;
						}
					}
					continue;
				} else if (opt.callback) {
					opt.validated = true;
					var val = opt.callback(this.argv[name] || '');
					val !== undefined && (this.argv[name] = val);
					delete opt.callback;
				}
			}

			// at this point, we know if we have any invalid or missing options

			if (!invalidCount && !missingCount) {
				break;
			}

			// we have an invalid option or missing option
			if (!prompting) {
				// if we're not prompting, output the invalid/missing options and exit
				this.logger.banner();

				if (Object.keys(invalid).length) {
					for (const name of Object.keys(invalid)) {
						const opt = invalid[name];
						const msg = `Invalid "${opt.label || `--${name}`}" value "${this.argv[opt.name]}"`;

						if (typeof opt.helpNoPrompt === 'function') {
							opt.helpNoPrompt(this.logger, msg);
						} else {
							this.logger.error(`${msg}\n`);
							if (opt.values) {
								this.logger.log('Accepted values:');
								for (const v of opt.values) {
									this.logger.log(`   ${cyan(v)}`);
								}
								this.logger.log();
							}
						}
					}
				}

				if (Object.keys(missing).length) {
					// if prompting is disabled, then we just print all the problems we encountered
					for (const name of Object.keys(missing)) {
						const msg = `Missing required option: --${name} <${missing[name].hint || 'value'}>`;
						if (typeof missing[name].helpNoPrompt === 'function') {
							missing[name].helpNoPrompt(this.logger, msg);
						} else {
							this.logger.error(`${msg}\n`);
						}
					}
				}

				const cmd = ['titanium'];
				if (this.command) {
					cmd.push(this.command.name());
				}
				cmd.push('--help');

				this.logger.log(`For help, run: ${cyan(cmd.join(' '))}\n`);
				process.exit(1);
			}

			// we are prompting, so find the first invalid or missing option
			let opt;
			if (invalidCount) {
				const name = Object.keys(invalid).shift();
				opt = invalid[name];

				if (!opt.prompt) {
					// option doesn't have a prompt, so let's make a generic one
					opt.prompt = async callback => {
						// if the option has values, then display a pretty list
						if (Array.isArray(opt.values)) {
							const { value } = await prompt({
								type: 'select',
								message: `Please select a valid ${cyan(name)} value:`,
								name: 'value',
								choices: opt.values.map(v => ({ label: v, value: v }))
							});
							if (value === undefined) {
								// sigint
								process.exit(0);
							}
							return callback(null, value);
						}

						const pr = opt.prompt || {};
						const { value } = await prompt({
							type: opt.password ? 'password' : 'text',
							message: `Please enter a valid ${cyan(name)}`,
							name: 'value',
							validate: opt.validate || (value => {
								if (pr.validator) {
									try {
										pr.validator(value);
									} catch (ex) {
										return ex.toString();
									}
								} else if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
									return pr.error;
								}
								return true;
							})
						});
						if (value === undefined) {
							// sigint
							process.exit(0);
						}
						callback(null, value);
					};
				}
			} else {
				// must be a missing option
				opt = missing[Object.keys(missing).shift()];
			}

			// do the prompting
			await this.prompt(opt);
			try {
				opt._err = null;
				opt.validated = true;
				if (opt.callback) {
					try {
						const val = opt.callback(this.argv[opt.name] || '');
						if (val !== undefined) {
							this.argv[opt.name] = val;
						}
						delete opt.callback;
					} catch (e) {
						if (e instanceof GracefulShutdown) {
							this.command.module.run = () => {};
						} else {
							throw e;
						}
					}
				}
			} catch {
				this.argv[opt.name] = undefined;
			}
		}
	}

	async prompt(opt) {
		this.logger.trace(`Prompting for --${opt.name}`);

		if (typeof opt.prompt === 'function') {
			const field = await new Promise(resolve => opt.prompt(resolve));
			if (!field) {
				return;
			}

			if (opt._err && field.autoSelectOne) {
				field.autoSelectOne = false;
			}

			this.argv[opt.name] = await new Promise(resolve => {
				field.prompt((err, value) => {
					if (err) {
						process.exit(1);
					}
					resolve(value);
				});
			});
			return;
		}

		const pr = opt.prompt || {};
		const p = (pr.label || capitalize(opt.desc || '')).trim().replace(/:$/, '');
		let def = pr.default || opt.default || '';
		if (typeof def === 'function') {
			def = def();
		} else if (Array.isArray(def)) {
			def = def.join(',');
		}

		const validate = pr.validate || (value => {
			if (pr.validator) {
				try {
					pr.validator(value);
				} catch (ex) {
					return ex.toString();
				}
			} else if (!value.length || (pr.pattern && !pr.pattern.test(value))) {
				return pr.error;
			}
			return true;
		});

		let value;

		if (Array.isArray(opt.values)) {
			const choices = opt.values.map(v => ({ label: v, value: v }));
			({ value } = await prompt({
				type: 'select',
				message: p,
				name: 'value',
				initial: def && choices.find(c => c.value === def) || undefined,
				validate,
				choices
			}));
		} else {
			({ value } = await prompt({
				type: opt.password ? 'password' : 'text',
				message: p,
				name: 'value',
				initial: def || undefined,
				validate
			}));
		}

		if (value === undefined) {
			// sigint
			process.exit(0);
		}

		this.argv[opt.name] = value;
	}
}
