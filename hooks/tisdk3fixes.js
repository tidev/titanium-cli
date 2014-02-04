/**
 * This hook is designed to address issues with Titanium SDKs >=3.0.0 and <3.2.0.
 * It hooks into the CLI validation process to modify the build and Titanium SDK
 * commands and hooks.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('node-appc');

exports.cliVersion = '>=3.2';

exports.init = function (logger, config, cli) {
	cli.on('cli:go', function () {
		var sdk = (cli.sdk && cli.sdk.name) || (cli.manifest && cli.manifest.version);

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
		var sdk = (cli.sdk && cli.sdk.name) || (cli.manifest && cli.manifest.version);

		// there was a bug in 3.2.0 where the --store-password was being forced to
		// --password when forking the correct SDK command with a SDK >= 3.2.0, so we
		// need to reverse it
		if (sdk && appc.version.gte(sdk, '3.2.0') && cli.argv.platform == 'android' && !cli.argv['store-password'] && cli.argv.password) {
			cli.argv['store-password'] = cli.argv.password;
		}
	});

	cli.on('cli:post-validate', function (data) {
		var sdk = (cli.sdk && cli.sdk.name) || (cli.manifest && cli.manifest.version);

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
};
