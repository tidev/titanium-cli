/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var assert = require('assert'),
	path = require('path'),
	hook = require('../lib/hook');

describe('hook', function () {
	it('namespace exists', function () {
		assert(typeof hook === 'function', 'expected hook API to be a function, not a ' + (typeof hook));
	});

	describe('#scanHooks()', function () {
		it('should find test hook', function () {
			var dir = path.join(__dirname, 'resources', 'hooks'),
				h = new hook;

			h.version = '3.2.0';
			h.scanHooks(dir);

			h.hooks.scannedPaths.should.have.ownProperty(dir);
			h.hooks.loadedFilenames.should.include(path.join(dir, 'testhook.js'));
			h.hooks.incompatibleFilenames.should.include(path.join(dir, 'oldhook.js'));
			h.hooks.erroredFilenames.should.include(path.join(dir, 'errorhook.js'));
		});
	});

	describe('#on()', function () {
		//
	});

	describe('#emit()', function () {
		//
	});

	describe('#createHook()', function () {
		//
	});
});
