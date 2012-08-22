/*
 * login.js: Titanium CLI login command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('logs into the Appcelerator network'),
		options: {
			user: {
				desc: __('user to log in as, if not already logged in'),
				required: true
			},
			password: {
				desc: __('the password to log in with'),
				required: true
			}
		}
	};
};

exports.run = function (logger, config, cli) {
	dump(cli.argv);
};