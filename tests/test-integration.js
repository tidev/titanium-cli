/**
 * Titanium CLI
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('node-appc'),
	fs = require('fs'),
	path = require('path');

describe('integration', function () {

	describe('create: login, install latest SDK, create a project', function () {
		this.timeout(300000); // 5 mins because the SDK download can take a long time
		it('should log in', function (done) {
			appc.subprocess.run('node', ['bin/titanium', 'login', 'travisci@appcelerator.com', 'travisci'], function (err, stdout, stderr) {
				stdout.indexOf('successfully').should.be.ok
				done();
			});
		});
		it('should install the latest SDK version', function (done) {
			appc.subprocess.run('node', ['bin/titanium', 'sdk', 'install', 'latest', '-d', '-f'], function (err, stdout, stderr) {
				stdout.indexOf('successfully installed').should.be.ok
				done();
			});
		});
		it('should create a project', function (done) {
			appc.subprocess.run('node', ['bin/titanium', 'create', '-n', 'footest', '-d', path.resolve('.'), '--id', 'com.appcelerator.footest', '-p', 'mobileweb', '-t', 'app', '-u', 'http://www.example.com', '-f'], function (err, stdout, stderr) {
				fs.existsSync(path.join(path.resolve('.'), 'footest')).should.be.true;
				fs.existsSync(path.join(path.resolve('.'), 'footest', 'tiapp.xml')).should.be.true;
				deleteFolderRecursive(path.join(path.resolve('.'), 'footest'));
				done();
			});
		});
	});

});

/**
 * Deletes a folder and its contents synchronously
 * @param {String} folderPath - Directory to remove
 */
var deleteFolderRecursive = function(folderPath) {
	if (fs.existsSync(folderPath)) {
		fs.readdirSync(folderPath).forEach(function(file,index){
			var curPath = path.join(folderPath, file);
			if (fs.lstatSync(curPath).isDirectory()) {
				// recurse
				deleteFolderRecursive(curPath);
			} else {
				// delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(folderPath);
	}
};