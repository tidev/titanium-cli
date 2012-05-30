/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require('fs'),
	colors = require('colors'),
	expandPath = require('./path.js').expandPath;

var fd;

function log(msg)
{
	if (fd)
	{
		// strip the colors, we don't want them in a logfile
		var m = colors.stripColors(msg);
		fs.writeSync(fd, m + "\n");
	}
}

function error (msg,exitCode)
{
	if (typeof msg === Array)
	{
		var newmsg = '';
		for (var c=0;c<msg.length;c++)
		{
			if (!msg[c].color)
			{
				msg[c] = msg[c].grey;
			}
			newmsg+=msg[c] + ' '; 
		}
		msg = newmsg;
	}
	var m = "[ERROR]".red.bold + " " + msg;
	if (!module.exports.quiet)
	{
		console.error(m);
	}
	log(m);
	cleanup();
	process.exit(exitCode || 1);
}

function info (msg)
{
	var m = "[INFO] ".blue.bold + " " + msg;
	if (!module.exports.quiet)
	{
		console.log(m);
	}
	log(m);
}

function debug (msg)
{
	var m = "[DEBUG]".grey.bold + " " + msg;
	if (!module.exports.quiet)
	{
		console.log(m);
	}
	log(m);
}

function warn (msg)
{
	var m = "[WARN] ".magenta.bold + " " + msg;
	if (!module.exports.quiet)
	{
		console.log(m);
	}
	log(m);
}

function configure(v)
{
	if (module.exports.logpath)
	{
		fd = fs.openSync(expandPath(module.exports.logpath),'w+');

	  	process.on('exit', cleanup);

		if (v) debug("Logging to file at " + module.exports.logpath.cyan.bold);
	}
}

function cleanup()
{
	if (fd)
	{
		fs.closeSync(fd);
		fd = null;
	}
}

module.exports.error = error;
module.exports.info = info;
module.exports.debug = debug;
module.exports.warn = warn;
module.exports.configure = configure;
module.exports.quiet = false;
module.exports.logpath = null;
