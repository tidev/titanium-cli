/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */


var log = require('../log.js'),
	pathExists = require('../path.js').pathExists,
	expandPath = require("../path.js").expandPath,
	path = require('path'),
	string = require('../string.js'),
	fs = require('fs'),
	analytics = require('../analytics.js');

/**
 * these are the external commands that delegated to the SDK itself instead of packaged with the 
 * CLI.  this module will handle the delegation to the appropriate implementation which is bundled 
 * inside each version of the SDK.  we do this such that each version of the SDK can handle the
 * version specific commands.  
 */

// format: [command] [one liner description used by help]

module.exports.externals = 
{
	'create': "create a new project",
	'build': "build a project",
	'install': "install the built app/module",
	'run': "run the built app/module",
	'clean': "clean the project removing all generated and temp files"
};

function resolveSDKVersion (titanium, environ, config, args, params)
{
	if (!environ.sdk || environ.sdk.length == 0)
	{
		log.error("No SDK versions detected",3);
	}

	var project_dir = expandPath(params.d || params.dir || process.env.PWD);
	
	// SDK version resolution order:
	//
	// 1. look at the command line
	// 2. look at tiapp.xml in current project
	// 3. use the latest from environment
	//
	
	var ver = environ.sdk[0].version; // latest
	
	if (params.version)
	{
		ver = params.version;
	}
	else
	{
		// check to see if the project directory is passed in and if not, assume the current working directory
		var xml = path.join(project_dir,'tiapp.xml');
		if (pathExists(xml))
		{
			// just do some poor man parsing which is fast
			var fc = fs.readFileSync(xml,'utf-8');
			var x = fc.indexOf('<sdk-version>');
			if (x > 0)
			{
				var y = fc.indexOf('</sdk-version>',x);
				ver = fc.substring(x+13,y);
			}
		}
	}
	
	// make sure we have the full path
	var found = false;
	var sdkPath = null;
	for (var c=0;c<environ.sdk.length;c++)
	{
		if (environ.sdk[c].version == ver)
		{
			sdkPath = environ.sdk[c].path;
			found = true;
			break;
		}
	}
	
	if (!found)
	{
		log.error("Couldn't find the SDK version: " + ver.bold.cyan,3);
	}
	
	return {version:ver,path:sdkPath,projectDir:project_dir};
}

function help(titanium, environ, config, args, params, command)
{
	// print any additional arguments
	var params = invoke('help', titanium, environ, config, args, params, command);
	if (params)
	{
		console.log("Parameters:".cyan.bold.underline+"\n");
		for (var c=0;c<params.length;c++)
		{
			console.log("  "+params[c]);
		}
	}
}

function execute (titanium, environ, config, args, params, command)
{
	invoke('execute', titanium, environ, config, args, params, command);
}

function requireParam(name, params)
{
	if (params[name])
	{
		return params[name];
	}
	log.error('Required parameter ' + name.cyan.bold + ' not found');
}

function optionalParam(name, params, def)
{
	if (typeof name == Object || typeof name == Array || String(typeof name)=='object')
	{
		for (var c=0;c<name.length;c++)
		{
			var r = optionalParam(name[c],params,null);
			if (r)
			{
				return r;
			}
		}
		return def;
	}
	if (params[name])
	{
		return params[name];
	}
	return def;
}

function invoke (_method, titanium, environ, config, args, params, command)
{
	var sdk = resolveSDKVersion(titanium, environ, config, args, params);
	
	var commandDir = path.join(sdk.path,'cli-commands');

	// make sure this SDK supports external commands
	if (!pathExists(commandDir))
	{
		log.error("The "+sdk.version.cyan.bold+" of the SDK does not support this CLI tool",2);
	}

	// make sure this version of the SDK supports this command
	var commandPath = path.join(commandDir,command,command+'.js');
	if (!pathExists(commandPath))
	{
		log.error("The "+sdk.version.cyan.bold+" of the SDK appears to not support the command "+command.cyan.bold,2);
	}
	
	// provide a nice utils object that exposes our built-in utils that we want to give the externals
	var utils = {
		path: {
			pathExists:pathExists,
			expandPath:expandPath
		},
		log: log,
		string: string,
		sdk: sdk,
		analytics: analytics,
		require: requireParam,
		optional: optionalParam
	};

	// delegate to our SDK command
	return require(commandPath)[_method](titanium, environ, config, args, params, command, utils);
}

module.exports.help = help;
module.exports.execute = execute;
