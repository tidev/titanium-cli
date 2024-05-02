'use strict';

const ADB = require('node-titanium-sdk/lib/adb');
const android = require('node-titanium-sdk/lib/android');
const androidDetect = require('../lib/detect').detect;
const Builder = require('../../../cli/lib/node-titanium-sdk/builder');
const EmulatorManager = require('node-titanium-sdk/lib/emulator');
const fields = require('fields');
const fs = require('fs');
const path = require('path');
const util = require('util');

const version = '0.0.0';

function AndroidBuilder() {
	Builder.apply(this, arguments);

	this.devices = null; // set by findTargetDevices() during 'config' phase
	this.devicesToAutoSelectFrom = [];

	this.keystoreAliases = [];

	this.tiSymbols = {};

	this.validABIs = this.packageJson.architectures;
	this.compileSdkVersion = this.packageJson.compileSDKVersion; // this should always be >= maxSupportedApiLevel
	this.minSupportedApiLevel = parseInt(this.packageJson.minSDKVersion);
	this.minTargetApiLevel = parseInt(version.parseMin(this.packageJson.vendorDependencies['android sdk']));
	this.maxSupportedApiLevel = parseInt(version.parseMax(this.packageJson.vendorDependencies['android sdk']));

	this.deployTypes = {
		emulator: 'development',
		device: 'test',
		'dist-playstore': 'production'
	};

	this.targets = ['emulator', 'device', 'dist-playstore'];
}

util.inherits(AndroidBuilder, Builder);

AndroidBuilder.prototype.config = function config(logger, config, cli) {
	Builder.prototype.config.apply(this, arguments);

	const _t = this;

	function assertIssue(logger, issues, name) {
		for (let i = 0; i < issues.length; i++) {
			if ((typeof name === 'string' && issues[i].id === name) || (typeof name === 'object' && name.test(issues[i].id))) {
				issues[i].message.split('\n').forEach(function (line) {
					logger[issues[i].type === 'error' ? 'error' : 'warn'](line.replace(/(__(.+?)__)/g, '$2'.bold));
				});
				logger.log();
				if (issues[i].type === 'error') {
					process.exit(1);
				}
			}
		}
	}

	// we hook into the pre-validate event so that we can stop the build before
	// prompting if we know the build is going to fail.
	//
	// this is also where we can detect android and jdk environments before
	// prompting occurs. because detection is expensive we also do it here instead
	// of during config() because there's no sense detecting if config() is being
	// called because of the help command.
	cli.on('cli:pre-validate', function (_obj, callback) {
		if (cli.argv.platform && cli.argv.platform !== 'android') {
			return callback();
		}

		_t.buildOnly = cli.argv['build-only'];
		_t.jdkInfo = {}; // mock?

		// detect android environment
		androidDetect(config, { packageJson: _t.packageJson }, androidInfo => {
			_t.androidInfo = androidInfo;
			assertIssue(logger, androidInfo.issues, 'ANDROID_JDK_NOT_FOUND');
			assertIssue(logger, androidInfo.issues, 'ANDROID_JDK_PATH_CONTAINS_AMPERSANDS');

			// if --android-sdk was not specified, then we simply try to set a default android sdk
			if (!cli.argv['android-sdk']) {
				let androidSdkPath = config.android && config.android.sdkPath;
				if (!androidSdkPath && androidInfo.sdk) {
					androidSdkPath = androidInfo.sdk.path;
				}
				androidSdkPath && (cli.argv['android-sdk'] = path.resolve(androidSdkPath));
			}

			callback();
		});
	});

	const targetDeviceCache = {};
	const findTargetDevices = function findTargetDevices(target, callback) {
		if (targetDeviceCache[target]) {
			return callback(null, targetDeviceCache[target]);
		}

		if (target === 'device') {
			new ADB(config).devices(function (err, devices) {
				if (err) {
					callback(err);
				} else {
					this.devices = devices.filter(function (d) {
						return !d.emulator && d.state === 'device';
					});
					if (this.devices.length > 1) {
						// we have more than 1 device, so we should show 'all'
						this.devices.push({
							id: 'all',
							model: 'All Devices'
						});
					}
					callback(null, targetDeviceCache[target] = this.devices.map(function (d) {
						return {
							name: d.model || d.manufacturer,
							id: d.id,
							version: d.release,
							abi: Array.isArray(d.abi) ? d.abi.join(',') : d.abi,
							type: 'device'
						};
					}));
				}
			}.bind(this));
		} else if (target === 'emulator') {
			new EmulatorManager(config).detect(function (err, emus) {
				if (err) {
					callback(err);
				} else {
					this.devices = emus;
					callback(null, targetDeviceCache[target] = emus.map(function (emu) {
						// normalize the emulator info
						if (emu.type === 'avd') {
							return {
								name: emu.name,
								id: emu.id,
								api: emu['api-level'],
								version: emu['sdk-version'],
								abi: emu.abi,
								type: emu.type,
								googleApis: emu.googleApis,
								sdcard: emu.sdcard
							};
						} else if (emu.type === 'genymotion') {
							return {
								name: emu.name,
								id: emu.name,
								api: emu['api-level'],
								version: emu['sdk-version'],
								abi: emu.abi,
								type: emu.type,
								googleApis: emu.googleApis,
								sdcard: true
							};
						}
						return emu; // not good
					}));
				}
			}.bind(this));
		} else {
			callback();
		}
	}.bind(this);

	return function (finished) {
		cli.createHook('build.android.config', this, callback => {
			const conf = {
				flags: {
					launch: {
						desc: 'disable launching the app after installing',
						default: true,
						hideDefault: true,
						negate: true
					}
				},
				options: {
					alias: {
						abbr: 'L',
						desc: 'the alias for the keystore',
						hint: 'alias',
						order: 155,
						prompt(callback) {
							callback(fields.select({
								title: 'What is the name of the keystore\'s certificate alias?',
								promptLabel: 'Select a certificate alias by number or name',
								margin: '',
								optionLabel: 'name',
								optionValue: 'name',
								numbered: true,
								relistOnError: true,
								complete: true,
								suggest: false,
								options: _t.keystoreAliases,
								validate: conf.options.alias.validate
							}));
						},
						validate(value, callback) {
							// if there's a value, then they entered something, otherwise let the cli prompt
							if (value) {
								const selectedAlias = value.toLowerCase(),
									alias = _t.keystoreAlias = _t.keystoreAliases.filter(function (a) { return a.name && a.name.toLowerCase() === selectedAlias; }).shift();
								if (!alias) {
									return callback(new Error(`Invalid "--alias" value "${value}"`));
								}
							}
							callback(null, value);
						}
					},
					'android-sdk': {
						abbr: 'A',
						default: config.android && config.android.sdkPath && path.resolve(config.android.sdkPath),
						desc: 'the path to the Android SDK',
						hint: 'path',
						order: 100,
						prompt: function (callback) {
							let androidSdkPath = config.android && config.android.sdkPath;
							if (!androidSdkPath && _t.androidInfo.sdk) {
								androidSdkPath = _t.androidInfo.sdk.path;
							}
							if (androidSdkPath) {
								androidSdkPath = path.resolve(androidSdkPath);
								if (process.platform === 'win32' || androidSdkPath.indexOf('&') !== -1) {
									androidSdkPath = undefined;
								}
							}

							callback(fields.file({
								promptLabel: 'Where is the Android SDK?',
								default: androidSdkPath,
								complete: true,
								showHidden: true,
								ignoreDirs: _t.ignoreDirs,
								ignoreFiles: _t.ignoreFiles,
								validate: _t.conf.options['android-sdk'].validate.bind(_t)
							}));
						},
						required: true,
						validate: function (value, callback) {
							if (!value) {
								callback(new Error('Invalid Android SDK path'));
							} else if (process.platform === 'win32' && value.indexOf('&') !== -1) {
								callback(new Error('The Android SDK path cannot contain ampersands (&) on Windows'));
							} else if (_t.androidInfo.sdk && _t.androidInfo.sdk.path === path.resolve(value)) {
								callback(null, value);
							} else {
								// attempt to find android sdk
								const pkginfo = {}; // appc.pkginfo.package(module)

								android.findSDK(value, config, pkginfo, () => {

									// NOTE: ignore errors when finding sdk, let gradle validate the sdk

									function next() {
										// set the android sdk in the config just in case a plugin or something needs it
										config.set('android.sdkPath', value);

										// path looks good, do a full scan again
										androidDetect(config, { packageJson: _t.packageJson, bypassCache: true }, androidInfo => {

											// assume sdk is valid, let gradle validate the sdk
											if (!androidInfo.sdk) {
												androidInfo.sdk = { path: value };
											}

											_t.androidInfo = androidInfo;
											callback(null, value);
										});
									}

									// new android sdk path looks good
									// if we found an android sdk in the pre-validate hook, then we need to kill the other sdk's adb server
									if (_t.androidInfo.sdk) {
										new ADB(config).stopServer(next);
									} else {
										next();
									}
								});
							}
						}
					},
					'avd-abi': {
						abbr: 'B',
						desc: 'the abi for the Android emulator; deprecated, use --device-id',
						hint: 'abi'
					},
					'avd-id': {
						abbr: 'I',
						desc: 'the id for the Android emulator; deprecated, use --device-id',
						hint: 'id'
					},
					'avd-skin': {
						abbr: 'S',
						desc: 'the skin for the Android emulator; deprecated, use --device-id',
						hint: 'skin'
					},
					'build-type': {
						hidden: true
					},
					'debug-host': {
						hidden: true
					},
					'deploy-type': {
						abbr: 'D',
						desc: `the type of deployment; only used when target is ${'emulator'.cyan} or ${'device'.cyan}`,
						hint: 'type',
						order: 110,
						values: ['test', 'development']
					},
					'device-id': {
						abbr: 'C',
						desc: 'the id of the Android emulator or the device id to install the application to',
						hint: 'name',
						order: 130,
						prompt(callback) {
							findTargetDevices(cli.argv.target, (_err, results) => {
								let opts = {};
								let title;
								let promptLabel;

								// we need to sort all results into groups for the select field
								if (cli.argv.target === 'device' && results.length) {
									opts['Devices'] = results;
									title = 'Which device do you want to install your app on?';
									promptLabel = 'Select a device by number or name';
								} else if (cli.argv.target === 'emulator') {
									// for emulators, we sort by type
									let emus = results.filter(function (e) {
										return e.type === 'avd';
									});

									if (emus.length) {
										opts['Android Emulators'] = emus;
									}

									emus = results.filter(function (e) {
										return e.type === 'genymotion';
									});
									if (emus.length) {
										opts['Genymotion Emulators'] = emus;

										logger.log('NOTE: Genymotion emulator must be running to detect Google API support'.magenta + '\n');
									}

									title = 'Which emulator do you want to launch your app in?';
									promptLabel = 'Select an emulator by number or name';
								}

								// if there are no devices/emulators, error
								if (!Object.keys(opts).length) {
									if (cli.argv.target === 'device') {
										logger.warn('Unable to find any devices, possibily due to missing dependencies.\n');
										logger.log('Continuing with build... (will attempt to install missing dependencies)\n');
									} else {
										logger.warn('Unable to find any emulators, possibily due to missing dependencies.\n');
										logger.log('Continuing with build... (will attempt to install missing dependencies)\n');
									}
									_t.buildOnly = true;
									return callback();
								}

								callback(fields.select({
									title: title,
									promptLabel: promptLabel,
									formatters: {
										option: function (opt, idx, num) {
											return '  ' + num + opt.name.cyan + (opt.version ? ' (' + opt.version + ')' : '') + (opt.googleApis
												? ' (Google APIs supported)'.grey
												: opt.googleApis === null
													? ' (Google APIs support unknown)'.grey
													: '');
										}
									},
									autoSelectOne: true,
									margin: '',
									optionLabel: 'name',
									optionValue: 'id',
									numbered: true,
									relistOnError: true,
									complete: true,
									suggest: true,
									options: opts
								}));
							});
						},
						required: true,
						validate(device, callback) {
							const dev = device.toLowerCase();
							findTargetDevices(cli.argv.target, function (_err, devices) {
								if (cli.argv.target === 'device' && dev === 'all') {
									// we let 'all' slide by
									return callback(null, dev);
								}
								for (let i = 0; i < devices.length; i++) {
									if (devices[i].id.toLowerCase() === dev) {
										return callback(null, devices[i].id);
									}
								}
								callback(new Error(cli.argv.target ? `Invalid Android device "${device}"` : `Invalid Android emulator "${device}"`));
							});
						},
						verifyIfRequired(callback) {
							if (_t.buildOnly) {
								// not required if we're build only
								return callback();
							}

							findTargetDevices(cli.argv.target, function (err, results) {
								if (cli.argv.target === 'emulator' && cli.argv['device-id'] === undefined && cli.argv['avd-id']) {
									// if --device-id was not specified, but --avd-id was, then we need to
									// try to resolve a device based on the legacy --avd-* options
									let avds = results.filter(function (a) {
											return a.type === 'avd';
										}).map(function (a) {
											return a.name;
										}),
										name = 'titanium_' + cli.argv['avd-id'] + '_';

									if (avds.length) {
										// try finding the first avd that starts with the avd id
										avds = avds.filter(function (avd) {
											return avd.indexOf(name) === 0;
										});
										if (avds.length === 1) {
											cli.argv['device-id'] = avds[0];
											return callback();
										} else if (avds.length > 1) {
											// next try using the avd skin
											if (!cli.argv['avd-skin']) {
												// we have more than one match
												logger.error(`Found ${avds.length} avd with id "${cli.argv['avd-id']}"`);
												logger.error('Specify --avd-skin and --avd-abi to select a specific emulator\n');
											} else {
												name += cli.argv['avd-skin'];
												// try exact match
												let tmp = avds.filter(function (avd) {
													return avd === name;
												});
												if (tmp.length) {
													avds = tmp;
												} else {
													// try partial match
													avds = avds.filter(function (avd) {
														return avd.indexOf(name + '_') === 0;
													});
												}
												if (avds.length === 0) {
													logger.error(`No emulators found with id "${cli.argv['avd-id']}" and skin "${cli.argv['avd-skin']}"\n`);
												} else if (avds.length === 1) {
													cli.argv['device-id'] = avds[0];
													return callback();
												} else if (!cli.argv['avd-abi']) {
													// we have more than one matching avd, but no abi to filter by so we have to error
													logger.error(`Found ${avds.length} avd with id "${cli.argv['avd-id']}" and skin "${cli.argv['avd-skin']}"`);
													logger.error('Specify --avd-abi to select a specific emulator\n');
												} else {
													name += '_' + cli.argv['avd-abi'];
													// try exact match
													tmp = avds.filter(function (avd) {
														return avd === name;
													});
													if (tmp.length) {
														avds = tmp;
													} else {
														avds = avds.filter(function (avd) {
															return avd.indexOf(name + '_') === 0;
														});
													}
													if (avds.length === 0) {
														logger.error(`No emulators found with id "${cli.argv['avd-id']}", skin "${cli.argv['avd-skin']}", and abi "${cli.argv['avd-abi']}"\n`);
													} else {
														// there is one or more avds, but we'll just return the first one
														cli.argv['device-id'] = avds[0];
														return callback();
													}
												}
											}
										}

										logger.warn(`${'--avd-*'.cyan} options have been ${'deprecated'.red}, please use ${'--device-id'.cyan}\n`);

										// print list of available avds
										if (results.length && !cli.argv.prompt) {
											logger.log('Available Emulators:');
											results.forEach(function (emu) {
												logger.log('   ' + emu.name.cyan + ' (' + emu.version + ')');
											});
											logger.log();
										}
									}

								} else if (cli.argv['device-id'] === undefined && results && results.length && config.get('android.autoSelectDevice', true)) {
									// we set the device-id to an array of devices so that later in validate()
									// after the tiapp.xml has been parsed, we can auto select the best device
									_t.devicesToAutoSelectFrom = results.sort((a, b) => {
										const eq = a.api && b.api && a.api === b.api;
										const gt = a.api && b.api && a.api.localeCompare(b.api) === 1;

										if (eq) {
											if (a.type === b.type) {
												if (a.googleApis === b.googleApis) {
													return 0;
												} else if (b.googleApis) {
													return 1;
												} else if (a.googleApis === false && b.googleApis === null) {
													return 1;
												}
												return -1;
											}
											return a.type === 'avd' ? -1 : 1;
										}

										return gt ? 1 : -1;
									});
									return callback();
								}

								// Failed to find devices, fallback to buildOnly.
								logger.warn('Unable to find any emulators or devices, possibily due to missing dependencies.');
								logger.warn('Continuing with build... (will attempt to install missing dependencies)');
								_t.buildOnly = true;
								return callback();
							});
						}
					},
					'key-password': {
						desc: 'the password for the keystore private key (defaults to the store-password)',
						hint: 'keypass',
						order: 160,
						prompt: function (callback) {
							callback(fields.text({
								promptLabel: 'What is the keystore\'s __key password__? ' + '(leave blank to use the store password)'.grey,
								password: true,
								validate: _t.conf.options['key-password'].validate.bind(_t)
							}));
						},
						secret: true,
						validate: function (keyPassword, callback) {
							// sanity check the keystore and store password
							_t.conf.options['store-password'].validate(cli.argv['store-password'], function (err, storePassword) {
								if (err) {
									// we have a bad --keystore or --store-password arg
									cli.argv.keystore = cli.argv['store-password'] = undefined;
									return callback(err);
								}

								callback(null, keyPassword);
							});
						}
					},
					keystore: {
						abbr: 'K',
						callback() {
							_t.conf.options['alias'].required = true;
							_t.conf.options['store-password'].required = true;
						},
						desc: 'the location of the keystore file',
						hint: 'path',
						order: 140,
						prompt(callback) {
							_t.conf.options['key-password'].required = true;
							callback(fields.file({
								promptLabel: 'Where is the __keystore file__ used to sign the app?',
								complete: true,
								showHidden: true,
								ignoreDirs: _t.ignoreDirs,
								ignoreFiles: _t.ignoreFiles,
								validate: _t.conf.options.keystore.validate.bind(_t)
							}));
						},
						validate(keystoreFile, callback) {
							if (!keystoreFile) {
								callback(new Error('Please specify the path to your keystore file'));
							} else {
								keystoreFile = path.resolve(keystoreFile);
								if (!fs.existsSync(keystoreFile) || !fs.statSync(keystoreFile).isFile()) {
									callback(new Error('Invalid keystore file'));
								} else {
									callback(null, keystoreFile);
								}
							}
						}
					},
					'output-dir': {
						abbr: 'O',
						desc: `the output directory when using ${'dist-playstore'.cyan}`,
						hint: 'dir',
						order: 180,
						prompt: function (callback) {
							callback(fields.file({
								promptLabel: 'Where would you like the output APK file saved?',
								default: cli.argv['project-dir'] && path.resolvePath(cli.argv['project-dir'], 'dist'),
								complete: true,
								showHidden: true,
								ignoreDirs: _t.ignoreDirs,
								ignoreFiles: /.*/,
								validate: _t.conf.options['output-dir'].validate.bind(_t)
							}));
						},
						validate: function (outputDir, callback) {
							callback(outputDir || !_t.conf.options['output-dir'].required ? null : new Error('Invalid output directory'), outputDir);
						}
					},
					'profiler-host': {
						hidden: true
					},
					'store-password': {
						abbr: 'P',
						desc: 'the password for the keystore',
						hint: 'password',
						order: 150,
						prompt(callback) {
							callback(fields.text({
								next: function (err) {
									return err && err.next || null;
								},
								promptLabel: 'What is the keystore\'s __password__?',
								password: true,
								// if the password fails due to bad keystore file,
								// we need to prompt for the keystore file again
								repromptOnError: false,
								validate: _t.conf.options['store-password'].validate.bind(_t)
							}));
						},
						secret: true,
						validate(storePassword, callback) {
							if (!storePassword) {
								return callback(new Error('Please specify a keystore password'));
							}

							// sanity check the keystore
							_t.conf.options.keystore.validate(cli.argv.keystore, function (err, keystoreFile) {
								if (err) {
									// we have a bad --keystore arg
									cli.argv.keystore = undefined;
									return callback(err);
								}

								callback(null, storePassword);
							});
						}
					},
					target: {
						abbr: 'T',
						callback(value) {
							// as soon as we know the target, toggle required options for validation
							if (value === 'dist-playstore') {
								_t.conf.options['alias'].required = true;
								_t.conf.options['deploy-type'].values = ['production'];
								_t.conf.options['device-id'].required = false;
								_t.conf.options['keystore'].required = true;
								_t.conf.options['output-dir'].required = true;
								_t.conf.options['store-password'].required = true;
							}
						},
						default: 'emulator',
						desc: 'the target to build for',
						order: 120,
						required: true,
						values: _t.targets
					},
					sigalg: {
						desc: 'the type of a digital signature algorithm. only used when overriding keystore signing algorithm',
						hint: 'signing',
						order: 170,
						values: ['MD5withRSA', 'SHA1withRSA', 'SHA256withRSA']
					}
				}
			};

			callback(null, _t.conf = conf);
		})((_err, result) => finished(result));
	};
};

AndroidBuilder.prototype.validate = function validate(_logger, _config, _cli) {
	Builder.prototype.validate.apply(this, arguments);

	return function (callback) {
		this.validateTiModules('android', this.deployType, (_err, _modules) => {
			callback();
		});
	}.bind(this);
};

AndroidBuilder.prototype.run = async function run(_logger, _config, cli, finished) {
	try {
		Builder.prototype.run.apply(this, arguments);

		await new Promise(resolve => cli.emit('build.pre.construct', this, resolve));

		await new Promise((resolve, reject) => {
			cli.emit('build.pre.compile', this, e => (e ? reject(e) : resolve()));
		});

		await new Promise(resolve => cli.emit('build.pre.build', this, resolve));
		await new Promise(resolve => cli.emit('build.post.build', this, resolve));
		await new Promise(resolve => cli.emit('build.post.compile', this, resolve));
		await new Promise(resolve => cli.emit('build.finalize', this, resolve));
	} catch (err) {
		process.exit(1);
	}

	if (finished) {
		finished();
	}
};

// create the builder instance and expose the public api
(function (androidBuilder) {
	exports.config   = androidBuilder.config.bind(androidBuilder);
	exports.validate = androidBuilder.validate.bind(androidBuilder);
	exports.run      = androidBuilder.run.bind(androidBuilder);
}(new AndroidBuilder(module)));
