/**
 * This hook is designed to address issues with Titanium SDKs >=3.0.0 and <3.2.0.
 * It hooks into the CLI validation process to modify the build and Titanium SDK
 * commands and hooks.
 *
 * @copyright
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

var appc = require('node-appc'),
	fs = require('fs'),
	path = require('path'),
	__ = appc.i18n(__dirname).__;

exports.cliVersion = '>=3.2';

exports.init = function (logger, config, cli, appc) {
	function getSDK() {
		return (cli.sdk && (cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name)) || (cli.manifest && cli.manifest.version);
	}

	cli.on('build.config', {
		post: function (data) {
			var sdk = getSDK();
			if (!sdk) {
				return;
			}

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

			var pd = data.result[1].options['project-dir'],
				tiPath = path.join(cli.sdk.path, 'node_modules', 'node-titanium-sdk', 'lib', 'titanium.js');

			if (!fs.existsSync(tiPath)) {
				tiPath = path.join(cli.sdk.path, 'node_modules', 'titanium-sdk', 'lib', 'titanium.js');
			}

			if (!fs.existsSync(tiPath)) {
				// we have bigger problems :(
				return;
			}

			var ti = require(tiPath),
				realValidateCorrectSDK = ti.validateCorrectSDK;

			if (pd && typeof pd.validate === 'function') {
				ti.validateCorrectSDK = function () {
					// just return true to trick the Titanium SDK 3.4.0+ build command --project-dir option's
					// callback into succeeding
					return true;
				};

				var origValidate = pd.validate;
				pd.validate = function (projectDir, callback) {
					return origValidate(projectDir, function (err, projectDir) {
						if (!err) {
							// if we don't have a tiapp loaded, then the --project-dir callback() wasn't
							// called, so just call it now
							if (!cli.tiapp) {
								projectDir = pd.callback(projectDir);
							}

							// now validate the sdk
							if (!realValidateCorrectSDK(logger, config, cli, 'build')) {
								throw new cli.GracefulShutdown();
							}
						}
						callback(err, projectDir);
					});
				};
			}
		}
	});
};
