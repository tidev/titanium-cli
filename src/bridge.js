import appcdLogger from 'appcd-logger';
import CLI, { ansi, Terminal, util } from 'cli-kit';
import Client from 'appcd-client';
import fs from 'fs';
import path from 'path';
import snooplogg from 'snooplogg';

const { error, log } = appcdLogger('ti:cli:bridge');
const { highlight } = snooplogg.styles;

/**
 * Manages a connection to the Appc Daemon.
 *
 * @class Bridge
 */
export default class Bridge {
	/**
	 * Loads the Titanium appcd plugin info and initializes the appcd client.
	 *
	 * @access public
	 */
	constructor() {
		const {
			dependencies,
			version
		} = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

		this.pluginName       = '@appcd/plugin-titanium';
		this.pluginDir        = path.resolve(require.resolve(this.pluginName), '..', '..');
		this.pluginVersion    = dependencies[this.pluginName];
		this.version          = version;

		this.client = new Client({
			userAgent: `titanium-cli/${version}`
		});
	}

	/**
	 * Attempts to connect to the daemon and check if the Titanium appcd plugin is registered. If
	 * it's not registered, then it will register it with the one distributed with this package.
	 *
	 * @returns {Promise} Resolves a response stream.
	 * @access private
	 */
	checkTitaniumPlugin() {
		return new Promise((resolve, reject) => {
			log('Titanium CLI service not found, checking if the Titanium appcd plugin is registered...');
			this.client
				.request(`/appcd/plugin/status/${this.pluginName}/${this.pluginVersion}`)
				.once('response', info => {
					// we are able to get the plugin status, yet our call earlier to the CLI service
					// failed, so the plugin must be borked
					const err = new Error(
						info.error
							? `Titanium appcd plugin has crashed and possibly needs to be reinstalled: ${info.error}`
							: 'Titanium appcd plugin\'s CLI service is not working and possibly needs to be reinstalled (404)'
					);
					err.info = info;
					reject(err);
				})
				.once('error', err => {
					if (err.status !== 404) {
						return reject(err);
					}

					// the Titanium appcd plugin is not registered, so let's register it
					log(`Registering Titanium appcd plugin: ${highlight(this.pluginDir)}`);
					this.client
						.request({ path: '/appcd/plugin/register', data: { path: this.pluginDir } })
						.once('response', resolve)
						.once('error', err => {
							reject(new Error(`Failed to register the Titanium appcd plugin: ${err.message}`));
						});
				});
		});
	}

	/**
	 * Disconnects from the daemon.
	 *
	 * @access public
	 */
	disconnect() {
		this.client.disconnect();
	}

	/**
	 * Ensures the daemon is installed and running, connects to it, and executes the CLI command.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Array.<String>} params.argv - The list of command line arguments.
	 * @param {String} params.cwd - The current working directory.
	 * @param {Object} [params.env] - A map of environment variables.
	 * @param {Array.<String>} [params.parentContextNames] - An array of parent names used for
	 * rendering help.
	 * @param {Stream} params.stdin - The input stream.
	 * @param {Stream} params.stdout - The output stream.
	 * @returns {Promise}
	 * @access public
	 */
	async exec({ argv, cwd, env, parentContextNames, stdin, stdout }) {
		const p = argv.indexOf('--interactive'); // experimental repl
		let interactive = false;
		if (p !== -1) {
			interactive = true;
			argv.splice(p, 1);
		}

		// step 1: get the url
		let url;
		try {
			url = await new Promise((resolve, reject) => {
				const path = `/titanium/${this.pluginVersion}/cli`;
				log(`Requesting ${highlight(path)}`);

				this.client.request({ path, startDaemon: true })
					.once('response', msg => {
						if (msg && msg.url) {
							resolve(msg.url);
						} else {
							reject(new Error('Unable to retrieve CLI session URL'));
						}
					})
					.once('error', async err => {
						if (err.status !== 404) {
							return reject(err);
						}

						try {
							await this.checkTitaniumPlugin();
						} catch (e) {
							return reject(e);
						}

						log(`Requesting ${highlight(path)}`);
						this.client.request({ path })
							.once('response', msg => {
								if (msg && msg.url) {
									resolve(msg.url);
								} else {
									reject(new Error('Unable to retrieve CLI session URL'));
								}
							})
							.once('error', reject);
					});
			});
		} finally {
			this.client.disconnect();
		}

		const headers = {
			'User-Agent': `titanium-cli/${this.version}`
		};
		if (cwd) {
			headers['clikit-cwd'] = util.encode(cwd);
		}
		if (env) {
			headers['clikit-env'] = util.encode(env);
		}
		if (parentContextNames) {
			headers['clikit-parents'] = util.encode(parentContextNames);
		}

		// step 2: connect to the cli session
		const handle = await CLI.connect(url, {
			headers,
			terminal: new Terminal({
				stdin,
				stdout
			})
		});

		handle.on('close', () => process.exit());

		handle.on('error', err => {
			error(err);
			process.exit(1);
		});

		handle.on('exit', code => {
			if (!interactive) {
				process.exit(code);
			}
		});

		// step 3: run the command
		if (!interactive || argv.length) {
			const command = argv.map(a => {
				return !a.length ? '""' : /\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
			}).join(' ');
			log(`Executing: ${highlight(command)}`);
			handle.send(ansi.custom.exec(command));
		}

		// only turn on echo after initial command has been run
		if (interactive) {
			handle.send(ansi.custom.echo(true));
		}
	}

	/**
	 * Ensures the daemon is installed and running, connects to it, and retrieves the CLI schema.
	 *
	 * @returns {Promise} Resolves an object containing the CLI schema.
	 * @access public
	 */
	schema() {
		return new Promise((resolve, reject) => {
			const path = `/titanium/${this.pluginVersion}/cli/schema`;
			log(`Requesting ${highlight(path)}`);

			this.client.request({ path, startDaemon: true })
				.once('response', resolve)
				.once('error', async err => {
					if (err.status !== 404) {
						return reject(err);
					}

					try {
						await this.checkTitaniumPlugin();
					} catch (e) {
						return reject(e);
					}

					log(`Requesting ${highlight(path)}`);

					this.client.request({ path })
						.once('response', resolve)
						.once('error', reject);
				});
		});
	}
}
