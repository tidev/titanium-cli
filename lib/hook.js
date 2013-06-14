/**
 * @overview
 * Hook management system. Performs hook detection, registration, and emitting.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

/**
 * Hook management system. Performs hook detection, registration, and emitting.
 * @module lib/hook
 */

module.exports = Hook;

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	semver = require('semver'),
	appc = require('node-appc'),
	afs = appc.fs,
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

// TODO: allow hooks to be individual js files

/**
 * Scans the specified path for hooks. Each hook is identified by a JavaScript
 * file.
 * @param {String} dir - A directory or JavaScript file to be scanned.
 */
Hook.prototype.scanHooks = function (dir) {
	if (!this.hooks.scannedPaths[dir] && afs.exists(dir)) {
		var jsfile = /\.js$/,
			ignore = /^[\._]/,
			isDir = fs.statSync(dir).isDirectory();

		(isDir ? fs.readdirSync(dir) : [dir]).forEach(function (filename) {
			var file = isDir ? path.join(dir, filename) : filename;
			if (fs.statSync(file).isFile() && jsfile.test(filename) && (!isDir || !ignore.test(path.basename(file)))) {
				try {
					var mod = require(file);
					if (!cli.version || !mod.cliVersion || semver.satisfies(cli.version, mod.cliVersion)) {
						this.hooks.loadedFilenames.push(file);
						mod.init && mod.init(logger, config, cli, appc);
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

	['pre', 'post'].forEach(function (type) {
		if (callback[type]) {
			var h = this.hooks[type][name] || (this.hooks[type][name] = []);
			callback[type].priority = priority;
			for (var i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback[type]);
		}
	}, this);

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
 * @param {*} data - The event payload
 * @param {Function} - A callback when the event has finished firing
 * @returns {Object} this
 */
Hook.prototype.emit = function emit(name, data, callback) {
	if (Object.prototype.toString.call(data) == '[object Object]') {
		this.createHook(name, data)(callback);
	} else if (typeof data == 'function') {
		this.createHook(name)(data);
	} else if (typeof callback == 'function') {
		this.createHook(name)(callback);
	}
	return this;
};

/**
 * Calls on().
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
		hooks = this.hooks;

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
				pre.call(ctx, data, function (e) {
					e && (data = e);
					cb();
				});
			};
		}), function () {
			var next = function (result) {
				data.result = result;
				// call all post filters
				async.series(posts.map(function (post) {
					return function (cb) {
						post.call(ctx, data, function (err, _data) {
							_data && (data = _data);
							cb(err, data);
						});
					};
				}), function (err, results) {
					callback && callback(err, results, data.result);
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
