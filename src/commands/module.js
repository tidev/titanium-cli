import { arrayify } from '../util/arrayify.js';
import { expand } from '../util/expand.js';
import { TiError } from '../util/tierror.js';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import * as timodule from '../util/timodule.js';
import chalk from 'chalk';
import { capitalize } from '../util/capitalize.js';

const { bold, cyan, gray } = chalk;

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
		let p = expand(projectDir || '.');
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
		const confPaths = arrayify(config.get('paths.modules'), true);
		const defaultInstallLocation = cli.env.installPath;
		const sdkLocations = cli.env.os.sdkPaths.map(p => expand(p));

		// attemp to detect if we're in a project folder by scanning for a tiapp.xml
		// until we hit the root
		if (existsSync(p)) {
			for (const { root } = parse(p); p !== root; p = dirname(p)) {
				if (existsSync(join(p, 'tiapp.xml'))) {
					p = join(p, 'modules');
					if (existsSync(p)) {
						searchPaths.project.push(p);
					}
					break;
				}
			}
		}

		// set our paths from the config file
		for (let path of confPaths) {
			path = expand(path);
			if (existsSync(path) && !searchPaths.project.includes(path) && !searchPaths.config.includes(path)) {
				searchPaths.config.push(p);
			}
		}

		// add any modules from various sdk locations
		if (!sdkLocations.includes(defaultInstallLocation)) {
			sdkLocations.push(defaultInstallLocation);
		}
		if (cli.sdk) {
			sdkLocations.push(expand(cli.sdk.path, '..', '..', '..'));
		}
		for (let path of sdkLocations) {
			path = expand(path, 'modules');
			if (existsSync(path) && !searchPaths.project.includes(path) && !searchPaths.config.includes(path) && !searchPaths.global.includes(path)) {
				searchPaths.global.push(path);
			}
		}

		const results = await timodule.detect(searchPaths, config, logger);

		if (isJson) {
			console.log(JSON.stringify(results, null, '\t'));
			return;
		}

		logger.skipBanner(false);
		logger.banner();

		for (const [scope, modules] of Object.entries(results)) {
			const platforms = Object.keys(modules);
			if (scope === 'project' && projectDir === undefined && !platforms.length) {
				// no sense printing project modules if there aren't any and the
				// user never asked to see them
				continue;
			}

			console.log(bold(scopeLabels[scope]));
			if (platforms.length) {
				let i = 0;
				for (const platform of platforms) {
					if (i++) {
						console.log();
					}

					const platformName = platformNames[platform.toLowerCase()] || capitalize(platform);
					console.log(gray(platformName));
					for (const [name, versions] of Object.entries(modules[platform])) {
						console.log(`  ${name}`);
						for (const [ver, mod] of Object.entries(versions)) {
							console.log(`    ${cyan(ver.padEnd(7))} ${mod.modulePath}`);
						}
					}
				}
			} else {
				console.log(gray('No modules found'));
			}
		}
	}
}
