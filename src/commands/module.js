import { expand } from '../util/expand.js';
import { TiError } from '../util/tierror.js';

// if a platform is not in this map, then we just print the capitalized platform name
const platformNames = {
	android: 'Android',
	commonjs: 'CommonJS',
	iphone: 'iPhone',
	ios: 'iOS'
};

const ModuleSubcommands = {};

/**
 * Returns the configuration for the module command.
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @returns {Object} Module command configuration
 */
export function config(logger, config, cli) {
	const subcommands = {};
	for (const [name, subcmd] of Object.entries(ModuleSubcommands)) {
		subcommands[name] = subcmd.conf(logger, config, cli);
	}
	return {
		defaultSubcommand: 'list',
		skipBanner: true,
		subcommands
	};
}

/**
 * Displays all installed modules.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
export async function run(logger, _config, cli) {
	let action = cli.argv._.shift() || 'list';
	if (!ModuleSubcommands[action]) {
		throw new TiError(`Invalid subcommand "${action}"`);
	}
	await ModuleSubcommands[action].fn(logger, _config, cli);
}

/**
 * Displays a list of all installed modules.
 * @memberof ModuleSubcommands
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config object
 * @param {CLI} _cli - The CLI instance
 * @param {Function} _finished - Callback when the command finishes
 */
ModuleSubcommands.list = {
	conf(_logger, _config, _cli) {
		return {
			desc: 'print a list of installed modules',
			flags: {
				json: {
					desc: 'display installed modules as json'
				}
			},
			options: {
				output: {
					abbr: 'o',
					default: 'report',
					hidden: true,
					values: ['report', 'json']
				},
				'project-dir': {
					desc: 'the directory of the project to search'
				}
			}
		};
	},
	async fn(logger, config, cli) {
		const isJson = cli.argv.json || cli.argv.output === 'json';
		const projectDir = cli.argv['project-dir'];
		const p = expand(projectDir || '.');
		const searchPaths = {
			project: [],
			config: [],
			global: []
		};
		const scopeLabels = {
			project: 'Project Modules',
			config: 'Configured Path Modules',
			global: 'Global Modules'
		};
		const confPaths = config.get('paths.modules');
		const defaultInstallLocation = cli.env.installPath;
		const sdkLocations = cli.env.os.sdkPaths.map(p => expand(p));

		console.log(sdkLocations);

		/*
		// attemp to detect if we're in a project folder by scanning for a tiapp.xml
		// until we hit the root
		if (fs.existsSync(p)) {
			while (path.dirname(p) !== p) {
				if (fs.existsSync(path.join(p, 'tiapp.xml'))) {
					fs.existsSync(p = path.join(p, 'modules')) && searchPaths.project.push(p);
					break;
				}
				p = path.dirname(p);
			}
		}

		// set our paths from the config file
		Array.isArray(confPaths) || (confPaths = [ confPaths ]);
		confPaths.forEach(function (p) {
			p && fs.existsSync(p = afs.resolvePath(p)) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && (searchPaths.config.push(p));
		});

		// add any modules from various sdk locations
		sdkLocations.indexOf(defaultInstallLocation) === -1 && sdkLocations.push(defaultInstallLocation);
		_cli.sdk && sdkLocations.push(afs.resolvePath(_cli.sdk.path, '..', '..', '..'));
		sdkLocations.forEach(function (p) {
			fs.existsSync(p = afs.resolvePath(p, 'modules')) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && searchPaths.global.indexOf(p) === -1 && (searchPaths.global.push(p));
		});

		const results = await new Promise(resolve => appc.timodule.scopedDetect(searchPaths, config, null, resolve));

		if (isJson) {
			// alias ios to iphone for backwards compatibility
			if (results.global && results.global.ios) {
				results.global.iphone = results.global.ios;
			}
			console.log(JSON.stringify(results, null, '\t'));
		} else {
			logger.banner();

			Object.keys(results).forEach(function (scope) {
				var modules = results[scope],
					platforms = Object.keys(modules);

				if (scope === 'project' && projectDir === undefined && !platforms.length) {
					// no sense printing project modules if there aren't any and the
					// user never asked to see them
					return;
				}

				_logger.log(scopeLabels[scope].bold);

				if (platforms.length) {
					platforms.forEach(function (platform, i) {
						i && _logger.log(); // add some whitespace

						var platformName = platformNames[platform.toLowerCase()] || appc.string.capitalize(platform);
						_logger.log(platformName.grey);

						Object.keys(modules[platform]).forEach(function (name) {
							_logger.log('  ' + name);
							Object.keys(modules[platform][name]).forEach(function (ver) {
								_logger.log('    ' + appc.string.rpad(ver, 7).cyan + ' ' + modules[platform][name][ver].modulePath);
							});
						});
					});
				} else {
					_logger.log(__('No modules found').grey);
				}

				_logger.log();
			});
		}
		*/
	}
}
