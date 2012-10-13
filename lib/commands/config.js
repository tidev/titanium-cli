/*
 * config.js: Titanium CLI config command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('../config'),
	appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

exports.desc = __('get and set config options');
exports.extendedDesc = __('Gets and sets config options. If no key is specified, then all key/values are returned.\n\nThe config file is located at: %s', config.getConfigPath().cyan);

exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		noAuth: true,
		flags: {
			remove: {
				abbr: 'r',
				desc: __('remove the specified config key and all its descendants')
			}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				desc: __('output format'),
				values: ['report', 'json']
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
	var len = cli.argv._.length,
		key = cli.argv._[0];
	if (len > 0) {
		if (!/^([A-Za-z_]{1}[A-Za-z0-9-_]*(\.[A-Za-z-_]{1}[A-Za-z0-9-_]*)*)$/.test(key)) {
			logger.banner();
			logger.error(__('Invalid key "%s"', key) + '\n');
			process.exit(1);
		}
	}
	if (cli.argv.remove) {
		if (len == 0) {
			logger.banner();
			logger.error(__('Missing key of the config setting to remove') + '\n');
			logger.log(__('Run %s to remove the config setting.', (cli.argv.$ + ' config --remove <key>').cyan) + '\n');
			process.exit(1);
		}
		if (len > 1) {
			logger.banner();
			logger.error(__('Too many arguments for "%s" flag', '--remove') + '\n');
			logger.log(__('Run %s to remove the config setting.', (cli.argv.$ + ' config --remove ' + (key.indexOf(' ') == -1 ? key : '"' + key + '"')).cyan) + '\n');
			process.exit(1);
		}
	}
};

exports.run = function (logger, config, cli) {
	var argv = cli.argv,
		key = argv._.length > 0 && argv._[0],
		value = argv._.length > 1 && argv._[1],
		results = {},
		asJson = cli.argv.output == 'json';
	
	function walk(obj, prefix, parent) {
		Object.keys(obj).forEach(function (name) {
			var p = parent ? parent + '.' + name : name;
			if (Object.prototype.toString.call(obj[name]) == '[object Object]') {
				walk(obj[name], prefix, p);
			} else {
				if (!prefix || !parent || parent.indexOf(prefix) == 0) {
					results[p] = asJson ? obj[name] : JSON.stringify(obj[name]);
				}
			}
		});
	}
	
	function print(prefix) {
		walk(config, prefix);
		
		var maxlen = Object.keys(results).reduce(function (a, b) {
			return Math.max(a, b.length);
		}, 0);
		
		if (asJson) {
			logger.log(JSON.stringify(results, null, '\t'));
		} else {
			Object.keys(results).sort().forEach(function (k) {
				logger.log('%s = %s', appc.string.rpad(k, maxlen), (results[k] || '').cyan);
			});
		}
	}
	
	if (key) {
		try {
			if (value) {
				// doing a set
				var pathMatch = key.match(/^paths\.(.*)$/),
					subPath;
				if (pathMatch) {
					subPath = pathMatch[1];
					if (!~['modules', 'commands', 'hooks', 'modules'].indexOf(subPath)) {
						logger.error(__('Unsupported key %s', key));
						return;
					}
					config.paths || (config.paths = {});
					config.paths[subPath] || (config.paths[subPath] = []);
					~config.paths[subPath].indexOf(value) || (config.paths[subPath].push(value));
				} else {
					config.set(key, value);
				}
				config.save();
				logger.log(asJson ? JSON.stringify({ success: true }) : __('%s saved', key.cyan));
			} else {
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
				
				if (obj) {
					if (argv.remove) {
						// doing a remove
						if (obj.hasOwnProperty(q)) {
							delete obj[q];
							config.save();
							logger.log(asJson ? JSON.stringify({ success: true }) : __('%s removed', key.cyan));
						} else {
							logger.log(asJson ? JSON.stringify({
								success: false,
								reason: __('key "%s" not found', key)
							}, null, '\t') : __('%s not found', key.cyan));
							process.exit(1);
						}
					} else {
						// doing a get
						if (Object.prototype.toString.call(obj[q]) == '[object Object]') {
							print(key);
						} else if (obj[q] != void 0) {
							logger.log(asJson ? JSON.stringify(obj[q]) : (''+obj[q]).cyan);
						} else {
							logger.log(asJson ? JSON.stringify({
								success: false,
								reason: __('key "%s" not found', key)
							}, null, '\t') : __('%s not found', key.cyan));
							process.exit(1);
						}
					}
				} else {
					logger.log(asJson ? JSON.stringify({
						success: false,
						reason: __('key "%s" not found', key)
					}, null, '\t') : __('%s not found', key.cyan));
					process.exit(1);
				}
			}
		} catch (e) {
			if (asJson) {
				logger.log(JSON.stringify({ success: false, error: e.toString() }));
			} else {
				logger.error(e);
			}
		}
	} else {
		// print all key/values
		print();
	}
};
