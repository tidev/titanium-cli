/**
 * @overview
 * Displays installed Titanium SDKs and installs new SDKs.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 *
 * @requires node-appc
 */

/** @module lib/commands/sdk */

var async = require('async'),
	fs = require('fs'),
	request = require('request'),
	temp = require('temp'),
	wrench = require('wrench'),
	HttpStatus = require('http-status-codes'),
	fields = require('fields'),
	appc = require('node-appc'),
	afs = appc.fs,
	__ = appc.i18n(__dirname).__,
	urls = {
		branches: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/branches.json',
		branch: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/index.json',
		build: 'http://builds.appcelerator.com.s3.amazonaws.com/mobile/$BRANCH/$FILENAME',
		releases: 'http://api.appcelerator.net/p/v1/release-list'
	};

/** SDK command title. */
exports.title = __('SDK');

/** SDK command description. */
exports.desc = __('manages installed Titanium SDKs');

/**
 * Returns the configuration for the SDK command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} SDK command configuration
 */
exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		defaultSubcommand: 'list',
		subcommands: {
			install: {
				desc: __('download the latest Titanium SDK or a specific version'),
				args: [
					{
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
				noAuth: true,
				args: [
					{
						desc: __('the version to select'),
						name: 'version',
						required: !config.cli.prompt
					}
				]
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

/**
 * Displays all installed Titanium SDKs or installs a new SDK.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
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
dump(cli.argv);
	var action = cli.argv._.shift();
	action || (action = 'list');
	action != 'list' && logger.banner();

	if (SdkSubCommands[action]) {
		SdkSubCommands[action].apply(SdkSubCommands[action], arguments);
	} else {
		logger.error(__('Invalid subcommand "%s"', action) + '\n');
		appc.string.suggest(action, Object.keys(SdkSubCommands), logger.log);
		logger.log(__('Available subcommands:'));
		Object.keys(SdkSubCommands).forEach(function (a) {
			logger.log('    ' + a.cyan);
		});
		logger.log();
		finished();
	}
};

/** @namespace SdkSubCommands */
var SdkSubCommands = {};

/**
 * Displays a list of all installed Titanium SDKs.
 * @memberof SdkSubCommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubCommands.list = function list(logger, config, cli, finished) {
	var tasks = {};

	cli.argv.releases && (tasks.releases = function (next) {
		getReleases(config, cli.env.os.name, function (err, data) {
			next(err, data);
		});
	});

	cli.argv.branches && (tasks.branches = function (next) {
		getBranches(config, function (err, data) {
			next(err, data);
		});
	});

	async.parallel(tasks, function (err, results) {
		var defaultSDKLocation = afs.resolvePath(config.get('titanium.sdk.defaultSDKLocation', cli.env.os.sdkPaths[0])),
			activeSDK = config.get('app.sdk'),
			sdks = cli.env.sdks,
			vers = Object.keys(sdks).sort().reverse();

		if ((!activeSDK || activeSDK == 'latest') && vers.length) {
			activeSDK = vers[0];
		}

		if (cli.argv.output == 'json') {
			var obj = {
				activeSDK: activeSDK,
				defaultSDKLocation: defaultSDKLocation,
				installed: {},
				releases: results.releases
			};

			vers.forEach(function (v) {
				obj.installed[v] = sdks[v].path;
			});

			appc.util.mix(obj, results.branches);

			logger.log(JSON.stringify(obj, null, '\t'));
		} else {
			logger.banner()
			if (!vers.length) {
				logger.log(__('No SDKs are installed') + '\n');
				return;
			}

			logger.log(__('Default SDK Install Location: %s', defaultSDKLocation.cyan) + '\n');

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
				logger.log('   ' + v.cyan + d.grey + new Array(n + 1).join(' ') + sdks[v].path);
			});
			logger.log();

			if (results.releases) {
				logger.log(__('Releases:'));
				var i = 0;
				Object.keys(results.releases).sort().reverse().forEach(function (r) {
					logger.log('   ' + r.cyan + (sdks.hasOwnProperty(r) ? ' ' + __('[installed]') : '') + (i++ == 0 ? ' ' + __('[latest]') : ''));
				});
				i || logger.log('   ' + __('No releases found'));
				logger.log();
			}

			if (results.branches) {
				logger.log(__('Branches:'));
				var data = results.branches;
				if (data && data.branches.length) {
					data.branches.sort().reverse().forEach(function (b) {
						logger.log('   ' + b.cyan + (b == data.defaultBranch ? ' ' + __('[default]') : ''));
					});
				} else {
					logger.log('   ' + __('No branches found'));
				}
				logger.log();
			}

			if (!activeValid) {
				logger.error(__("Active Titanium SDK '%s' not found", activeSDK) + '\n');
				logger.log(__('Run %s to set the active Titanium SDK.', (cli.argv.$ + ' sdk select <sdk-version>').cyan) + '\n');
			}
		}

		finished();
	});
};

/**
 * Selects the specified Titanium SDK as the active SDK.
 * @memberof SdkSubCommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubCommands.select = function install(logger, config, cli, finished) {
	var selectedSDK = cli.argv.version,
		// we only care about SDKs that are 3.0 or newer
		vers = Object.keys(cli.env.sdks).filter(function (v) {
			return appc.version.gte(v, '3.0.0');
		}).sort().reverse(),
		activeSDK = config.get('app.sdk', 'latest') == 'latest' && vers.length ? vers[0] : config.get('app.sdk'),
		activeLabel = ' [' + __('active') + ']',
		maxlen = vers.reduce(function (a, b) {
			return Math.max(a, b.length + (b == activeSDK ? activeLabel.length : 0));
		}, 0);

	// check we even have any SDKs installed
	if (!vers.length) {
		logger.log(__('No suitable Titanium SDKs installed') + '\n');
		return;
	}

	// if they specified 'latest', then determine the latest version
	if (selectedSDK == 'latest' && vers.length) {
		selectedSDK = vers[0];
	}

	if (selectedSDK) {
		// we have a version, see if it's valid
		if (vers.indexOf(selectedSDK) != -1) {
			config.app.sdk = selectedSDK;
			config.save();
			logger.log(__('Configuration saved') + '\n');
			finished();
			return;
		} else {
			logger.error(__('Invalid Titanium SDK "%s"', selectedSDK) + '\n');
			appc.string.suggest(selectedSDK, vers, logger.log);
			// if prompting is disabled, then we're done
			if (!config.cli.prompt) {
				process.exit(1);
			}
		}
	} else if (!config.cli.prompt) {
		// no version supplied, no prompting, show error and exit
		logger.error(__('No SDK version supplied') + '\n');
		logger.log(__('Usage: %s', (cli.argv.$ + ' sdk select <version>').cyan) + '\n');
		process.exit(1);
	}

	// prompt for the sdk version to select
	fields.select({
		default: activeSDK,
		promptLabel: __('Titanium SDK version to select'),
		complete: true,
		numbered: true,
		margin: '',
		options: {
			'Installed SDKs:': vers.map(function (v) {
				return {
					path: cli.env.sdks[v].path,
					value: v
				};
			})
		},
		formatters: {
			option: function (opt, idx, num) {
				var d = opt.value == activeSDK ? activeLabel : '',
					n = maxlen + 2 - opt.value.length - d.length;
				return '  ' + num + opt.value.cyan + d.grey + new Array(n + 1).join(' ') + opt.path;
			}
		},
		validate: function (value) {
			if (!cli.env.sdks[value]) {
				logger.error(__('Invalid Titanium SDK "%s"', value));
				return false;
			}
			return true;
		}
	}).prompt(function (err, value) {
		if (err && err.message == 'cancelled') {
			logger.log('\n');
			process.exit(1);
		}

		config.app.sdk = value;
		config.save();

		logger.log('\n' + __('Configuration saved') + '\n');
	});

	finished();
};

/**
 * Installs the specified Titanium SDK.
 * @memberof SdkSubCommands
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
SdkSubCommands.install = function install(logger, config, cli, finished) {
	// Make sure sdk folder is writable when installing an sdk
	// allow user to set sdk install directory
	// allow ti sdk install to specify CI SDK versions (git hash and zip file)
	console.log('hi from install');
	finished();
};




/*
		case 'install':
			install(logger, config, cli.argv, cli.env, onComplete);
			break;

		case 'uninstall':
			uninstall(logger, cli.argv, cli.env, config);
			break;

		case 'update':
			update(logger, config, cli.argv, cli.env, onComplete);
			break;
	*/

/**
 * Fetches the specified URL and returns the JSON parsed response.
 * @param {String} url - The URL to connect to
 * @param {Object} config - The CLI config object
 * @param {Function} callback - Callback when the command finishes
 */
function fetch(url, config, callback) {
	request({
		url: url,
		proxy: config.get('cli.httpProxyServer')
	}, function (error, response, body) {
		if (error) {
			callback(error);
			return;
		}

		if (response.statusCode != 200) {
			callback(new Error(HttpStatus.getStatusText(response.statusCode)));
			return;
		}

		try {
			callback(null, JSON.parse(body));
		} catch (ex) {
			callback(ex);
		}
	});
}

/**
 * Retrieves the list of releases.
 * @param {Object} config - The CLI config object
 * @param {String} os - The name of the OS (osx, linux, win32)
 * @param {Function} callback - Callback when the command finishes
 */
function getReleases(config, os, callback) {
	fetch(urls.releases, config, function (err, data) {
		var releases = {};
		!err && data && data.releases && data.releases.forEach(function (r) {
			r.os == os && r.name == 'mobilesdk' && (releases[r.version] = r.url);
		});
		callback && callback(err, releases);
	});
}

/**
 * Retrieves the list of branches.
 * @param {Object} config - The CLI config object
 * @param {Function} callback - Callback when the command finishes
 */
function getBranches(config, callback) {
	fetch(urls.branches, config, callback);
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
	var version = ''+argv._.shift();

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
		fields.text({
			label: __('Enter "%s" to confirm uninstall:', version.cyan),
			validate: function (value) {
				if (!env.sdks[value]) {
					logger.error(__('Incorrect version match, try again'));
					return false;
				}
				return true;
			}
		}).prompt(removeSDK);
	}
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
