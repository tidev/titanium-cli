/* eslint-disable max-len */

import chalk from 'chalk';
import { ticonfig } from '../util/ticonfig.js';
import { TiError } from '../util/tierror.js';
import { expand } from '../util/expand.js';

const { cyan } = chalk;

export const extendedDesc = `Gets and sets config options. If no key is specified, then all key/values are returned.

When specifying only the __<key>__ and using the __--remove__ flag, the specified key and all of its descendents are removed.

The __path.*__ config settings allow lists of values. You can specify multiple __<value>__'s following the __<key>__. Use the __--append__ flag to append a new value and the __--remove__ flag to remove an existing value.

Set the SDK path overwriting the previous values
  __titanium config paths.sdks /path/to/sdk__

Add another SDK path
  __titanium config paths.sdks --append /path/to/another/sdk__

Remove an SDK path
  __titanium config paths.sdks --remove /path/to/sdk__

The config file is located at: __${ticonfig.getConfigPath()}__`;

/**
 * Returns the configuration for the config command.
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @returns {Object} Config command configuration
 */
export function config(_logger, _config, _cli) {
	return {
		title: 'Config',
		skipBanner: true,
		flags: {
			append: {
				abbr: 'a',
				desc: 'appends a value to a key containing a list of values'
			},
			json: {
				desc: 'output config as json'
			},
			remove: {
				abbr: 'r',
				desc: 'removes all values and all its descendants or a specific value from a list of values'
			}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				hidden: true,
				values: ['report', 'json']
			}
		},
		args: [
			{
				name: 'key',
				desc: 'the key to get or set'
			},
			{
				name: 'value',
				desc: 'the value to set the specified key'
			}
		]
	};
}

/**
 * Validates command line arguments.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
export function validate(_logger, _config, cli) {
	const [key, value] = cli.argv._;

	if (key !== undefined && !/^([A-Za-z_]{1}[A-Za-z0-9-_]*(\.[A-Za-z-_]{1}[A-Za-z0-9-_]*)*)$/.test(key)) {
		throw new TiError(`Invalid key "${key}"`);
	}

	if (cli.argv.remove) {
		if (key === undefined) {
			throw new TiError('Missing key of the config setting to remove', {
				after: `Run ${cyan('titanium config --remove <key>')} to remove the config setting.`
			});
		}

		// if the key is not a path setting, then we don't allow any values
		if (value !== undefined && !/^paths\..*$/.test(key)) {
			throw new TiError('Too many arguments for "--remove" flag', {
				after: `Run ${cyan(
					`titanium config --remove ${key.includes(' ') ? `"${key}"` : key}`
				)} to remove the config setting.`
			});
		}
	}
}

/**
 * Displays config settings or sets a config value.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
export async function run(logger, config, cli) {
	const { argv } = cli;
	const key = argv._.length > 0 ? argv._.shift() : undefined;
	const value = argv._.length > 0 ? argv._[0] : undefined;
	const results = {};
	const asJson = argv.json || argv.output === 'json';

	function walk(obj, parts, parent) {
		const filter = Array.isArray(parts) ? parts.shift() : null;
		for (const name of Object.keys(obj)) {
			if (!filter || name === filter) {
				const p = parent ? parent + '.' + name : name;
				if (obj[name] && typeof obj[name] === 'object') {
					walk(obj[name], parts, p);
				} else if (!parts || !parts.length || !parent || parent.indexOf(parts) === 0) {
					results[p] = asJson ? obj[name] : JSON.stringify(obj[name]);
				}
			}
		}
	}

	function print(prefix) {
		if (asJson) {
			logger.log(JSON.stringify(config.get(prefix), null, '\t'));
		} else {
			walk(config, prefix && prefix.split('.'));
			const maxlen = Object.keys(results).reduce((a, b) => Math.max(a, b.length), 0);
			for (const key of Object.keys(results).sort()) {
				logger.log(`${key.padEnd(maxlen)} = ${cyan(results[key] || '')}`);
			}
		}
	}

	if (key) {
		try {
			if (value !== undefined) {
				// doing a set or removing a list item
				const listMatch = key.match(/^paths\.(.*)$/);
				if (listMatch) {
					const subPath = listMatch[1];

					const validKeys = [
						'hooks',
						'modules',
						'plugins',
						'sdks',
						'templates',
						'xcode'
					];
					if (!validKeys.includes(subPath)) {
						throw new TiError(`Unsupported key "${key}"\n`);
					}

					if (!config.paths) {
						config.paths = {};
					}

					if (argv.append) {
						if (!Array.isArray(config.paths[subPath])) {
							config.paths[subPath] = [];
						}
						for (let v of argv._) {
							v = expand(v);
							if (!config.paths[subPath].includes(v)) {
								config.paths[subPath].push(v);
							}
						}
					} else if (argv.remove) {
						if (!Array.isArray(config.paths[subPath])) {
							config.paths[subPath] = [];
						}
						for (let v of argv._) {
							let p = config.paths[subPath].indexOf(v);
							if (p !== -1) {
								config.paths[subPath].splice(p, 1);
							} else {
								v = expand(v);
								p = config.paths[subPath].indexOf(v);
								if (p !== -1) {
									config.paths[subPath].splice(p, 1);
								}
							}
						}
					} else {
						config.paths[subPath] = argv._;
					}
				} else {
					config.set(key, value);
				}
				config.save();
				logger.log(asJson ? JSON.stringify({ success: true }) : `${cyan(key)} saved`);
				return;
			}

			const parts = key.split('.');
			let i = 0;
			let q = parts.pop();
			let p = parts.length && parts[i++];
			let obj = config;

			if (p) {
				do {
					obj = p in obj ? obj[p] : (obj[p] = {});
				} while (obj && (p = parts[i++]));
			}

			if (obj) {
				if (argv.remove) {
					// doing a remove
					if (Object.hasOwn(obj, q)) {
						delete obj[q];
						config.save();
						logger.log(asJson ? JSON.stringify({ success: true }) : `${cyan(`"${key}"`)} removed`);
						return;
					}
				} else if (Array.isArray(obj[q])) {
					if (asJson) {
						logger.log(JSON.stringify(obj[q]));
					} else if (obj[q].length) {
						logger.log(obj[q].join('\n'));
					}
					return;
				} else if (obj[q] && typeof obj[q] === 'object') {
					print(key);
					return;
				} else if (obj[q] !== undefined) {
					logger.log(asJson ? JSON.stringify(obj[q]) : obj[q]);
					return;
				}
			}
			throw new TiError(`Key "${key}" not found`);
		} catch (e) {
			if (asJson) {
				logger.logerr(JSON.stringify({ success: false, error: e.message }));
				process.exit(1);
			}
			throw e;
		}
	} else {
		// print all key/values
		print();
	}
}
