/**
 * Runs unit tests.
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
		path = require('path'),
		args = Array.prototype.slice.call(arguments),
		p = args.indexOf('--debug');

	if (p != -1) {
		args.splice(p, 1);
		args.unshift('debug', path.join(rootDir, 'tests', 'run.js'));
	} else {
		args.unshift(path.join(rootDir, 'tests', 'run.js'));
	}

	var child = spawn(process.execPath, args, {
		cwd: rootDir,
		stdio: 'inherit'
	});
	child.on('close', function (code) {
		process.exit(code);
	});
};