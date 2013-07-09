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
		path = require('path');

	spawn(process.execPath, [
		path.join(rootDir, 'tests', 'run.js')
	].concat(Array.prototype.slice.call(arguments)), {
		cwd: rootDir,
		stdio: 'inherit'
	});
};