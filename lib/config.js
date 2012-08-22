/*
 * completion.js: Titanium CLI config processor
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require('fs'),
	path = require('path'),
	appc = require('node-appc'),
	config = module.exports = {
		// default config
		user: {},
		
		app: {
			sdk: 'latest'
		},
		
		cli: {
			colors: true,
			completion: true,
			logLevel: 'warn',
			prompt: true
		},
		
		load: function () {
			var cfg = path.join(appc.fs.home(), '.titanium', 'config.json');
			if (appc.fs.exists(cfg)) {
				try {
					appc.util.mix(config, JSON.parse(fs.readFileSync(cfg, 'utf-8')));
				} catch (ex) {
					tierror('Unable to parse config file:', ex);
				}
			}
			return config;
		}
	};
