/*
 * status.js: Titanium CLI status command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

exports.config = function (logger, config, cli) {
	return {
		desc: __('displays session and project information'),
		options: {
			output: {
				alias: 'o',
				default: 'report',
				desc: 'output format',
				values: ['report', 'json', 'xml']
			}
		},
		args: [
			{
				desc: __('the directory where the project is located'),
				name: 'project-dir',
				required: true
			}
		]
	};
};

exports.run = function (logger, config, cli) {
	dump(cli.argv);
};