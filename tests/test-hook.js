/**
 * Titanium CLI
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var assert = require('assert'),
	path = require('path'),
	Hook = require(__lib('hook'));

describe('hook', function () {
	it('namespace exists', function () {
		assert(typeof Hook === 'function', 'expected hook API to be a function, not a ' + (typeof Hook));
	});

	describe('#scanHooks()', function () {
		it('should find test hook', function () {
			var dir = path.join(__dirname, 'resources', 'hooks'),
				h = new Hook;

			h.version = '3.2.0';
			h.scanHooks(dir);

			h.hooks.scannedPaths.should.have.ownProperty(dir);
			h.hooks.loadedFilenames.should.include(path.join(dir, 'testhook.js'));
			h.hooks.incompatibleFilenames.should.include(path.join(dir, 'oldhook.js'));
			h.hooks.erroredFilenames.should.include(path.join(dir, 'errorhook.js'));
		});
	});

	describe('#on()', function () {
		it('should register pre and post hooks', function () {
			var h = new Hook;
			h.on('test', function () {});
			h.on('test', {
				post: function () {}
			});
			h.on('test-pre', {
				pre: function () {}
			});
			h.on('test-obj', {
				pre: function () {},
				post: function () {}
			});

			h.hooks.pre.should.have.ownProperty('test-pre');
			h.hooks.pre['test-pre'].should.have.length(1);

			h.hooks.pre.should.have.ownProperty('test-obj');
			h.hooks.pre['test-obj'].should.have.length(1);

			h.hooks.post.should.have.ownProperty('test');
			h.hooks.post['test'].should.have.length(2);

			h.hooks.post.should.have.ownProperty('test-obj');
			h.hooks.post['test-obj'].should.have.length(1);
		});
	});

	describe('#emit()', function () {
		it('should fire pre and post hooks', function (done) {
			var h = new Hook,
				counter = 0;

			h.on('test', {
				pre: function () {
					counter++;
				},
				post: function () {
					counter++;
				}
			});

			h.emit('test', function () {
				counter.should.equal(2);
				done();
			});
		});

		it('should fire pre and post hooks that have callbacks', function (done) {
			var h = new Hook,
				counter = 0;

			h.on('test', {
				pre: function (data, finished) {
					counter++;
					finished();
				},
				post: function (data, finished) {
					counter++;
					finished();
				}
			});

			h.emit('test', function () {
				counter.should.equal(2);
				done();
			});
		});
	});

	describe('#createHook()', function () {
		it('should create a function hook with null context and fire it', function (done) {
			// this test will multiply 2 * 3, but the pre-hook will multiple those by 2,
			// so this means 4 * 6 = 24. The post-hook then divides the result by 10 with
			// a final value of 2.4.

			var h = new Hook,
				fn = h.createHook('test', null, function (x, y, cb) {
					cb(null, x * y);
				});

			h.on('test', {
				pre: function (data) {
					data.args[0] *= 2;
					data.args[1] *= 2;
				},
				post: function (data) {
					data.result[1] /= 10;
				}
			});

			fn(2, 3, function (err, result) {
				result.should.equal(2.4);
				done();
			});
		});

		it('should create a function hook without a context and fire it', function (done) {
			// this test will multiply 2 * 3, but the pre-hook will multiple those by 2,
			// so this means 4 * 6 = 24. The post-hook then divides the result by 10 with
			// a final value of 2.4.

			var h = new Hook,
				fn = h.createHook('test', function (x, y, cb) {
					cb(null, x * y);
				});

			h.on('test', {
				pre: function (data) {
					data.args[0] *= 2;
					data.args[1] *= 2;
				},
				post: function (data) {
					data.result[1] /= 10;
				}
			});

			fn(2, 3, function (err, result) {
				result.should.equal(2.4);
				done();
			});
		});

		it('should create a event hook', function (done) {
			// this test will multiply 2 * 3, but the pre-hook will multiple those by 2,
			// so this means 4 * 6 = 24. The post-hook then divides the result by 10 with
			// a final value of 2.4.

			var h = new Hook,
				fn = h.createHook('test', { payload: 10 });

			h.on('test', function (data) {
				data.payload *= 2;
			});

			fn(function (err, result) {
				this.should.have.ownProperty('payload');
				this.payload.should.equal(20);
				done();
			});
		});
	});
});
