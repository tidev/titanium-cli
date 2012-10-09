/*
 * setup.js: Titanium CLI setup command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	afs = appc.fs,
	async = require('async'),
	exec = require('child_process').exec,
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n;

exports.desc = __('run the setup wizard');

exports.config = function (logger, config, cli) {
	return {
		noAuth: true,
		flags: {
			advanced: {
				abbr: 'a',
				desc: __('prompts for all configuration options')
			}
		}
	};
};

exports.run = function (logger, config, cli) {
	logger.log(__('Enter %s at any time to quit', 'ctrl-c'.cyan) + '\n');
	
	var props = {
		'user.name': {
			default: config.user.name,
			description: 'What is your name? This is used as the default for the "author" field in the tiapp.xml or module manifest file when creating new projects.',
			label: 'Your name'
		},
		'user.email': {
			default: config.user.email,
			description: 'What is your email address used for logging into the Appcelerator Network?',
			label: 'Your e-mail address'
		},
		'user.locale': {
			default: config.user.locale || locale,
			description: 'What would you like as your default locale?',
			label: 'Locale'
		},
		'app.idprefix': {
			advanced: true,
			default: config.app.idprefix,
			description: 'What is your prefix for application IDs (example: com.mycompany)',
			label: 'ID prefix'
		},
		'app.publisher': {
			advanced: true,
			default: config.app.publisher,
			description: 'Used for populating the "publisher" field in new projects',
			label: 'Default publisher name'
		},
		'app.url': {
			advanced: true,
			default: config.user.url,
			description: 'Used for populating the "url" field in new projects',
			label: 'Default company URL'
		},
		'app.sdk': {
			default: cli.env.getSDK(config.user.sdk),
			description: 'What Titanium SDK would you like to use by default?',
			label: 'Titanium SDK to use',
			validate: function (value) {
				if (!cli.env.sdks[value]) {
					// TODO: error message
					return false;
				}
				return true;
			}
		},
		'app.workspace': {
			default: config.app.workspace,
			label: 'Workspace path',
			validate: function (value) {
				if (!afs.exists(afs.resolvePath(value))) {
					// TODO: error message
					return false;
				}
				return true;
			}
		},
		'cli.colors': {
			advanced: true,
			default: !!config.cli.colors,
			description: '',
			label: 'Enable colors in the CLI',
			values: ['y', 'n']
		},
		'cli.logLevel': {
			advanced: true,
			default: config.cli.logLevel || 'info',
			description: 'Default logging output level',
			label: 'Enable colors in the CLI',
			values: logger.getLevels()
		},
		'cli.prompt': {
			advanced: true,
			default: config.cli.hasOwnProperty('prompt') ? !!config.cli.prompt : true,
			description: 'Would you like to be prompted for missing options and arguments?',
			label: 'Enable prompting',
			values: ['y', 'n']
		},
		'cli.failOnWrongSDK': {
			advanced: true,
			default: !!config.cli.failOnWrongSDK || false,
			description: 'If trying to run an SDK command such as "build" for a',
			label: 'Fail on wrong SDK',
			values: ['y', 'n']
		},
		'android.sdkPath': {
			default: config.android.sdkPath,
			description: 'Path to the Android SDK. This is needed for building Android apps.',
			label: 'Android SDK path'
		},
		'android.ndkPath': {
			advanced: true,
			default: config.android.ndkPath,
			description: 'Path to the Android NDK. This is needed for building native Titainum Modules for Android.',
			label: 'Android SDK path'
		},
		'ios.developerName': {
			advanced: true,
			default: config.ios.developerName,
			description: 'What is the name of the iOS developer certificate you want to use by default? This is used if you want to test on device.',
			label: 'iOS Developer Name'
		},
		'ios.distributionName': {
			advanced: true,
			default: config.ios.distributionName,
			description: 'What is the name of the iOS distribution certificate you want to use by default? This is used if you want to distribute the app either through the App Store or Ad Hoc.',
			label: 'iOS Distribution Name'
		}
	};
	
	// if we're not doing an advanced setup, then let's remove the advanced props now
	if (!cli.argv.advanced) {
		Object.keys(props).forEach(function (name) {
			if (props[name].advanced) {
				delete props[name];
			}
		});
	}
	
	// remove ios props if we're not on mac os x
	if (process.platform != 'darwin') {
		delete props['ios.developerName'];
		delete props['ios.distributionName'];
	}
	
	appc.prompt({
		properties: props
	}, function (err, results) {
		Object.keys(results).forEach(function (key) {
console.log('setting ' + key + ' to ' + results[key]);
			config.set(key, results[key]);
		});
		
dump(config);
		
		// config.save();
		logger.log(__('Configuration saved') + '\n');
	});
};
