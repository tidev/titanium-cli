/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var pathExists = require('./path').pathExists;
var listAndSortVersions = require('./path').listAndSortVersions;
var fs = require('fs');
var log = require('./log.js');

function resolveTitaniumInstallPath()
{
	var path = require('path');
	var platform = process.platform;
	
	//
	// Update env if using Windows
	//
	if (process.platform == "win32") 
	{
		process.env.HOME = process.env.USERPROFILE;
	}
	else if (process.platform == "darwin") 
	{
		platform = "osx";
	}
    else if(process.platform == 'linux')
    {
        platform = 'linux';
    }
	
	// FIXME: we need to deal with non-OSX platforms
	
	var targets = [
		'~/Library/Application Support/Titanium',
		'/Library/Application Support/Titanium',
        path.join(process.env.HOME, '/.titanium')
	];
	
	//FIXME: make this smart about the install path based on platform
    if (platform == 'linux')
    {
        var basedir = path.join(process.env.HOME, "/.titanium");
    }
    else if(platform == 'osx')
    {
        var basedir = "/Library/Application Support/Titanium";
    }
	
	// construct an environ object which will contain the
	// details of whats installed on the local machine 
	var config = 
	{
		platform: platform,
		basedir: basedir,
		sdk:[],
		modules:{},
		ok:false
	};
	for (var c=0;c<targets.length;c++)
	{
		try
		{
			var dir = targets[c];
			if (pathExists(dir))
			{
				var mobilesdkDir = path.join(dir,'mobilesdk',platform);
				if (pathExists(mobilesdkDir))
				{
					var sdks = listAndSortVersions(mobilesdkDir);
					config.sdk = [];
					for (var x=0;x<sdks.length;x++)
					{
						config.sdk[x] = {version:sdks[x],path:path.join(mobilesdkDir,sdks[x])};
					}
					if (config.sdk.length > 0 && !config.ok)
					{
						config.ok = true;
					}
				}
				var moduleDir = path.join(dir,'modules');
				if (pathExists(moduleDir))
				{
					var modules = fs.readdirSync(moduleDir);
					for (var x=0;x<modules.length;x++)
					{
						// skip older desktop modules
						if (modules[x]=='win32' || modules[x]=='osx') continue;
						// skip the mac magic stuff
						if (modules[x]=='.DS_Store') continue;
						var modulePath = path.join(moduleDir,modules[x]);
						var moduleNames = fs.readdirSync(modulePath);
						config.modules[modules[x]] = [];
						for (var y=0;y<moduleNames.length;y++)
						{
							var i = moduleNames[y].indexOf('.zip');
							var moduleName = moduleNames[y];
							if (i==-1)
							{
								var moduleVers = fs.readdirSync(path.join(modulePath,moduleName));
								var o = {};
								o[moduleName]=moduleVers;
								config.modules[modules[x]].push(o);
							}
							else
							{
								var t = moduleName.substring(0,moduleName.length-4).split('-');
								var o = {};
								o[t[0]]=[t[2]];
								config.modules[t[1]].push(o);
							}
						}
					}
				}
			}
		}
		catch(e)
		{
			// oops...
			log.error(e);
		}
	}
	
	return config;
}

module.exports = resolveTitaniumInstallPath();
