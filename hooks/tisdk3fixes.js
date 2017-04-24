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

var appc = require('node-appc'),
	fs = require('fs'),
	path = require('path'),
	__ = appc.i18n(__dirname).__;

exports.cliVersion = '>=3.2';

exports.init = function (logger, config, cli, appc) {
	function getSDK() {
		return (cli.sdk && (cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name)) || (cli.manifest && cli.manifest.version);
	}

	cli.on('cli:go', function () {
		var sdk = getSDK();

		// starting in 3.2.1, we "fixed" the hook system, but 3.2.0 and older use the
		// old hook syntax, so we need to preserve it
		if (sdk && appc.version.lte(sdk, '3.2.0')) {
			cli._fireHookCallback = function (callback, err, data) {
				if (err) {
					callback(err);
				} else {
					callback(err, {}, data.result.shift());
				}
			};
		}
	});

	cli.on('cli:pre-validate', function (data) {
		var sdk = getSDK();

		// there was a bug in 3.2.0 where the --store-password was being forced to
		// --password when forking the correct SDK command with a SDK >= 3.2.0, so we
		// need to reverse it
		if (sdk && appc.version.gte(sdk, '3.2.0') && appc.version.lt(sdk, '4.0.0') && cli.argv.platform === 'android' && !cli.argv['store-password'] && cli.argv.password) {
			cli.argv['store-password'] = cli.argv.password;
		}
	});

	cli.on('cli:post-validate', function (data) {
		var sdk = getSDK();

		if (sdk && appc.version.gte(sdk, '3.0.0') && appc.version.lt(sdk, '3.2.0') && data.command.platform && /^ios|iphone$/.test(data.command.platform.name)) {
			// in the iOS build for SDK 3.0.0 through 3.1.x, the valid deploy types
			// are always "development" and "test" regardless of the target. that's
			// a bug. if the target changes, so should the array of valid deploy
			// types.
			switch (cli.argv.target) {
				case 'dist-adhoc':
				case 'dist-appstore':
					data.command.platform.options['deploy-type'].values = ['production'];
			}
		}

		// dont show warnings if output type is json
		if (cli.argv.output !== 'json' && data.command.name === 'build' && sdk && appc.version.lt(sdk, '3.2.0')) {
			logger.log('');
			logger.warn(__('Titanium ' + sdk + ' has been deprecated and will not work with future releases.'));
			logger.warn(__('Please use Titanium 3.2 or newer.'));
		}
	});

	// Titanium SDK 3.3.x and older does not support Xcode 6, so we try to remove it as if it never existed
	function removeXcode6(callback) {
		if (!cli.sdk || appc.version.gte(getSDK(), '3.4.0')) {
			return callback();
		}

		var detectFile = path.join(cli.sdk.platforms.iphone.path, 'cli', 'lib', 'detect.js');
		if (!fs.existsSync(detectFile)) {
			return callback();
		}

		require(detectFile).detect(config, null, function (iosInfo) {
			var validXcodes = 0;

			// remove all Xcodes that are 6.0 or newer
			Object.keys(iosInfo.xcode).forEach(function (ver) {
				if (appc.version.gte(iosInfo.xcode[ver].version, '6.0.0')) {
					delete iosInfo.xcode[ver];
				} else if (iosInfo.xcode[ver].supported) {
					validXcodes++;
				}
			});

			// remove all IOS_XCODE_TOO_NEW warnings
			for (var i = 0; i < iosInfo.issues.length; i++) {
				if (iosInfo.issues[i].id === 'IOS_XCODE_TOO_NEW') {
					iosInfo.issues.splice(i--, 1);
				}
			}

			if (!validXcodes) {
				iosInfo.issues.unshift({
					id: 'IOS_NO_SUPPORTED_XCODE_FOUND',
					type: 'warning',
					message: __('There are no supported Xcode installations found.')
				});
			}

			callback();
		});
	}

	cli.on('cli:command-loaded', function (data, done) {
		if (process.platform === 'darwin' && data.command.name === 'info') {
			// if we're running the 'info' command, then run the iOS detection and remove
			// Xcode 6 even if we're not displaying iOS info
			removeXcode6(done);
		} else {
			done();
		}
	});

	cli.on('build.config', {
		pre: function (data, done) {
			if (process.platform === 'darwin' && /^(ios|iphone|ipad)$/.test(cli.argv.platform || cli.argv.p)) {
				return removeXcode6(done);
			} else {
				done();
			}
		},
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
				ti = require(path.join(cli.sdk.path, 'node_modules', 'titanium-sdk', 'lib', 'titanium.js')),
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
