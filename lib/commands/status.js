/*
 * status.js: Titanium CLI status command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	async = require('async');

exports.desc = __('displays session information');

exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		noAuth: true,
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				desc: __('output format'),
				values: ['report', 'json']
			}
		}
	};
};

exports.run = function (logger, config, cli) {

	async.parallel({
		auth: function (next) {
			next(null, appc.auth.status());
		},
		project: function (next) {
			// TODO: Implement project status
			next(null, {});
		}
	}, function (err, results) {
		switch(cli.argv.output) {
			case 'report':
				logger.banner();
				if (results.auth.loggedIn) {
					logger.log(__('You are currently %s as %s', 'logged in'.cyan, results.auth.email.cyan) + '\n');
				} else {
					logger.log(__('You are currently %s', 'logged out'.cyan) + '\n');
				}
				break;
			case 'json':
				logger.log(JSON.stringify(results.auth));
				break;
		}
	});
};