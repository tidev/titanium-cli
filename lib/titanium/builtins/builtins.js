/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */


/**
 * these are the built-in commands that are handled and packaged with each version of the 
 * CLI instead of delegated to the SDK itself (which are called externals).
 */

module.exports.builtins = 
{
	'help': "provide usage information for this tool",
	'sdk': "manage SDK versions (download, list)",
	'login': "login to the Appcelerator cloud",
	'logout': "logout of the Appcelerator cloud"
};