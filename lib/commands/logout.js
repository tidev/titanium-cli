/*
 * logout.js: Titanium CLI logout command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('logs out of the Appcelerator network')
	};
};

exports.run = function (logger, config, cli) {
	dump(cli.argv);
};