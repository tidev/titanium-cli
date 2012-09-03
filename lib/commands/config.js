/*
 * config.js: Titanium CLI config command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('../config'),
	string = require('node-appc').string;

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
	
	function walk(obj, parent) {
		Object.keys(obj).forEach(function (name) {
			if (Object.prototype.toString.call(obj[name]) == '[object Object]') {
				walk(obj[name], parent ? parent + '.' + name : name);
			} else {
				results[(parent ? parent + '.' : '') + name] = JSON.stringify(obj[name]);
			}
		});
	}
	
	if (key) {
		try {
			if (value) {
				// doing a set
				new Function('cfg', 'v', 'cfg["' + key.split('.').join('"]["') + '"] = v;')(config, value);
				config.save();
				logger.log(__('%s saved', key.cyan));
			} else if (argv.remove) {
				// doing a remove
				eval('(delete config["' + key.split('.').join('"]["') + '"])');
				config.save();
				logger.log(__('%s removed', key.cyan));
			} else {
				// doing a get
				var x = new Function('cfg', 'return cfg["' + key.split('.').join('"]["') + '"];')(config);
				x !== void 0 && logger.log((''+x).cyan);
			}
		} catch (e) {
			logger.error(e);
		}
	} else {
		// print all key/values
		walk(config);
		
		var maxlen = Object.keys(results).reduce(function (a, b) {
			return Math.max(a, b.length);
		}, 0);
		
		Object.keys(results).sort().forEach(function (k) {
			logger.log('%s = %s', string.rpad(k, maxlen).cyan, results[k] || '');
		});
	}
};
