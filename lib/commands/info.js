/**
 * The info command. Displays information about the current system including
 * Xcode installations, iOS SDKs, Android SDKs, and so on.
 *
 * @module commands/info
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

var appc = require('node-appc'),
	async = require('async'),
	env = appc.environ,
	fs = require('fs'),
	humanize = require('humanize'),
	mix = appc.util.mix,
	moment = require('moment'),
	path = require('path'),
	__ = appc.i18n(__dirname).__,

	typesList = ['all', 'os', 'nodejs', 'titanium', 'ios', 'osx', 'jdk', 'haxm', 'android'],
	indent = 27,
	rpad = function (s) { return appc.string.rpad(s, indent); },
	styleHeading = function (s) { return ('' + s).bold; },
	styleBad = function (s) { return ('' + s).red; },
	styleValue = function (s) { return ('' + s).magenta; };

/** Info command description. */
exports.desc = __('display development environment information');

/**
 * Returns the configuration for the info command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Info command configuration
 */
exports.config = function (logger, config, cli) {
	return {
		noAuth: true,
		skipBanner: true,
		flags: {
			legacy: {
				desc: __('outputs results using old format')
			}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				desc: __('output format'),
				values: ['report', 'json']
			},
			types: {
				abbr: 't',
				default: 'all',
				desc: __('information types to display; you may select one or more'),
				skipValueCheck: true,
				values: typesList
			}
		}
	};
};

/**
 * Displays information about the current system.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
exports.run = function (logger, config, cli, finished) {
	var busy;

	if (cli.argv.output != 'json') {
		logger.banner();
		if (!cli.argv.quiet && !!cli.argv['progress-bars']) {
			busy = new appc.busyindicator;
			busy.start();
		}
	}

	var types = {},
		i = 0;
	(cli.argv.types || 'all').toLowerCase().split(',').forEach(function (t) {
		t = t.trim();
		if (typesList.indexOf(t) >= 0) {
			types[t] = ++i;
		}
	});
	i == 0 && (types.all = 1);

	// important: we must duplicate every bit of info as to not accidentally
	// break the contract of the JSON formatted output.
	async.parallel([
		function os(next) {
			if (types.all || types.os || types.nodejs) {
				env.getOSInfo(function (info) {
					next(null, {
						os: {
							name: info.os,
							version: info.osver,
							architecture: info.ostype,
							numcpus: info.oscpu,
							memory: info.memory
						},
						node: {
							version: info.node.replace(/^v/, '')
						},
						npm: {
							version: info.npm
						}
					});
				});
			} else {
				next(null, null);
			}
		},

		function tisdk(next) {
			if (types.all || types.titanium) {
				var result = {
					titanium: {},
					titaniumCLI: {
						version: cli.version,
						nodeAppcVer: null,
						selectedSDK: cli.sdk && cli.sdk.name
					}
				};

				// get the node-appc info
				try {
					result.titaniumCLI.nodeAppcVer = require('node-appc/package.json').version;
				} catch (e) {}

				Object.keys(env.sdks).forEach(function (ver) {
					var n = env.sdks[ver];
						v = result.titanium[ver] = {
						path: n.path,
						platforms: Object.keys(n.platforms),
						githash: n.manifest ? n.manifest.githash : null,
						timestamp: n.manifest ? n.manifest.timestamp : null,
						nodeAppcVer: null
					};
					try {
						v.nodeAppcVer = require(path.join(v.path, 'node_modules', 'node-appc', 'package.json')).version;
					} catch (e) {}
				});

				next(null, result);
			} else {
				next(null, null);
			}
		},

		function ios(next) {
			if (process.platform === 'darwin' && (types.all || types.ios)) {
				if (!cli.argv.legacy && cli.sdk) {
					// try to find a Titanium SDK 3.2 or newer for the detection stuff
					var tisdk = cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name,
						file;

					// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
					if (appc.version.gte(tisdk, '3.2.0')
						&& cli.sdk.platforms
						&& (
							(cli.sdk.platforms.ios && fs.existsSync(file = path.join(cli.sdk.platforms.ios.path, 'cli', 'lib', 'detect.js')))
							|| (cli.sdk.platforms.iphone && fs.existsSync(file = path.join(cli.sdk.platforms.iphone.path, 'cli', 'lib', 'detect.js')))
						)
					) {
						var mod = require(file);
						// detect ios environment
						mod.detect(config, null, function (result) {
							// detect devices
							mod.detectDevices(function (err, devices) {
								// detect emulators
								mod.detectSimulators(config, function (err, simulators) {
									result.title = 'iOS';
									result.tisdk = tisdk;
									result.devices = devices;
									result.simulators = simulators;
									next(null, { ios: result });
								});
							});
						});
						return;
					}
				}

				// the old legacy node-appc detection code
				appc.ios.detect(function (info) {
					var result = { xcode: {}, iosDetectVersion: '1.0' };

					if (Object.keys(info.xcode).length) {
						Object.keys(info.xcode).forEach(function (ver) {
							if (ver != '__selected__') {
								mix(result.xcode[ver] = {}, info.xcode[ver]);
							}
						});
					}

					result.iosCerts = {
						devNames: info.certs.devNames,
						distNames: info.certs.distNames,
						wwdr: info.certs.wwdr
					};

					result.keychains = info.certs.keychains;

					var pp = result.iOSProvisioningProfiles = {};
					Object.keys(info.provisioningProfiles).forEach(function (type) {
						pp[type] || (pp[type] = []);
						info.provisioningProfiles[type].forEach(function (profile) {
							pp[type].push(mix({}, profile));
						});
					});

					result.iosKeychains = ['System Default'].concat(info.keychains);

					result.title = 'iOS';
					next(null, result);
				});
			} else {
				next(null, null);
			}
		},

		function osx(next) {
			if (process.platform === 'darwin' && (types.all || types.osx)) {
				appc.clitools.detect(config, function (clitools) {
					next(null, {
						osx: {
							title: __('Mac OS X'),
							clitools: clitools
						}
					});
				});
			} else {
				next(null, null);
			}
		},

		function jdk(next) {
			if (types.all || types.jdk) {
				appc.jdk.detect(config, function (result) {
					result.title = __('Java Development Kit');
					next(null, { jdk: result });
				});
			} else {
				next(null, null);
			}
		},

		function android(next) {
			if (types.all || types.android) {
				if (!cli.argv.legacy && cli.sdk) {
					// try to find a Titanium SDK 3.2 or newer for the detection stuff
					var tisdk = cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name,
						file;

					// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
					if (appc.version.gte(tisdk, '3.2.0')
						&& cli.sdk.platforms
						&& cli.sdk.platforms.android
						&& fs.existsSync(file = path.join(cli.sdk.platforms.android.path, 'cli', 'lib', 'detect.js'))
					) {
						var mod = require(file);
						// detect android environment
						mod.detect(config, null, function (result) {
							// detect devices
							mod.detectDevices(config, function (err, devices) {
								// detect emulators
								mod.detectEmulators(config, function (err, emus) {
									result.title = 'Android';
									result.tisdk = tisdk;
									result.devices = devices;
									result.emulators = emus;
									delete result.avds;
									next(null, { android: result });
								});
							});
						});
						return;
					}
				}

				// the old legacy node-appc detection code
				appc.android.detect(function (result) {
					result || (result = {});
					result.title = 'Android';
					result.androidDetectVersion || (result.androidDetectVersion = '1.0');
					next(null, { android: result });
				}, config.android && config.android.sdkPath, config.android && config.android.ndkPath);
			} else {
				next(null, null);
			}
		},

		function haxm(next) {
			if (types.all || types.haxm) {
				appc.haxm.detect(config, function (result) {
					result.title = __('Intel® Hardware Accelerated Execution Manager (HAXM)');
					next(null, { haxm: result });
				});
			} else {
				next(null, null);
			}
		}
	], function (err, results) {
		var data = mix.apply(null, results);

		if (cli.argv.output == 'json') {
			logger.log(JSON.stringify(data, null, '\t'));
		} else {
			busy && busy.stop();
			printData(logger, config, data, types);
		}

		finished();
	});
};

function printData(logger, config, data, types) {
	var issues = {},
		isLegacy = false;

	if (process.platform == 'darwin' && (types.all || types.ios) && appc.version.lt(data.ios.detectVersion || data.iosDetectVersion, '2.0')) {
		// the keychain names are the only left side label that isn't fixed length, so
		// if we're displaying ios info, find the longest keychain name
		data.iosKeychains.forEach(function (keychain) {
			var len = path.basename(keychain).length + 2;
			if (len > indent) {
				indent = len;
			}
		});
	}

	if (types.all || types.os) {
		logger.log(
			styleHeading(__('Operating System')) + '\n' +
			'  ' + rpad(__('Name'))         + ' = ' + styleValue(data.os.name) + '\n' +
			'  ' + rpad(__('Version'))      + ' = ' + styleValue(data.os.version) + '\n' +
			'  ' + rpad(__('Architecture')) + ' = ' + styleValue(data.os.architecture) + '\n' +
			'  ' + rpad(__('# CPUs'))       + ' = ' + styleValue(data.os.numcpus) + '\n' +
			'  ' + rpad(__('Memory'))       + ' = ' + styleValue((data.os.memory / 1024 / 1024 / 1024).toFixed(1) + 'GB') + '\n'
		);
	}

	if (types.all || types.nodejs) {
		logger.log(
			styleHeading(__('Node.js')) + '\n' +
			'  ' + rpad(__('Node.js Version')) + ' = ' + styleValue(data.node.version) + '\n' +
			'  ' + rpad(__('npm Version'))     + ' = ' + styleValue(data.npm.version) + '\n'
		);
	};

	if ((types.all || types.titanium) && data.titanium) {
		logger.log(
			styleHeading(__('Titanium CLI')) + '\n' +
			'  ' + rpad(__('CLI Version'))       + ' = ' + styleValue(data.titaniumCLI.version) + '\n' +
			'  ' + rpad(__('node-appc Version')) + ' = ' + styleValue(data.titaniumCLI.nodeAppcVer || 'unknown') + '\n'
		);

		logger.log(styleHeading(__('Titanium SDKs')));
		if (Object.keys(data.titanium).length) {
			Object.keys(data.titanium).sort().reverse().forEach(function (ver) {
				var x = data.titanium[ver];
				logger.log(
					'  ' + ver.cyan + '\n' +
					'  ' + rpad('  ' + __('Install Location'))  + ' = ' + styleValue(x.path) + '\n' +
					'  ' + rpad('  ' + __('Platforms'))         + ' = ' + styleValue(x.platforms.join(', ')) + '\n' +
					'  ' + rpad('  ' + __('git Hash'))          + ' = ' + styleValue(x.githash || 'unknown') + '\n' +
					'  ' + rpad('  ' + __('git Timestamp'))     + ' = ' + styleValue(x.timestamp || 'unknown') + '\n' +
					'  ' + rpad('  ' + __('node-appc Version')) + ' = ' + styleValue(appc.version.lt(ver, '3.0.0') ? 'n/a' : x.nodeAppcVer || 'unknown')
				);
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	if (types.all || types.osx) {
		logger.log(styleHeading(data.osx.title));
		logger.log('  ' + rpad(__('Command Line Tools')) + ' = ' + styleValue(data.osx.clitools && data.osx.clitools.installed ? __('installed') : __('not found')) + '\n');
		data.osx.clitools.issues.length && (issues.osx = data.osx.clitools.issues);
	}

	if (types.all || types.jdk) {
		logger.log(styleHeading(data.jdk.title));
		if (data.jdk.version) {
			logger.log('  ' + rpad(__('Version')) + ' = ' + styleValue(data.jdk.version + '_' + data.jdk.build) + '\n');
		} else {
			logger.log('  ' + __('Not found').grey + '\n');
		}
		data.jdk.issues.length && (issues.jdk = data.jdk.issues);
	}

	if (types.all || types.haxm) {
		logger.log(styleHeading(data.haxm.title));
		if (!data.haxm.compatible) {
			logger.log('  ' + __('Not compatible; Intel® CPU required').grey + '\n');
		} else if (data.haxm.installed) {
			logger.log(
				'  ' + rpad(__('Installed'))    + ' = ' + styleValue('yes') + '\n' +
				'  ' + rpad(__('Memory Limit')) + ' = ' + styleValue(humanize.filesize((data.haxm.memlimit | 0) * 1024 * 1024, 1024, 0).toUpperCase()) + '\n'
			);
		} else {
			logger.log('  ' + __('Not installed').grey + '\n');
		}
	}

	if (process.platform == 'darwin' && (types.all || types.ios)) {
		if (!data.ios || appc.version.lt(data.ios.detectVersion, '2.0')) {
			printIosLegacy(logger, config, data);
			isLegacy = true;
		} else {
			printIos(logger, config, data.ios);
			data.ios.issues.length && (issues.ios = data.ios.issues);
		}
	}

	if (types.all || types.android) {
		if (!data.android || appc.version.lt(data.android.detectVersion, '2.0')) {
			printAndroidLegacy(logger, config, data);
			isLegacy = true;
		} else {
			printAndroid(logger, config, data.android);
			data.android.issues.length && (issues.android = data.android.issues);
		}
	}

	// only show issues if we have printed non-legacy android or ios info
	if (Object.keys(issues).length) {
		Object.keys(issues).forEach(function (type) {
			if (types.all || types[type]) {
				logger.log(styleHeading(__('%s Issues', data[type].title)));
				issues[type].forEach(function (issue) {
					var msg = appc.string.wrap(issue.message.split('\n').map(function (line) {
							return line.trim().replace(/(__(.+?)__)/g, '$2'.bold);
						}).join(' '), config.get('cli.width', 120) - 5).replace(/\n/g, '\n     ') + '\n';

					if (issue.type == 'error') {
						logger.log(('  ' + (process.platform == 'win32' ? '\u00D7' : '\u2715') + '  ' + msg).red);
					} else if (issue.type == 'warning') {
						logger.log(('  !  '.bold + msg).yellow);
					} else {
						logger.log(('  ' + (process.platform == 'win32' ? '*' : '\u25CF') + '  ' + msg).magenta);
					}
				});
			}
		});
	} else {
		logger.log(__('Issues').bold);
		logger.log('  ' + __('No issues detected! Your development environment should be working perfectly!') + '\n');
	}
}

function printIosLegacy(logger, config, data) {
	logger.log(
		appc.string.wrap(
			__('NOTE: The following Xcode and iOS information has been detected using the old environment detection logic. To display more accurate information, install and select a Titanium SDK 3.2 or newer.'),
			config.get('cli.width', 100)
		).magenta + '\n'
	);

	// Xcode
	logger.log(styleHeading(__('Xcode')));
	if (Object.keys(data.xcode).length) {
		Object.keys(data.xcode).sort().reverse().forEach(function (ver) {
			var x = data.xcode[ver];
			logger.log(
				(x.version + ' (build ' + x.build + ')' + (x.selected ? ' - Xcode default' : '')).cyan + '\n' +
				'  ' + rpad(__('Install Location'))                  + ' = ' + styleValue(x.path) + '\n' +
				'  ' + rpad(__('iOS SDKs'))                          + ' = ' + styleValue(x.sdks.length ? x.sdks.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('iOS Simulators'))                    + ' = ' + styleValue(x.sims.length ? x.sims.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('Supported by TiSDK %s', data.tisdk)) + ' = ' + styleValue(x.supported == 'maybe' ? 'maybe' : x.supported ? 'yes' : 'no')
			);
		});
		logger.log();
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	// ios keychains
	logger.log(
		styleHeading(__('iOS Keychains')) + '\n' +
		data.iosKeychains.sort().reverse().map(function (keychain) {
			return '  ' + rpad(path.basename(keychain)) + ' = ' + styleValue(keychain);
		}).join('\n') + '\n');

	// ios certs
	logger.log(styleHeading(__('iOS Certificates')));
	if (Object.keys(data.keychains).length) {
		Object.keys(data.keychains).forEach(function (keychain) {
			if (data.keychains[keychain].developer) {
				logger.log(__('Developer').grey);
				data.keychains[keychain].developer.forEach(function (d) {
					logger.log('  ' + styleValue(d));
				});
			}
			if (data.keychains[keychain].distribution) {
				logger.log(__('Distribution').grey);
				data.keychains[keychain].distribution.forEach(function (d) {
					logger.log('  ' + styleValue(d));
				});
			}
			logger.log();
		});
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	// wwdr cert
	logger.log(styleHeading(__('Apple WWDR Certificate')) + '\n' +
		'  ' + rpad(__('Apple WWDR')) + ' = ' + styleValue(data.iosCerts.wwdr ? __('installed') : __('not found')) + '\n');

	function printProfiles(profiles) {
		if (profiles.length) {
			profiles.sort(function (a, b) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}).forEach(function (profile) {
				logger.log(
					profile.name.grey + (profile.expired ? ' ' + styleBad(__('**EXPIRED**')) : '') + '\n' +
					'  ' + rpad(__('UUID'))       + ' = ' + styleValue(profile.uuid) + '\n' +
					'  ' + rpad(__('App Prefix')) + ' = ' + styleValue(profile.appPrefix) + '\n' +
					'  ' + rpad(__('App Id'))     + ' = ' + styleValue(profile.appId)
				);
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	// provisioning profiles
	logger.log(styleHeading(__('Development iOS Provisioning Profiles')));
	printProfiles(data.iOSProvisioningProfiles.development);

	logger.log(styleHeading(__('Distribution iOS Provisioning Profiles')));
	printProfiles(data.iOSProvisioningProfiles.distribution);

	logger.log(styleHeading(__('Ad Hoc iOS Provisioning Profiles')));
	printProfiles(data.iOSProvisioningProfiles.adhoc);
}

function printIos(logger, config, data) {
	// Xcode
	logger.log(styleHeading(__('Xcode')));
	if (Object.keys(data.xcode).length) {
		Object.keys(data.xcode).sort().reverse().forEach(function (ver) {
			var x = data.xcode[ver];
			logger.log(
				'  ' + (x.version + ' (build ' + x.build + ')' + (x.selected ? ' - Xcode default' : '')).cyan + '\n' +
				'  ' + rpad('  ' + __('Install Location'))                  + ' = ' + styleValue(x.path) + '\n' +
				'  ' + rpad('  ' + __('iOS SDKs'))                          + ' = ' + styleValue(x.sdks.length ? x.sdks.join(', ') : 'none') + '\n' +
				'  ' + rpad('  ' + __('iOS Simulators'))                    + ' = ' + styleValue(x.sims.length ? x.sims.join(', ') : 'none') + '\n' +
				'  ' + rpad('  ' + __('Supported by TiSDK %s', data.tisdk)) + ' = ' + styleValue(x.supported == 'maybe' ? 'maybe' : x.supported ? 'yes' : 'no')
			);
		});
		logger.log();
	} else {
		logger.log(__('No Xcode installations found.').grey + '\n');
	}

	// ios keychains
	logger.log(
		styleHeading(__('iOS Keychains')) + '\n' +
		Object.keys(data.certs.keychains).sort().reverse().map(function (keychain) {
			return '  ' + rpad(path.basename(keychain)) + ' = ' + styleValue(keychain);
		}).join('\n') + '\n');

	// ios certs
	logger.log(styleHeading(__('iOS Development Certificates')));
	var counter = 0;
	if (Object.keys(data.certs.keychains).length) {
		Object.keys(data.certs.keychains).forEach(function (keychain) {
			var devs = data.certs.keychains[keychain].developer || [];
			if (devs.length) {
				logger.log(keychain.grey);
				devs.sort(function (a, b) {
					return a.name == b.name ? 0 : a.name < b.name ? -1 : 1;
				}).forEach(function (dev) {
					counter++;
					logger.log('  ' + dev.name.cyan + (dev.expired ? ' ' + styleBad(__('**EXPIRED**')) : dev.invalid ? ' ' + styleBad(__('**NOT VALID**')) : ''));
					logger.log('  ' + rpad('  ' + __('Not valid before')) + ' = ' + styleValue(moment(dev.before).format('l LT')));
					logger.log('  ' + rpad('  ' + __('Not valid after')) + ' = ' + styleValue(moment(dev.after).format('l LT')));
				});
			}
		});
	}
	logger.log(counter ? '' : '  ' + __('None').grey + '\n');

	logger.log(styleHeading(__('iOS Distribution Certificates')));
	counter = 0;
	if (Object.keys(data.certs.keychains).length) {
		Object.keys(data.certs.keychains).forEach(function (keychain) {
			var dists = data.certs.keychains[keychain].distribution || [];
			if (dists.length) {
				logger.log(keychain.grey);
				dists.sort(function (a, b) {
					return a.name == b.name ? 0 : a.name < b.name ? -1 : 1;
				}).forEach(function (dist) {
					counter++;
					logger.log('  ' + dist.name.cyan + (dist.expired ? ' ' + styleBad(__('**EXPIRED**')) : dist.invalid ? ' ' + styleBad(__('**NOT VALID**')) : ''));
					logger.log('  ' + rpad('  ' + __('Not valid before')) + ' = ' + styleValue(moment(dist.before).format('l LT')));
					logger.log('  ' + rpad('  ' + __('Not valid after')) + ' = ' + styleValue(moment(dist.after).format('l LT')));
				});
			}
		});
	}
	logger.log(counter ? '' : '  ' + __('None').grey + '\n');

	// wwdr cert
	logger.log(styleHeading(__('Apple WWDR Certificate')));
	if (data.certs.wwdr) {
		logger.log('  ' + rpad(__('Apple WWDR')) + ' = ' + styleValue(__('installed')) + '\n');
	} else {
		logger.log('  ' + rpad(__('Apple WWDR')) + ' = ' + styleBad(__('not found')) + '\n');
	}

	function printProfiles(profiles) {
		if (profiles.length) {
			profiles.sort(function (a, b) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}).forEach(function (profile) {
				logger.log('  ' + profile.name.cyan + (profile.expired ? ' ' + styleBad(__('**EXPIRED**')) : ''));
				logger.log('  ' + rpad('  ' + __('UUID'))       + ' = ' + styleValue(profile.uuid));
				logger.log('  ' + rpad('  ' + __('App Prefix')) + ' = ' + styleValue(profile.appPrefix));
				logger.log('  ' + rpad('  ' + __('App Id'))     + ' = ' + styleValue(profile.appId));
				logger.log('  ' + rpad('  ' + __('Date Created')) + ' = ' + styleValue(profile.creationDate ? moment(profile.creationDate).format('l LT') : 'unknown'));
				logger.log('  ' + rpad('  ' + __('Date Expired')) + ' = ' + styleValue(profile.expirationDate ? moment(profile.expirationDate).format('l LT') : 'unknown'));
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	// provisioning profiles
	logger.log(styleHeading(__('Development iOS Provisioning Profiles')));
	printProfiles(data.provisioningProfiles.development);

	logger.log(styleHeading(__('Distribution iOS Provisioning Profiles')));
	printProfiles(data.provisioningProfiles.distribution);

	logger.log(styleHeading(__('Ad Hoc iOS Provisioning Profiles')));
	printProfiles(data.provisioningProfiles.adhoc);

	logger.log(styleHeading(__('iOS Simulators')));
	if (data.simulators && data.simulators.length) {
		logger.log(data.simulators.map(function (sim) {
			var features = '';
			return '  ' + sim.name.cyan + '\n' + [
				'  ' + rpad('  ' + __('Type'))         + ' = ' + styleValue(sim.type),
				'  ' + rpad('  ' + __('iOS Versions')) + ' = ' + styleValue(sim.versions.join(', ')),
				'  ' + rpad('  ' + __('Architecture')) + ' = ' + styleValue(sim['64bit'] ? '64-bit' : '32-bit'),
				'  ' + rpad('  ' + __('Features'))     + ' = ' + styleValue(sim.retina ? 'retina' + (sim.tall ? ', tall' : '') : (sim.tall ? 'tall' : 'n/a'))
			].join('\n');
		}).join('\n') + '\n');
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	logger.log(styleHeading(__('Connected iOS Devices')));
	var iosDevices = data.devices && data.devices.filter(function (device) { return device.id != 'itunes'; });
	if (iosDevices.length) {
		logger.log(iosDevices.map(function (device) {
			return '  ' + device.name.cyan + '\n' + [
				'  ' + rpad('  ' + __('ID'))               + ' = ' + styleValue(device.id),
				'  ' + rpad('  ' + __('Type'))             + ' = ' + styleValue(device.deviceClass + ' (' + device.deviceColor + ')'),
				'  ' + rpad('  ' + __('iOS Version'))      + ' = ' + styleValue(device.productVersion),
				'  ' + rpad('  ' + __('CPU Architecture')) + ' = ' + styleValue(device.cpuArchitecture)
			].join('\n');
		}).join('\n') + '\n');
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}
}

function printAndroidLegacy(logger, config, data) {
	// legacy warning
	logger.log(
		appc.string.wrap(
			__('NOTE: The following Android information has been detected using the old environment detection logic. To display more accurate information, install and select a Titanium SDK 3.2 or newer.'),
			config.get('cli.width', 100)
		).magenta + '\n'
	);

	logger.log(styleHeading(__('Android SDK')) + '\n' +
		'  ' + rpad(__('Android Executable')) + ' = ' + styleValue(data.android.exe || __('not found')) + '\n' +
		'  ' + rpad(__('SDK Path'))           + ' = ' + styleValue(data.android.sdkPath || __('not found')) + '\n'
	);

	logger.log(styleHeading(__('Android NDK')) + '\n' +
		'  ' + rpad(__('NDK Path'))           + ' = ' + styleValue(data.android.ndk ? data.android.ndk.path : __('not found')) + '\n' +
		'  ' + rpad(__('NDK Version'))        + ' = ' + styleValue(data.android.ndk ? data.android.ndk.version : __('not installed')) + '\n'
	);

	var androidPlatforms = '',
		androidAddons = '';

	(function (targets) {
		if (targets && Object.keys(targets).length) {
			Object.keys(targets).forEach(function (targetId) {
				var target = targets[targetId];
				if (target.type == 'Platform') {
					androidPlatforms += (targetId + ') ' + target.id).grey + '\n' +
						'  ' + rpad(__('Name'))        + ' = ' + styleValue(target.name) + '\n' +
						'  ' + rpad(__('API Level'))   + ' = ' + styleValue(target['api-level']) + '\n' +
						'  ' + rpad(__('Revision'))    + ' = ' + styleValue(target.revision) + '\n' +
						'  ' + rpad(__('Skins'))       + ' = ' + styleValue(target.skins.join(', ')) + '\n' +
						'  ' + rpad(__('ABIs'))        + ' = ' + styleValue(target.abis.join(', ')) + '\n' +
						'  ' + rpad(__('Path'))        + ' = ' + styleValue(target.path) + '\n';
				} else if (target.type == 'Add-On') {
					androidAddons += (targetId + ') ' + target.id).grey + '\n' +
						'  ' + rpad(__('Name'))        + ' = ' + styleValue(target.name) + '\n' +
						'  ' + rpad(__('Vendor'))      + ' = ' + styleValue(target.vendor) + '\n' +
						'  ' + rpad(__('Revision'))    + ' = ' + styleValue(target.revision) + '\n' +
						'  ' + rpad(__('Description')) + ' = ' + styleValue(target.description) + '\n' +
						'  ' + rpad(__('Skins'))       + ' = ' + styleValue(target.skins.join(', ')) + '\n' +
						'  ' + rpad(__('ABIs'))        + ' = ' + styleValue(target.abis.join(', ')) + '\n' +
						'  ' + rpad(__('Path'))        + ' = ' + styleValue(target.path) + '\n' +
						'  ' + rpad(__('Based On'))    + ' = ' + styleValue(target['based-on'] ? __('Android %s (API level %s)', target['based-on']['android-version'], target['based-on']['api-level']) : __('unknown')) + '\n' +
						'  ' + rpad(__('Libraries'))   + ' = ' + styleValue(target.libraries && Object.keys(target.libraries).length
							? Object.keys(target.libraries).map(function (lib) {
									return lib + ': ' + target.libraries[lib].description + ' (' + target.libraries[lib].jar + ')';
								}).join(', ')
							: 'none') + '\n';
				}
			});
		}
	}(data.android.targets));

	logger.log(styleHeading(__('Android Platforms')) + '\n' + (androidPlatforms ? androidPlatforms : '  ' + __('None').grey + '\n'));
	logger.log(styleHeading(__('Android Add-Ons')) + '\n' + (androidAddons ? androidAddons : '  ' + __('None').grey + '\n'));

	logger.log(styleHeading(__('Android AVDs')));
	(function (avds) {
		if (avds && avds.length) {
			logger.log(avds.map(function (avd) {
				return avd.name.grey + '\n' +
					'  ' + rpad(__('Path'))     + ' = ' + styleValue(avd.path) + '\n' +
					'  ' + rpad(__('Target'))   + ' = ' + styleValue(avd.target) + '\n' +
					'  ' + rpad(__('ABI'))      + ' = ' + styleValue(avd.abi) + '\n' +
					'  ' + rpad(__('Skin'))     + ' = ' + styleValue(avd.skin) + '\n' +
					'  ' + rpad(__('SD Card'))  + ' = ' + styleValue(avd.sdcard || __('no sd card')) + '\n' +
					'  ' + rpad(__('Based On')) + ' = ' + styleValue(avd['based-on'] ? __('Android %s (API level %s)', avd['based-on']['android-version'], avd['based-on']['api-level']) : __('unknown'));
				}).join('\n') + '\n');
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}(data.android.avds));
}

function printAndroid(logger, config, data) {
	logger.log(styleHeading(__('Android SDK')) + '\n' +
		'  ' + rpad(__('Android Executable')) + ' = ' + styleValue(data.sdk && data.sdk.executables.android || __('not found')) + '\n' +
		'  ' + rpad(__('ADB Executable'))     + ' = ' + styleValue(data.sdk && data.sdk.executables.adb || __('not found')) + '\n' +
		'  ' + rpad(__('SDK Path'))           + ' = ' + styleValue(data.sdk && data.sdk.path || __('not found')) + '\n'
	);

	logger.log(styleHeading(__('Android NDK')) + '\n' +
		'  ' + rpad(__('NDK Path'))           + ' = ' + styleValue(data.ndk && data.ndk.path || __('not found')) + '\n' +
		'  ' + rpad(__('NDK Version'))        + ' = ' + styleValue(data.ndk && data.ndk.version || __('not installed')) + '\n'
	);

	var androidPlatforms = '',
		androidAddons = '',
		apiLevelMap = {};

	if (data.targets && Object.keys(data.targets).length) {
		Object.keys(data.targets).forEach(function (targetId) {
			var target = data.targets[targetId],
				supported = (target.supported == 'maybe'
					? (' (' + __('not supported by Titanium SDK %s, but may work', data.tisdk) + ')').yellow
					: target.supported
						? ''
						: styleBad(' **' + __('Not supported by Titanium SDK %s', data.tisdk) + '**'));

			if (target.type == 'platform') {
				var m = target.name.match(/Android\s+(\d(?:\.\d(?:\.\d)?)?)/);
				if (m) {
					apiLevelMap[m[1]] = target['api-level'];
				}
				androidPlatforms += '  ' + (targetId + ') ' + target.id).cyan + '\n' +
					'  ' + rpad('  ' + __('Name'))        + ' = ' + styleValue(target.name) + supported + '\n' +
					'  ' + rpad('  ' + __('API Level'))   + ' = ' + styleValue(target['api-level']) + '\n' +
					'  ' + rpad('  ' + __('Revision'))    + ' = ' + styleValue(target.revision) + '\n' +
					'  ' + rpad('  ' + __('Skins'))       + ' = ' + styleValue(target.skins.join(', ')) + '\n' +
					'  ' + rpad('  ' + __('ABIs'))        + ' = ' + styleValue(target.abis.join(', ')) + '\n' +
					'  ' + rpad('  ' + __('Path'))        + ' = ' + styleValue(target.path) + '\n';
			} else if (target.type == 'add-on') {
				androidAddons += '  ' + (targetId + ') ' + target.id).cyan + '\n' +
					'  ' + rpad('  ' + __('Name'))        + ' = ' + styleValue(target.name
						+ ' (' + target['based-on'] ? __('Android %s (API level %s)', target['based-on']['android-version'], target['based-on']['api-level']) : __('unknown') + ')') + supported + '\n' +
					'  ' + rpad('  ' + __('Vendor'))      + ' = ' + styleValue(target.vendor) + '\n' +
					'  ' + rpad('  ' + __('Revision'))    + ' = ' + styleValue(target.revision) + '\n' +
					'  ' + rpad('  ' + __('Description')) + ' = ' + styleValue(target.description) + '\n' +
					'  ' + rpad('  ' + __('Skins'))       + ' = ' + styleValue(target.skins.join(', ')) + '\n' +
					'  ' + rpad('  ' + __('ABIs'))        + ' = ' + styleValue(target.abis.join(', ')) + '\n' +
					'  ' + rpad('  ' + __('Path'))        + ' = ' + styleValue(target.path) + '\n' +
					'  ' + rpad('  ' + __('Libraries'))   + ' = ' + styleValue(target.libraries && Object.keys(target.libraries).length
						? Object.keys(target.libraries).map(function (lib) {
								return lib + ': ' + target.libraries[lib].description + ' (' + target.libraries[lib].jar + ')';
							}).join(', ')
						: 'none') + '\n';
			}
		});
	}

	logger.log(styleHeading(__('Android Platforms')) + '\n' + (androidPlatforms ? androidPlatforms : '  ' + __('None').grey + '\n'));
	logger.log(styleHeading(__('Android Add-Ons')) + '\n' + (androidAddons ? androidAddons : '  ' + __('None').grey + '\n'));

	logger.log(styleHeading(__('Android Emulators')));
	if (data.emulators) {
		var emus = data.emulators.filter(function (e) { return e.type == 'avd'; });
		if (emus.length) {
			logger.log(emus.map(function (emu) {
				return '  ' + emu.name.cyan + '\n' +
					'  ' + rpad('  ' + __('Path'))        + ' = ' + styleValue(emu.path) + '\n' +
					'  ' + rpad('  ' + __('SDK Version')) + ' = ' + styleValue(emu.target) + '\n' +
					'  ' + rpad('  ' + __('ABI'))         + ' = ' + styleValue(emu.abi) + '\n' +
					'  ' + rpad('  ' + __('Skin'))        + ' = ' + styleValue(emu.skin) + '\n' +
					'  ' + rpad('  ' + __('SD Card'))     + ' = ' + styleValue(emu.sdcard || __('no sd card')) + '\n' +
					(emu['based-on']
						? '  ' + rpad('  ' + __('Based On'))    + ' = ' + styleValue(__('Android %s (API level %s)', emu['based-on']['android-version'], emu['based-on']['api-level'])) + '\n'
						: ''
					) +
					'  ' + rpad('  ' + __('Google APIs')) + ' = ' + styleValue(emu.googleApis ? __('yes') : __('no'));
			}).join('\n') + '\n');
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	if (config.get('genymotion.enabled')) {
		logger.log(styleHeading(__('Genymotion Emulators')));
		if (data.emulators) {
			var emus = data.emulators.filter(function (e) { return e.type == 'genymotion'; });
			if (emus.length) {
				logger.log(emus.map(function (emu) {
					return '  ' + emu.name.cyan + '\n' +
						'  ' + rpad('  ' + __('SDK Version'))         + ' = ' + styleValue(emu.target + (apiLevelMap[emu.target] ? ' (android-' + apiLevelMap[emu.target] + ')' : '')) + '\n' +
						'  ' + rpad('  ' + __('ABI'))                 + ' = ' + styleValue(emu.abi || __('unknown')) + '\n' +
						'  ' + rpad('  ' + __('Genymotion Version'))  + ' = ' + styleValue(emu.genymotion || __('unknown')) + '\n' +
						'  ' + rpad('  ' + __('Display'))             + ' = ' + styleValue(emu.display || __('unknown')) + '\n' +
						'  ' + rpad('  ' + __('DPI'))                 + ' = ' + styleValue(emu.dpi || __('unknown')) + '\n' +
						'  ' + rpad('  ' + __('OpenGL Acceleration')) + ' = ' + styleValue(emu.hardwareOpenGL ? __('yes') : __('no')) + '\n' +
						'  ' + rpad('  ' + __('Google APIs'))         + ' = ' + styleValue(emu.googleApis === null ? __('unknown, emulator not running') : emu.googleApis ? __('yes') : __('no'));
				}).join('\n') + '\n');
			} else {
				logger.log('  ' + __('None').grey + '\n');
			}
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	logger.log(styleHeading(__('Connected Android Devices')));
	if (data.devices && data.devices.length) {
		logger.log(data.devices.map(function (device) {
			var name = device.name,
				result = [
					'  ' + rpad(__('ID'))          + ' = ' + styleValue(device.id),
					'  ' + rpad(__('SDK Version')) + ' = ' + styleValue(device.release + ' (android-' + device.sdk + ')'),
					'  ' + rpad(__('ABIs'))        + ' = ' + styleValue(device.abi.join(', '))
				];

			if (device.emulator) {
				switch (device.emulator.type) {
					case 'avd':
						name = 'Android Emulator: ' + device.emulator.name;
						result.push('  ' + rpad(__('Skin'))        + ' = ' + styleValue(device.emulator.skin || __('unknown')));
						result.push('  ' + rpad(__('SD Card'))     + ' = ' + styleValue(device.emulator.sdcard || __('unknown')));
						result.push('  ' + rpad(__('Google APIs')) + ' = ' + styleValue(device.emulator.googleApis ? __('yes') : __('no')));
						break;

					case 'genymotion':
						if (config.get('genymotion.enabled')) {
							name = 'Genymotion Emulator: ' + device.emulator.name;
							result.push('  ' + rpad(__('Genymotion Version'))  + ' = ' + styleValue(device.emulator.genymotion || __('unknown')));
							result.push('  ' + rpad(__('Display'))             + ' = ' + styleValue(device.emulator.display || __('unknown')));
							result.push('  ' + rpad(__('DPI'))                 + ' = ' + styleValue(device.emulator.dpi || __('unknown')));
							result.push('  ' + rpad(__('OpenGL Acceleration')) + ' = ' + styleValue(device.emulator.hardwareOpenGL ? __('yes') : __('no')));
							result.push('  ' + rpad(__('Google APIs'))         + ' = ' + styleValue(device.emulator.googleApis ? __('yes') : __('no')));
						}
						break;
				}

				return name.cyan + '\n' + result.join('\n');
			} else {
				return name.cyan + '\n' + result.join('\n');
			}
		}).join('\n') + '\n');
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}
}
