/*
 * logout.js: Titanium CLI logout command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

exports.desc = __('logs out of the Appcelerator network');

exports.config = function (logger, config, cli) {
	return {
		noAuth: true
	};
};

exports.run = function (logger, config, cli) {
	appc.auth.logout(function (result) {
		if (result.alreadyLoggedOut) {
			logger.log(__('Already logged out') + '\n');
		} else {
			logger.log(__('Logged out successfully') + '\n');
		}
	}, config.cli.httpProxyServer);
};