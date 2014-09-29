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
		if (sdk && appc.version.gte(sdk, '3.2.0') && cli.argv.platform == 'android' && !cli.argv['store-password'] && cli.argv.password) {
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
			if (sdk && appc.version.lt(sdk, '3.4.0')) {
				// the plan is to wrap the project-dir callback and add the check to see if
				// we're using the correct SDK so we can fork as soon as possible
				// note: this logic was fixed in 3.4.0

				var titaniumFile = path.join(cli.sdk.path, 'node_modules', 'titanium-sdk', 'lib', 'titanium.js');

				// In Titanium SDK 3.2.3, the validateCorrectSDK() function call was moved from the --project-dir
				// callback into the validate() function because we needed to make sure all command line arguments
				// were processed before forking the correct SDK. In Titanium CLI 3.3.0, the command line parser
				// was completely rewritten and now properly handles arguments, so the validateCorrectSDK() can
				// be moved back into the callback() where it belongs. This has been corrected in Titanium SDK
				// 3.4.0, but needs to be monkey patched in 3.2.3 and 3.3.x.
				if (appc.version.gte(sdk, '3.2.3') && fs.existsSync(titaniumFile)) {
					var pd = data.result[1].options['project-dir'],
						orig = pd.callback;

					pd.callback = function (projectDir) {
						if (orig) {
							projectDir = orig(projectDir);
						}
						var ti = require(titaniumFile);
						if (!ti.validateCorrectSDK(logger, config, cli, 'build')) {
							throw new cli.GracefulShutdown;
						}
					};
				}
			}
		}
	});
};
