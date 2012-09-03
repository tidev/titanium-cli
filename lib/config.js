/*
 * completion.js: Titanium CLI config processor
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require('fs'),
	path = require('path'),
	appc = require('node-appc'),
	config = {
		// default config
		user: {},
		
		app: {
			sdk: 'latest',
			workspace: ''
		},
		
		cli: {
			colors: true,
			completion: true,
			logLevel: 'warn',
			prompt: true
		}
	};

Object.defineProperty(config, 'getConfigPath', {
	value: function () {
		return appc.fs.resolvePath('~', '.titanium', 'config.json');
	}
});

Object.defineProperty(config, 'load', {
	value: function () {
		var cfg = this.getConfigPath();
		if (appc.fs.exists(cfg)) {
			try {
				var values = JSON.parse(fs.readFileSync(cfg));
				
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