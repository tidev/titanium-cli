/* eslint-disable curly */
/* eslint-disable array-bracket-spacing */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-unused-vars */
/* eslint-disable security/detect-child-process */
/**
 * The purgetss command. Create a clean app.tss file with only the classes used in your XML Files.
 *
 * @module commands/purgetss
 *
 * @see ModuleSubcommands
 *
 * @copyright
 * Copyright (c) 2009-2015 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */
'use strict';
const { exec } = require('child_process');

/** Module command description. */
exports.desc = 'Create a clean app.tss file with only the classes used in your XML Files.';

/**
 * Returns the configuration for the module command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Module command configuration
 */
exports.config = function(logger, config, cli) {
	//
	return {
		skipSendingAnalytics: true,
		options: {
			modules: {
				default: 'false',
				values: ['true', 'false'],
				desc: 'Copy or Create the corresponding CommonJS module into `lib` folder.',
			},
			vendor: {
				skipValueCheck: true,
				values: ['fa', 'md', 'f7'],
				desc: 'Use any of these arguments to copy specific vendor:'
			}
		},
		args: [
			{
				name: 'init',
				desc: 'Create a `config.js` file for your project.'
			},
			{
				name: 'build',
				desc: 'Build a custom `tailwind.tss` file.'
			},
			{
				name: 'fonts',
				desc: 'Copy Font Awesome, Material Design or Framework7 Icons Fonts to your project.'
			},
			{
				name: 'build-fonts',
				desc: 'Build a custom `fonts.tss` file.'
			},
			{
				name: 'module',
				desc: 'Copy `purgetss.ui.js` module into your project’s `lib` folder.'
			},
		]
	};
};

/**
 * Displays all installed modules.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function(logger, config, cli, finished) {
	let options = '';
	try {
		if (cli.argv._.length === 0) {
			execCommand('purgetss');
		} else {
			cli.argv._.forEach(command => {
				switch (command) {
					case 'init':
						execCommand('purgetss init');
						break;
					case 'build':
						execCommand('purgetss build');
						break;
					case 'fonts':
						if (cli.argv.vendor) options += ` -v=${cli.argv.vendor}`;
						if (cli.argv.modules === 'true') options += ' --modules';
						execCommand(`purgetss fonts${options}`);
						break;
					case 'build-fonts':
						if (cli.argv.modules === 'true') options += ' --modules';
						execCommand(`purgetss build-fonts${options}`);
						break;
					case 'module':
						execCommand('purgetss module');
						break;
				}
			});
		}
	} catch (error) {
		//
	}
	finished();
};

function execCommand(currentCommand) {
	exec(currentCommand, (error, response) => {
		if (error && error.code === 127) {
			return console.log('\n::PurgeTSS:: First install purgetss globally using: [sudo] npm i purgetss -g');
		}
		return console.log(response);
	});
}
