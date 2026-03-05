import { arrayify } from '../util/arrayify.js';
import { capitalize, expand, isDir, isFile } from 'node-titanium-sdk/util';
import { TiError } from '../util/tierror.js';
import chalk from 'chalk';
import { detectTiModules } from 'node-titanium-sdk/titanium';
import { dirname, join, parse } from 'node:path';

const { cyan, gray, magenta } = chalk;

// if a platform is not in this map, then we just print the capitalized platform name
const platformNames = {
	android: 'Android',
	commonjs: 'CommonJS',
	iphone: 'iPhone',
	ios: 'iOS',
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
		if (subcmd.alias) {
			subcommands[name].alias = subcmd.alias;
		}
	}
	return {
		title: 'Module',
		defaultSubcommand: 'list',
		skipBanner: true,
		subcommands,
	};
}

/**
 * Displays all installed modules.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
export async function run(logger, config, cli) {
	let action = cli.command.name();
	if (action === 'list' && cli.command.args.length) {
		action = cli.command.args[0];
		if (cli.argv.$_.includes('list')) {
			throw new TiError(`Invalid argument "${action}"`, { showHelp: true });
		}
		cli.command = cli.command.parent;
	}
	for (const [name, subcommand] of Object.entries(ModuleSubcommands)) {
		if (action === name || action === subcommand.alias) {
			await ModuleSubcommands[name].fn(logger, config, cli);
			return;
		}
	}
	throw new TiError(`Invalid subcommand "${action}"`, { showHelp: true });
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
	alias: 'ls',
	conf(_logger, _config, _cli) {
		return {
			desc: 'print a list of installed modules',
			flags: {
				json: {
					desc: 'display installed modules as JSON',
				},
			},
			options: {
				output: {
					abbr: 'o',
					default: 'report',
					hidden: true,
					values: ['report', 'json'],
				},
				'project-dir': {
					desc: 'the directory of the project to search',
				},
			},
		};
	},
	async fn(logger, config, cli) {
		const isJson = cli.argv.json || cli.argv.output === 'json';
		let p = expand(cli.argv['project-dir'] || '.');
		const searchPaths = arrayify(config.get('paths.modules'), true);

		// attempt to detect if we're in a project folder by scanning for a tiapp.xml
		// until we hit the root
		if (isDir(p)) {
			for (const { root } = parse(p); p !== root; p = dirname(p)) {
				if (isFile(join(p, 'tiapp.xml'))) {
					searchPaths.push(p);
					break;
				}
			}
		}

		const { modules } = await detectTiModules({
			searchPaths
		});

		if (isJson) {
			logger.log(JSON.stringify(modules, null, '\t'));
			return;
		}

		logger.skipBanner(false);
		logger.banner();

		if (Object.keys(modules).length) {
			for (const [name, platforms] of Object.entries(modules)) {
				logger.log(name);
				for (const [platform, versions] of Object.entries(platforms)) {
					const platformName = platformNames[platform.toLowerCase()] || capitalize(platform);
					logger.log(`  ${gray(platformName)}`);
					for (const [version, mod] of Object.entries(versions)) {
						logger.log(`    ${cyan(version)}`);
						logger.log(`      Path          = ${magenta(mod.path)}`);
						logger.log(`      Author        = ${magenta(mod.author || '')}`);
						logger.log(`      Description   = ${magenta(mod.description || '')}`);
						logger.log(`      Titanium SDK  = ${magenta(mod.minsdk ? `>=${mod.minsdk}` : 'any')}`);
						logger.log();
					}
				}
			}
		} else {
			logger.log(gray('No modules found'));
			logger.log();
		}
	},
};
