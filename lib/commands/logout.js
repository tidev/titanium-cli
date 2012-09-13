/*
 * logout.js: Titanium CLI logout command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc');

exports.config = function (logger, config, cli) {
	return {
		desc: __('logs out of the Appcelerator network')
	};
};

exports.run = function (logger, config, cli) {
	appc.auth.logout(function (result) {
		if (result.error) {
			logger.log(__('Logout failed: %s', result.error) + '\n');
		} else {
			logger.log(__('Logged out successfully') + '\n');
		}
	});
};