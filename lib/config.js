/**
 * Internal CLI configuration logic. Loads and saves CLI settings to
 * ~/.titanium/config.json.
 *
 * @module config
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var fs = require('fs'),
	path = require('path'),
	appc = require('node-appc'),
	wrench = require('wrench'),
	__ = appc.i18n(__dirname).__,
	afs = appc.fs,
	mixObj = appc.util.mixObj,
	defaults = {
		// default config
		user: {},

		app: {
			workspace: ''
		},

		cli: {
			colors: true,
			completion: false,
			logLevel: 'trace',
			prompt: true,
			progressBars: true,
			failOnWrongSDK: false,
			httpProxyServer: '',
			rejectUnauthorized: true,
			width: 100,
			ignoreDirs: '^(\\.svn|_svn|\\.git|\\.hg|\\.?[Cc][Vv][Ss]|\\.bzr|\\$RECYCLE\\.BIN)$',
			ignoreFiles: '^(\\.gitignore|\\.npmignore|\\.cvsignore|\\.DS_Store|\\._.*|[Tt]humbs.db|\\.vspscc|\\.vssscc|\\.sublime-project|\\.sublime-workspace|\\.project|\\.tmproj)$'
		},

		// additional search paths for commands and hooks
		paths: {
			commands: [],
			hooks: [],
			modules: [],
			plugins: [],
			sdks: []
		}
	},
	config = module.exports = {},
	titaniumConfigFolder = afs.resolvePath('~', '.titanium'),
	configFile = path.join(titaniumConfigFolder, 'config.json');

/**
 * Returns an absolute path to the config file.
 * @returns {String} Path to config file
 */
Object.defineProperty(config, 'getConfigPath', {
	value: function () {
		return configFile;
	}
});

/**
 * Returns an object with the default configuration values.
 * @returns {Object} A copy of the default config object
 */
Object.defineProperty(config, 'getDefaults', {
	value: function () {
		return mixObj({}, defaults);
	}
});

/**
 * Sets a default configuration value.
 * @param {string} key - The config object name
 * @param {string} value - The new default value
 */
Object.defineProperty(config, 'setDefault', {
	value: function (key, value) {
		if (key) {
			var parts = key.split('.'),
				i = 0,
				q = parts.pop(),
				p = parts.length && parts[i++],
				obj = defaults;

			if (p) {
				do {
					obj = p in obj ? obj[p] : (obj[p] = {});
				} while (obj && (p = parts[i++]));
			}

			if (obj && q) {
				obj[q] = value;
			}
		}
	}
});

/**
 * Gets a value for a given key. Keys may use dot notation to get values from
 * nested objects. For example, "cli.colors" maps to { cli: { colors: true } }.
 * @param {String} key - The config object name
 * @param {string} defaultValue - A default value if the value does not exist
 * @returns {*} The value
 */
Object.defineProperty(config, 'get', {
	value: function (key, defaultValue) {
		if (!key) {
			return this;
		}

		var parts = key.split('.'),
			i = 0,
			q = parts.pop(),
			p = parts.length && parts[i++],
			obj = this;

		if (p) {
			do {
				if (p in obj) {
					obj = obj[p];
				} else {
					return defaultValue;
				}
			} while (obj && (p = parts[i++]));
		}

		return obj && q && obj.hasOwnProperty(q) ? obj[q] : defaultValue;
	}
});

/**
 * Sets the value for a given key. Keys may use dot notation to set values in
 * nested objects. For example, "cli.colors" maps to { cli: { colors: true } }.
 * @param {String} key
 * @param {String|Number|Boolean} value
 */
Object.defineProperty(config, 'set', {
	value: function (key, value) {
		var parts = key.split('.'),
			i = 0,
			q = parts.pop(),
			p = parts.length && parts[i++],
			obj = this;

		if (p) {
			do {
				obj = p in obj ? obj[p] : (obj[p] = {});
			} while (obj && (p = parts[i++]));
		}

		// if not an array, try to cast to null, true, false, or leave as string
		if (!Array.isArray(value)) {
			value = value == void 0 ? '' : value.toString().trim();
			value === 'null' && (value = null);
			value === 'true' && (value = true);
			value === 'false' && (value = false);
		}

		if (obj && q) {
			obj[q] = value;
		}
	}
});

/**
 * Loads the config from disk.
 * @param {String} file - The CLI config file to load
 * @returns {Object} The config object
 */
Object.defineProperty(config, 'load', {
	value: function (file) {
		if (file) {
			file = afs.resolvePath(file);
			if (fs.existsSync(file)) {
				configFile = file;
			} else {
				throw new Error(__('Unable to open config file "%s"', file));
			}
		}

		// each time we load the config, we have to zero out the current config
		Object.keys(config).forEach(function (key) {
			delete config[key];
		});

		// mix in the default values
		mixObj(config, defaults);

		// if the config file exists, then we load it
		if (fs.existsSync(configFile)) {
			try {
				var values = JSON.parse(fs.readFileSync(configFile));

				(function walk(obj) {
					Object.keys(obj).forEach(function (k) {
						var value = obj[k],
							type = Object.prototype.toString.call(value);
						if (type == '[object Object]') {
							walk(value);
						} else if (type == '[object String]') {
							value = value == void 0 ? '' : value.toString().trim();
							value === 'null' && (value = null);
							value === 'true' && (value = true);
							value === 'false' && (value = false);
							obj[k] = value;
						}
					});
				}(values));

				mixObj(config, values);
			} catch (ex) {
				throw new Error(__('Unable to parse config file'));
			}
		}

		return config;
	}
});

/**
 * Saves the config to disk.
 */
Object.defineProperty(config, 'save', {
	value: function () {
		try {
			if (!fs.existsSync(titaniumConfigFolder)) {
				wrench.mkdirSyncRecursive(titaniumConfigFolder);
			}
			fs.writeFileSync(configFile, JSON.stringify(config, null, '\t'));
		} catch (e) {
			if (e.code == 'EACCES') {
				console.error(__('Unable to write config file %s', configFile));
				console.error(__('Please ensure the Titanium CLI has access to modify this file.') + '\n');
			} else {
				console.error(__('An error occurred trying to save the Titanium CLI config file.'));
				console.error((e.stack || e.toString()) + '\n');
			}
			process.exit(1);
		}
	}
});
