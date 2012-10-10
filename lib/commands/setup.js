/*
 * setup.js: Titanium CLI setup command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	afs = appc.fs,
	prompt = require('prompt'),
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
	
	appc.ios.detect(function (env) {
		var validate = require('revalidator').validate,
			devNames = env.certs.devNames.map(function (name) {
				var m = name.match(/^([^(]+?)*/);
				return m && m[0].trim();
			}),
			distNames = env.certs.distNames.map(function (name) {
				var m = name.match(/^([^(]+?)*/);
				return m && m[0].trim();
			}),
			props = {
				'user.name': {
					default: config.user.name,
					description: __('What is your name?').bold + ' ' + __('(this is used as the default for the "author" field in the tiapp.xml or module manifest file when creating new projects)').grey,
					errorMsg: __('Invalid name'),
					conform: function (value) {
						return !!value.trim()
					}
				},
				'user.email': {
					default: config.user.email,
					description: __('What is your email address used for logging into the Appcelerator Network?').bold,
					errorMsg: __('Invalid e-mail address'),
					conform: function (value) {
						return !!value.trim()
					}
				},
				'user.locale': {
					default: config.user.locale,
					description: __('What would you like as your default locale?').bold + ' ' + __('(examples: "en", "de", "fr")').grey,
					errorMsg: __('Invalid locale'),
					conform: function (value) {
						return !!value.trim()
					}
	
				},
				'app.idprefix': {
					advanced: true,
					default: config.app.idprefix,
					description: __('What is your prefix for application IDs?').bold + ' ' + __('(example: com.mycompany)').grey
				},
				'app.publisher': {
					advanced: true,
					default: config.app.publisher,
					description: __('Used for populating the "publisher" field in new projects:').bold
				},
				'app.url': {
					advanced: true,
					default: config.user.url,
					description: __('Used for populating the "url" field in new projects:').bold
				},
				'app.sdk': {
					default: cli.env.getSDK(config.user.sdk).name,
					description: __('What Titanium SDK would you like to use by default?').bold,
					conform: function (value) {
						if (!cli.env.sdks[value]) {
							throw new appc.exception(__('Invalid Titanium SDK'));
						}
						return true;
					}
				},
				'app.workspace': {
					default: config.app.workspace,
					description: __('Path to your workspace where your projects should be created:').bold,
					conform: function (value) {
						if (!afs.exists(afs.resolvePath(value))) {
							throw new appc.exception(__('Invalid workspace directory'));
						}
						return true;
					}
				},
				'cli.colors': {
					advanced: true,
					default: !!config.cli.colors,
					description: __('Enable colors in the CLI?').bold,
					before: function (value) {
						return value === 'true';
					},
					conform: function (value) {
						if (!/^true|false$/.test(value)) {
							throw new appc.exception(__('Please specify %s or %s', 'true', 'false'));
						}
						return true;
					}
				},
				'cli.logLevel': {
					advanced: true,
					default: config.cli.logLevel || 'info',
					description: __('Default logging output level').bold,
					conform: function (value) {
						if (logger.getLevels().indexOf(value.toLowerCase()) == -1) {
							throw new appc.exception(
								__('Invalid log level'),
								[__('Available log levels:')].concat(logger.getLevels().map(function (level) {
									return '    ' + level.cyan;
								}))
							);
						}
						return true;
					}
				},
				'cli.prompt': {
					advanced: true,
					default: config.cli.hasOwnProperty('prompt') ? !!config.cli.prompt : true,
					description: __('Would you like to be prompted for missing options and arguments?').bold,
					before: function (value) {
						return value === 'true';
					},
					conform: function (value) {
						if (!/^true|false$/.test(value)) {
							throw new appc.exception(__('Please specify %s or %s', 'true', 'false'));
						}
						return true;
					}
				},
				'cli.failOnWrongSDK': {
					advanced: true,
					default: !!config.cli.failOnWrongSDK || false,
					description: __('Fail if trying to compile an app on different version in the tiapp.xml?').bold,
					before: function (value) {
						return value === 'true';
					},
					conform: function (value) {
						if (!/^true|false$/.test(value)) {
							throw new appc.exception(__('Please specify %s or %s', 'true', 'false'));
						}
						return true;
					}
				},
				'android.sdkPath': {
					default: config.android && config.android.sdkPath,
					description: __('Path to the Android SDK:').bold + ' ' + __('(this is needed for building Android apps)').grey,
					conform: function (value) {
						if (value && !afs.exists(afs.resolvePath(value))) {
							throw new appc.exception(__('Invalid Android SDK path'));
						}
						return true;
					}
				},
				'android.ndkPath': {
					advanced: true,
					default: config.android && config.android.ndkPath,
					description: __('Path to the Android NDK:').bold + ' ' + __('(this is needed for building native Titainum Modules for Android)').grey,
					conform: function (value) {
						if (value && !afs.exists(afs.resolvePath(value))) {
							throw new appc.exception(__('Invalid Android NDK path'));
						}
						return true;
					}
				},
				'ios.developerName': {
					advanced: true,
					default: config.ios && config.ios.developerName,
					description: __('What is the name of the iOS developer certificate you want to use by default?').bold
						+ ' ' + __('(this is used if you want to test on device)').grey,
					conform: function (name) {
						if (devNames.indexOf(name) == -1) {
							throw new appc.exception(__('Unable to find an iOS Developer Certificate for "%s"', name), [
								__('Available names: %s', devNames.map(function (d) { return ('"' + d + '"').cyan; }).join(', '))
							]);
						}
						return true;
					}
				},
				'ios.distributionName': {
					advanced: true,
					default: config.ios && config.ios.distributionName,
					description: __('What is the name of the iOS distribution certificate you want to use by default?').bold
						+ ' ' + __('(this is used if you want to distribute the app either through the App Store or Ad Hoc)').grey,
					conform: function (name) {
						if (distNames.indexOf(name) == -1) {
							throw new appc.exception(__('Unable to find an iOS Distribution Certificate for "%s"', name), [
								__('Available names: %s', distNames.map(function (d) { return ('"' + d + '"').cyan; }).join(', '))
							]);
						}
						return true;
					}
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
			properties: props
		}, function (err, results) {
			if (err) {
				logger.log('\n');
				process.exit(1);
			}
			
			Object.keys(results).forEach(function (key) {
				config.set(key, (results[key] || '').trim());
			});
			
			config.save();
			logger.log('\n' + __('Configuration saved') + '\n');
		});
	});
};
