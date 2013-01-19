/*
 * sdk.js: Titanium CLI SDK command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var async = require('async'),
	fs = require('fs'),
	request = require('request'),
	temp = require('temp'),
	wrench = require('wrench'),
	prompt = require('prompt'),
	appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	addAnalyticsEvent,
	urls = {
		branches: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/branches.json',
		branch: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/index.json',
		build: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/$FILENAME',
		releases: 'http://api.appcelerator.net/p/v1/release-list'
	};

exports.title = __('SDK');
exports.desc = __('manages installed Titanium SDKs');

exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: {
			install: {
				desc: __('download the latest Titanium SDK or a specific version'),
				args: [
					{
						abbr: 'v',
						default: 'latest',
						desc: __('the version to install or "latest"'),
						name: 'version',
						required: true
					}
				],
				flags: {
					force: {
						abbr: 'f',
						desc: __('force re-install')
					},
					default: {
						abbr: 'd',
						desc: __('set as default SDK'),
					}
				},
				options: {
					branch: {
						abbr: 'b',
						desc: __('the branch to install from or "latest" (stable)'),
						hint: __('branch name')
					}
				}
			},
			uninstall: {
				desc: __('uninstall a specific Titanium SDK version'),
				args: [
					{
						abbr: 'v',
						desc: __('the version to uninstall'),
						name: 'version',
						required: true
					}
				],
				flags: {
					force: {
						abbr: 'f',
						desc: __('force uninstall without confirmation')
					}
				}
			},
			list: {
				desc: __('print a list of installed SDK versions'),
				noAuth: true,
				flags: {
					branches: {
						abbr: 'b',
						desc: __('retreive and print all branches')
					},
					releases: {
						abbr: 'r',
						desc: __('retreive and print all releases')
					}
				},
				options: {
					output: {
						abbr: 'o',
						default: 'report',
						desc: __('output format'),
						values: ['report', 'json']
					}
				}
			},
			select: {
				desc: __('used to select which installed Titanium SDK is the active SDK'),
				noAuth: true
			},
			update: {
				desc: __('check to find the latest version of the Titanium SDK'),
				flags: {
					install: {
						abbr: 'i',
						desc: __('install latest version'),
					},
					force: {
						abbr: 'f',
						desc: __('force install of latest version')
					},
					default: {
						abbr: 'd',
						desc: __('set as default SDK'),
					}
				},
				options: {
					branch: {
						abbr: 'b',
						desc: __('the branch to update from'),
						hint: __('branch name')
					}
				}
			}
		}
	};
};

exports.run = function (logger, config, cli) {
	addAnalyticsEvent = cli.addAnalyticsEvent;
	
	function onComplete(err, ver) {
		if (err) {
			logger.log();
			logger.error(err);
			logger.log();
			process.exit(1);
		} else if (cli.argv.default) {
			logger.log(__('Saving SDK %s as the default.', ver.cyan));
			config.app.sdk = ver;
			config.save();
		}
	}
	
	var subcmd = cli.argv._.shift();
	subcmd != 'list' && logger.banner();
	
	switch (subcmd) {
		case 'install':
			install(logger, config, cli.argv, cli.env, onComplete);
			break;
		
		case 'uninstall':
			uninstall(logger, cli.argv, cli.env, config);
			break;
		
		case 'list':
			list(logger, config, cli.argv, cli.env);
			break;
		
		case 'update':
			update(logger, config, cli.argv, cli.env, onComplete);
			break;
		
		case 'select':
			select(logger, config, config.app && config.app.sdk, cli.argv, cli.env);
			break;
		
		default:
			logger.error(__('Invalid subcommand "%s"', subcmd) + '\n');
			appc.string.suggest(subcmd, ['install', 'uninstall', 'list', 'update', 'select'], logger.log);
			process.exit(1);
	}
};

function fetch(url, desc, logger, config, callback, errback) {
	request({
		url: url,
		proxy: config.cli.httpProxyServer || undefined
	}, function (error, response, body) {
		if (error) {
			logger.error(__('Failed to retrieve %s: %s', desc, error.toString()) + '\n');
			errback ? errback() : process.exit(1);
		}
		
		if (response.statusCode != 200) {
			logger.error(__('Failed to retrieve %s: expected 200, got %s', desc, response.statusCode) + '\n');
			errback ? errback() : process.exit(1);
		}
		
		var data;
		try {
			data = JSON.parse(body);
		} catch (ex) {
			logger.error(__('Unable to parse %s results', desc) + '\n');
			errback ? errback() : process.exit(1);
		}
		
		callback(data);
	});
}

function getBranches(logger, config, callback, errback) {
	fetch(urls.branches, 'list of branches', logger, config, callback, errback);
}

function getReleases(logger, config, os, callback, errback) {
	fetch(urls.releases, 'list of releases', logger, config, function (data) {
		var releases = {};
		data && data.releases && data.releases.forEach(function (r) {
			r.os == os && r.name == 'mobilesdk' && (releases[r.version] = r.url);
		});
		callback && callback(releases);
	}, errback);
}

function downloadSDK(logger, config, url, version, env, onComplete) {
	logger.log(__('Downloading %s', url.cyan));
	
	var tempName = temp.path({suffix: '.zip'}),
		tempStream = fs.createWriteStream(tempName),
		req = request({
			url: url,
			proxy: config.cli.httpProxyServer || undefined
		});
	
	req.pipe(tempStream);
	
	req.on('error', function (err) {
		fs.unlinkSync(tempName);
		logger.error(__('Failed to download SDK: %s', err.toString()));
	});
	
	req.on('response', function (req) {
		var total = parseInt(req.headers['content-length']),
			bar = new appc.progress('  :paddedPercent [:bar] :etas', {
				complete: '='.cyan,
				incomplete: '.'.grey,
				width: 40,
				total: total
			}),
			http = require('http');
		
		if (req.statusCode >= 400) {
			onComplete(__('Request failed with HTTP status code %s %s', req.statusCode, http.STATUS_CODES[req.statusCode] || ''));
		} else {
			req.on('data', function (buffer) {
				bar.tick(buffer.length);
			});
			
			tempStream.on('close', function () {
				bar.tick(total);
				logger.log('\n');
				extractSDK(logger, tempName, version, env, onComplete);
			});
		}
	});
}

function extractSDK(logger, filename, version, env, onComplete) {
	logger.log(__('Extracting SDK...'));
	appc.zip.unzip(filename, env.installPath, function (error) {
		fs.unlinkSync(filename);
		if (error) {
			logger.log('\n' + __('Titanium SDK %s installed, but with errors.', version.cyan) + '\n');
			logger.log(error);
			process.exit(1);
		} else {
			logger.log('');
			onComplete && onComplete(null, version);
			logger.log(__('Titanium SDK %s successfully installed!', version.cyan) + '\n');
			process.exit(0);
		}
	});
}

function getBranch(logger, config, branches, argv, env, callback) {
	var branch = argv.branch,
		version = argv._[0] || 'latest';
	
	if (branch == 'latest') {
		branches.sort().reverse();
		for (var i = 0; i < branches.length; i++) {
			if (branches[i] != 'master') {
				branch = branches[i];
				break;
			}
		}
	} else if (!~branches.indexOf(branch)) {
		logger.error(__('Branch "%s" does not exist', argv.branch) + '\n');
		appc.string.suggest(argv.branch, branches, logger.log, 2);
		logger.log(__("Run '%s' for a list of all branches.", (argv.$ + ' sdk list --branches').cyan) + '\n');
		process.exit(1);
	}
	
	fetch(urls.branch.replace(/\$BRANCH/, branch), 'list of builds', logger, config, function (data) {
		var builds = {},
			re = new RegExp('-' + env.os.name + '\.zip$'),
			reFilename = new RegExp('^(mobilesdk-)(.*)(-' + env.os.name + '.zip)$');
		for (var i = 0; i < data.length; i++) {
			re.test(data[i].filename) && data[i].build_type == 'mobile' && (builds[data[i].filename.replace(reFilename, '$2')] = data[i].filename);
		}
		version == 'latest' && (version = Object.keys(builds).sort().reverse().shift());
		callback(branch, version, builds[version]);
	});
}

function install(logger, config, argv, env, onComplete) {
	if (argv.branch) {
		getBranches(logger, config, function (data) {
			if (!data || !data.branches.length) {
				logger.error(__('No branches found') + '\n');
				process.exit(1);
			}
			
			getBranch(logger, config, data.branches, argv, env, function (branch, version, filename) {
				if (!argv.force && env.sdks[version]) {
					logger.error(__('SDK "%s" is already installed!', version) + '\n');
					logger.log(__("Run '%s' to re-install.", (argv.$ + ' sdk install ' + version + ' --force --branch ' + branch).cyan) + '\n');
					process.exit(1);
				}
				downloadSDK(logger, config, urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, filename), version, env, onComplete);
				addAnalyticsEvent('sdk.install', {
					version: version,
					branch: branch,
				});
			});
		});
	} else {
		getReleases(logger, config, env.os.name, function (releases) {
			var names = Object.keys(releases) || [],
				version = argv._[0] || 'latest',
				isLatest = version == 'latest';
			
			if (!names.length) {
				logger.error(__('No releases found') + '\n');
				process.exit(1);
			}
			
			isLatest && (version = names.sort().reverse()[0]);
			
			if (!~names.indexOf(version)) {
				logger.error(__('Invalid version "%s"', version) + '\n');
				appc.string.suggest(version, names, logger.log, 1);
				logger.log(__("Run '%s' for available releases.", (argv.$ + ' sdk list --releases').cyan) + '\n');
				process.exit(1);
			}
			
			if (!argv.force && env.sdks[version]) {
				if (isLatest) {
					logger.log(__("You're up-to-date. Version %s is currently the newest version available.", version.cyan) + '\n');
				} else {
					logger.error(__('SDK "%s" is already installed!', version) + '\n');
				}
				logger.log(__("Run '%s' to re-install.", (argv.$ + ' sdk install ' + version + ' --force').cyan) + '\n');
				process.exit(1);
			}
			
			isLatest && logger.log(__('New version available! %s', version.cyan) + '\n');
			
			downloadSDK(logger, config, releases[version], version, env, onComplete);
			addAnalyticsEvent('sdk.install', {
				version: version
			});
		});
	}
}

function uninstall(logger, argv, env, config) {
	var version = ''+argv._.shift(),
		validate = require('revalidator').validate;
	
	if (!version) {
		logger.error(__('No version specified') + '\n');
		process.exit(1);
	}
	
	if (!env.sdks[version]) {
		logger.error(__('Version %s is not installed', version) + '\n');
		process.exit(1);
	}
	
	function removeSDK(err, data) {
		if (err) {
			logger.log('\n');
			process.exit(1);
		}
		
		data && logger.log();
		
		// sanity check
		if (appc.fs.exists(env.sdks[version].path)) {
			logger.log(__('Removing SDK directory %s', env.sdks[version].path.cyan));
			try {
				wrench.rmdirSyncRecursive(env.sdks[version].path);
				
				delete env.sdks[version];
				
				if (config.app.sdk == version) {
					config.app.sdk = Object.keys(env.sdks).sort().reverse().shift() || 'latest';
					config.save();
					logger.log(__('Updated active Titanium SDK to %s', config.app.sdk.cyan));
				}
				
				logger.log(__('Successfully uninstalled Titanium SDK %s', version.cyan) + '\n');
			} catch (e) {
				logger.log();
				logger.error(__('An error occurred trying to remove the Titanium SDK folder') + '\n');
				logger.log(e.toString() + '\n');
			}
		}
	}
	
	if (argv.force) {
		removeSDK();
	} else {
		// overwrite prompt settings and render function
		prompt.colors = false;
		prompt.delimiter = prompt.message = '';
		prompt._performValidation = function (name, prop, against, schema, line, callback) {
			var result = { valid: false },
				msg,
				errorMsg = prop.schema.errorMsg;
			
			try {
				result = validate(against, schema);
			} catch (err) {
				if (err.type == 'AppcException') {
					logger.error(err.message);
					err.details.forEach(function (line) {
						logger.log(line);
					});
					return false;
				} else {
					return (line !== -1) ? callback(err) : false;
				}
			}
			
			if (!result.valid) {
				if (errorMsg) {
					logger.error(errorMsg);
				} else {
					msg = line !== -1 ? 'Invalid input for ' : 'Invalid command-line input for ';
					logger.error(msg + name.stripColors);
					prop.schema.message && logger.error(prop.schema.message);
				}
				
				prompt.emit('invalid', prop, line);
			}
			
			return result.valid;
		};
		
		prompt.start();
		prompt.get({
			properties: {
				confirm: {
					conform: function (version) {
						return !!env.sdks[version];
					},
					errorMsg: 'Incorrect version match, try again',
					description: 'Enter "'.bold.grey + version.cyan + '" to confirm uninstall:'.bold.grey,
					required: true
				}
			}
		}, removeSDK);
	}
}

function list(logger, config, argv, env) {
	var tasks = [],
		activeSDK = config.app && config.app.sdk;
	
	argv.releases && tasks.push(function (callback) {
		getReleases(logger, config, env.os.name, function (data) {
			callback(null, { type:'releases', data:data });
		});
	});
	
	argv.branches && tasks.push(function (callback) {
		getBranches(logger, config, function (data) {
			callback(null, { type:'branches', data:data });
		});
	});
	
	async.parallel(tasks, function (err, results) {
		var vers = Object.keys(env.sdks).sort().reverse();
		
		if ((!activeSDK || activeSDK == 'latest') && vers.length) {
			activeSDK = vers[0];
		}
		
		if (argv.output == 'json') {
			var obj = {
				activeSDK: activeSDK,
				installed: {},
				releases: {}
			};
			
			vers.forEach(function (v) {
				obj.installed[v] = env.sdks[v].path;
			});
			
			results.forEach(function (r) {
				if (r.type == 'releases') {
					obj.releases = r.data;
				} else if (r.type == 'branches') {
					appc.util.mix(obj, r.data);
				}
			});
			
			logger.log(JSON.stringify(obj, null, '\t'));
		} else {
			logger.banner()
			if (!vers.length) {
				logger.log(__('No SDKs are installed') + '\n');
				return;
			}
			
			var activeLabel = ' ' + __('[active]'),
				maxlen = vers.reduce(function (a, b) {
					return Math.max(a, b.length + (b == activeSDK ? activeLabel.length : 0));
				}, 0),
				activeValid = false;
			
			logger.log(__('Installed SDKs:'));
			vers.forEach(function (v) {
				var d = v == activeSDK ? activeLabel : '',
					n = maxlen + 2 - v.length - d.length;
				activeValid = activeValid || v == activeSDK;
				logger.log('   ' + v.cyan + d.grey + new Array(n + 1).join(' ') + env.sdks[v].path);
			});
			logger.log();
			
			results.forEach(function (r) {
				switch (r.type) {
					case 'releases':
						logger.log(__('Releases:'));
						var i = 0,
							data = r.data;
						Object.keys(data).sort().reverse().forEach(function (r) {
							logger.log('   ' + r.cyan + (env.sdks.hasOwnProperty(r) ? ' ' + __('[installed]') : '') + (i++ == 0 ? ' ' + __('[latest]') : ''));
						});
						i || logger.log('   ' + __('No releases found'));
						logger.log();
						break;
					
					case 'branches':
						logger.log(__('Branches:'));
						var data = r.data;
						if (data && data.branches.length) {
							data.branches.sort().reverse().forEach(function (b) {
								logger.log('   ' + b.cyan + (b == data.activeBranch ? ' ' + __('[active]') : ''));
							});
						} else {
							logger.log('   ' + __('No branches found'));
						}
						logger.log();
				}
			});
			
			if (!activeValid) {
				logger.error(__('Active Titanium SDK %s is not found', activeSDK) + '\n');
				logger.log(__('Run %s to set the active Titanium SDK', (argv.$ + ' sdk select <sdk-version>').cyan) + '\n');
			}
		}
	});
}

function update(logger, config, argv, env, onComplete) {
	if (argv.branch) {
		getBranches(logger, config, function (data) {
			if (!data || !data.branches.length) {
				logger.error(__('No branches found') + '\n');
				process.exit(1);
			}
			
			getBranch(logger, config, data.branches, argv, env, function (branch, version, filename) {
				if (!argv.force && env.sdks[version]) {
					logger.log(__("You're up-to-date. Version %s is currently the newest version available.", version.cyan) + '\n');
					logger.log(__("Run '%s' to re-install.", (argv.$ + ' sdk install ' + version + ' --force --branch ' + branch).cyan) + '\n');
					process.exit(1);
				}
				downloadSDK(logger, config, urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, filename), version, env, onComplete);
				addAnalyticsEvent('sdk.update', {
					version: version,
					branch: branch,
				});
			});
		});
	} else {
		getReleases(logger, config, env.os.name, function (releases) {
			var latest = Object.keys(releases).shift();
			if (!argv.force && env.sdks[latest]) {
				logger.log(__("You're up-to-date. Version %s is currently the newest version available.", latest.cyan) + '\n');
			} else if (argv.force || argv.install) {
				downloadSDK(logger, config, releases[latest], latest, env, onComplete);
				addAnalyticsEvent('sdk.update', {
					version: latest
				});
			} else {
				logger.log(__('New version available! %s', latest.cyan) + '\n');
				logger.log(__("Run '%s' to download and install", (argv.$ + ' sdk update --install').cyan) + '\n');
			}
		});
	}
}

function select(logger, config, activeSDK, argv, env) {
	var vers = Object.keys(env.sdks).sort().reverse(),
		selected = argv._.shift(),
		activeLabel = ' ' + __('[active]'),
		maxlen = vers.reduce(function (a, b) {
			return Math.max(a, b.length + (b == activeSDK ? activeLabel.length : 0));
		}, 0),
		prompt = require('prompt'),
		validate = require('revalidator').validate;
	
	if (!vers.length) {
		logger.log(__('No SDKs are installed') + '\n');
		return;
	}
	
	if (selected == 'latest' && vers.length) {
		selected = vers[0];
	}
	
	if (selected && vers.indexOf(selected) != -1) {
		config.app.sdk = selected;
		config.save();
		logger.log(__('Configuration saved') + '\n');
		process.exit(0);
	}
	
	if ((!activeSDK || activeSDK == 'latest') && vers.length) {
		activeSDK = vers[0];
	}
	
	logger.log(__('Installed SDKs:'));
	vers.forEach(function (v) {
		var d = v == activeSDK ? activeLabel : '',
			n = maxlen + 2 - v.length - d.length;
		logger.log('   ' + v.cyan + d.grey + new Array(n + 1).join(' ') + env.sdks[v].path);
	});
	logger.log();
	
	// overwrite prompt settings and render function
	prompt.colors = false;
	prompt.delimiter = prompt.message = '';
	prompt._performValidation = function (name, prop, against, schema, line, callback) {
		var result = { valid: false },
			msg,
			errorMsg = prop.schema.errorMsg;
		
		try {
			result = validate(against, schema);
		} catch (err) {
			if (err.type == 'AppcException') {
				logger.error(err.message);
				err.details.forEach(function (line) {
					logger.log(line);
				});
				return false;
			} else {
				return (line !== -1) ? callback(err) : false;
			}
		}
		
		if (!result.valid) {
			if (errorMsg) {
				logger.error(errorMsg);
			} else {
				msg = line !== -1 ? 'Invalid input for ' : 'Invalid command-line input for ';
				logger.error(msg + name.stripColors);
				prop.schema.message && logger.error(prop.schema.message);
			}
			
			prompt.emit('invalid', prop, line);
		}
		
		return result.valid;
	};
	
	prompt.start();
	prompt.get({
		properties: {
			sdk: {
				default: activeSDK,
				description: __('Titanium SDK version to activate').bold,
				conform: function (value) {
					if (!env.sdks[value]) {
						throw new appc.exception(__('Invalid Titanium SDK'));
					}
					return true;
				}
			}
		}
	}, function (err, results) {
		if (err) {
			logger.log('\n');
			process.exit(1);
		}
		
		config.app.sdk = results.sdk.trim();
		config.save();
		
		logger.log('\n' + __('Configuration saved') + '\n');
	});
}
