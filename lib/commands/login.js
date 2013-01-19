/*
 * login.js: Titanium CLI login command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

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
			logger.log(__('Login failed: %s', result.error) + '\n');
		} else {
			logger.log(__('Logged in successfully') + '\n');
		}
	}, config.cli.httpProxyServer);
};