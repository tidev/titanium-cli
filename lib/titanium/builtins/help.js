/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

/**
 * command: help
 * purpose: display help for this CLI
 *
 */
var builtins = require('./builtins.js').builtins,
	externals = require('../externals/externals.js').externals,
	log = require('../log.js'),
	string = require('../string.js');


function help(titanium, environ, config, args, params)
{
	// print any additional arguments
	console.log([
		"Sub-commands:".cyan.bold.underline,
		"",
		"  " + string.rpad("version",15) + "print the version of the CLI".grey,
		"  " + string.rpad("commands",15) + "print all available commands".grey,
	].join("\n"));
	console.log();
}

function execute (titanium, environ, config, args, params)
{
	if (args.length > 0)
	{
		var cmd = args[0];
		
		if (builtins[cmd])
		{
			console.log("Command:".cyan.bold.underline);
			console.log();
			console.log('  ' + string.rpad(cmd,15)  + builtins[cmd].grey);
			console.log();
			require('./'+cmd+'.js').help(titanium, environ, config, args, params, cmd);
		}
		else if (externals[cmd])
		{
			console.log("Command:".cyan.bold.underline);
			console.log();
			console.log('  ' + string.rpad(cmd,15)  + externals[cmd].grey);
			console.log();
			require('../externals/externals.js').help(titanium, environ, config, args, params, cmd);
		}
		else if (cmd == 'version')
		{
			console.log(titanium.exports.version);
		}
		else if (cmd == 'commands')
		{
			// make a listing of all available commands
			var commands = [];
			for (var k in builtins) { commands.push('  ' + string.rpad(k,15) + builtins[k].grey) }
			for (var k in externals) { commands.push('  ' + string.rpad(k,15) + externals[k].grey) }
			var prompt = [
				"Available Commands:".cyan.underline.bold,
				"",
				commands.join("\n"),
				""
			];
			console.log(prompt.join("\n"));
		}
		else 
		{
			// don't have that command
			log.error("I don't support the command "+cmd.red.bold);
		}
	}
	else
	{
		var prompt = [
			"Usage:".cyan.underline.bold,
			"",
			"   titanium [command] <arguments>",
			"",
			"",
			"Common Commands:".cyan.underline.bold,
			"",
			"To install latest SDK".cyan,
			"  titanium sdk install",
			"",
			"To create a project".cyan,
			"  titanium create",
			"",
			"To build a project".cyan,
			"  titanium build",
			"",
			"To run a project".cyan,
			"  titanium run",
			"",
			"To install a project".cyan,
			"  titanium install",
			// "",
			// "Other Commands:".cyan.underline.bold,
			// "  titanium login        " + "login of the Appcelerator cloud".grey,
			// "  titanium logout       " + "logout of the Appcelerator cloud".grey,
			// "  titanium clean        " + "fully clean project removing all generated files".grey,
			// "  titanium help         " + "get a detailed listing of all available commands".grey,
			// "",
			"To get a list of all available commands: ".cyan + "titanium help commands",
			"",
			"Common Examples:".cyan.underline.bold,
			"",
			"To create a titanium app for iOS, Android and Mobile Web".cyan,
			"   titanium create --platforms=ios,android,mobileweb --id=org.appcelerator.sample sample",
			"",
			"To build the project".cyan,
			"   titanium build --platforms=ios sample",
			""
		];
		console.log(prompt.join("\n"));
	}
}

module.exports.execute = execute;
module.exports.help = help;