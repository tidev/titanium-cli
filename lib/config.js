/**
 * @overview
 * Internal CLI configuration logic. Loads and saves CLI settings to
 * ~/.titanium/config.json.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

/** @module lib/config */

var fs = require('fs'),
	path = require('path'),
	appc = require('node-appc'),
	wrench = require('wrench'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = appc.fs,
	config = module.exports = {
		// default config
		user: {},

		app: {
			sdk: 'latest',
			workspace: ''
		},

		cli: {
			colors: true,
			completion: false,
			logLevel: 'trace',
			prompt: true,
			failOnWrongSDK: false,
			httpProxyServer: ''
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
	titaniumConfigFolder = afs.resolvePath('~', '.titanium'),
	configFile = path.join(titaniumConfigFolder, 'config.json');

Object.defineProperty(config, 'getConfigPath', {
	value: function () {
		return configFile;
	}
});

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

		value = value == void 0 ? '' : value.toString().trim();
		value === 'null' && (value = null);
		value === 'true' && (value = true);
		value === 'false' && (value = false);
		if (obj && q) {
			obj[q] = value;
		}
	}
});

Object.defineProperty(config, 'checkIfSetup', {
	value: function (logger) {
		if (afs.exists(configFile)) {
			return true;
		}
		logger.log(
			__('Titanium CLI has not yet been configured.').yellow + '\n' +
			__('Run %s to configure the Titanium CLI.', 'titanium setup').split('titanium setup').map(function (s) { return s.yellow; }).join('titanium setup'.cyan) + '\n'
		);
		return false;
	}
});

Object.defineProperty(config, 'load', {
	value: function () {
		if (afs.exists(configFile)) {
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

				appc.util.mix(config, values);
			} catch (ex) {
				console.error(__('Unable to parse config file:'));
				console.error(ex);
			}
		}
		return config;
	}
});

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
