import { Argument, Command, Option } from 'commander';
import { ticonfig } from './ticonfig.js';
import { TiError } from './tierror.js';

export function applyCommandConfig(cmdName, cmd, conf) {
	if (conf.title) {
		cmd.title = conf.title;
	}

	if (conf.alias) {
		cmd.alias(conf.alias);
	}

	if (conf.flags) {
		for (const [name, meta] of Object.entries(conf.flags)) {
			this.logger.trace(`Adding "${cmdName}" flag: ${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`);
			cmd.option(`${meta.abbr ? `-${meta.abbr}, ` : ''}--${name}`, meta.desc);
		}
	}

	if (conf.options) {
		for (const [name, meta] of Object.entries(conf.options)) {
			if (name === 'log-level' || name === 'sdk') {
				// --log-level and --sdk are now a global options
				this.logger.trace(`Skipping "${cmdName}" option: --${name}`);
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
			if (Array.isArray(meta.values)) {
				opt.choices(meta.values);
			}
			this.logger.trace(`Adding "${cmdName}" option: ${meta.abbr ? `-${meta.abbr}, ` : ''}${long} [value]`);
			cmd.addOption(opt);
			cmd.hook('preAction', (_, actionCommand) => {
				const opt = actionCommand.options.find(o => o.long === long);
				if (opt) {
					const value = actionCommand.getOptionValue(opt.attributeName()) || opt.defaultValue;

					if (typeof meta.callback === 'function') {
						meta.callback(value);
					}

					// the following is `build` command specific
					if (name === 'platform') {
						const platformConf = conf.platforms?.[value];
						if (platformConf) {
							this.command.platform = {
								conf: platformConf
							};
						}
					}
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
			this.logger.trace(`Adding "${cmdName}" arg: ${fmt}`);
			cmd.addArgument(arg);
		}
	}

	if (conf.subcommands) {
		for (const [name, subconf] of Object.entries(conf.subcommands)) {
			this.logger.trace(
				`Adding subcommand "${name}"${
					conf.defaultSubcommand === name ? ' (default)' : ''
				} to "${cmdName}"`
			);
			const subcmd = new Command(name);
			subcmd
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
					outputError: msg => {
						// explicitly set the subcommand so the global error
						// handler can print the correct help screen
						this.command = subcmd;
						throw new TiError(msg.replace(/^error:\s*/, ''));
					}
				});
			this.applyConfig(name, subcmd, subconf);
			subcmd.action((...args) => this.executeCommand(args, true));
			cmd.addCommand(subcmd, {
				isDefault: conf.defaultSubcommand === name
			});
		}
	}
}
