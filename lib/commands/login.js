/**
 * @overview
 * The login command. Authenticates a user against the Appcelerator Network.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */

/** @module lib/commands/login */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

/** Login command description. */
exports.desc = __('logs into the Appcelerator network');

exports.config = function (logger, config, cli) {
	return {
		noAuth: true,
		args: [
			{
				name: 'username',
				desc: __('user to log in as, if not already logged in'),
				prompt: {
					default: config.user && config.user.email,
					label: __('Username'),
					error: __('Invalid username'),
					pattern: /\S+/
				},
				required: true
			},
			{
				name: 'password',
				desc: __('the password to log in with'),
				prompt: {
					label: __('Password'),
					error: __('Invalid password'),
					pattern: /\S+/
				},
				password: true,
				required: true
			}
		]
	};
};

exports.run = function (logger, config, cli) {
	appc.auth.login(cli.argv.username, cli.argv.password, function(result) {
		if (result.error) {
			if (result.error.type == 'AppcException') {
				result.error.dump(logger.error);
			} else {
				logger.error(result.error.toString().trim());
			}
			result.hasOwnProperty('loggedIn') && logger.error(__(result.loggedIn ? 'You are still logged in' : 'You are currently logged out'));
		} else {
			logger.log(__('Logged in successfully'));
		}
		logger.log();
	}, config.cli.httpProxyServer);
};