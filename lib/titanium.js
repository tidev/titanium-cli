/*
 * titanium.js: Top-level include for the titanium CLI
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */
console.log('hello');


var path = require("path"),
    colors = require("colors"),
	optimist = require("optimist"),
	fs = require("fs"),
	environ = require('./titanium/environ.js'),
	config = require('./titanium/config.js'),
	builtins = require('./titanium/builtins/builtins.js').builtins
	externals = require('./titanium/externals/externals.js').externals,
	log = require('./titanium/log.js'),
	analytics = require('./titanium/analytics.js'),
	pkginfo = require('pkginfo')(module, 'name', 'version');

var titanium = module.exports;

function banner()
{
	// yes, that's correct: ascii art FTW
	var prompt = [
		"________         __                                  ",
		"___  __/___(_)__  /_______ ________ ___(_)____  _________ ___", 
		"  / /   __  / _  __/_  __ `/__  __ \\__  / _  / / /__  __ `__ \\",
		" / /    _  /  / /_  / /_/ / _  / / /_  /  / /_/ / _  / / / / /",
		"/_/     /_/   \\__/  \\__,_/  /_/ /_/ /_/   \\__,_/  /_/ /_/ /_/"
	];
	console.log(prompt.join("\n").cyan);
	console.log();
	console.log("Welcome to ".white + "Titanium".bold.cyan + " - the open source mobile framework by".white + " Appcelerator".red.bold+" and contributors".white);
	console.log();
}

titanium.start = function(setup)
{
	setup();
	
	var cmd = optimist.argv._[0];
	var args = optimist.argv._.splice(1);
	var showBanner = optimist.argv.banner===false ? false : true;

	if (optimist.argv._.length < 1)
	{
		cmd = 'help';
	}
	if (optimist.argv.version && cmd=='help' || (cmd=='help' && args[0]=='version'))
	{
		args = ['version'];
		showBanner = false;
	}
	
	// turn off the colors
	if (optimist.argv.colors === false || config.config.colors === false)
	{
		colors.mode = "none";	
	}
	
	// turn off the analytics
	if (optimist.argv.analytics === false || config.config.analytics === false)
	{
		analytics.on = false;
	}
	
	// check for quiet settings
	if (optimist.argv.quiet)
	{
		log.quiet = true;
		showBanner = false;
	}
	
	if (showBanner)
	{
		banner();
	}

	// see if we have a log file
	if (optimist.argv.logpath || config.config.logpath)
	{
		log.logpath = optimist.argv.logpath || config.config.logpath;
		log.configure(cmd!='help');
	}
	
	if (!environ.ok)
	{
		//TODO: it would be nice to allow the user to install titanium directly from here
		log.error("It appears that no Titanium Mobile SDK could be found on this system. Please make sure to install before continuing.");
	}
	
	if (builtins[cmd])
	{
		require('./titanium/builtins/'+cmd+'.js').execute(module,environ,config.config,args,optimist.argv);
	}
	else if (externals[cmd])
	{
		require('./titanium/externals/externals.js').execute(module,environ,config.config,args,optimist.argv,cmd);
	}
	else
	{
		log.error("Couldn't find command: " + cmd.grey.bold + ".  You can run " + "titanium help commands".cyan.bold + " to get a list of all commands",2);
	}


	// TEST
	// config.config['b']=0xabc;
	// config.saveConfig();
};

