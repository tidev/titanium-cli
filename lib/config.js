/*
 * completion.js: Titanium CLI config processor
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require('fs'),
	path = require('path'),
	appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = appc.fs,
	config = {
		// default config
		user: {},
		
		app: {
			sdk: 'latest',
			workspace: ''
		},
		
		cli: {
			colors: true,
			completion: false,
			logLevel: 'warn',
			prompt: true,
			failOnWrongSDK: false
		},
		
		// additional search paths for commands and hooks
		paths: {}
	},
	configFile = afs.resolvePath('~', '.titanium', 'config.json');

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
			obj = this,
			num = Number(value);
		
		if (p) {
			do {
				obj = p in obj ? obj[p] : (obj[p] = {});
			} while (obj && (p = parts[i++]));
		}
		
		if (value === '' || typeof value !== 'string' || isNaN(num)) {
			value = value == void 0 ? '' : value.toString().trim();
			value === 'null' && (value = null);
			value === 'true' && (value = true);
			value === 'false' && (value = false);
		} else {
			value = num;
		}
		
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
			__('Titanium CLI has not yet been configured').yellow + '\n' +
			__('Run %s to run the setup wizard', 'titanium setup'.cyan) + '\n'
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
							var num = Number(value);
							if (value === '' || typeof value !== 'string' || isNaN(num)) {
								value = value == void 0 ? '' : value.toString().trim();
								value === 'null' && (value = null);
								value === 'true' && (value = true);
								value === 'false' && (value = false);
								obj[k] = value;
							} else {
								obj[k] = num;
							}
						}
					});
				}(values));
				
				appc.util.mix(config, values);
			} catch (ex) {
				tierror('Unable to parse config file:', ex);
			}
		}
		return config;
	}
});

Object.defineProperty(config, 'save', {
	value: function () {
		fs.writeFileSync(this.getConfigPath(), JSON.stringify(config, null, '\t'));
	}
});

module.exports = config;