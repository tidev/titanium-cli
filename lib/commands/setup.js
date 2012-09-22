/*
 * setup.js: Titanium CLI setup command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('../config'),
	appc = require('node-appc');

exports.config = function (logger, config, cli) {
	return {
		desc: __('run the setup wizard'),
		noAuth: true
	};
};

exports.validate = function (logger, config, cli) {
};

exports.run = function (logger, config, cli) {
	dump(cli.argv);
};
