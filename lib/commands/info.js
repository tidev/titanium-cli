/**
 * @overview
 * The info command. Displays information about the current system including
 * Xcode installations, iOS SDKs, Android SDKs, and so on.
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
 * The info command. Displays information about the current system including
 * Xcode installations, iOS SDKs, Android SDKs, and so on.
 * @module lib/commands/info
 */

var appc = require('node-appc'),
	__ = appc.i18n(__dirname).__,
	afs = appc.fs,
	env = appc.environ,
	mix = appc.util.mix,
	async = require('async'),
	path = require('path'),
	moment = require('moment'),
	typesList = ['all', 'os', 'nodejs', 'titanium', 'ios', 'android'];

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
	var issues = [],
		types = {},
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
		function (next) {
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

		function (next) {
			if (process.platform === 'darwin' && (types.all || types.ios)) {
				// try to find a Titanium SDK 3.2 or newer for the detection stuff
				var sdks = Object.keys(cli.env.sdks).sort().reverse(),
					i, len, sdk, tisdk, file;

				for (i = 0, len = sdks.length; i < len; i++) {
					sdk = cli.env.sdks[sdks[i]];
					tisdk = sdk.manifest && sdk.manifest.version || sdk[i];

					// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
					if (appc.version.gte(tisdk, '3.2.0')
						&& sdk.platforms
						&& (
							(sdk.platforms.ios && afs.exists(file = path.join(sdk.platforms.ios.path, 'cli', 'lib', 'detect.js')))
							|| (sdk.platforms.iphone && afs.exists(file = path.join(sdk.platforms.iphone.path, 'cli', 'lib', 'detect.js')))
						)
					) {
						require(file).detect(logger, config, cli, {}, function (info) {
							// for backwards compatibility
							var devNames = {},
								distNames = {};
							Object.keys(info.certs.keychains).forEach(function (keychain) {
								var k = info.certs.keychains[keychain];
								k.developer && k.developer.forEach(function (d) {
									d.name && !devNames[d.name] && (devNames[d.name] = 1);
								});
								k.distribution && k.distribution.forEach(function (d) {
									d.name && !distNames[d.name] && (distNames[d.name] = 1);
								});
							});

							var result = {
								tisdk: tisdk,
								xcode: info.xcodeInstalls,
								iosDetectVersion: info.detectVersion || '1.0',
								iosCerts: {
									devNames: Object.keys(devNames),
									distNames: Object.keys(distNames),
									wwdr: info.certs.wwdr
								},
								iosKeychains: info.certs.keychains
							};

							var pp = result.iOSProvisioningProfiles = {};
							Object.keys(info.provisioningProfiles).forEach(function (type) {
								pp[type] || (pp[type] = []);
								info.provisioningProfiles[type].forEach(function (profile) {
									pp[type].push(mix({}, profile));
								});
							});

							result.iosIssues = info.issues;
							issues = issues.concat(info.issues);

							next(null, result);
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

					next(null, result);
				});
			} else {
				next(null, null);
			}
		},

		function (next) {
			if (types.all || types.android) {
				// try to find a Titanium SDK 3.2 or newer for the detection stuff
				var sdks = Object.keys(cli.env.sdks).sort().reverse(),
					i, len, sdk, tisdk, file;

				for (i = 0, len = sdks.length; i < len; i++) {
					sdk = cli.env.sdks[sdks[i]];
					tisdk = sdk.manifest && sdk.manifest.version || sdk[i];

					// check if we have a titanium sdk 3.2 or newer that has the new fancy detection system
					if (appc.version.gte(tisdk, '3.2.0')
						&& sdk.platforms
						&& sdk.platforms.android
						&& afs.exists(file = path.join(sdk.platforms.android.path, 'cli', 'lib', 'detect.js'))
					) {
						require(file).detect(logger, config, cli, {}, function (info) {
dump(info);
process.exit(0);
							var result = {
								tisdk: tisdk,
								androidDetectVersion: info.detectVersion || '1.0'
							};
							//result.iosIssues = info.issues;
							//issues = issues.concat(info.issues);

							next(null, result);
						});
						return;
					}
				}

				// the old legacy node-appc detection code
				appc.android.detect(function (info) {
					info || (info = {});
					info.jdk && (info.java = info.jdk); // backwards compatibility
					info.androidDetectVersion || (info.androidDetectVersion = '1.0');
					next(null, { android: info });
				}, config.android && config.android.sdkPath, config.android && config.android.ndkPath);
			} else {
				next(null, null);
			}
		},

		function (next) {
			if (types.all || types.titanium) {
				var sdks = {},
					sdkCount = 0,
					validSdks = 0;

				Object.keys(env.sdks).forEach(function (ver) {
					var n = env.sdks[ver];
					if (appc.version.gte(n.manifest ? n.manifest.version : ver, '3.0.0')) {
						validSdks++;
					}
					sdkCount++;
					sdks[ver] = {
						path: n.path,
						platforms: Object.keys(n.platforms),
						githash: n.manifest ? n.manifest.githash : null,
						timestamp: n.manifest ? n.manifest.timestamp : null
					};
				});

				next(null, { titanium: sdks });
			} else {
				next(null, null);
			}
		}
	], function (err, results) {
		var data = mix.apply(null, results);
		data.issues = issues;

		// if we're displaying titanium sdk info, then get the node-appc info
		data.titaniumCLI || (data.titaniumCLI = {});
		if ((types.all || types.titanium) && data.titanium) {
			data.titaniumCLI.version = cli.version;
			try {
				data.titaniumCLI.nodeAppcVer = require('node-appc/package.json').version;
			} catch (e) {}

			// get the node-appc version for each sdk
			Object.keys(data.titanium).forEach(function (ver) {
				try {
					data.titanium[ver].nodeAppcVer = require(path.join(data.titanium[ver].path, 'node_modules', 'node-appc', 'package.json')).version;
				} catch (e) {}
			});
		}

		if (cli.argv.output == 'json') {
			logger.log(JSON.stringify(data, null, '\t'));
		} else {
			printData(logger, config, cli, data, types);
		}

		finished();
	});
};

function printData(logger, config, cli, data, types) {
	var indent = 25,
		rpad = function (s) {
			return appc.string.rpad(s, indent);
		},
		cyan = function (s) {
			return ('' + s).cyan;
		};

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

	logger.banner();

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
			logger.log(__('No Titanium SDKs found.').grey + '\n');
		}
	}

	if (process.platform == 'darwin' && (types.all || types.ios)) {
		var iosLegacy = appc.version.lt(data.iosDetectVersion, '2.0');

		// legacy warning
		if (iosLegacy) {
			logger.log(
				appc.string.wrap(
					__('NOTE: The following Xcode and iOS information has been detected using the old environment detection logic. To display more accurate information, select a Titanium SDK 3.2 or newer.'),
					config.get('cli.width', 100)
				).magenta + '\n'
			);
		}

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
			logger.log(__('No Xcode installations found.').grey + '\n');
		}

		// ios keychains
		if (iosLegacy) {
			logger.log(
				__('iOS Keychains').bold + '\n' +
				data.iosKeychains.sort().reverse().map(function (keychain) {
					return '  ' + rpad(path.basename(keychain)) + ' = ' + cyan(keychain);
				}).join('\n') + '\n');
		} else {
			logger.log(
				__('iOS Keychains').bold + '\n' +
				Object.keys(data.iosKeychains).sort().reverse().map(function (keychain) {
					return '  ' + rpad(path.basename(keychain)) + ' = ' + cyan(keychain);
				}).join('\n') + '\n');
		}

		// ios certs
		if (iosLegacy) {
			logger.log(__('iOS Certificates').bold);
			if (Object.keys(data.keychains).length) {
				Object.keys(data.keychains).forEach(function (keychain) {
/* FIXME USING TISDK 3.1.1
					certs[keychain] = [];
					if (data.keychains[keychain].developer) {
						certs[keychain].push(['Development', data.keychains[keychain].developer]);
					}
					if (data.keychains[keychain].distribution) {
						certs[keychain].push(['Distribution', data.keychains[keychain].distribution]);
					}
*/
				});
			} else {
				logger.log('  ' + __('None').grey + '\n');
			}
		} else {
			logger.log(__('iOS Development Certificates').bold);
			var counter = 0;
			if (Object.keys(data.iosKeychains).length) {
				Object.keys(data.iosKeychains).forEach(function (keychain) {
					var devs = data.iosKeychains[keychain].developer || [];
					if (devs.length) {
						logger.log(keychain.grey);
						devs.forEach(function (dev) {
							counter++;
							logger.log('  ' + dev.name.cyan + (dev.expired ? ' **EXPIRED**'.red : dev.invalid ? ' **INVALID**'.red : ''));
						});
					}
				});
			}
			logger.log(counter ? '' : '  ' + __('None').grey + '\n');

			logger.log(__('iOS Distribution Certificates').bold);
			counter = 0;
			if (Object.keys(data.iosKeychains).length) {
				Object.keys(data.iosKeychains).forEach(function (keychain) {
					var dists = data.iosKeychains[keychain].distribution || [];
					if (dists.length) {
						logger.log(keychain.grey);
						dists.forEach(function (dist) {
							counter++;
							logger.log('  ' + dist.name.cyan + (dist.expired ? ' **EXPIRED**'.red : dist.invalid ? ' **INVALID**'.red : ''));
						});
					}
				});
			}
			logger.log(counter ? '' : '  ' + __('None').grey + '\n');
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
						profile.name.grey + (profile.expired ? ' **EXPIRED**'.red : '') + '\n' +
						'  ' + rpad(__('UUID'))       + ' = ' + cyan(profile.uuid) + '\n' +
						'  ' + rpad(__('App Prefix')) + ' = ' + cyan(profile.appPrefix) + '\n' +
						'  ' + rpad(__('App Id'))     + ' = ' + cyan(profile.appId)
					);
					if (!iosLegacy) {
						logger.log(
							'  ' + rpad(__('Date Created')) + ' = ' + cyan(profile.creationDate ? moment(profile.creationDate).format('l LT') : 'unknown') + '\n' +
							'  ' + rpad(__('Date Expired')) + ' = ' + cyan(profile.expirationDate ? moment(profile.expirationDate).format('l LT') : 'unknown')
						);
					}
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

		logger.log(__('Adhoc iOS Provisioning Profiles').bold);
		printProfiles(data.iOSProvisioningProfiles.adhoc);
	}

	if (types.all || types.android) {
		var androidLegacy = appc.version.lt(data.androidDetectVersion, '2.0');

		// legacy warning
		if (androidLegacy) {
			logger.log(
				appc.string.wrap(
					__('NOTE: The following Android information has been detected using the old environment detection logic. To display more accurate information, select a Titanium SDK 3.2 or newer.'),
					config.get('cli.width', 100)
				).magenta + '\n'
			);
		}

		logger.log(__('Android').bold + '\n' +
			'  ' + rpad(__('Android Executable')) + ' = ' + cyan(data.android.exe || __('not found')) + '\n' +
			'  ' + rpad(__('SDK Path'))           + ' = ' + cyan(data.android.sdkPath || __('not found')) + '\n' +
			'  ' + rpad(__('NDK Path'))           + ' = ' + cyan(data.android.ndk ? data.android.ndk.path : __('not found')) + '\n' +
			'  ' + rpad(__('NDK Version'))        + ' = ' + cyan(data.android.ndk ? data.android.ndk.version : __('not installed')) + '\n' +
			'  ' + rpad(__('JDK Version'))        + ' = ' + cyan(data.android.jdk && data.android.jdk.version ? data.android.jdk.version + '_' + data.android.jdk.build : __('not installed')) + '\n'
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

	if (appc.version.gte(data.tisdk, '3.2.0')) {
		logger.log(__('Issues').bold);
		if (data.issues.length) {
			data.issues.forEach(function (issue) {
				var msg = appc.string.wrap(issue.message.split('\n').map(function (line) {
						return line.trim().replace(/(__(.+?)__)/g, '$2'.bold);
					}).join(' '), config.get('cli.width', 120) - 5).replace(/\n/g, '\n     ') + '\n';

				if (issue.type == 'error') {
					logger.log(('  \u2715  ' + msg).red);
				} else if (issue.type == 'warning') {
					logger.log(('  !  '.bold + msg).yellow);
				} else {
					logger.log(('  \u25CF  ' + msg).magenta);
				}
			});
		} else {
			logger.log('  ' + __('No issues detected! Your development environment should be working perfectly!') + '\n');
		}
	}
}