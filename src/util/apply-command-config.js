import { Argument, Command, Option } from 'commander';
import { ticonfig } from './ticonfig.js';
import { TiError } from './tierror.js';

/**
 * Takes a Titanium CLI command config with flags, options, args, and
 * subcommands and adds them to the current Commander.js command context.
 *
 * @param {CLI} cli - The CLI instance.
 * @param {String} cmdName - The name of the command.
 * @param {Command} cmd - The Commander.js command instance.
 * @param {Object} conf - The CLI command config to apply.
 */
export function applyCommandConfig(cli, cmdName, cmd, conf) {
	if (conf.title) {
		cmd.title = conf.title;
	}

	if (conf.alias) {
		cmd.alias(conf.alias);
	}

	if (conf.flags) {
		for (const [name, meta] of Object.entries(conf.flags)) {
			cli.debugLogger.trace(`Adding "${cmdName}" flag: ${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`);
			const opt = new Option(`${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`, meta.desc);
			if (meta.default) {
				opt.default(meta.default);
			}
			if (meta.hidden) {
				opt.hideHelp(true);
			}
			cmd.addOption(opt);
		}
	}

	if (conf.options) {
		for (const [name, meta] of Object.entries(conf.options)) {
			if (name === 'sdk') {
				// --log-level and --sdk are now a global options
				cli.debugLogger.trace(`Skipping "${cmdName}" option: --${name}`);
				continue;
			}

			const long = `--${name}`;
			const opt = new Option(`${meta.abbr ? `-${meta.abbr}, ` : ''}${long} [value]`, meta.desc);
			if (meta.hidden) {
				opt.hideHelp(true);
			}
			if (meta.default !== undefined) {
				opt.default(meta.default);
			}

			if (optionExists(cmd, name)) {
				cli.debugLogger.trace(`Option "${name}" already exists, skipping`);
				continue;
			}

			cli.debugLogger.trace(`Adding "${cmdName}" option: ${meta.abbr ? `-${meta.abbr}, ` : ''}${long} [value]`);
			cmd.addOption(opt);

			if (typeof meta.callback === 'function') {
				cmd.on(`option:${opt.attributeName()}`, value => {
					cli.debugLogger.trace(`Firing --${name} option callback: ${value ?? opt.defaultValue}`);
					const result = meta.callback(value ?? opt.defaultValue);
					cmd.setOptionValue(opt.name(), result ?? value ?? opt.defaultValue);
				});
			}

			conf.options[name] = new Proxy(meta, {
				set(obj, prop, value) {
					const orig = obj[prop];
					obj[prop] = value;

					if (prop === 'required' && orig !== value) {
						cli.debugLogger.trace(`--${name} changed: ${prop}=${value}`);
						opt[prop] = value;
					}

					return true;
				}
			});
		}

		if (conf.options['log-level'] && !conf.options.timestamp) {
			cli.debugLogger.trace(`Adding "${cmdName}" option: --timestamp`);
			cmd.option('--timestamp', 'displays a timestamp in front of log lines');
			cmd.on('option:timestamp', () => {
				if (cli.ready) {
					cli.logger.timestampEnabled(true);
				}
			});
		}
	}

	if (Array.isArray(conf.args)) {
		for (const meta of conf.args) {
			const v = meta.variadic ? '...' : '';
			const fmt = meta.required ? `<${meta.name}${v}>` : `[${meta.name}${v}]`;
			const arg = new Argument(fmt, meta.desc);
			if (meta.default !== undefined) {
				arg.default(meta.default);
			}
			if (Array.isArray(meta.values)) {
				arg.choices(meta.values);
			}
			cli.debugLogger.trace(`Adding "${cmdName}" arg: ${fmt}`);
			cmd.addArgument(arg);
		}
	}

	if (conf.subcommands) {
		for (const [name, subconf] of Object.entries(conf.subcommands)) {
			cli.debugLogger.trace(
				`Adding subcommand "${name}"${
					conf.defaultSubcommand === name ? ' (default)' : ''
				} to "${cmdName}"`
			);

			const subcmd = new Command(name);
			subcmd
				.addHelpText('beforeAll', () => {
					cli.logger.bannerEnabled(true);
					cli.logger.skipBanner(false);
					cli.logger.banner();
				})
				.configureHelp({
					helpWidth: ticonfig.get('cli.width', 80),
					showGlobalOptions: true,
					sortSubcommands: true
				})
				.configureOutput({
					outputError: msg => {
						// explicitly set the subcommand so the global error
						// handler can print the correct help screen
						cli.command = subcmd;
						throw new TiError(msg.replace(/^error:\s*/, ''));
					}
				})
				.action((...args) => cli.executeCommand(args));

			cli.applyConfig(name, subcmd, subconf);

			subcmd.conf = subconf;

			// subcommand shares parent command's module
			subcmd.module = cmd.module;

			cmd.addCommand(subcmd, {
				isDefault: conf.defaultSubcommand === name,
				hidden: !!subconf.hidden
			});
		}
	}
}

function optionExists(ctx, name) {
	const exists = ctx.options.find(o => o.name() === name);
	if (exists) {
		return true;
	}
	if (ctx.parent) {
		return optionExists(ctx.parent, name);
	}
	return false;
}
