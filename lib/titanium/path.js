/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var fs = require("fs"),
	path = require("path");

function expandPath(p)
{
	if (process.platform == "win32") 
	{
		process.env.HOME = process.env.USERPROFILE;
	}
	var np = p.replace(/~\//g,process.env.HOME+'/');
	return np;
}

function pathExists(dir)
{
	try
	{
		var d = expandPath(dir);
		var stat = fs.statSync(d);
		return stat && stat.size > 0;
	}
	catch(e)
	{
		return false;
	}
}

function listAndSortVersions(dir)
{
	var listing = fs.readdirSync(dir);
	
	var dirs = [];
	
	// sort by OSGI version in reverse (newest) order first
	for (var c=0;c<listing.length;c++)
	{
		dirs[c] = [listing[c],listing[c].replace(/\./g,'')];
	}
	
	var sortedDirs = dirs.sort(function(a,b){
		if (a[0] == b[0]) return 0;
		if (a[0] < b[0]) return 1;
		return -1;
	});
	
	dirs = [];
	for (var c=0;c<sortedDirs.length;c++)
	{
		// all of our SDKs contain a README
		if (pathExists(path.join(dir,sortedDirs[c][0],'README')))
		{
			dirs.push(sortedDirs[c][0]);
		}
	}
	
	return dirs;
}



module.exports.pathExists = pathExists;
module.exports.listAndSortVersions = listAndSortVersions;
module.exports.expandPath = expandPath;
