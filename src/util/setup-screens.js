import { detect } from '../util/proxy.js';
import prompts from 'prompts';
import chalk from 'chalk';
import { expand } from './expand.js';
import { existsSync } from 'node:fs';

const { bold, cyan, gray } = chalk;
const { prompt } = prompts;

/**
 * The setup command screens.
 * @class
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
export class SetupScreens {
	proxy = [];

	screens = {
		quick: {
			label: '__q__uick',
			desc: 'Quick Setup'
		},
		check: {
			label: 'chec__k__',
			desc: 'Check Environment'
		},
		user: {
			label: '__u__ser',
			desc: 'User Information'
		},
		app: {
			label: 'a__p__p',
			desc: 'New App Defaults'
		},
		network: {
			label: '__n__etwork',
			desc: 'Network Settings'
		},
		cli: {
			label: '__c__li',
			desc: 'Titanium CLI Settings'
		},
		android: {
			label: '__a__ndroid',
			desc: 'Android Settings'
		},
		ios: {
			label: '__i__os',
			desc: 'iOS Settings'
		}
	};

	constructor(logger, config, cli) {
		this.logger = logger;
		this.config = config;
		this.cli = cli;
	}

	async run() {
		const p = await detect();
		if (p) {
			this.proxy.push(p);
		}

		let next = this.cli.argv._[0] || 'mainmenu';
		let screen;
		while (screen = this[`${next}Screen`]) {
			next = (await screen.call(this)) || 'mainmenu';
			this.logger.trace(`Next screen: ${next}`);
		}
	}

	async mainmenuScreen() {
		const screens = Object.keys(this.screens).filter(name => name !== 'ios' || process.platform === 'darwin');

		const lookup = {
			[screens.length + 1]: 'exit',
			exit: 'exit',
			x: 'exit'
		};

		this.logger.log(
			screenTitle('Main Menu') + '\n' +
			screens
				.map((name, i) => {
					const { label, desc } = this.screens[name];
					const padding = 7 - (label.length - 4);
					const title = cyan(
						label.replace(/__(.+)__/, (_s, char) => {
							lookup[char] = name;
							return bold(char);
						}) +
						(padding > 0 ? ' '.repeat(padding) : '')
					);
					lookup[name] = lookup[i + 1] = name;
					return `${String(i + 1).padStart(4)})  ${title}  ${desc}`;
				})
				.join('\n') +
			`\n${String(screens.length + 1).padStart(4)})  ${cyan(
				'e__x__it'.replace(/__(.+)__/, (_s, char) => bold(char)))
			}     Exit`
		);

		const { value } = await prompt({
			type: 'text',
			message: 'Where do you want to go?',
			name: 'value'
		});

		const next = lookup[value];
		if (!next || next === 'exit') {
			process.exit(0);
		}
		return next;
	}

	async quickScreen() {
		//
	}

	async checkScreen() {
		//
	}

	async userScreen() {
		this.logger.log(screenTitle('User'));

		const { name } = await prompt({
			type: 'text',
			message: 'What do you want as your "author" name?',
			initial: this.config.get('user.name', ''),
			name: 'name'
		});

		if (name) {
			this.config.set('user.name', name);
			this.config.save();
			this.logger.log('\nConfiguration saved!');
		}
	}

	async appScreen() {
		this.logger.log(screenTitle('New App Defaults'));

		const values = await prompt([
			{
				type: 'text',
				message: 'Path to your workspace where your projects should be created:',
				initial: this.config.get('app.workspace', ''),
				name: 'workspace',
				validate: value => {
					if (!value) {
						return 'Please specify a workspace directory';
					}
					value = expand(value);
					if (!existsSync(value)) {
						return 'Specified workspace directory does not exist'
					}
					return true;
				}
			},
			{
				type: 'text',
				message: 'What is your prefix for application IDs? (example: com.mycompany)',
				initial: this.config.get('app.idprefix'),
				name: 'idprefix'
			},
			{
				type: 'text',
				message: 'What is the name of your organization to use as the "publisher"?',
				initial: this.config.get('app.publisher'),
				name: 'publisher'
			},
			{
				type: 'text',
				message: 'What is the URL of your organization?',
				initial: this.config.get('app.url'),
				name: 'url'
			}
		]);

		this.config.set('app.workspace', values.workspace);
		this.config.set('app.idprefix', values.idprefix);
		this.config.set('app.publisher', values.publisher);
		this.config.set('app.url', values.url);
		this.config.save();
		this.logger.log('\nConfiguration saved!');
	}

	async networkScreen() {
		this.logger.log(screenTitle('Network Settings'));

		let defaultProxy = this.config.get('cli.httpProxyServer', undefined);
		if (!defaultProxy) {
			for (const proxy of this.proxy) {
				if (proxy.valid) {
					defaultProxy = proxy.fullAddress;
					break;
				}
			}
		}

		const values = await prompt([
			{
				type: 'toggle',
				message: 'Are you behind a proxy server?',
				initial: !!this.config.get('cli.httpProxyServer'),
				name: 'hasProxy',
				active: 'yes',
				inactive: 'no'
			},
			{
				type: prev => prev ? 'text' : null,
				message: 'Proxy server URL',
				initial: defaultProxy,
				name: 'httpProxyServer',
				validate: value => {
					try {
						const u = new URL(value);
						if (!/^https?:$/.test(u.protocol)) {
							return 'HTTP proxy url protocol must be either "http" or "https" (ex: http://user:pass@example.com)';
						}
						if (!(u.host || '')) {
							return 'HTTP proxy url must contain a host name (ex: http://user:pass@example.com)';
						}
						return true;
					} catch (e) {
						return e.message;
					}
				}
			},
			{
				type: 'toggle',
				message: 'Verify server (SSL) certificates against known certificate authorities?',
				initial: !!this.config.get('cli.rejectUnauthorized'),
				name: 'rejectUnauthorized',
				active: 'yes',
				inactive: 'no'
			}
		]);

		this.config.set('cli.httpProxyServer', values.hasProxy ? values.httpProxyServer : '');
		this.config.set('cli.rejectUnauthorized', values.rejectUnauthorized);
		this.config.save();
		this.logger.log('\nConfiguration saved!');
	}

	async cliScreen() {
		this.logger.log(screenTitle('Titanium CLI Settings'));

		const logLevels = this.logger.getLevels().reverse();

		const values = await prompt([
			{
				type: 'toggle',
				message: 'Enable colors?',
				initial: this.config.get('cli.colors', true),
				name: 'colors',
				active: 'yes',
				inactive: 'no'
			},
			{
				type: 'toggle',
				message: 'Enable interactive prompting for missing options and arguments?',
				initial: this.config.get('cli.prompt', true),
				name: 'prompt',
				active: 'yes',
				inactive: 'no'
			},
			{
				type: 'toggle',
				message: 'Display progress bars when downloading or installing?',
				initial: this.config.get('cli.progressBars', true),
				name: 'progressBars',
				active: 'yes',
				inactive: 'no'
			},
			{
				type: 'select',
				message: 'Output log level',
				initial: logLevels.indexOf(this.config.get('cli.logLevel', 'info')),
				name: 'logLevel',
				choices: this.logger.getLevels().reverse().map(level => {
					return {
						title: level,
						value: level
					};
				})
			},
			{
				type: 'number',
				message: 'What is the width of the Titanium CLI output?',
				initial: this.config.get('cli.width', 80),
				name: 'width',
				validate: value => {
					return value !== '' && value < 1 ? 'Please enter a positive number' : true;
				}
			}
		]);

		this.config.set('cli.colors', values.colors);
		this.config.set('cli.prompt', values.prompt);
		this.config.set('cli.progressBars', values.progressBars);
		this.config.set('cli.logLevel', values.logLevel);
		this.config.set('cli.width', values.width);
		this.config.save();
		this.logger.log('\nConfiguration saved!');
	}

	async androidScreen() {
		//
	}

	async iosScreen() {
		//
	}
}

function screenTitle(title) {
	const width = 50;
	const margin = width - title.length + 4;
	const pad = Math.floor(margin / 2);

	return `\n${
		gray('┤ '.padStart(pad + 1, '─'))
	}${
		bold(title)
	}${
		gray(' ├'.padEnd(margin - pad + 1, '─'))
	}\n`;
}
