/*
 * version.js: Titanium CLI version command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('print the version and exits')
	};
};

exports.run = function (logger, config, cli) {
	// don't have to do anything... by default the banner will be displayed
};