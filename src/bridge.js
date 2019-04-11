import appcdLogger from 'appcd-logger';
import Client from 'appcd-client';
import fs from 'fs';
import path from 'path';
import snooplogg from 'snooplogg';

const { log } = appcdLogger('ti:cli:bridge');
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
		this.pluginDir        = path.resolve(require.resolve('@appcd/plugin-titanium'), '..', '..');
		let { name, version } = JSON.parse(fs.readFileSync(path.join(this.pluginDir, 'package.json'), 'utf8'));
		this.pluginName       = name;
		this.pluginVersion    = version;

		({ version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')));
		this.client = new Client({
			userAgent: `titanium-cli/${version}`
		});
	}

	/**
	 * Attempts to connect to the Appc Daemon. If the connection fails, it attempts to find appcd,
	 * get its configuration, start the daemon, and reconnect.
	 *
	 * @returns {Promise} Resolves a response stream.
	 * @access private
	 */
	async connect() {
		await new Promise((resolve, reject) => {
			this.client
				.connect({ startDaemon: true })
				.on('connected', resolve)
				.on('error', reject);
		});

		log(`Requesting ${highlight(this.path)}`);
		return await new Promise((resolve, reject) => {
			const response = this.client.request({ path: this.path, data: this.data });
			const onFinish = (...msg) => {
				resolve(response);
				setImmediate(() => response.emit('finish', ...msg));
			};

			response
				.once('response', (...msg) => {
					response.removeListener('finish', onFinish);
					resolve(response);
					setImmediate(() => response.emit('response', ...msg));
				})
				.once('finish', onFinish)
				.once('error', err => {
					if (err.status === 404) {
						this.checkTitaniumPlugin().then(resolve).catch(reject);
					} else {
						reject(err);
					}
				});
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
						.once('response', () => this.connect().then(resolve).catch(reject))
						.once('error', err => {
							reject(new Error(`Failed to register the Titanium appcd plugin: ${err.message}`));
						});
				});
		});
	}

	/**
	 * Dispatches a request to the Appc Daemon.
	 *
	 * @param {String} path - A path relative to the Titanium appcd plugin's CLI service endpoint.
	 * @param {Object} [data] - An optional data payload to send with the request.
	 * @returns {Promise} Resolves a response stream.
	 * @access public
	 */
	async request(path, data) {
		if (!path || typeof path !== 'string') {
			throw new TypeError('Expected path to be a non-empty string');
		}

		if (data && typeof data !== 'object') {
			throw new TypeError('Expected data to be an object');
		}

		this.path = `/titanium/${this.pluginVersion}/cli/${path.replace(/^\//, '')}`;
		this.data = data;

		return this.connect();
	}

	/**
	 * Executes a command.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Array.<String>} params.argv - The list of command line arguments.
	 * @param {Console} params.console - A console instance.
	 * @returns {Promise}
	 * @access public
	 */
	async exec({ argv, console }) {
		const response = await this.request('/', { argv });

		response.on('response', (msg, { type }) => {
			// TODO: implement protocol for handling prompting
			if (type === 'stdout' || type === 'stderr') {
				console[`_${type}`].write(msg);
			}
		});

		await new Promise((resolve, reject) => {
			const cleanup = () => {
				this.client.disconnect();
				resolve();
			};

			response
				.once('finish', cleanup)
				.once('close', cleanup)
				.once('error', reject);
		});
	}
}
