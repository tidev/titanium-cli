/**
 * The logout command. Ends a user's Appcelerator Network session.
 *
 * @module commands/logout
 *
 * @copyright
 * Copyright (c) 2009-2015 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */

var appc = require('node-appc'),
	__ = appc.i18n(__dirname).__;

/** Logout command description. */
exports.desc = __('logs into the Appcelerator network **deprecated**'.grey);

/** Command is deprecated, so hide it from help */
exports.hidden = true;

/**
 * This command has been deprecated and only shows a message.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
	logger.log(__('Command has been deprecated and has no effect.') + '\n');
	finished();
};
