/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var config = require('./config.js').config;

function addEvent (name,payload)
{
	// allow the analytics to be turned off
	if (config.analytics === false || module.exports.on === false)
	{
		return;
	}

	// TODO: implement logging
	
	// ideally we would store to a local SQLite (or JSON file) and 
	// send when connected and store when not connected for later sending
	// this would be similar to what we do on the phone
}

module.exports.addEvent = addEvent;
module.exports.on = true;