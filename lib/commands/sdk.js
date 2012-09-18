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
	appc = require('node-appc'),
	urls = {
		branches: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/branches.json',
		branch: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/index.json',
		build: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/$FILENAME',
		releases: 'http://api.appcelerator.net/p/v1/release-list'
	};

exports.config = function (logger, config, cli) {
	return {
		title: __('SDK'),
		desc: __('manages installed Titanium SDKs'),
		options: {
			'log-level': {
				callback: function (value) {
					logger.levels[value] && logger.setLevel(value);
				},
				desc: __('minimum logging level'),
				default: 'warn',
				values: logger.getLevels()
			}
		},
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
			list: {
				desc: __('print a list of installed SDK versions'),
				flags: {
					branches: {
						abbr: 'b',
						desc: __('retreive and print all branches')
					},
					releases: {
						abbr: 'r',
						desc: __('retreive and print all releases')
					}
				}
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

exports.validate = function (logger, config, cli) {
	if (!cli.argv._.length) {
		throw __('Missing subcommand');
	}
};

exports.run = function (logger, config, cli) {
	function onSuccess(ver) {
		if (cli.argv.default) {
			logger.log(__('Saving SDK %s as the default.', ver.cyan));
			config.app.sdk = ver;
			config.save();
		}
	}
	
	switch (cli.argv._.shift()) {
		case 'install':
			install(logger, cli.argv, cli.env, onSuccess);
			break;
		
		case 'list':
			list(logger, cli.argv, cli.env);
			break;
		
		case 'update':
			update(logger, cli.argv, cli.env, onSuccess);
			break;
	}
};

function fetch(url, desc, logger, callback, errback) {
	request(url, function (error, response, body) {
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

function getBranches(logger, callback, errback) {
	fetch(urls.branches, 'list of branches', logger, callback, errback);
}

function getReleases(logger, os, callback, errback) {
	fetch(urls.releases, 'list of releases', logger, function (data) {
		var releases = {};
		data && data.releases && data.releases.forEach(function (r) {
			r.os == os && r.name == 'mobilesdk' && (releases[r.version] = r.url);
		});
		callback && callback(releases);
	}, errback);
}

function downloadSDK(logger, url, version, env, onSuccess) {
	logger.log(__('Downloading %s', url.cyan));
	
	var tempName = temp.path({suffix: '.zip'}),
		tempStream = fs.createWriteStream(tempName),
		req = request(url),
		pipeResp = req.pipe(tempStream);
	
	req.on('error', function (err) {
		fs.unlinkSync(tempName);
		logger.error(__('Failed to download SDK: %s', err.toString()));
	});
	
	req.on('response', function (req) {
		var bar = new appc.progress('  :paddedPercent [:bar] :etas', {
			complete: '='.cyan,
			incomplete: '.'.grey,
			width: 65,
			total: parseInt(req.headers['content-length'])
		});
		
		req.on('data', function (buffer) {
			bar.tick(buffer.length);
		});
		
		tempStream.on('close', function (e) {
			logger.log('\n');
			extractSDK(logger, tempName, version, env, onSuccess);
		});
	});
}

function extractSDK(logger, filename, version, env, onSuccess) {
	wrench.mkdirSyncRecursive(env.installPath);
	
	logger.log(__('Extracting SDK...'));
	
	var AdmZip = require('adm-zip'),
		zip = new AdmZip(filename),
		zipEntries = zip.getEntries(),
		bar = new appc.progress('  :paddedPercent [:bar] :etas', {
			complete: '='.cyan,
			incomplete: '.'.grey,
			width: 65,
			total: zipEntries.length
		}),
		errors = 0,
		tasks = [],
		exec = require("child_process").exec;
	
	function finished() {
		fs.unlinkSync(filename);
		if (errors) {
			logger.log('\n\n' + __('Titanium SDK %s installed, but with errors.', version.cyan) + '\n');
			process.exit(1);
		} else {
			logger.log('\n');
			onSuccess && onSuccess(version);
			logger.log(__('Titanium SDK %s successfully installed!', version.cyan) + '\n');
			process.exit(0);
		}
	}
	
	zipEntries.forEach(
		/osx|linux/.test(env.os.name)
		?	function (entry) {
				tasks.push(function (callback) {
					var cmd = 'unzip -o -qq "' + filename + '" "' + entry.entryName + '" -d "' + env.installPath + '"';
					exec(cmd, function (err, stdout, stderr) {
						err && (errors++);
						bar.tick();
						callback();
					});
				});
			}
		:	function (entry) {
				zip.extractEntryTo(entry, env.installPath, true, true);
				bar.tick();
				finished();
			}
	);
	
	tasks.length && async.series(tasks, finished);
}

function getBranch(logger, branches, argv, env, callback) {
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
	
	fetch(urls.branch.replace(/\$BRANCH/, branch), 'list of builds', logger, function (data) {
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

function install(logger, argv, env, onSuccess) {
	if (argv.branch) {
		getBranches(logger, function (data) {
			if (!data || !data.branches.length) {
				logger.error(__('No branches found') + '\n');
				process.exit(1);
			}
			
			getBranch(logger, data.branches, argv, env, function (branch, version, filename) {
				if (!argv.force && env.sdks[version]) {
					logger.error(__('SDK "%s" is already installed!', version) + '\n');
					logger.log(__("Run '%s' to re-install.", (argv.$ + ' sdk install ' + version + ' --force --branch ' + branch).cyan) + '\n');
					process.exit(1);
				}
				downloadSDK(logger, urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, filename), version, env, onSuccess);
			});
		});
	} else {
		getReleases(logger, env.os.name, function (releases) {
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
			
			downloadSDK(logger, releases[version], version, env, onSuccess);
		});
	}
}

function list(logger, argv, env) {
	var tasks = [];
	
	argv.releases && tasks.push(function (callback) {
		getReleases(logger, env.os.name, function (data) {
			callback(null, { type:'releases', data:data });
		});
	});
	
	argv.branches && tasks.push(function (callback) {
		getBranches(logger, function (data) {
			callback(null, { type:'branches', data:data });
		});
	});
	
	async.parallel(tasks, function (err, results) {
		var vers = Object.keys(env.sdks);
		if (!vers.length) {
			logger.log(__('No SDKs are installed'));
			return;
		}
		
		var maxlen = vers.reduce(function (a, b) {
			return Math.max(a, (Array.isArray(b) ? b[0] : b).length);
		}, 0);
		
		logger.log(__('Installed SDKs:'));
		vers.forEach(function (v) {
			logger.log('   ' + appc.string.rpad(v.cyan, maxlen + 2) + env.sdks[v].path);
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
							logger.log('   ' + b.cyan + (b == data.defaultBranch ? ' ' + __('[default]') : ''));
						});
					} else {
						logger.log('   ' + __('No branches found'));
					}
					logger.log();
			}
		});
	});
}

function update(logger, argv, env, onSuccess) {
	if (argv.branch) {
		getBranches(logger, function (data) {
			if (!data || !data.branches.length) {
				logger.error(__('No branches found') + '\n');
				process.exit(1);
			}
			
			getBranch(logger, data.branches, argv, env, function (branch, version, filename) {
				if (!argv.force && env.sdks[version]) {
					logger.log(__("You're up-to-date. Version %s is currently the newest version available.", version.cyan) + '\n');
					logger.log(__("Run '%s' to re-install.", (argv.$ + ' sdk install ' + version + ' --force --branch ' + branch).cyan) + '\n');
					process.exit(1);
				}
				downloadSDK(logger, urls.build.replace(/\$BRANCH/, branch).replace(/\$FILENAME/, filename), version, env, onSuccess);
			});
		});
	} else {
		getReleases(logger, env.os.name, function (releases) {
			var latest = Object.keys(releases).shift();
			if (!argv.force && env.sdks[latest]) {
				logger.log(__("You're up-to-date. Version %s is currently the newest version available.", latest.cyan) + '\n');
			} else if (argv.force || argv.install) {
				downloadSDK(logger, releases[latest], latest, env, onSuccess);
			} else {
				logger.log(__('New version available! %s', latest.cyan) + '\n');
				logger.log(__("Run '%s' to download and install", (argv.$ + ' sdk update --install').cyan) + '\n');
			}
		});
	}
}
