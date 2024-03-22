import { SetupScreens } from '../util/setup-screens.js';
import chalk from 'chalk';

const { cyan } = chalk;

export const extendedDesc = `The setup command guides you through the various configuration settings and
helps detect if your development environment is properly installed.

The first time the Titanium CLI is installed, you should run the __titanium
setup wizard__ to configure the most common settings.`;

let screens;

/**
 * Returns the configuration for the setup command.
 *
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Setup command configuration
 */
export async function config(logger, config, cli) {
	screens = new SetupScreens(logger, config, cli);

	return {
		title: 'Setup',
		args: [
			{
				name: 'screen',
				default: 'mainmenu',
				desc: 'initial screen',
				values: Object.keys(screens.screens).sort()
			}
		]
	};
}

/**
 * Steps the user through the configuration of their Titanium environment.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 */
export async function run(logger, _config, _cli) {
	logger.log(`Enter ${cyan('ctrl-c')} at any time to quit.`);
	await screens.run();
}
