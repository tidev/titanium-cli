/**
 * The setup command. Walks the user through a series of questions to help them
 * configure their Titanium environment.
 *
 * @module commands/setup
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

var fs = require('fs'),
	path = require('path'),
	url = require('url'),
	appc = require('node-appc'),
	exec = require('child_process').exec,
	async = require('async'),
	request = require('request'),
	fields = require('fields'),
	afs = appc.fs,
	AppcException = appc.exception,
	mixObj = appc.util.mixObj,
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__f = i18n.__f,
	__n = i18n.__n;

/** Setup command description. */
exports.desc = __('sets up the Titanium CLI');

/** Config command extended description. */
exports.extendedDesc = __f('commands/setup');

/**
 * Returns the configuration for the setup command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Setup command configuration
 */
exports.config = function (logger, config, cli) {
	return {
		noAuth: true,
		args: [
			{
				name: 'screen',
				default: 'mainmenu',
				desc: __('initial screen'),
				values: Object.keys(SetupScreens.prototype).filter(function (f) {
					return !/^_|exit/.test(f) && (process.platform == 'darwin' || f != 'ios');
				})
			}
		]
	};
};

/**
 * Steps the user through the configuration of their Titanium environment.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
	logger.log(__('Enter %s at any time to quit.', 'ctrl-c'.cyan));

	fields.setup({
		colors: !!config.get('cli.colors')
	});

	var screens = new SetupScreens(logger, config, cli);

	var queue = async.queue(function (screen, callback) {
		try {
			screen.call(screens, callback);
		} catch (ex) {
			if (ex) {
				var s = ex.stack.toString().split('\n');
				logger.error(s.shift());
				logger.log('\n' + s.join('\n').grey);
			}
			callback(ex);
		}
	}, 1);

	queue.drain = finished;

	function post(err, next) {
		logger.log();
		if (err && err.message == 'cancelled') {
			logger.log();
			process.exit(1);
		}
		screens[next] || (next = 'mainmenu');
		queue.push(screens[next], post);
	}

	if (cli.argv.screen && !screens[cli.argv.screen]) {
		logger.log();
		logger.error(__('Invalid setup screen "%s"', cli.argv.screen));
	}
	queue.push(cli.argv.screen && screens[cli.argv.screen] || screens.mainmenu, post);
};

/**
 * Detects the Android environment using either the new or old detection code.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} callback - A function to call when finished
 */
function detectAndroid(logger, config, cli, callback) {
	if (cli.sdk) {
		// try to find a Titanium SDK 3.2 or newer for the detection stuff
		var tisdk = cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name,
			file;

		// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
		if (appc.version.gte(tisdk, '3.2.0')
			&& cli.sdk.platforms
			&& cli.sdk.platforms.android
			&& fs.existsSync(file = path.join(cli.sdk.platforms.android.path, 'cli', 'lib', 'detect.js'))
		) {
			require(file).detect(logger, config, cli, {}, function (result) {
				callback(result);
			});
			return;
		}
	}

	// the old legacy node-appc detection code
	appc.android.detect(function (result) {
		result || (result = {});
		result.detectVersion = '1.0';
		callback(result);
	}, config.android && config.android.sdkPath, config.android && config.android.ndkPath);
}

/**
 * Detects the iOS environment using either the new or old detection code.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} callback - A function to call when finished
 */
function detectIos(logger, config, cli, callback) {
	if (cli.sdk) {
		var tisdk = cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name,
			file;

		// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
		if (appc.version.gte(tisdk, '3.2.0')
			&& cli.sdk.platforms
			&& (
				(cli.sdk.platforms.ios && afs.exists(file = path.join(cli.sdk.platforms.ios.path, 'cli', 'lib', 'detect.js')))
				|| (cli.sdk.platforms.iphone && afs.exists(file = path.join(cli.sdk.platforms.iphone.path, 'cli', 'lib', 'detect.js')))
			)
		) {
			require(file).detect(logger, config, cli, {}, function (result) {
				callback(result);
			});
			return;
		}
	}

	appc.ios.detect(function (result) {
		result || (result = {});
		result.detectVersion = '1.0';
		callback(result);
	});
}

/**
 * The setup command screens.
 * @class
 * @classdesc The setup command screens.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @constructor
 */
function SetupScreens(logger, config, cli) {
	this._logger = logger;
	this._config = config;
	this._cli = cli;

	var activeSdk = cli.env.getSDK(config.get('sdk.selected', config.get('app.sdk', 'latest'))),
		activeSdkLabel = ' [' + __('active') + ']',
		sdkVersions = Object.keys(cli.env.sdks).filter(function (v) {
			return appc.version.gte(v, '3.0.0');
		}).sort().reverse(),
		sdkVersionMaxlen = sdkVersions.reduce(function (a, b) {
			return Math.max(a, b.length + (b == activeSdk.name ? activeSdkLabel.length : 0));
		}, 0);

	this._registry = {
		'user': {
			'name': fields.text({
				default: config.get('user.name', ''),
				title: __('What do you want as your "author" name?'),
				validate: function (value) {
					if (!value) {
						throw new Error(__('Invalid name'));
					}
					return true;
				}
			}),
			'email': fields.text({
				default: config.get('user.email', ''),
				title: __('What is your email address used for logging into the Appcelerator Network?'),
				validate: function (value) {
					if (!value) {
						throw new Error(__('Invalid e-mail address'));
					}
					return true;
				}
			}),
			'locale': fields.text({
				default: config.get('user.locale', ''),
				title: __('What would you like as your default locale?'),
				desc: __('(examples: "en", "en-us", "de", "fr")'),
				validate: function (value) {
					if (!value || !/^[A-Za-z]{2}[A-Za-z]?(([-_][A-Za-z0-9]{4})?[-_][A-Za-z0-9]{2}[A-Za-z0-9]?)?$/.test(value)) {
						throw new Error(__('Invalid locale format'));
					}
					return true;
				}
			})
		},
		'app': {
			'workspace': fields.file({
				default: config.get('app.workspace', ''),
				title: __('Path to your workspace where your projects should be created:'),
				complete: true,
				showHidden: true,
				ignoreDirs: new RegExp(config.get('cli.ignoreDirs')),
				ignoreFiles: new RegExp(config.get('cli.ignoreFiles')),
				validate: function (value) {
					if (value && !fs.existsSync(afs.resolvePath(value))) {
						throw new Error(__('Invalid workspace directory'));
					}
					return true;
				}.bind(this)
			})
		},
		'sdk': {
			'selected': fields.select({
				default: activeSdk && activeSdk.name || 'latest',
				label: __('What Titanium SDK would you like to use by default?'),
				complete: true,
				completeIgnoreCase: true,
				suggest: true,
				suggestThreshold: 2,
				numbered: true,
				margin: '',
				formatters: {
					option: function (opt, idx, num) {
						var d = opt.value == activeSdk.name ? activeSdkLabel : '',
							n = sdkVersionMaxlen + 2 - opt.value.length - d.length;
						return num + opt.value.cyan + d.grey + new Array(n + 1).join(' ') + opt.path;
					}
				},
				promptLabel: __('Enter # or SDK name'),
				optionLabel: 'value',
				options: sdkVersions.map(function (sdk) {
					return { path: cli.env.sdks[sdk].path, value: sdk };
				}.bind(this)),
				validate: function (value) {
					if (sdkVersions.indexOf(value) == -1) {
						throw new Error(__('Invalid Titanium SDK'));
					}
					// set the new sdk
					cli.sdk = cli.env.sdks[value];
					return true;
				}
			})
		},
		'android': {
			'sdkPath': function (defaultValue) {
				return fields.file({
					default: defaultValue,
					title: __('Path to the Android SDK'),
					desc: __("Leave blank if you don't want to build for Android."),
					complete: true,
					showHidden: true,
					ignoreDirs: new RegExp(config.get('cli.ignoreDirs')),
					ignoreFiles: new RegExp(config.get('cli.ignoreFiles')),
					validate: function (value) {
						if (value && (!fs.existsSync(afs.resolvePath(value) || fs.statSync(value).isDirectory()))) {
							throw new Error(__('Invalid Android SDK path'));
						}

						var androidExecutable = path.join(value, 'tools', 'android' + (process.platform == 'win32' ? '.bat' : ''));
						if (!fs.existsSync(androidExecutable)) {
							throw new Error(__('Invalid Android SDK path') + '\n' + __('Required file does not exist: "%s"', androidExecutable));
						}

						var adbExecutable = path.join(value, 'platform-tools', 'adb' + (process.platform == 'win32' ? '.exe' : ''));
						if (!fs.existsSync(adbExecutable)) {
							throw new Error(__('Invalid Android SDK path') + '\n' + __('Required file does not exist: %s"', adbExecutable));
						}

						return true;
					}.bind(this)
				});
			}
		}
	};
}

/**
 * Renders the screen title.
 * @param {String} title - The screen title
 * @private
 */
SetupScreens.prototype._title = function _title(title) {
	var width = 50,
		margin = width - title.length + 4
		pad = Math.floor(margin / 2),
		left = pad ? (new Array(pad + 1)).join('─') : '',
		right = pad ? (new Array(margin - pad + 1)).join('─') : '';
	this._logger.log('\n' + (left + '┤ ').grey + title.bold + (' ├' + right).grey + '\n');
};

/**
 * Saves the configuration to disk.
 * @param {Object} data - The config data to save
 * @private
 */
SetupScreens.prototype._save = function _save(data) {
	if (data) {
		// we reload the config to always make sure we have a clean state
		this._config.load();
		mixObj(this._config, data);
		this._config.save();
		this._logger.log('\n' + __('Configuration saved!'));
	}
};

/**
 * Displays the main menu and prompts for selection.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.mainmenu = function mainmenu(callback) {
	this._title(__('Main Menu'));
	fields.select({
		numbered: true,
		promptLabel: __('Where do you want to go?'),
		optionLabel: 'key',
		separator: ' ',
		margin: '',
		complete: true,
		completeIgnoreCase: true,
		formatters: {
			option: function (opt, idx, num) {
				return '  ' + num + this._format(opt.key + (new Array(10 - opt.key.replace(/__(.+?)__/g, '?').length)).join(' '), 'option') + opt.label;
			}
		},
		options: [
			{ key: '__w__izard', value: 'wizard', label: __('Setup Wizard') },
			{ key: 'chec__k__',   value: 'check', label: __('Check Environment') },
			{ key: '__u__ser',    value: 'user', label: __('User Information') },
			{ key: 'a__p__p',     value: 'app', label: __('New App Defaults') },
			{ key: '__c__li',     value: 'cli', label: __('Titanium CLI Settings') },
			{ key: '__s__dk',     value: 'sdk', label: __('Titanium SDK Settings') },
			{ key: '__i__os',     value: 'ios', label: __('iOS Settings') },
			{ key: '__a__ndroid', value: 'android', label: __('Android Settings') },
			//{ key: 'pa__t__hs',   value: 'paths', label: __('Search Paths') },
			{ key: 'e__x__it',   value: 'exit', label: __('Exit') }
		].filter(function (o) { return process.platform == 'darwin' || o.id != 'ios'; })
	}).prompt(callback);
};

/**
 * Prompts for essential config options.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.wizard = function wizard(callback) {
	var busy = new appc.busyindicator;
	busy.start();

	detectAndroid(this._logger, this._config, this._cli, function (results) {
		busy.stop();

		this._title(__('Setup Wizard'));

		var androidSdkPath = this._config.get('android.sdkPath', results && results.sdk && results.sdk.path);

		fields.set({
			'name': this._registry.user.name,
			'email': this._registry.user.email,
			'locale': this._registry.user.locale,
			'sdk': this._registry.sdk.selected,
			'workspace': this._registry.app.workspace,
			'using android': !androidSdkPath && fields.select({
				promptLabel: __('Do you plan to build your app for Android?'),
				display: 'prompt',
				default: 'yes',
				options: [ 'yes', 'no' ],
				next: function (value) {
					return value == 'no' ? false : null;
				}
			}),
			'androidSdkPath': this._registry.android.sdkPath(androidSdkPath)
		}).prompt(function (err, data) {
			if (!err) {
				var values = {
					user: {
						name: data.name,
						email: data.email,
						locale: data.locale
					},
					sdk: {
						selected: data.sdk
					},
					app: {
						workspace: data.workspace
					}
				};
				if (data['using android'] == 'yes') {
					values.android = {
						sdkPath: data.androidSdkPath
					};
				}
				this._save(values);
			}
			callback();
		}.bind(this));
	}.bind(this));
};

/**
 * Checks if your development environment is correctly setup.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.check = function check(callback) {
	this._title(__('Check Environment'));

	var logger = this._logger,
		config = this._config,
		cli = this._cli,
		log = logger.log,
		busy = new appc.busyindicator;

	busy.start();

	async.parallel({
		'nodejs': function (next) {
			cli.env.getOSInfo(function (results) {
				var r = {
						node: results.node,
						npm: results.npm,
						latestNode: results.node,
						latestNpm: results.npm
					};

				request({
					url: 'http://nodejs.org/dist/npm-versions.txt',
					proxy: config.get('cli.httpProxyServer')
				}, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						var vers = body.split('\n'),
							i = 0,
							len = vers.length,
							latestNpm, parts, nodeVer, npmVer;

						for (; i < len; i++) {
							if (vers[i].charAt(0) == '#') continue;

							parts = vers[i].split(' ');
							nodeVer = parts.shift().replace('v', '');
							npmVer = parts.shift();

							// we only want stable releases
							if (nodeVer.split('.')[1] % 2 != 1 && appc.version.gt(nodeVer, r.latestNode)) {
								r.latestNode = nodeVer;
								r.latestNpm = npmVer;
							}
						}
					}
					next(null, r);
				});
			});
		},
		'ios': function (next) {
			if (process.platform != 'darwin') {
				return next(null, null);
			}
			detectIos(logger, config, cli, function (results) {
				// http://en.wikipedia.org/w/api.php?format=json&action=query&titles=Template:Latest_stable_software_release/Xcode&prop=revisions&rvprop=content
				next(null, results);
			});
		},
		'android': function (next) {
			detectAndroid(logger, config, cli, function (results) {
				next(null, results);
			});
		},
		'java': function (next) {
			appc.jdk.detect(config, function (results) {
				next(null, results);
			});
		},
		'haxm': function (next) {
			appc.haxm.detect(config, function (results) {
				next(null, results);
			});
		},
		'cli': function (next) {
			request({
				url: 'http://registry.npmjs.org/titanium',
				proxy: config.get('cli.httpProxyServer')
			}, function (error, response, body) {
				var r = {};
				if (!error && response.statusCode == 200) {
					try {
						var v = JSON.parse(body);
						r.latest = Object.keys(v.versions).sort().pop();
					} catch (ex) {}
				}
				next(null, r);
			});
		}
	}, function (err, results) {
		busy.stop();

		function ok(s, t) {
			log('  ✓'.green + '  ' + appc.string.rpad(s, 12) + t.grey);
		}

		function warn(s, t) {
			log('  !'.yellow.bold + '  ' + appc.string.rpad(s, 12) + t.grey);
		}

		function bad(s, t) {
			log('  \u2715'.red + '  ' + appc.string.rpad(s, 12) + t.grey);
		}

		function update(s, t) {
			log('  \u2605'.magenta + '  ' + appc.string.rpad(s, 12) + t.grey);
		}

		var updates = 0,
			warnings = 0,
			errors = 0;

		(function (r) {
			log('Node.js');
			if (r.node == r.latestNode) {
				ok('node', __('up-to-date (%s)', 'v' + r.node));
			} else {
				++updates, update('node', __('new version %s available (currently %s)', r.latestNode, r.node));
			}
			if (r.npm == r.latestNpm) {
				ok('npm', __('up-to-date (%s)', 'v' + r.npm));
			} else {
				++updates, update('npm', __('new version %s available (currently %s)', r.latestNpm, r.npm));
			}
			log();
		}(results.nodejs));

		(function (r) {
			log('Titanium CLI');
			if (!r.latest || r.latest == cli.version) {
				ok('cli', __('up-to-date (%s)', 'v' + cli.version));
			} else if (appc.version.gt(cli.version, r.latest)) {
				ok('cli', __('bleeding edge (%s)', 'v' + cli.version));
			} else {
				++updates, update('cli', __('new version %s available (currently %s)', r.latest, cli.versio));
			}

			// TODO: dependencies up-to-date?

			log();
		}(results.cli));

		(function (r) {
			log('Titanium SDK');
			log();
		}(cli.env.sdks));

/*
		is root user?

		log('  ' + '✔'.green + '  ' + 'Java');
		log('  ' + '✔'.green + '  ' + 'Intel® Hardware Accelerated Execution Manager (HAXM)');
		log('  ' + '✔'.green + '  ' + 'iOS SDK');
		log('  ' + '✔'.green + '  ' + 'Xcode');
		log('  ' + '✔'.green + '  ' + 'Android SDK');
		log('  ' + '✔'.green + '  ' + 'Android NDK');

*/

		log('  ' + String(updates).magenta + ' ' + __n('update', 'updates', updates));
		log('  ' + String(warnings).yellow + ' ' + __n('warning', 'warnings', warnings));
		log('  ' + String(errors).red + ' ' + __n('error', 'errors', errors));

		//this._logger.log(results[0].issues);
		//this._logger.log(results[1].issues);

		log();
		process.exit(0);
		callback();
	});

	// TODO
	// iOS
	// Android
	// Java
	// Node version
	// directory permissions
	// ti sdk
	// common commands (sh, security, openssl, etc)
	// U+2713 	✓ 	Check mark
	// U+2714 	✔ 	w
	// U+2715 	✕ 	Multiplication X
	// U+2716 	✖ 	Heavy multiplication X

//	logger.log(__('Download and install a certificate from %s', 'https://developer.apple.com/ios/manage/certificates/team/index.action'.cyan) + '\n');
// || (env.certs.devNames.length == 0 && env.certs.distNames.length == 0)
};

/**
 * Configures user-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.user = function user(callback) {
	this._title(__('User Information'));
	fields.set({
		'name': this._registry.user.name,
		'email': this._registry.user.email,
		'locale': this._registry.user.locale
	}).prompt(function (err, data) {
		!err && this._save({ user: data });
		callback();
	}.bind(this));
};

/**
 * Configures new app default settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.app = function app(callback) {
	this._title(__('New App Defaults'));
	fields.set({
		'workspace': this._registry.app.workspace,
		'idprefix': fields.text({
			default: this._config.get('app.idprefix'),
			title: __('What is your prefix for application IDs?'),
			desc: __('(example: com.mycompany)')
		}),
		'publisher': fields.text({
			default: this._config.get('app.publisher'),
			title: __('Used for populating the "publisher" field in new projects:')
		}),
		'url': fields.text({
			default: this._config.get('app.url'),
			title: __('Used for populating the "url" field in new projects:')
		}),
	}).prompt(function (err, data) {
		!err && this._save({ app: data });
		callback();
	}.bind(this));
};

/**
 * Configures CLI settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.cli = function cli(callback) {
	var httpProxyServer = {
		promptLabel: __('Proxy server URL'),
		default: this._config.get('cli.httpProxyServer'),
		validate: function (value) {
			var u = url.parse(value);
			if (!/^https?\:$/.test(u.protocol)) {
				throw new Error(__('HTTP proxy url protocol must be either "http" or "https" (ex: http://user:pass@example.com)'));
			}
			if (!(u.host || '')) {
				throw new Error(__('HTTP proxy url must contain a host name (ex: http://user:pass@example.com)'));
			}
			return true;
		}
	};
	httpProxyServer.default || delete httpProxyServer.default;

	this._title(__('Titanium CLI Settings'));

	fields.set({
		'colors': fields.select({
			promptLabel: __('Enable colors?'),
			display: 'prompt',
			default: this._config.get('cli.colors', true) === false ? 'no' : 'yes',
			options: [ 'yes', 'no' ]
		}),
		'prompt': fields.select({
			promptLabel: __('Enable interactive prompting for missing options and arguments?'),
			display: 'prompt',
			default: this._config.get('cli.prompt', true) === false ? 'no' : 'yes',
			options: [ 'yes', 'no' ]
		}),
		'progressBars': fields.select({
			promptLabel: __('Display progress bars when downloading or installing?'),
			display: 'prompt',
			default: this._config.get('cli.progressBars', true) === false ? 'no' : 'yes',
			options: [ 'yes', 'no' ]
		}),
		/*'completion': fields.select({
			promptLabel: __('Enable bash completion? (Mac OS X and Linux only)'),
			display: 'prompt',
			default: this._config.get('cli.completion', false) === false ? 'no' : 'yes',
			options: [ 'yes', 'no' ]
		}),*/
		'loglevel': fields.select({
			title: __('Output log level'),
			promptLabel: __('Enter # or log level'),
			style: {
				option: 'cyan'
			},
			complete: true,
			completeIgnoreCase: true,
			numbered: true,
			suggest: true,
			suggestThreshold: 2,
			default: this._config.get('cli.loglevel', 'trace'),
			options: this._logger.getLevels()
		}),
		'width': fields.text({
			title: __('What is the width of the Titanium CLI output?'),
			description: __('Enter 0 for max width of the terminal.'),
			promptLabel: __('CLI width'),
			default: this._config.get('cli.width', 100),
			validate: function (value, callback) {
				value = parseInt(value);
				if (isNaN(value) || value < 0) {
					throw new Error(__('Width must be greater than or equal to zero'));
				}
				callback(null, value);
			}
		}),
		'hasProxy': fields.select({
			promptLabel: __('Are you behind a proxy server?'),
			display: 'prompt',
			default: this._config.get('cli.httpProxyServer') ? 'yes' : 'no',
			options: [ 'yes', 'no' ],
			next: function (value) {
				return value == 'yes' ? 'httpProxyServer' : 'failOnWrongSDK';
			}
		}),
		'httpProxyServer': fields.text(httpProxyServer),
		'failOnWrongSDK': fields.select({
			promptLabel: __('Fail if selected Titanium SDK differs from <sdk-version> in tiapp.xml?'),
			display: 'prompt',
			default: this._config.get('cli.failOnWrongSDK', false) === false ? 'no' : 'yes',
			options: [ 'yes', 'no' ]
		})
	}).prompt(function (err, data) {
		if (!err) {
			delete data.hasProxy;
			data.colors = (data.colors == 'yes');
			data.prompt = (data.prompt == 'yes');
			data.progressBars = (data.progressBars == 'yes');
			//data.completion = (data.completion == 'yes');
			data.failOnWrongSDK = (data.failOnWrongSDK == 'yes');
			this._save({ cli: data });
		}
		callback();
	}.bind(this));
};

/**
 * Configures Titanium SDK settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.sdk = function sdk(callback) {
	this._title(__('Titanium SDK Settings'));
	fields.set({
		'selected': this._registry.sdk.selected,
		'defaultInstallLocation': fields.file({
			default: this._config.get('sdk.defaultInstallLocation', this._cli.env.installPath),
			title: __('Path to find and install Titanium SDKs:'),
			complete: true,
			showHidden: true,
			ignoreDirs: new RegExp(this._config.get('cli.ignoreDirs')),
			ignoreFiles: new RegExp(this._config.get('cli.ignoreFiles')),
			validate: function (value) {
				if (value && (!fs.existsSync(afs.resolvePath(value) || fs.statSync(value).isDirectory()))) {
					throw new Error(__('Invalid directory'));
					return false;
				}
				return true;
			}.bind(this)
		})
	}).prompt(function (err, data) {
		!err && this._save({ sdk: data });
		callback();
	}.bind(this));
};

/**
 * Configures iOS-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.ios = function ios(callback) {
	if (process.platform != 'darwin') {
		return callback();
	}

	var busy = new appc.busyindicator;
	busy.start();

	detectIos(this._logger, this._config, this._cli, function (results) {
		busy.stop();

		this._title(__('iOS Settings'));

		var devList = [],
			devNames = {}
			currentDevName = this._config.get('ios.developerName'),
			distList = [],
			distNames = {},
			currentDistName = this._config.get('ios.distributionName');

		if (results.detectVersion == '1.0') {
			results.certs.devNames.forEach(function (n) {
				if (!devNames[n]) {
					devList.push({ name: n });
					devNames[n] = 1;
				}
			});

			results.certs.distNames.forEach(function (n) {
				if (!distNames[n]) {
					distList.push({ name: n });
					distNames[n] = 1;
				}
			});
		} else {
			Object.keys(results.certs.keychains).forEach(function (keychain) {
				(results.certs.keychains[keychain].developer || []).forEach(function (dev) {
					var n = dev.name;
					if ((n === currentDevName || !dev.invalid) && !devNames[n]) {
						devList.push(dev);
						devNames[n] = 1;
					}
				});

				(results.certs.keychains[keychain].distribution || []).forEach(function (dist) {
					var n = dist.name;
					if ((n === currentDistName || !dist.invalid) && !distNames[n]) {
						distList.push(dist);
						distNames[n] = 1;
					}
				});
			});
		}

		fields.set({
			'developerName': devList.length && fields.select({
				default: currentDevName,
				title: __('What do you want to be your default iOS developer cert for device builds?'),
				desc: __('(only valid, non-expired developer certs are listed)'),
				promptLabel: __('Enter # or cert name'),
				display: devList.length > 5 ? 'grid' : 'list',
				complete: true,
				completeIgnoreCase: true,
				zeroSkip: true,
				numbered: true,
				suggest: true,
				optionLabel: 'name',
				optionValue: 'name',
				formatters: {
					option: function (opt, i) {
						return '  ' + (i+1) + ') ' + opt.name.cyan + (opt.expired ? ' ' + __('**EXPIRED**').red : opt.invalid ? ' ' + __('**INVALID**').red : '');
					}
				},
				options: devList.sort(function (a, b) {
					return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
				}),
				validate: function (value, callback) {
					if (value) {
						var i, l;

						// try to find an exact match
						for (i = 0, l = devList.length; i < l; i++) {
							if (devList[i].name == value) {
								callback(null, value);
								return;
							}
						}

						value += ' (';

						// no match, try partial match without the id
						for (i = 0, l = devList.length; i < l; i++) {
							if (devList[i].name.indexOf(value) == 0) {
								callback(null, devList[i].name);
								return;
							}
						}
					}

					throw new Error(__('Invalid iOS developer certificate'));
				}.bind(this)
			}),
			'distributionName': distList.length && fields.select({
				default: currentDistName,
				title: __('What do you want to be your default iOS distribution cert for App Store and Ad Hoc builds?'),
				desc: __('(only valid, non-expired distribution certs are listed)'),
				promptLabel: __('Enter # or cert name'),
				display: distList.length > 5 ? 'grid' : 'list',
				complete: true,
				completeIgnoreCase: true,
				zeroSkip: true,
				numbered: true,
				suggest: true,
				optionLabel: 'name',
				optionValue: 'name',
				formatters: {
					option: function (opt, i) {
						return '  ' + (i+1) + ') ' + opt.name.cyan + (opt.expired ? ' ' + __('**EXPIRED**').red : opt.invalid ? ' ' + __('**INVALID**').red : '');
					}
				},
				options: distList.sort(function (a, b) {
					return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
				}),
				validate: function (value, callback) {
					if (value) {
						// try to find an exact match
						for (var i = 0, l = distList.length; i < l; i++) {
							if (distList[i].name == value) {
								callback(null, value);
								return;
							}
						}
					}

					throw new Error(__('Invalid iOS distribution certificate'));
				}.bind(this)
			})
		}).prompt(function (err, data) {
			!err && this._save({ ios: data });
			callback();
		}.bind(this));
	}.bind(this));
};

/**
 * Configures Android-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.android = function android(callback) {
	this._title(__('Android Settings'));

	var busy = new appc.busyindicator;
		busy.start();

	detectAndroid(this._logger, this._config, this._cli, function (results) {
		busy.stop();

		fields.set({
			'sdkPath': this._registry.android.sdkPath(this._config.get('android.sdkPath', results && results.sdk && results.sdk.path)),
			'ndkPath': fields.file({
				default: this._config.get('android.ndkPath'),
				title: __('Path to the Android NDK'),
				desc: __('Only required for building native Titainum Modules.'),
				complete: true,
				showHidden: true,
				ignoreDirs: new RegExp(this._config.get('cli.ignoreDirs')),
				ignoreFiles: new RegExp(this._config.get('cli.ignoreFiles')),
				validate: function (value) {
					if (value) {
						if (!fs.existsSync(afs.resolvePath(value) || fs.statSync(value).isDirectory())) {
							throw new appc.exception(__('Invalid Android NDK path'));
						}

						var releasetxtExecutable = path.join(value, 'RELEASE.txt');
						if (!fs.existsSync(releasetxtExecutable)) {
							throw new Error(__('Invalid Android NDK path') + '\n' + __('Required file does not exist: "%s"', releasetxtExecutable));
						}

						var ndkbuildExecutable = path.join(value, 'ndk-build' + (process.platform == 'win32' ? '.cmd' : ''));
						if (!fs.existsSync(ndkbuildExecutable)) {
							throw new Error(__('Invalid Android NDK path') + '\n' + __('Required file does not exist: "%s"', ndkbuildExecutable));
						}
					}

					return true;
				}.bind(this)
			})
		}).prompt(function (err, data) {
			!err && this._save({ android: data });
			callback();
		}.bind(this));
	}.bind(this));
};

/**
 * Configures search paths.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.paths = function paths(callback) {
	this._title(__('Search Paths'));
	// TODO
	// "commands": [],
	// "hooks": [
	// 	"/Users/chris/appc/liveview/hook",
	// 	"/Users/chris/appc/titanium-code-processor/hooks"
	// ],
	// "modules": [
	// 	"/Users/chris/Library/Application Support/Titanium"
	// ],
	// "plugins": [
	// 	"~/appc/ti.alloy"
	// ],
	// "sdks": [
	// 	"/Users/chris/Desktop"
	// ],
	// "xcode": []
	callback();
};

/**
 * Exits the setup command.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.exit = function exit() {
	process.exit(0);
};
