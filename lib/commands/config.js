/*
 * config.js: Titanium CLI config command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('../config'),
	appc = require('node-appc');

exports.config = function (logger, config, cli) {
	return {
		desc: __('get and set config options'),
		extendedDesc: __('Gets and sets config options. If no key is specified, then all key/values are returned.\n\nThe config file is located at: %s', config.getConfigPath().cyan),
		skipBanner: true,
		flags: {
			'remove': {
				abbr: 'r',
				desc: __('remove the specified config key and all its descendants')
			}
		},
		args: [
			{
				name: 'key',
				desc: __('the key to get or set')
			},
			{
				name: 'value',
				desc: __('the value to set the specified key')
			}
		]
	};
};

exports.validate = function (logger, config, cli) {
	if (cli.argv._.length > 0) {
		var key = cli.argv._[0];
		if (!/^([A-Za-z_]{1}[A-Za-z0-9-_]*(\.[A-Za-z-_]{1}[A-Za-z0-9-_]*)*)$/.test(key)) {
			logger.banner();
			logger.error(__('Invalid key "%s"', key) + '\n');
			process.exit(1);
		}
	}
};

exports.run = function (logger, config, cli) {
	var argv = cli.argv,
		key = argv._.length > 0 && argv._[0],
		value = argv._.length > 1 && argv._[1],
		results = {};
	
	function walk(obj, prefix, parent) {
		Object.keys(obj).forEach(function (name) {
			var p = parent ? parent + '.' + name : name;
			if (Object.prototype.toString.call(obj[name]) == '[object Object]') {
				walk(obj[name], prefix, p);
			} else {
				if (!prefix || !parent || parent.indexOf(prefix) == 0) {
					results[p] = JSON.stringify(obj[name]);
				}
			}
		});
	}
	
	function print(prefix) {
		walk(config, prefix);
		
		var maxlen = Object.keys(results).reduce(function (a, b) {
			return Math.max(a, b.length);
		}, 0);
		
		Object.keys(results).sort().forEach(function (k) {
			logger.log('%s = %s', appc.string.rpad(k, maxlen).cyan, results[k] || '');
		});
	}
	
	if (key) {
		try {
			var parts = key.split('.'),
				i = 0,
				q = parts.pop(),
				p = parts.length && parts[i++],
				obj = config;
			
			if (p) {
				do {
					obj = p in obj ? obj[p] : (obj[p] = {});
				} while (obj && (p = parts[i++]));
			}
			
			if (value) {
				// doing a set
				var num = Number(value);
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
				
				config.save();
				logger.log(__('%s saved', key.cyan));
			} else if (argv.remove) {
				// doing a remove
				if (obj && q) {
					delete obj[q];
				}
				config.save();
				logger.log(__('%s removed', key.cyan));
			} else {
				// doing a get
				if (obj) {
					if (Object.prototype.toString.call(obj[q]) == '[object Object]') {
						print(key);
					} else if (obj[q] != void 0) {
						logger.log((''+obj[q]).cyan);
					}
				}
			}
		} catch (e) {
			logger.error(e);
		}
	} else {
		// print all key/values
		print();
	}
};
