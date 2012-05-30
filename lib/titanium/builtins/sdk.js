/*
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */


/**
 * command: download
 * purpose: download the SDK 
 *
 */

/**
 * TODO: need to support proxies (see jitsu for example of how they do it)
 */

var string = require('../string.js'),
	log = require('../log.js'),
	semver = require('semver'),
	request = require('request'),
	temp = require('temp'),
	fs = require('fs'),
	pathExists = require('../path.js').pathExists,
	util = require('util'),
	zip = require('zip'),
	path = require("path"),
	exec = require("child_process").exec;

var	branchesURL = 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/branches.json';
var branchURL = 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/index.json';
var zipURL = 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/';
var releaseURL = 'http://api.appcelerator.net/p/v1/release-list';

function help(titanium, environ, config, args, params)
{
	// print any additional arguments
	console.log([
		"Sub-commands:".cyan.bold.underline,
		"",
		"  " + string.rpad("install <latest|VER>",25) + "download the latest version (default) or a specific version (or range)".grey,
		"  " + string.rpad("list",25) + "print a list of installed SDK versions".grey,
		"  " + string.rpad("update",25) + "check to find the latest version of the SDK".grey,
	].join("\n"));
	console.log();
}

function progress(done)
{
	var cols = Math.min(80, process.stdout.getWindowSize()[0]);
	var num = Math.floor(cols * done);
	var str = '[' + string.rpad('',num,'#') + string.rpad('',cols-num,' ');
	//TODO: windows
	process.stdout.write('\x1b[?25l' + str + '] ' + String(((100*done).toFixed(0))+'%').grey + '\u000D');
}

function install (titanium, environ, config, args, params, details)
{
	var version = 'latest';
	if (args.length > 1)
	{
		version = args[1];
	}
	
	if (!details)
	{
	 	request(releaseURL, function(error, response, body)
		{
			if (!error)
			{
				if (response.statusCode==200)
				{
					var r = JSON.parse(body);
					var found = null;
					for (var c=0;c<r.releases.length;c++)
					{
						if (environ.platform == r.releases[c].os)
						{
							if (version == 'latest' || 
								r.releases[c].version == version)
							{
								if (version == 'latest') log.info('Latest version is '+r.releases[c].version.cyan);
								found = r.releases[c];
								break;
							}
						}
					}
					if (!found)
					{
						log.error("Couldn't find the requested version: "+version.cyan);
					}
					install(titanium, environ, config, args, params, found);
				}
				else
				{
					log.error("Didn't receive a valid response. Expected 200, received "+String(response.statusCode).cyan);
				}
			}
			else
			{
				log.error('Error received from server: '+error.red);
			}
		});
		
	}
	else
	{
		log.debug('Using install version URL: ' + details.url.cyan);
		var tempName = temp.path({suffix: '.zip'});
		var tempStream = fs.createWriteStream(tempName);
		var req =  request(details.url);
		var pipeResp =req.pipe(tempStream);
		var done = 0, total = 0;
		req.on('error',function(err){
			fs.unlinkSync(tempName);
			log.error('error retrieving download: ' +err.red);
		});
		req.on('response',function(req){
			done = total = req.headers['content-length'];
		});
		req.on('data',function(buffer){
			done -=buffer.length;
			progress(1 - done/total);
		});
		tempStream.on('close',function(e){
			process.stdout.write('\x1b[?12l\x1b[?25h\n');
			log.debug('Retrieved '+String(total).cyan+' bytes into '+tempName.cyan);
			extractSDK(titanium, environ, config, args, params, tempName, details.version||version);
		});
	}
}

function extractSDK(titanium, environ, config, args, params, file, version)
{
	if (!environ.ok)
	{
		// means we don't have an SDK installed. try to create our Titanium directory
		if (!pathExists(environ.basedir))
		{
			log.debug("Attempting to setup the Titanium SDK directory at " + environ.basedir.cyan);
			//TODO: better error checking and permissions checking
			//TODO: windows, linux
			fs.mkdirSync(environ.basedir);
		}
	}
	
	//NOTE: this zip library doesn't seem to preserve file attributes (such as executable bit)
	//so we're going to use normal unzip builtin to extract for unix-like OS
	if (environ.platform == 'osx' || environ.platform == 'linux')
	{
		var cmd = 'unzip -of  -qq "' + file + '" -d "' + environ.basedir + '"';
		log.debug('Running: '+cmd.cyan); 
		log.info('Unzipping distribution file ... one moment');
		exec(cmd, function(err, stdout, stderr){
			if (err)
			{
				log.error(stderr);
				log.error(err);
			}
			if (stdout) log.debug(stdout);
			log.info("The " + version.cyan + " version of the SDK is now installed");
			process.exit(0);
		});
	}
	else
	{
		var data = fs.readFileSync(file);
		var reader = zip.Reader(data);

		reader.forEach(function (entry) 
		{
			var pf = path.join(environ.basedir,entry.getName());
			if (entry.isDirectory())
			{
				if (!pathExists(pf))
				{
					try { fs.mkdirSync(pf); } catch(e){}
				}
			}
			else
			{
				log.debug(pf);
				fs.writeFileSync(pf,entry.getData());
			}
		});

		// delete the temporary file
		fs.unlinkSync(file);
	}
}

function list (titanium, environ, config, args, params)
{
	if (environ.sdk.length == 0)
	{
		console.log('No SDKs are installed');
		return;
	}
	for (var c=0;c<environ.sdk.length;c++)
	{
		var meta = environ.sdk[c];
		console.log(string.rpad(meta.version,20).cyan + meta.path.grey);
	}
}

function update (titanium, environ, config, args, params)
{
	log.debug('Fetching update versions from '+branchesURL.grey);
 	request(releaseURL, function(error, response, body)
	{
		if (!error)
		{
			if (response.statusCode==200)
			{
				var r = JSON.parse(body);
				var latest = null;
				for (var c=0;c<r.releases.length;c++)
				{
					if (environ.platform == r.releases[c].os)
					{
						latest = r.releases[c];
						break;
					}
				}
				if (latest)
				{
					environ.sdk[0].version='1';
					if(environ.sdk.length > 0 && environ.sdk[0].version == latest.version)
					{
						log.info('You have the latest version: '+latest.version.cyan.bold);
					}
					else
					{
						log.info('You do not have the latest version. The latest version is '+latest.version.cyan.bold);
						if (params.install)
						{
							// DO THE INSTALL
							log.info('Installing the latest version');
							install(titanium, environ, config, args, params, latest);
						}
						else
						{
							log.info('You can automagically install the latest version when using this command such as ' + 'titanium sdk update --install'.cyan.bold);
						}
					}
				}
			}
			else
			{
				log.error("Didn't receive a valid response. Expected 200, received "+String(response.statusCode).cyan);
			}
		}
		else
		{
			log.error('Error received from server: '+error);
		}
	});
}

function execute (titanium, environ, config, args, params)
{
	if (args.length == 0)
	{
		log.error('please specify a sub-command or run '+'titanium help sdk'.cyan+' for specific help on this command');
	}
	
	// console.log(environ);
	// process.exit(0);
	
	var subcmd = args[0];
	
	switch(subcmd)
	{
		case 'install':
		{
			install(titanium, environ, config, args, params);
			break;
		}
		case 'list':
		{
			list(titanium, environ, config, args, params);
			break;
		}
		case 'update':
		{
			update(titanium, environ, config, args, params);
			break;
		}
		default:
		{
			log.error('unsupported sub-commana: ' + subcmd.cyan);
			break;
		}
	}
	
}

module.exports.help = help;
module.exports.execute = execute;
