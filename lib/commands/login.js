/*
 * login.js: Titanium CLI login command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('logs into the Appcelerator network'),
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
	dump(cli.argv);
};