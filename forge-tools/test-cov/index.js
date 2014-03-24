/**
 * Generates lib-cov files, then runs all unit tests and an html-based
 * coverage report.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

module.exports = function () {
	var spawn = require('child_process').spawn,
		fs = require('fs'),
		path = require('path'),
		colors = require('colors'),
		wrench = require('wrench'),
		args = Array.prototype.slice.call(arguments);

	console.log('Code Coverage Tool'.cyan.bold + ' - Copyright (c) 2012-' + (new Date).getFullYear() + ', Appcelerator, Inc.  All Rights Reserved.\n');

	which('jscoverage', function (code) {
		if (code) {
			console.error('ERROR: Unable to find "jscoverage".\n\n'.red
				+ 'You can download it by visiting "https://github.com/visionmedia/node-jscoverage" or by running:\n\n'
				+ '   git clone https://github.com/visionmedia/node-jscoverage.git\n'
				+ '   cd node-jscoverage\n'
				+ '   configure\n'
				+ '   make\n'
				+ '   sudo make install\n');
			process.exit(1);
		} else {
			var startTime = Date.now();
			console.log('Generating lib-cov...');

			wrench.rmdirSyncRecursive(path.join(rootDir, 'lib-cov'), true);
			var child = spawn('jscoverage', ['lib', 'lib-cov'], { cwd: rootDir }),
				err = '';

			child.stderr.on('data', function (data) {
				err += data.toString();
			});

			child.on('close', function (code) {
				if (code) {
					console.error('\nERROR: jscoverage failed (' + code + ')\n'.red);
					err && console.error(err.trim() + '\n');
				} else {
					console.log('lib-cov generation completed successfully in ' + (Date.now() - startTime) + ' ms\n');

					startTime = Date.now();
					console.log('Generating coverage.html...');

					var coverageFile = path.join(rootDir, 'coverage.html');
					fs.existsSync(coverageFile) && fs.unlinkSync(coverageFile);

					process.env.APPC_COV = path.join(__dirname, 'templates');

					var test = spawn(process.execPath, [ path.join(rootDir, 'tests', 'run.js') ].concat(args), {
							env: process.env,
							cwd: rootDir
						}),
						output = '';

					test.stdout.on('data', function (data) {
						output += data.toString();
					});

					test.stderr.pipe(process.stderr);

					test.on('close', function (code) {
						if (!code) {
							fs.writeFileSync(coverageFile, output);
							console.log('coverage.html generated successfully in ' + (Date.now() - startTime) + ' ms\n');
						} else {
							console.error(output);
						}

						process.exit(code);
					});
				}
			});
		}
	});
};