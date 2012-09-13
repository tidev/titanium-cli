/*
 * status.js: Titanium CLI status command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	async = require('async');

exports.config = function (logger, config, cli) {
	return {
		desc: __('displays session information'),
		skipBanner: true,
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
			appc.auth.status(function(status) {
				next(null, status);
			});
		},
		project: function (next) {
			// TODO: Implement project status
			next(null, {});
		}},
		function (err, results) {

			switch(cli.argv.output) {
				case 'report':
					logger.banner();
					if (results.auth.loggedIn) {
						logger.log(__("You are currently logged in") + "\n");
					} else {
						if (results.auth.expired) {
							logger.log(__("You are not currently logged in. You must log in before using authenticated commands") + "\n");
						} else {
							logger.log(__("You are not currently logged in. Offline support available for %s",
								appc.time.prettyDiff(Date.now(), results.auth.offlineExpires, {
									showFullName: true,
									hideMS: true,
									colorize: true
								})) + "\n");
						}
					}
					break;
				case 'json':
					logger.log(JSON.stringify(results.auth));
					break;
			}
		});
};