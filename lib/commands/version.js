/*
 * version.js: Titanium CLI version command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

exports.desc = __('print the version and exits');

exports.config = function (logger, config, cli) {
	return {
		noAuth: true
	};
};

exports.run = function (logger, config, cli) {
	// don't have to do anything... by default the banner will be displayed
};