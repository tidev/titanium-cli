/**
 * Hook management system. Performs hook detection, registration, and emitting.
 *
 * @module hook
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires async
 * @requires node-appc
 * @requires semver
 */

module.exports = Hook;

var fs = require('fs'),
	path = require('path'),
	vm = require('vm'),
	async = require('async'),
	semver = require('semver'),
	appc = require('node-appc'),
	mix = appc.util.mix;

/**
 * Creates hook system.
 * @class
 * @classdesc Hook registry and dispatcher.
 * @constructor
 */
function Hook() {
	// legacy interface for Titanium SDK <3.2
	this.hooks = {
		scannedPaths: {},
		pre: {},
		post: {},
		loadedFilenames: [],
		incompatibleFilenames: [],
		erroredFilenames: []
	};
}

/**
 * @constant
 * @type {Number}
 * @default
 */
Hook.HOOK_PRIORITY_DEFAULT = 1000;

/**
 * Scans the specified path for hooks. Each hook is identified by a JavaScript
 * file.
 * @param {String} dir - A directory or JavaScript file to be scanned.
 */
Hook.prototype.scanHooks = function scanHooks(dir) {
	if (!this.hooks.scannedPaths[dir] && fs.existsSync(dir)) {
		var jsfile = /\.js$/,
			ignore = /^[\._]/,
			isDir = fs.statSync(dir).isDirectory();

		(isDir ? fs.readdirSync(dir) : [dir]).forEach(function (filename) {
			var file = isDir ? path.join(dir, filename) : filename;
			if (fs.existsSync(file) && fs.statSync(file).isFile() && jsfile.test(filename) && (!isDir || !ignore.test(path.basename(file)))) {
				try {
					vm.runInThisContext('(function (exports, require, module, __filename, __dirname) { ' + fs.readFileSync(file).toString() + '\n});', file, 0, false);
					var mod = require(file);
					if (!this.version || !mod.cliVersion || semver.satisfies(appc.version.format(this.version, 0, 3, true), mod.cliVersion)) {
						mod.init && mod.init(this.logger, this.config, this, appc);
						this.hooks.loadedFilenames.push(file);
					} else {
						this.hooks.incompatibleFilenames.push(file);
					}
				} catch (ex) {
					this.hooks.erroredFilenames.push(file);
				}
			}
		}, this);
		this.hooks.scannedPaths[dir] = 1;
	}
};

/**
 * Registers a callback to a hook.
 * @param {String} name - The event name
 * @param {Function|Object} callback - The function/object fired
 * @returns {Object} this
 * @example
 * cli.on('build.post.compile', {
 *     priority: 8000,
 *     post: function (build, finished) {
 *         // do awesome stuff here
 *         finished();
 *     }
 * });
 */
Hook.prototype.on = function on(name, callback) {
	var priority = Hook.HOOK_PRIORITY_DEFAULT;

	if (typeof callback == 'function') {
		callback = { post: callback };
	} else if (Object.prototype.toString.call(callback) == '[object Object]') {
		priority = parseInt(callback.priority) || priority;
	}

	if (callback.pre) {
		var h = this.hooks.pre[name] || (this.hooks.pre[name] = []);
		callback.pre.priority = priority;
		for (var i = 0; i < h.length && priority >= h[i].priority; i++) {}
		h.splice(i, 0, callback.pre);
	}

	if (callback.post) {
		var h = this.hooks.post[name] || (this.hooks.post[name] = []);
		callback.post.priority = priority;
		for (var i = 0; i < h.length && priority >= h[i].priority; i++) {}
		h.splice(i, 0, callback.post);
	}

	return this;
};

/**
 * Calls on().
 * @deprecated
 */
Hook.prototype.addHook = Hook.prototype.on;

/**
 * Fires an hook event. This function creates a 'function hook', then immediately
 * calls it, thus making it an 'event hook'.
 * @param {String} name - The hook name
 * @param {Object} [data] - The event payload
 * @param {Function} callback - A callback when the event has finished firing
 * @returns {Object} this
 */
Hook.prototype.emit = function emit(name, data, callback) {
	if (typeof data == 'function') {
		callback = data;
		data = null;
	}
	this.createHook(name, data)(callback);
	return this;
};

/**
 * Calls emit().
 * @deprecated
 */
Hook.prototype.fireHook = Hook.prototype.emit;

/**
 * Creates a hook. This is a multipurpose function that is capable of creating
 * 'event hooks' and 'function hooks'.
 * @param {String} name - The hook name
 * @param {Object} ctx - A context to bind the 'fn' param
 * @param {Function} fn - The function to call when the hook is running
 * @returns {Function} A new 'function hook'
 */
Hook.prototype.createHook = function createHook(name, ctx, fn) {
	var dataPayload = {},
		hooks = this.hooks,
		_t = this;

	if (typeof ctx == 'function') {
		fn = ctx;
		ctx = null;
	} else if (Object.prototype.toString.call(ctx) == '[object Object]' && !fn) {
		dataPayload = ctx;
		ctx = null;
	}

	return function () {
		var data = mix(dataPayload, {
				type: name,
				args: Array.prototype.slice.call(arguments),
				fn: fn,
				ctx: ctx
			}),
			callback = data.args.pop(),
			pres = hooks.pre[name] || [],
			posts = hooks.post[name] || [];

		// call all pre filters
		async.series(pres.map(function (pre) {
			return function (cb) {
				if (pre.length >= 2) {
					pre.call(ctx, data, function (err, _data) {
						_data && (data = _data);
						cb(err);
					});
				} else {
					pre.call(ctx, data);
					cb();
				}
			};
		}), function (preErr) {
			if (preErr) {
				callback && callback(preErr);
				return;
			}

			function next() {
				data.result = Array.prototype.slice.call(arguments);
				// call all post filters
				async.series(posts.map(function (post) {
					return function (cb) {
						if (post.length >= 2) {
							post.call(ctx, data, function (err, _data) {
								if (!err && _data && typeof _data == 'object' && _data.type) {
									data = _data;
								}
								cb(err);
							});
						} else {
							post.call(ctx, data);
							cb();
						}
					};
				}), function (postErr) {
					if (callback) {
						_t._fireHookCallback(callback, postErr, data);
					}
				});
			};

			if (data.fn) {
				// call the function
				data.args.push(next);
				data.fn.apply(data.ctx, data.args);
			} else {
				// just fire the event
				next();
			}
		});
	};
};

Hook.prototype._fireHookCallback = function _fireHookCallback(callback, err, data) {
	if (err) {
		callback(err);
	} else {
		callback.apply(null, data.result);
	}
};
