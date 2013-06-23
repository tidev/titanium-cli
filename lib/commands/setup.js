/**
 * @overview
 * The setup command. Walks the user through a series of questions to help them
 * configure their Titanium environment.
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

/**
 * The setup command. Walks the user through a series of questions to help them
 * configure their Titanium environment.
 * @module lib/commands/setup
 */

var appc = require('node-appc'),
	afs = appc.fs,
	mixObj = appc.util.mixObj,
	fields = require('fields'),
	async = require('async'),
	exec = require('child_process').exec,
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__f = i18n.__f;

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
					return !/^_|exit/.test(f);
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
				console.log('\nQUEUE EXCEPTION!');
				dump(ex);
			}
			callback(ex);
		}
	}, 1);

	queue.drain = function () {
		logger.log();
		console.log('all items have been processed');
		finished();
	};

	function post(err, next) {
		logger.log();
		if (err && err.message == 'cancelled') {
			logger.log();
			process.exit(1);
		}
		screens[next] || (next = 'mainmenu');
		queue.push(screens[next], post);
	}

	queue.push(cli.argv.screen && screens[cli.argv.screen] || screens.mainmenu, post);
};

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
	this.logger = logger;
	this.config = config;
	this.cli = cli;
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
	this.logger.log('\n' + (left + '┤ ').grey + title.bold + (' ├' + right).grey + '\n');
};

/**
 * Saves the configuration to disk.
 * @param {Object} data - The config data to save
 * @private
 */
SetupScreens.prototype._save = function _save(data) {
	if (data) {
		// we reload the config to always make sure we have a clean state
		this.config.load();
		mixObj(data, this.config);
		this.config.save();
		this.logger.log(__('Configuration saved'));
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
		separator: ' ',
		margin: '',
		complete: true,
		completeIgnoreCase: true,
		formatters: {
			option: function (opt, idx, num) {
				return '  ' + num + ' ' + appc.string.rpad(opt.value, 10).cyan + opt.label;
			}
		},
		options: [
			{ value: 'wizard',  label: __('Setup Wizard') },
			{ value: 'check',   label: __('Check Environment') },
			{ value: 'user',    label: __('User Information') },
			{ value: 'app',     label: __('New App Defaults') },
			{ value: 'cli',     label: __('Titanium CLI Settings') },
			{ value: 'sdk',     label: __('Titanium SDK Settings') },
			{ value: 'ios',     label: __('iOS Settings') },
			{ value: 'android', label: __('Android Settings') },
			{ value: 'paths',   label: __('Search Paths') },
			{ value: 'exit',   label: __('Exit') }
		].filter(function (o) { return process.platform == 'darwin' || o.id != 'ios'; })
	}).prompt(callback);
};

/**
 * Prompts for essential config options.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.wizard = function wizard(callback) {
	this._title(__('Setup Wizard'));
	// TODO
	// "name": "Chris Barber",
	// "email": "cbarber@appcelerator.com",
	// "locale": "en",
	// "sdk"
	// "workspace"
	// android.sdkPath
	callback();
};

/**
 * Checks if your development environment is correctly setup.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.check = function check(callback) {
	this._title(__('Check Environment'));
	// TODO
	// iOS
	// Android
	// Java
	// Python?
	// Node version
	// directory permissions
	// ti sdk
	// common commands (sh, security, openssl, etc)
	// U+2713 	✓ 	Check mark
	// U+2714 	✔ 	Heavy check mark
	// U+2715 	✕ 	Multiplication X
	// U+2716 	✖ 	Heavy multiplication X
	callback();
};

/**
 * Configures user-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.user = function user(callback) {
	this._title(__('User Information'));
	fields.set({
		'name': fields.text({
			default: this.config.get('user.name', ''),
			title: __('What do you want as your "author" name?'),
			validate: function (value) {
				if (!value) {
					throw new Error(__('Invalid name'));
				}
				return true;
			}
		}),
		'email': fields.text({
			default: this.config.get('user.email', ''),
			title: __('What is your email address used for logging into the Appcelerator Network?'),
			validate: function (value) {
				if (!value) {
					throw new Error(__('Invalid e-mail address'));
				}
				return true;
			}
		}),
		'locale': fields.text({
			default: this.config.get('user.locale', ''),
			title: __('What would you like as your default locale?'),
			desc: __('(examples: "en", "en-us", "de", "fr")'),
			validate: function (value) {
				if (!value || !/^[A-Za-z]{2}[A-Za-z]?(([-_][A-Za-z0-9]{4})?[-_][A-Za-z0-9]{2}[A-Za-z0-9]?)?$/.test(value)) {
					throw new Error(__('Invalid locale format'));
				}
				return true;
			}
		})
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
	// TODO
	// "workspace": "",
	// "idprefix": "com.appcelerator",
	// "publisher": "Appcelerator",
	// "url": ""
	callback();
};

/**
 * Configures CLI settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.cli = function cli(callback) {
	this._title(__('Titanium CLI Settings'));
	// TODO
	// "colors": true,
	// "completion": false,
	// "logLevel": "trace",
	// "prompt": true,
	// "failOnWrongSDK": false,
	// "httpProxyServer": "",
	// "width": 100,
	// "progressBars": true
	// "hideCharEncWarning"
	// cli.analytics.showErrors
	callback();
};

/**
 * Configures Titanium SDK settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.sdk = function sdk(callback) {
	this._title(__('Titanium SDK Settings'));
	// TODO
	// selected: "3.2.0",
	// defaultInstallLocation
	callback();
};

/**
 * Configures iOS-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.ios = function ios(callback) {
	if (process.platform != 'darwin') {
		return callback();
	}

	this._title(__('iOS Settings'));

	appc.ios.detect(function (env) {
		// check the iOS environment
	});

// xcode-select
// security

//	logger.log(__('Download and install a certificate from %s', 'https://developer.apple.com/ios/manage/certificates/team/index.action'.cyan) + '\n');
// || (env.certs.devNames.length == 0 && env.certs.distNames.length == 0)
/*

	fields.set({
		'developerName': env.certs.devNames.length && fields.select({
			default: config.get('ios.developerName', ''),
			title: __('What is the name of the iOS developer certificate you want to use by default?'),
			desc: __("Enter 0 (zero) if you don't want to build for iOS."),
			promptLabel: __('Enter # or cert name'),
			display: env.certs.devNames.length > 5 ? 'grid' : 'list',
			complete: true,
			completeIgnoreCase: true,
			zeroSkip: true,
			numbered: true,
			suggest: true,
			options: env.certs.devNames
		}),
		'distributionName': env.certs.distNames.length && fields.select({
			default: config.ios && config.ios.distributionName,
			title: __('What is the name of the iOS distribution certificate you want to use by default?'),
			desc: __('Enter 0 (zero) to skip. This is used if you want to distribute the app either through the App Store or Ad Hoc.'),
			promptLabel: __('Enter # or cert name'),
			display: env.certs.distNames.length > 5 ? 'grid' : 'list',
			complete: true,
			completeIgnoreCase: true,
			zeroSkip: true,
			numbered: true,
			suggest: true,
			options: env.certs.distNames
		})
	}).prompt(function (err, data) {
		!err && this._save({ ios: data });
		callback();
	}.bind(this));
*/
};

/**
 * Configures Android-related settings.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.android = function android(callback) {
	this._title(__('Android Settings'));
	fields.set({
		'sdkPath': fields.file({
			default: this.config.get('android.sdkPath', ''),
			title: __('Path to the Android SDK'),
			desc: __("Leave blank if you don't want to build for Android."),
			complete: true,
			showHidden: true,
			ignore: ['$RECYCLE.BIN'],
			validate: function (value) {
				if (value && !afs.exists(afs.resolvePath(value))) {
					this.logger.error(__('Invalid Android SDK path'));
					return false;
				}
				return true;
			}.bind(this)
		}),
		'ndkPath': fields.file({
			default: this.config.get('android.ndkPath', ''),
			title: __('Path to the Android NDK'),
			desc: __('Only required for building native Titainum Modules.'),
			complete: true,
			showHidden: true,
			ignore: ['$RECYCLE.BIN'],
			validate: function (value) {
				if (value && !afs.exists(afs.resolvePath(value))) {
					throw new appc.exception(__('Invalid Android NDK path'));
				}
				return true;
			}.bind(this)
		})
	}).prompt(function (err, data) {
		!err && this._save({ android: data });
		callback();
	}.bind(this));
};

/**
 * Configures search paths.
 * @param {Function} callback - Function to be called when the prompting finishes
 */
SetupScreens.prototype.paths = function android(paths) {
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

/*function old(){
	appc.ios.detect(function (env) {
		var distNames = env && env.certs.distNames.map(function (name) {
				var m = name.match(/^([^(]+?)*                /);
				return m && m[0].trim();
			}),
			sdk = cli.env.getSDK(config.sdk.selected || config.app.sdk) || cli.env.getSDK('latest');

		async.series({
			'app': function (next) {
				logger.log(__('App Settings').magenta + '\n');

				var active = ' [' + __('active') + ']',
					longestSDK = 0;
				Object.keys(cli.env.sdks).forEach(function (s) {
					if (s == sdk.name) {
						s += active;
					}
					if (s.length > longestSDK) {
						longestSDK = s.length;
					}
				});

				fields.set({
					'idprefix': fields.text({
						default: config.app.idprefix,
						label: __('What is your prefix for application IDs?'),
						desc: __('(example: com.mycompany)')
					}),
					'publisher': fields.text({
						default: config.app.publisher,
						label: __('Used for populating the "publisher" field in new projects:')
					}),
					'url': fields.text({
						default: config.app.url,
						label: __('Used for populating the "url" field in new projects:')
					}),
					'sdk': fields.select({
						default: sdk && sdk.name,
						label: __('What Titanium SDK would you like to use by default?'),
						complete: true,
						completeIgnoreCase: true,
						suggest: true,
						suggestThreshold: 2,
						numbered: true,
						formatters: {
							option: function (opt, idx, num) {
								var len = (opt.label + (opt.value == sdk.name ? active : '')).length;
								return num + opt.label.cyan + (opt.value == sdk.name ? active.grey : '') + (new Array(longestSDK - len + 1)).join(' ') + '  ' + opt.path;
							}
						},
						promptLabel: __('Enter # or SDK name'),
						options: Object.keys(cli.env.sdks).map(function (sdk) {
							return { label: cli.env.sdks[sdk].name, path: cli.env.sdks[sdk].path, value: sdk };
						}),
						validate: function (value) {
							if (!cli.env.sdks[value]) {
								throw new Error(__('Invalid Titanium SDK'));
							}
							return true;
						}
					}),
					'workspace': fields.file({
						default: config.app.workspace,
						label: __('Path to your workspace where your projects should be created:'),
						complete: true,
						validate: function (value) {
							if (!afs.exists(afs.resolvePath(value))) {
								throw new Error(__('Invalid workspace directory'));
							}
							return true;
						}
					})
				}).prompt(next);
			},

			'cli': function (next) {
				logger.log(__('CLI Settings').magenta + '\n');

				var logLevels = logger.getLevels();

				fields.set({
					'colors': fields.select({
						promptLabel: 'Enable colors in the CLI?',
						display: 'prompt',
						default: config.cli.colors === false ? 'no' : 'yes',
						options: [ 'yes', 'no' ],
						validate: function (value, callback) {
							callback(null, value === 'yes');
						}
					}),
					'logLevel': fields.select({
						default: config.cli.logLevel || 'info',
						label: __('Default logging output level'),
						promptLabel: __('Enter # or log level'),
						complete: true,
						completeIgnoreCase: true,
						numbered: true,
						suggest: true,
						suggestThreshold: 2,
						options: logLevels,
						style: {
							option: 'cyan'
						}
					}),
					'prompt': fields.select({
						promptLabel: __('Would you like to be prompted for missing options and arguments?'),
						display: 'prompt',
						default: (config.cli.hasOwnProperty('prompt') ? !!config.cli.prompt : true) ? 'yes' : 'no',
						options: [ 'yes', 'no' ],
						validate: function (value, callback) {
							callback(null, value === 'yes');
						}
					}),
					'failOnWrongSDK': fields.select({
						promptLabel: __('Fail if trying to compile an app on different version in the tiapp.xml?').bold,
						display: 'prompt',
						default: !!config.cli.failOnWrongSDK || false ? 'yes' : 'no',
						options: [ 'yes', 'no' ],
						validate: function (value, callback) {
							callback(null, value === 'yes');
						}
					}),
					'hasProxy': fields.select({
						promptLabel: __('Are you behind a proxy server?').bold,
						display: 'prompt',
						default: config.httpProxyServer ? 'yes' : 'no',
						options: [ 'yes', 'no' ],
						hidden: true,
						validate: function (value, callback) {
							callback(null, value === 'yes');
						},
						next: function (value) {
							return value ? 'httpProxyServer' : null;
						}
					}),
					'httpProxyServer': fields.text({
						default: config.httpProxyServer || '',
						label: __('HTTP proxy server'),
						desc: __('Only required if you are behind a proxy, otherwise leave blank.')
					})
				}).prompt(next);
			},
		}, function (err, values) {
			if (err) {
				logger.log('\n');
				process.exit(1);
			}

			var toString = Object.prototype.toString;
			(function mix(dest, src) {
				Object.keys(src).forEach(function (s) {
					if (dest.hasOwnProperty(s) && toString.call(src[s]) == '[object Object]' && toString.call(dest[s]) == '[object Object]') {
						mix(dest[s], src[s]);
					} else if (dest.hasOwnProperty(s) && Array.isArray(dest[s])) {
						if (Array.isArray(src[s])) {
							// note: this will not remove dupes
							dest[s] = dest[s].concat(src[s]);
						} else {
							dest[s].push(src[s]);
						}
					} else {
						dest[s] = src[s];
					}
				});
			}(config, values));

			config.save();

			logger.log('\n' + __('Configuration saved') + '\n');
			finished();
		});
	});
};*/
