/*
 * logger.js: Titanium CLI logger
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 *
 * Portions derived from winston under the MIT license.
 * Copyright (c) 2010 Charlie Robbins
 * https://github.com/flatiron/winston
 */

var path = require('path'),
	winston = require('winston'),
	common = require(path.join(path.dirname(require.resolve('winston')), 'winston', 'common.js')),
	config = require('./config'),
	consoul = new winston.transports.Console({
		level: config.cli.logLevel || 'warn',
		colorize: !!config.cli.colors
	}),
	logger = exports = module.exports = new winston.Logger({
		transports: [ consoul ],
		silent: !!config.cli.quiet
	}),
	origLoggerLog = logger.log,
	bannerEnabled = true;

logger.silence = function (val) {
	consoul.silent = val;
};

logger.setLevel = function (n) {
	consoul.level = n;
};

logger.log = function () {
	var args = Array.prototype.slice.call(arguments),
		padLevels = logger.padLevels;
	args.length || args.unshift(' '); // blank lines need 
	args[0] in logger.levels || args.unshift('_');
	logger.padLevels = false; // disable padding for general output
	origLoggerLog.apply(logger, args);
	logger.padLevels = padLevels;
	return logger;
};

require('pkginfo')(module, 'version', 'about');

logger.banner = function () {
	bannerEnabled && console.log(exports.about.name.cyan.bold + ', version ' + exports.version + '\n' + exports.about.copyright + '\n');
};

logger.bannerEnabled = function (b) {
	bannerEnabled = !!b;
};

// override the Console log() function to strip off the ':' after the level
consoul.log = function (level, msg, meta, callback) {
	if (this.silent) {
		return callback(null, true);
	}
	
	var self = this,
		output;
	
	if (level != '_') {
		msg = '\b\b' + msg;
	}
	
	output = common.log({
		colorize:    this.colorize,
		json:        this.json,
		level:       level,
		message:     level == 'error' ? msg.red : msg,
		meta:        meta,
		stringify:   this.stringify,
		timestamp:   this.timestamp,
		prettyPrint: this.prettyPrint,
		raw:         this.raw
	});
	
	if (/^\: /.test(output) && level == '_') {
		output = output.substring(2);
	}
	
	if (level === 'error' || level === 'debug') {
		console.error(output);
	} else {
		console.log(output);
	}
	
	self.emit('logged');
	callback(null, true);
};

// override the colorize() function so we can change the level formatting
winston.config.colorize = function (level) {
	return level == '_' ? '' : ('[' + level.toUpperCase() + '] ')[winston.config.allColors[level]];
};

logger.exception = function (ex) {
	if (ex.stack) {
		ex.stack.split('\n').forEach(logger.error);
	} else {
		logger.error(ex.toString());
	}
	logger.log();
};

// init the logger with sensible cli defaults
logger.cli();

// override levels, must be done after calling cli()
logger.setLevels({
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	_: 5 // generic log() call
});

// override colors, must be done after calling cli()
winston.addColors({
	trace: 'grey',
	debug: 'magenta'
});