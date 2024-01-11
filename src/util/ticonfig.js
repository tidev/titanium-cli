import { join } from 'node:path';
import fs from 'fs-extra';
import { expand } from './expand.js';
import { TiError } from './tierror.js';

export class TiConfig {
	#configFile = '';

	#defaults = {
		app: {
			workspace: '.'
		},

		cli: {
			colors: true,
			completion: false,
			httpProxyServer: '',
			ignoreDirs: '^(\\.svn|_svn|\\.git|\\.hg|\\.?[Cc][Vv][Ss]|\\.bzr|\\$RECYCLE\\.BIN)$',
			ignoreFiles: '^(\\.gitignore|\\.npmignore|\\.cvsignore|\\.DS_Store|\\._.*|[Tt]humbs.db|\\.vspscc|\\.vssscc|\\.sublime-project|\\.sublime-workspace|\\.project|\\.tmproj)$',
			logLevel: 'trace',
			progressBars: true,
			prompt: true,
			rejectUnauthorized: true,
			width: 80
		},

		// additional search paths for commands and hooks
		paths: {
			hooks: [],
			modules: [],
			plugins: [],
			sdks: [],
			templates: []
		},

		user: {}
	};

	#titaniumConfigFolder = '';

	constructor(file) {
		this.#titaniumConfigFolder = expand('~/.titanium');
		this.#configFile = join(this.#titaniumConfigFolder, 'config.json');
		this.load(file);
	}

	/**
	 * Non-destructively deep merge an object into the config.
	 */
	apply(src, dest = this) {
		for (let [key, value] of Object.entries(src)) {
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				if (!dest[key] || typeof dest[key] !== 'object' || Array.isArray(value)) {
					dest[key] = {};
				}
				this.apply(value, dest[key]);
			} else {
				if (value === undefined) {
					value = '';
				} else if (typeof value === 'string') {
					value = value.trim();
				}
				if (value === 'null') {
					value = null;
				} else if (value === 'true') {
					value = true;
				} else if (value === 'false') {
					value = false;
				}
				dest[key] = value;
			}
		}
		return this;
	}

	/**
	 * Gets a value for a given key. Keys may use dot notation to get values from
	 * nested objects. For example, "cli.colors" maps to { cli: { colors: true } }.
	 * @param {String} key - The config object name
	 * @param {string} defaultValue - A default value if the value does not exist
	 * @returns {*} The value
	 */
	get(key, defaultValue) {
		if (!key) {
			return this;
		}

		const parts = key.split('.');
		let i = 0;
		let q = parts.pop();
		let p = parts.length && parts[i++];
		let obj = this;

		if (p) {
			do {
				if (p in obj) {
					obj = obj[p];
				} else {
					return defaultValue;
				}
			} while (obj && (p = parts[i++]));
		}

		return obj && q && Object.hasOwn(obj, q) ? obj[q] : defaultValue;
	}

	/**
	 * Returns an absolute path to the config file.
	 * @returns {String} Path to config file
	 */
	getConfigPath() {
		return this.#configFile;
	}

	/**
	 * Loads the config from disk.
	 * @param {String} file - The CLI config file to load
	 */
	load(file) {
		if (file) {
			file = expand(file);
			if (!fs.existsSync(file)) {
				throw new Error(`Unable to open config file "${file}"`);
			}
		} else {
			file = this.#configFile;
		}

		// reset with the defaults
		this.apply(this.#defaults);

		// if the config file exists, then we load it
		if (fs.existsSync(file)) {
			try {
				this.apply(fs.readJsonSync(file));
				this.#configFile = file;
			} catch (ex) {
				throw new Error(`Unable to parse config file "${file}"`);
			}
		}
	}

	setConfigPath(file) {
		this.#configFile = file;
	}

	/**
	 * Saves the config to disk.
	 */
	save() {
		try {
			fs.ensureDirSync(this.#titaniumConfigFolder);

			const tmpFile = `${this.#configFile}.${Date.now()}.tmp`;
			fs.writeFileSync(tmpFile, JSON.stringify(this, null, 2));
			fs.renameSync(tmpFile, this.#configFile);
		} catch (e) {
			throw new TiError(`Unable to write config file ${this.#configFile}`, {
				after: 'Please ensure the Titanium CLI has access to modify this file'
			});
		}
	}

	/**
	 * Sets the value for a given key. Keys may use dot notation to set values in
	 * nested objects. For example, "cli.colors" maps to { cli: { colors: true } }.
	 * @param {String} key
	 * @param {String|Number|Boolean} value
	 */
	set(key, value) {
		const parts = key.split('.');
		let i = 0;
		let q = parts.pop();
		let p = parts.length && parts[i++];
		let obj = this;

		if (p) {
			do {
				obj = p in obj ? obj[p] : (obj[p] = {});
			} while (obj && (p = parts[i++]));
		}

		// if not an array, try to cast to null, true, false, int or leave as string
		if (!Array.isArray(value)) {
			value = value === undefined ? '' : String(value).trim();
			value === 'null' && (value = null);
			value === 'true' && (value = true);
			value === 'false' && (value = false);
			if (String(~~value) === value) {
				value = ~~value;
			}
		}

		if (obj && q) {
			obj[q] = value;
		}
	}
}

export const ticonfig = new TiConfig();
