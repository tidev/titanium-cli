/*
 * logout.js: Titanium CLI logout command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc');

exports.desc = __('logs out of the Appcelerator network');

exports.config = function (logger, config, cli) {
	return {
		noAuth: true
	};
};

exports.run = function (logger, config, cli) {
	appc.auth.logout(function (result) {
		logger.log(__('Logged out successfully') + '\n');
	});
};