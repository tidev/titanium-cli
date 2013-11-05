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
	__ = appc.i18n(__dirname).__,
	fs = require('fs'),
	env = appc.environ,
	mix = appc.util.mix,
	async = require('async'),
	path = require('path'),
	humanize = require('humanize'),
	moment = require('moment'),
	typesList = ['all', 'os', 'nodejs', 'titanium', 'ios', 'jdk', 'haxm', 'android'],
	indent = 25,
	rpad = function (s) { return appc.string.rpad(s, indent); },
	cyan = function (s) { return ('' + s).cyan; };

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
	var busy,
		tisdk = cli.sdk.manifest && cli.sdk.manifest.version || cli.sdk.name;

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
					var file;

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
		},

		function winstore(next) {
			if (process.platform == 'win32' && appc.version.gte(tisdk, '3.2.0') && (types.all || types.winstore)) {
				require(path.join(cli.sdk.path, 'node_modules', 'titanium-sdk', 'lib', 'winstore')).detect(function (env) {
					next(null, { winstore: mix({ title: 'Windows Store' }, env) });
				});
			} else {
				next(null, null);
			}
		},

		function wp8(next) {
			if (process.platform == 'win32' && appc.version.gte(tisdk, '3.2.0') && (types.all || types.wp8)) {
				require(path.join(cli.sdk.path, 'node_modules', 'titanium-sdk', 'lib', 'wp8')).detect(function (env) {
					next(null, { wp8: mix({ title: 'Windows Phone 8' }, env) });
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

	// the keychain names are the only left side label that isn't fixed length, so
	// if we're displaying ios info, find the longest keychain name
	if (process.platform == 'darwin' && (types.all || types.ios) && data.iosKeychains) {
		(appc.version.lt(data.iosDetectVersion, '2.0') ? data.iosKeychains : Object.keys(data.iosKeychains)).forEach(function (keychain) {
			var len = path.basename(keychain).length;
			if (len > indent) {
				indent = len;
			}
		});
	}

	if (types.all || types.os) {
		logger.log(
			__('Operating System').bold + '\n' +
			'  ' + rpad(__('Name'))         + ' = ' + cyan(data.os.name) + '\n' +
			'  ' + rpad(__('Version'))      + ' = ' + cyan(data.os.version) + '\n' +
			'  ' + rpad(__('Architecture')) + ' = ' + cyan(data.os.architecture) + '\n' +
			'  ' + rpad(__('# CPUs'))       + ' = ' + cyan(data.os.numcpus) + '\n' +
			'  ' + rpad(__('Memory'))       + ' = ' + cyan((data.os.memory / 1024 / 1024 / 1024).toFixed(1) + 'GB') + '\n'
		);
	}

	if (types.all || types.nodejs) {
		logger.log(
			__('Node.js').bold + '\n' +
			'  ' + rpad(__('Node.js Version')) + ' = ' + cyan(data.node.version) + '\n' +
			'  ' + rpad(__('npm Version'))     + ' = ' + cyan(data.npm.version) + '\n'
		);
	};

	if ((types.all || types.titanium) && data.titanium) {
		logger.log(
			__('Titanium CLI').bold + '\n' +
			'  ' + rpad(__('CLI Version'))       + ' = ' + cyan(data.titaniumCLI.version) + '\n' +
			'  ' + rpad(__('node-appc Version')) + ' = ' + cyan(data.titaniumCLI.nodeAppcVer || 'unknown') + '\n'
		);

		logger.log(__('Titanium SDKs').bold);
		if (Object.keys(data.titanium).length) {
			Object.keys(data.titanium).sort().reverse().forEach(function (ver) {
				var x = data.titanium[ver];
				logger.log(
					ver.grey + '\n' +
					'  ' + rpad(__('Install Location'))  + ' = ' + cyan(x.path) + '\n' +
					'  ' + rpad(__('Platforms'))         + ' = ' + cyan(x.platforms.join(', ')) + '\n' +
					'  ' + rpad(__('git Hash'))          + ' = ' + cyan(x.githash || 'unknown') + '\n' +
					'  ' + rpad(__('git Timestamp'))     + ' = ' + cyan(x.timestamp || 'unknown') + '\n' +
					'  ' + rpad(__('node-appc Version')) + ' = ' + cyan(appc.version.lt(ver, '3.0.0') ? 'n/a' : x.nodeAppcVer || 'unknown')
				);
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	if (types.all || types.jdk) {
		logger.log(data.jdk.title.bold);
		if (data.jdk.version) {
			logger.log('  ' + rpad(__('Version')) + ' = ' + cyan(data.jdk.version + '_' + data.jdk.build) + '\n');
		} else {
			logger.log('  ' + __('Not found').grey + '\n');
		}
		data.jdk.issues.length && (issues.jdk = data.jdk.issues);
	}

	if (types.all || types.haxm) {
		logger.log(data.haxm.title.bold);
		if (!data.haxm.compatible) {
			logger.log('  ' + __('Not compatible; Intel® CPU required').grey + '\n');
		} else if (data.haxm.installed) {
			logger.log(
				'  ' + rpad(__('Installed'))    + ' = ' + cyan('yes') + '\n' +
				'  ' + rpad(__('Memory Limit')) + ' = ' + cyan(humanize.filesize((data.haxm.memlimit | 0) * 1024 * 1024, 1024, 0).toUpperCase()) + '\n'
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

	if (process.platform == 'win32') {
		if (data.winstore && (types.all || types.winstore)) {
			printWinStore(logger, config, data.winstore);
			data.winstore.issues.length && (issues.winstore = data.jdk.winstore);
		}
		if (data.wp8 && (types.all || types.wp8)) {
			printWP8(logger, config, data.wp8);
			data.wp8.issues.length && (issues.wp8 = data.wp8.issues);
		}
	}

	// only show issues if we have printed non-legacy android or ios info
	if (!isLegacy && (types.all || (types.ios && issues.ios) || (types.android && issues.android) || (types.jdk && issues.jdk) ||
			(types.winstore && issues.winstore) || (types.wp8 && issues.wp8))) {
		if (Object.keys(issues).length) {
			Object.keys(issues).forEach(function (type) {
				logger.log(__('%s Issues', data[type].title).bold);
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
			});
		} else {
			logger.log(__('Issues').bold);
			logger.log('  ' + __('No issues detected! Your development environment should be working perfectly!') + '\n');
		}
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
	logger.log(__('Xcode').bold);
	if (Object.keys(data.xcode).length) {
		Object.keys(data.xcode).sort().reverse().forEach(function (ver) {
			var x = data.xcode[ver];
			logger.log(
				(x.version + ' (build ' + x.build + ')' + (x.selected ? ' - Xcode default' : '')).grey + '\n' +
				'  ' + rpad(__('Install Location'))                  + ' = ' + cyan(x.path) + '\n' +
				'  ' + rpad(__('iOS SDKs'))                          + ' = ' + cyan(x.sdks.length ? x.sdks.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('iOS Simulators'))                    + ' = ' + cyan(x.sims.length ? x.sims.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('Supported by TiSDK %s', data.tisdk)) + ' = ' + cyan(x.supported == 'maybe' ? 'maybe' : x.supported ? 'yes' : 'no')
			);
		});
		logger.log();
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	// ios keychains
	logger.log(
		__('iOS Keychains').bold + '\n' +
		data.iosKeychains.sort().reverse().map(function (keychain) {
			return '  ' + rpad(path.basename(keychain)) + ' = ' + cyan(keychain);
		}).join('\n') + '\n');

	// ios certs
	logger.log(__('iOS Certificates').bold);
	if (Object.keys(data.keychains).length) {
		Object.keys(data.keychains).forEach(function (keychain) {
			if (data.keychains[keychain].developer) {
				logger.log(__('Developer').grey);
				data.keychains[keychain].developer.forEach(function (d) {
					logger.log('  ' + cyan(d));
				});
			}
			if (data.keychains[keychain].distribution) {
				logger.log(__('Distribution').grey);
				data.keychains[keychain].distribution.forEach(function (d) {
					logger.log('  ' + cyan(d));
				});
			}
			logger.log();
		});
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	// wwdr cert
	logger.log(__('Apple WWDR Certificate').bold + '\n' +
		'  ' + rpad(__('Apple WWDR')) + ' = ' + cyan(data.iosCerts.wwdr ? __('installed') : __('not found')) + '\n');

	function printProfiles(profiles) {
		if (profiles.length) {
			profiles.sort(function (a, b) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}).forEach(function (profile) {
				logger.log(
					profile.name.grey + (profile.expired ? ' ' + __('**EXPIRED**').red : '') + '\n' +
					'  ' + rpad(__('UUID'))       + ' = ' + cyan(profile.uuid) + '\n' +
					'  ' + rpad(__('App Prefix')) + ' = ' + cyan(profile.appPrefix) + '\n' +
					'  ' + rpad(__('App Id'))     + ' = ' + cyan(profile.appId)
				);
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	// provisioning profiles
	logger.log(__('Development iOS Provisioning Profiles').bold);
	printProfiles(data.iOSProvisioningProfiles.development);

	logger.log(__('Distribution iOS Provisioning Profiles').bold);
	printProfiles(data.iOSProvisioningProfiles.distribution);

	logger.log(__('Ad Hoc iOS Provisioning Profiles').bold);
	printProfiles(data.iOSProvisioningProfiles.adhoc);
}

function printIos(logger, config, data) {
	// Xcode
	logger.log(__('Xcode').bold);
	if (Object.keys(data.xcode).length) {
		Object.keys(data.xcode).sort().reverse().forEach(function (ver) {
			var x = data.xcode[ver];
			logger.log(
				(x.version + ' (build ' + x.build + ')' + (x.selected ? ' - Xcode default' : '')).grey + '\n' +
				'  ' + rpad(__('Install Location'))                  + ' = ' + cyan(x.path) + '\n' +
				'  ' + rpad(__('iOS SDKs'))                          + ' = ' + cyan(x.sdks.length ? x.sdks.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('iOS Simulators'))                    + ' = ' + cyan(x.sims.length ? x.sims.join(', ') : 'none') + '\n' +
				'  ' + rpad(__('CLI Tools Installed'))               + ' = ' + cyan(x.cliTools ? 'yes' : 'no') + '\n' +
				'  ' + rpad(__('Supported by TiSDK %s', data.tisdk)) + ' = ' + cyan(x.supported == 'maybe' ? 'maybe' : x.supported ? 'yes' : 'no')
			);
		});
		logger.log();
	} else {
		logger.log(__('No Xcode installations found.').grey + '\n');
	}

	// ios keychains
	logger.log(
		__('iOS Keychains').bold + '\n' +
		Object.keys(data.certs.keychains).sort().reverse().map(function (keychain) {
			return '  ' + rpad(path.basename(keychain)) + ' = ' + cyan(keychain);
		}).join('\n') + '\n');

	// ios certs
	logger.log(__('iOS Development Certificates').bold);
	var counter = 0;
	if (Object.keys(data.certs.keychains).length) {
		Object.keys(data.certs.keychains).forEach(function (keychain) {
			var devs = data.certs.keychains[keychain].developer || [];
			if (devs.length) {
				logger.log(keychain.grey);
				devs.forEach(function (dev) {
					counter++;
					logger.log('  ' + dev.name.cyan + (dev.expired ? ' ' + __('**EXPIRED**').red : dev.invalid ? ' ' + __('**INVALID**').red : ''));
				});
			}
		});
	}
	logger.log(counter ? '' : '  ' + __('None').grey + '\n');

	logger.log(__('iOS Distribution Certificates').bold);
	counter = 0;
	if (Object.keys(data.certs.keychains).length) {
		Object.keys(data.certs.keychains).forEach(function (keychain) {
			var dists = data.certs.keychains[keychain].distribution || [];
			if (dists.length) {
				logger.log(keychain.grey);
				dists.forEach(function (dist) {
					counter++;
					logger.log('  ' + dist.name.cyan + (dist.expired ? ' ' + __('**EXPIRED**').red : dist.invalid ? ' ' + __('**INVALID**').red : ''));
				});
			}
		});
	}
	logger.log(counter ? '' : '  ' + __('None').grey + '\n');

	// wwdr cert
	logger.log(__('Apple WWDR Certificate').bold + '\n' +
		'  ' + rpad(__('Apple WWDR')) + ' = ' + cyan(data.certs.wwdr ? __('installed') : __('not found')) + '\n');

	function printProfiles(profiles) {
		if (profiles.length) {
			profiles.sort(function (a, b) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}).forEach(function (profile) {
				logger.log(
					profile.name.grey + (profile.expired ? ' ' + __('**EXPIRED**').red : '') + '\n' +
					'  ' + rpad(__('UUID'))       + ' = ' + cyan(profile.uuid) + '\n' +
					'  ' + rpad(__('App Prefix')) + ' = ' + cyan(profile.appPrefix) + '\n' +
					'  ' + rpad(__('App Id'))     + ' = ' + cyan(profile.appId) + '\n' +
					'  ' + rpad(__('Date Created')) + ' = ' + cyan(profile.creationDate ? moment(profile.creationDate).format('l LT') : 'unknown') + '\n' +
					'  ' + rpad(__('Date Expired')) + ' = ' + cyan(profile.expirationDate ? moment(profile.expirationDate).format('l LT') : 'unknown')
				);
			});
			logger.log();
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	// provisioning profiles
	logger.log(__('Development iOS Provisioning Profiles').bold);
	printProfiles(data.provisioningProfiles.development);

	logger.log(__('Distribution iOS Provisioning Profiles').bold);
	printProfiles(data.provisioningProfiles.distribution);

	logger.log(__('Ad Hoc iOS Provisioning Profiles').bold);
	printProfiles(data.provisioningProfiles.adhoc);

	logger.log(__('iOS Simulators').bold);
	if (data.simulators && data.simulators.length) {
		logger.log(data.simulators.map(function (sim) {
			var features = '';
			return sim.name.grey + '\n' + [
				'  ' + rpad(__('Type'))         + ' = ' + cyan(sim.type),
				'  ' + rpad(__('iOS Versions')) + ' = ' + cyan(sim.versions.join(', ')),
				'  ' + rpad(__('Architecture')) + ' = ' + cyan(sim['64bit'] ? '64-bit' : '32-bit'),
				'  ' + rpad(__('Features'))     + ' = ' + cyan(sim.retina ? 'retina' + (sim.tall ? ', tall' : '') : (sim.tall ? 'tall' : 'n/a'))
			].join('\n');
		}).join('\n') + '\n');
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	logger.log(__('Connected iOS Devices').bold);
	if (data.devices && data.devices.length) {
		logger.log(data.devices.map(function (device) {
			return device.name.grey + '\n' + [
				'  ' + rpad(__('ID'))               + ' = ' + cyan(device.udid),
				'  ' + rpad(__('Type'))             + ' = ' + cyan(device.deviceClass + ' (' + device.deviceColor + ')'),
				'  ' + rpad(__('iOS Version'))      + ' = ' + cyan(device.productVersion),
				'  ' + rpad(__('CPU Architecture')) + ' = ' + cyan(device.cpuArchitecture)
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

	logger.log(__('Android SDK').bold + '\n' +
		'  ' + rpad(__('Android Executable')) + ' = ' + cyan(data.android.exe || __('not found')) + '\n' +
		'  ' + rpad(__('SDK Path'))           + ' = ' + cyan(data.android.sdkPath || __('not found')) + '\n'
	);

	logger.log(__('Android NDK').bold + '\n' +
		'  ' + rpad(__('NDK Path'))           + ' = ' + cyan(data.android.ndk ? data.android.ndk.path : __('not found')) + '\n' +
		'  ' + rpad(__('NDK Version'))        + ' = ' + cyan(data.android.ndk ? data.android.ndk.version : __('not installed')) + '\n'
	);

	var androidPlatforms = '',
		androidAddons = '';

	(function (targets) {
		if (targets && Object.keys(targets).length) {
			Object.keys(targets).forEach(function (targetId) {
				var target = targets[targetId];
				if (target.type == 'Platform') {
					androidPlatforms += (targetId + ') ' + target.id).grey + '\n' +
						'  ' + rpad(__('Name'))        + ' = ' + cyan(target.name) + '\n' +
						'  ' + rpad(__('API Level'))   + ' = ' + cyan(target['api-level']) + '\n' +
						'  ' + rpad(__('Revision'))    + ' = ' + cyan(target.revision) + '\n' +
						'  ' + rpad(__('Skins'))       + ' = ' + cyan(target.skins.join(', ')) + '\n' +
						'  ' + rpad(__('ABIs'))        + ' = ' + cyan(target.abis.join(', ')) + '\n' +
						'  ' + rpad(__('Path'))        + ' = ' + cyan(target.path) + '\n';
				} else if (target.type == 'Add-On') {
					androidAddons += (targetId + ') ' + target.id).grey + '\n' +
						'  ' + rpad(__('Name'))        + ' = ' + cyan(target.name) + '\n' +
						'  ' + rpad(__('Vendor'))      + ' = ' + cyan(target.vendor) + '\n' +
						'  ' + rpad(__('Revision'))    + ' = ' + cyan(target.revision) + '\n' +
						'  ' + rpad(__('Description')) + ' = ' + cyan(target.description) + '\n' +
						'  ' + rpad(__('Skins'))       + ' = ' + cyan(target.skins.join(', ')) + '\n' +
						'  ' + rpad(__('ABIs'))        + ' = ' + cyan(target.abis.join(', ')) + '\n' +
						'  ' + rpad(__('Path'))        + ' = ' + cyan(target.path) + '\n' +
						'  ' + rpad(__('Based On'))    + ' = ' + cyan(target['based-on'] ? __('Android %s (API level %s)', target['based-on']['android-version'], target['based-on']['api-level']) : __('unknown')) + '\n' +
						'  ' + rpad(__('Libraries'))   + ' = ' + cyan(target.libraries && Object.keys(target.libraries).length
							? Object.keys(target.libraries).map(function (lib) {
									return lib + ': ' + target.libraries[lib].description + ' (' + target.libraries[lib].jar + ')';
								}).join(', ')
							: 'none') + '\n';
				}
			});
		}
	}(data.android.targets));

	logger.log(__('Android Platforms').bold + '\n' + (androidPlatforms ? androidPlatforms : '  ' + __('None').grey + '\n'));
	logger.log(__('Android Add-Ons').bold + '\n' + (androidAddons ? androidAddons : '  ' + __('None').grey + '\n'));

	logger.log(__('Android AVDs').bold);
	(function (avds) {
		if (avds && avds.length) {
			logger.log(avds.map(function (avd) {
				return avd.name.grey + '\n' +
					'  ' + rpad(__('Path'))     + ' = ' + cyan(avd.path) + '\n' +
					'  ' + rpad(__('Target'))   + ' = ' + cyan(avd.target) + '\n' +
					'  ' + rpad(__('ABI'))      + ' = ' + cyan(avd.abi) + '\n' +
					'  ' + rpad(__('Skin'))     + ' = ' + cyan(avd.skin) + '\n' +
					'  ' + rpad(__('SD Card'))  + ' = ' + cyan(avd.sdcard || __('no sd card')) + '\n' +
					'  ' + rpad(__('Based On')) + ' = ' + cyan(avd['based-on'] ? __('Android %s (API level %s)', avd['based-on']['android-version'], avd['based-on']['api-level']) : __('unknown'));
				}).join('\n') + '\n');
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}(data.android.avds));
}

function printAndroid(logger, config, data) {
	logger.log(__('Android SDK').bold + '\n' +
		'  ' + rpad(__('Android Executable')) + ' = ' + cyan(data.sdk && data.sdk.executables.android || __('not found')) + '\n' +
		'  ' + rpad(__('ADB Executable'))     + ' = ' + cyan(data.sdk && data.sdk.executables.adb || __('not found')) + '\n' +
		'  ' + rpad(__('SDK Path'))           + ' = ' + cyan(data.sdk && data.sdk.path || __('not found')) + '\n'
	);

	logger.log(__('Android NDK').bold + '\n' +
		'  ' + rpad(__('NDK Path'))           + ' = ' + cyan(data.ndk && data.ndk.path || __('not found')) + '\n' +
		'  ' + rpad(__('NDK Version'))        + ' = ' + cyan(data.ndk && data.ndk.version || __('not installed')) + '\n'
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
						: (' **' + __('Not supported by Titanium SDK %s', data.tisdk) + '**').red);

			if (target.type == 'platform') {
				var m = target.name.match(/Android\s+(\d(?:\.\d(?:\.\d)?)?)/);
				if (m) {
					apiLevelMap[m[1]] = target['api-level'];
				}
				androidPlatforms += (targetId + ') ' + target.id).grey + '\n' +
					'  ' + rpad(__('Name'))        + ' = ' + cyan(target.name) + supported + '\n' +
					'  ' + rpad(__('API Level'))   + ' = ' + cyan(target['api-level']) + '\n' +
					'  ' + rpad(__('Revision'))    + ' = ' + cyan(target.revision) + '\n' +
					'  ' + rpad(__('Skins'))       + ' = ' + cyan(target.skins.join(', ')) + '\n' +
					'  ' + rpad(__('ABIs'))        + ' = ' + cyan(target.abis.join(', ')) + '\n' +
					'  ' + rpad(__('Path'))        + ' = ' + cyan(target.path) + '\n';
			} else if (target.type == 'add-on') {
				androidAddons += (targetId + ') ' + target.id).grey + '\n' +
					'  ' + rpad(__('Name'))        + ' = ' + cyan(target.name
						+ ' (' + target['based-on'] ? __('Android %s (API level %s)', target['based-on']['android-version'], target['based-on']['api-level']) : __('unknown') + ')') + supported + '\n' +
					'  ' + rpad(__('Vendor'))      + ' = ' + cyan(target.vendor) + '\n' +
					'  ' + rpad(__('Revision'))    + ' = ' + cyan(target.revision) + '\n' +
					'  ' + rpad(__('Description')) + ' = ' + cyan(target.description) + '\n' +
					'  ' + rpad(__('Skins'))       + ' = ' + cyan(target.skins.join(', ')) + '\n' +
					'  ' + rpad(__('ABIs'))        + ' = ' + cyan(target.abis.join(', ')) + '\n' +
					'  ' + rpad(__('Path'))        + ' = ' + cyan(target.path) + '\n' +
					'  ' + rpad(__('Libraries'))   + ' = ' + cyan(target.libraries && Object.keys(target.libraries).length
						? Object.keys(target.libraries).map(function (lib) {
								return lib + ': ' + target.libraries[lib].description + ' (' + target.libraries[lib].jar + ')';
							}).join(', ')
						: 'none') + '\n';
			}
		});
	}

	logger.log(__('Android Platforms').bold + '\n' + (androidPlatforms ? androidPlatforms : '  ' + __('None').grey + '\n'));
	logger.log(__('Android Add-Ons').bold + '\n' + (androidAddons ? androidAddons : '  ' + __('None').grey + '\n'));

	logger.log(__('Android Emulators').bold);
	if (data.emulators) {
		var emus = data.emulators.filter(function (e) { return e.type == 'avd'; });
		if (emus.length) {
			logger.log(emus.map(function (emu) {
				return emu.name.grey + '\n' +
					'  ' + rpad(__('Path'))        + ' = ' + cyan(emu.path) + '\n' +
					'  ' + rpad(__('SDK Version')) + ' = ' + cyan(emu.target) + '\n' +
					'  ' + rpad(__('ABI'))         + ' = ' + cyan(emu.abi) + '\n' +
					'  ' + rpad(__('Skin'))        + ' = ' + cyan(emu.skin) + '\n' +
					'  ' + rpad(__('SD Card'))     + ' = ' + cyan(emu.sdcard || __('no sd card')) + '\n' +
					(emu['based-on']
						? '  ' + rpad(__('Based On'))    + ' = ' + cyan(__('Android %s (API level %s)', emu['based-on']['android-version'], emu['based-on']['api-level'])) + '\n'
						: ''
					) +
					'  ' + rpad(__('Google APIs')) + ' = ' + cyan(emu.googleApis ? __('yes') : __('no'));
			}).join('\n') + '\n');
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}

	if (config.get('genymotion.enabled')) {
		logger.log(__('Genymotion Emulators').bold);
		if (data.emulators) {
			var emus = data.emulators.filter(function (e) { return e.type == 'genymotion'; });
			if (emus.length) {
				logger.log(emus.map(function (emu) {
					return emu.name.grey + '\n' +
						'  ' + rpad(__('SDK Version'))         + ' = ' + cyan(emu.target + (apiLevelMap[emu.target] ? ' (android-' + apiLevelMap[emu.target] + ')' : '')) + '\n' +
						'  ' + rpad(__('ABI'))                 + ' = ' + cyan(emu.abi || __('unknown')) + '\n' +
						'  ' + rpad(__('Genymotion Version'))  + ' = ' + cyan(emu.genymotion || __('unknown')) + '\n' +
						'  ' + rpad(__('Display'))             + ' = ' + cyan(emu.display || __('unknown')) + '\n' +
						'  ' + rpad(__('DPI'))                 + ' = ' + cyan(emu.dpi || __('unknown')) + '\n' +
						'  ' + rpad(__('OpenGL Acceleration')) + ' = ' + cyan(emu.hardwareOpenGL ? __('yes') : __('no')) + '\n' +
						'  ' + rpad(__('Google APIs'))         + ' = ' + cyan(emu.googleApis === null ? __('unknown, emulator not running') : emu.googleApis ? __('yes') : __('no'));
				}).join('\n') + '\n');
			} else {
				logger.log('  ' + __('None').grey + '\n');
			}
		} else {
			logger.log('  ' + __('None').grey + '\n');
		}
	}

	logger.log(__('Connected Android Devices').bold);
	if (data.devices && data.devices.length) {
		logger.log(data.devices.map(function (device) {
			var name = device.model || device.manufacturer,
				result = [
					'  ' + rpad(__('ID'))          + ' = ' + cyan(device.id),
					'  ' + rpad(__('SDK Version')) + ' = ' + cyan(device.release + ' (android-' + device.sdk + ')'),
					'  ' + rpad(__('ABIs'))        + ' = ' + cyan(device.abi.join(', '))
				];

			if (device.emulator) {
				switch (device.emulator.type) {
					case 'avd':
						name = 'Android Emulator: ' + device.emulator.name;
						result.push('  ' + rpad(__('Skin'))        + ' = ' + cyan(device.emulator.skin || __('unknown')));
						result.push('  ' + rpad(__('SD Card'))     + ' = ' + cyan(device.emulator.sdcard || __('unknown')));
						result.push('  ' + rpad(__('Google APIs')) + ' = ' + cyan(device.emulator.googleApis ? __('yes') : __('no')));
						break;

					case 'genymotion':
						if (config.get('genymotion.enabled')) {
							name = 'Genymotion Emulator: ' + device.emulator.name;
							result.push('  ' + rpad(__('Genymotion Version'))  + ' = ' + cyan(device.emulator.genymotion || __('unknown')));
							result.push('  ' + rpad(__('Display'))             + ' = ' + cyan(device.emulator.display || __('unknown')));
							result.push('  ' + rpad(__('DPI'))                 + ' = ' + cyan(device.emulator.dpi || __('unknown')));
							result.push('  ' + rpad(__('OpenGL Acceleration')) + ' = ' + cyan(device.emulator.hardwareOpenGL ? __('yes') : __('no')));
							result.push('  ' + rpad(__('Google APIs'))         + ' = ' + cyan(device.emulator.googleApis ? __('yes') : __('no')));
						}
						break;
				}

				return name.grey + '\n' + result.join('\n');
			} else {
				return name.grey + '\n' + result.join('\n');
			}
		}).join('\n') + '\n');
	} else {
		logger.log('  ' + __('None').grey + '\n');
	}
}

function printWinStore(logger, config, data) {
	logger.log(__('Windows Store SDK').bold + '\n' +
		'  ' + rpad(__('Visual Studio Path')) + ' = ' + cyan(data.visualStudioPath || __('not found')) + '\n' +
		'  ' + rpad(__('MSBuild version')) + ' = ' + cyan(data.msbuildVersion || __('not found')) + '\n'
	);
}

function printWP8(logger, config, data) {
	logger.log(__('Windows Phone 8 SDK').bold + '\n' +
		'  ' + rpad(__('Visual Studio Path')) + ' = ' + cyan(data.visualStudioPath || __('not found')) + '\n' +
		'  ' + rpad(__('MSBuild version')) + ' = ' + cyan(data.msbuildVersion || __('not found')) + '\n' +
		'  ' + rpad(__('SDK Path')) + ' = ' + cyan(data.sdkPath || __('not found')) + '\n'
	);
	if (data.devices) {
		logger.log(__('Windows Phone 8 Devices').bold);
		var devices = [];
		Object.keys(data.devices).forEach(function (device) {
			devices.push('  ' + appc.string.rpad(device + ')', 3).grey + data.devices[device].cyan);
		});
		logger.log(devices.join('\n') + '\n');
	}
}
