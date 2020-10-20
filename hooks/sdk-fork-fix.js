/**
 * This hook is designed to address issues with forking of the projects correct SDK when the build
 * or clean commands are called with both a --project-directory option
 *
 * @copyright
 * Copyright (c) 2009-2020 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const fields = require('fields');
const path = require('path');

exports.cliVersion = '>=3.2';

exports.init = function (logger, config, cli, _appc) {
	function handleFork (data, commandName) {
		// Pretty much all versions of Titanium SDK incorrectly handle the situation where the <sdk-version>
		// in the tiapp.xml differs from selected SDK.
		//
		// 3.3.x and older calls ti.validateCorrectSDK() from the build command's validate() function
		// instead of the --project-dir validate() function.
		//
		// 3.4.0 and newer incorrectly call ti.validateCorrectSDK() from the --project-dir callback()
		// function instead of the validate() function. This is bad since the callback() function
		// will throw a GracefulShutdown exception in the middle of parsing args.
		//
		// To fix this, we noop the function for Ti SDK 3.4.0+ to prevent the GracefulShutdown exception
		// from being thrown. Then for all versions we augment the --project-dir validate() function to
		// call ti.validateCorrectSDK().
		//
		// Now, after we validate the project dir, we check if the tiapp.xml's <sdk-version> matches
		// the select Titanium SDK and if so, runs the build, otherwise it will fork the correct command
		// as initially intended.

		const pd = data.result[1].options['project-dir'];

		if (!pd || typeof pd.validate !== 'function') {
			return;
		}

		const tiPath = path.join(cli.sdk.path, 'node_modules', 'node-titanium-sdk', 'lib', 'titanium.js');

		const ti = require(tiPath); // eslint-disable-line security/detect-non-literal-require
		const realValidateCorrectSDK = ti.validateCorrectSDK;

		ti.validateCorrectSDK = function () {
			// just return true to trick the Titanium SDK 3.4.0+ build command --project-dir option's
			// callback into succeeding
			return true;
		};

		let origPrompt = pd.prompt;
		const origValidate = pd.validate;
		let gracefulShutdown = false;

		pd.validate = function (projectDir, callback) {
			return origValidate(projectDir, function (err, projectDir) {
				if (!err) {
					// if we don't have a tiapp loaded, then the --project-dir callback() wasn't
					// called, so just call it now
					if (!cli.tiapp) {
						projectDir = pd.callback(projectDir);
					}

					// force overwrite when validate() was called during prompting, otherwise
					// the value should be the same
					cli.argv['project-dir'] = projectDir;

					// now validate the sdk
					if (!realValidateCorrectSDK(logger, config, cli, commandName)) {
						throw new cli.GracefulShutdown();
					}
				}
				callback(err, projectDir);
			});
		};

		// SDKs prior to 9.3.0 did not set a prompt correctly on the --project-dir argument and let
		// the default prompting occur, if we detect that instance then just redirect
		if (commandName === 'clean' && origPrompt === undefined) {
			origPrompt = function prompt (callback) {
				callback(fields.file({
					promptLabel: 'Where is the __project directory__?',
					complete: true,
					showHidden: true,
					ignoreDirs: new RegExp(config.get('cli.ignoreDirs')), // eslint-disable-line security/detect-non-literal-regexp
					ignoreFiles: /.*/,
					validate: pd.validate
				}));
			};
		}

		pd.prompt = callback => {
			origPrompt(field => {
				field.validate = (projectDir, cb) => {
					try {
						pd.validate(projectDir, cb);
					} catch (err) {
						if (err instanceof cli.GracefulShutdown) {
							gracefulShutdown = true;
							return true;
						} else {
							cb(err);
						}
					}
				};
				const origFieldPrompt = field.prompt.bind(field);
				field.prompt = cb => {
					origFieldPrompt((err, value) => {
						if (err) {
							cb(err);
						} else if (gracefulShutdown) {
							// do nothing!
						} else {
							cb(null, value);
						}
					});
				};
				callback(field);
			});
		};
	}

	cli.on('build.config', {
		post: function (data) {
			handleFork(data, 'build');
		}
	});

	cli.on('clean.config', {
		post: function (data) {
			handleFork(data, 'clean');
		}
	});
};
