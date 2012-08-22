/*
 * config.js: Titanium CLI config command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('get and set config options')
	};
};

exports.run = function (logger, config, cli) {
	dump(cli.argv);
};