#!/usr/bin/env node

/**
 * Titanium CLI JSDoc Bootstrap
 *
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var cp = require('child_process'),
	path = require('path'),
	wrench = require('wrench'),
	start = Date.now(),
	params = { cwd: path.join(__dirname, '..', '..') };

cp.spawn('which', [ 'jsdoc' ], params).on('exit', function (code) {
	if (code) {
		console.error('Unable to find "jsdoc". Please install it by running "npm install -g jsdoc".\n');
	} else {
		wrench.rmdirRecursive(path.join(params.cwd, 'docs'), function () {
			var child = cp.spawn('jsdoc', [ '-c', path.join('tools', 'docs', 'conf.json') ], params),
				out = '',
				outFn = function (data) { out += data.toString(); };

			child.stdout.on('data', outFn);
			child.stderr.on('data', outFn);

			child.on('exit', function (code) {
				if (code) {
					console.error('Error building docs:\n' + out + '\n');
				} else {
					console.log('Docs generated successfully in ' + (Math.round((Date.now() - start) / 100) / 10) + ' seconds\n');
				}
			});
		});
	}
});
