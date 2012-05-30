/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require("fs"),
	path = require("path"),
	optimist = require("optimist"),
	pathExists = require('./path.js').pathExists,
	expandPath = require('./path.js').expandPath,
	log = require('./log.js');
	
function getConfigPath()
{
	if (process.platform == "win32") {
		process.env.HOME = process.env.USERPROFILE;
	}
	var p = optimist.argv.config || path.join(process.env.HOME,'.ticli');
	if (optimist.argv.config)
	{
		if (!pathExists(optimist.argv.config))
		{
			log.error("Could't find config path: "+optimist.argv.config.blue.bold.underline);
		}
	}
	return expandPath(p);
}	

var config = getConfigPath();

function loadConfig()
{
	if (pathExists(config))
	{
		try
		{
			var b = fs.readFileSync(config,'utf-8');
			return JSON.parse(b);
		}
		catch(e)
		{
		}
	}
	return {};
}

function saveConfig()
{
	fs.writeFileSync(config,JSON.stringify(module.exports.config),'utf-8');
}

module.exports.config = loadConfig();
module.exports.saveConfig = saveConfig;

	