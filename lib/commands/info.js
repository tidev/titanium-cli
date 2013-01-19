/*
 * info.js: Titanium CLI info command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	env = appc.environ,
	mix = appc.util.mix,
	async = require('async'),
	path = require('path'),
	typesList = ['all', 'os', 'nodejs', 'titanium', 'ios', 'android'];

exports.desc = __('display development environment information');

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

exports.run = function (logger, config, cli) {
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
		function (next) {
			if (types.all || types.os || types.nodejs) {
				env.getOSInfo(function (info) {
					next(null, {
						os: {
							name: info.os,
							version: info.osver,
							architecture: info.osarch,
							numcpus: info.oscpu,
							memory: info.memory
						},
						node: {
							version: info.node
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
				appc.ios.detect(function (info) {
					var result = { xcode: {} };
					Object.keys(info.xcode).forEach(function (ver) {
						if (ver != '__selected__') {
							mix(result.xcode[ver] = {}, info.xcode[ver]);
						}
					});
					
					result.iosCerts = {
						dev: info.certs.dev,
						devNames: info.certs.devNames,
						dist: info.certs.dist,
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
					
					result.iOSKeychains = ['System Default'].concat(info.keychains);
					
					next(null, result);
				});
			} else {
				next(null, null);
			}
		},
		
		function (next) {
			if (types.all || types.android) {
				appc.android.detect(function (info) {
					next(null, { android: info });
				}, config.android && config.android.sdkPath, config.android && config.android.ndkPath);
			} else {
				next(null, null);
			}
		},
		
		function (next) {
			if (types.all || types.titanium) {
				var sdks = {};
				Object.keys(env.sdks).forEach(function (ver) {
					var n = env.sdks[ver];
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
		var data = mix.apply(null, results),
			sections,
			maxlen,
			libraries;
		
		if (cli.argv.output == 'json') {
			logger.log(JSON.stringify(data, null, '\t'));
		} else {
			sections = {};
			
			if (types.all || types.os) {
				sections['Operating System'] = [
					['Name', data.os.name],
					['Version', data.os.version],
					['Architecture', data.os.architecture],
					['# CPUs', data.os.numcpus],
					['Memory', (data.os.memory / 1024 / 1024 / 1024).toFixed(1) + 'GB']
				];
			}
			
			if (types.all || types.nodejs) {
				sections['node.js'] = [
					['node.js Version', data.node.version],
					['npm Version', data.npm.version]
				];
			};
			
			if (process.platform == 'darwin' && (types.all || types.ios)) {
				var xcode = sections['Xcode'] = {};
				Object.keys(data.xcode).sort().forEach(function (ver) {
					var x = data.xcode[ver];
					xcode[x.version + ' (build ' + x.build + ')'] = [
						['Install Location', x.path],
						['Selected', x.selected],
						['iOS SDKs', x.sdks.length ? x.sdks.join(', ') : 'none'],
						['iOS Simulators', x.sims.length ? x.sims.join(', ') : 'none']
					];
				});
				
				var certs = sections['iOS Certificates'] = {};
				if (Object.keys(data.keychains).length) {
					Object.keys(data.keychains).forEach(function (keychain) {
						certs[keychain] = [];
						if (data.keychains[keychain].developer) {
							certs[keychain].push(['Development', data.keychains[keychain].developer]);
						}
						if (data.keychains[keychain].distribution) {
							certs[keychain].push(['Distribution', data.keychains[keychain].distribution]);
						}
					});
				} else {
					certs['None'] = [];
				}
				
				sections['Apple WWDR Certificate'] = [
					['Apple WWDR', data.iosCerts.wwdr ? 'installed' : 'not found']
				];
				
				var pp = sections['Development iOS Provisioning Profiles'] = {};
				if (data.iOSProvisioningProfiles.development.length) {
					data.iOSProvisioningProfiles.development.forEach(function (profile) {
						pp[profile.name] = [
							['UUID', profile.uuid],
							['App Prefix', profile.appPrefix],
							['App Id', profile.appId]
						];
					});
				} else {
					pp['None'] = [];
				}
				
				pp = sections['Distribution iOS Provisioning Profiles'] = {};
				if (data.iOSProvisioningProfiles.distribution.length) {
					data.iOSProvisioningProfiles.distribution.forEach(function (profile) {
						pp[profile.name] = [
							['UUID', profile.uuid],
							['App Prefix', profile.appPrefix],
							['App Id', profile.appId]
						];
					});
				} else {
					pp['None'] = [];
				}
				
				pp = sections['Adhoc iOS Provisioning Profiles'] = {};
				if (data.iOSProvisioningProfiles.adhoc.length) {
					data.iOSProvisioningProfiles.adhoc.forEach(function (profile) {
						pp[profile.name] = [
							['UUID', profile.uuid],
							['App Prefix', profile.appPrefix],
							['App Id', profile.appId]
						];
					});
				} else {
					pp['None'] = [];
				}
				
				sections['iOS Keychains'] = data.iOSKeychains.map(function (keychain) {
					return [path.basename(keychain), keychain];
				});
			}
			
			if ((types.all || types.titanium) && data.titanium) {
				var titanium = sections['Titanium SDKs'] = {};
				Object.keys(data.titanium).forEach(function (ver) {
					var x = data.titanium[ver];
					titanium[ver] = [
						['Install Location', x.path],
						['Platforms', x.platforms.join(', ')],
						['git Hash', x.githash || 'unknown'],
						['git Timestamp', x.timestamp || 'unknown']
					];
				});
			}
			
			if (types.all || types.android) {
				if (data.android) {
					sections['Android'] = [
						['Android Executable', data.android.exe],
						['SDK Path', data.android.sdkPath],
						['NDK Path', data.android.ndk.path],
						['NDK Version', data.android.ndk.version],
						['JDK Version', data.android.java.version ? data.android.java.version + '_' + data.android.java.build : 'not installed']
					];
					
					var androidPlatforms = sections['Android Platforms'] = {},
						androidAddons = sections['Android Add-ons'] = {},
						androidAvds = sections['Android AVDs'] = {};
					
					(function (targets) {
						if (targets.length) {
							targets.forEach(function (targetId) {
								var target = data.android.targets[targetId];
								switch (target.type) {
									case 'Platform':
										androidPlatforms[target.id] = [
											['Name', target.name],
											['API Level', target['api-level']],
											['Revision', target.revision],
											['Skins', target.skins.join(', ')],
											['ABIs', target.abis.join(', ')],
											['Path', target.path]
										];
										break;
									
									case 'Add-On':
										androidAddons[target.id] = [
											['Name', target.name],
											['Vendor', target.vendor],
											['Revision', target.revision],
											['Description', target.description],
											['Skins', target.skins.join(', ')],
											['ABIs', target.abis.join(', ')],
											['Path', target.path],
											['Based On', target['based-on'] ? __('Android %s (API level %s)', target['based-on']['android-version'], target['based-on']['api-level']) : 'unknown'],
											['Libraries', target.libraries ? Object.keys(target.libraries).map(function (lib) {
												return lib + ': ' + target.libraries[lib].description + ' (' + target.libraries[lib].jar + ')';
											}) : 'none']
										];
										break;
								}
							});
						} else {
							androidPlatforms['None'] = [];
							androidAddons['None'] = [];
						}
					}(Object.keys(data.android.targets)));
	
					(function (avds) {
						if (avds.length) {
							avds.forEach(function (avd) {
								androidAvds[avd.name] = [
									['Path', avd.path],
									['Target', avd.target],
									['ABI', avd.abi],
									['Skin', avd.skin],
									['SD Card', avd.sdcard || 'no sd card'],
									['Based On', avd['based-on'] ? __('Android %s (API level %s)', avd['based-on']['android-version'], avd['based-on']['api-level']) : 'unknown']
								];
							});
						} else {
							androidAvds['None'] = [];
						}
					}(data.android.avds));
				} else {
					sections['Android'] = [
						['Android Executable', 'not found'],
						['SDK Path', 'unknown'],
						['NDK Path', 'unknown'],
						['NDK Version', 'unknown'],
						['JDK Version', 'unknown']
					];
					sections['Android Platforms'] = { 'None': [] };
					sections['Android Add-ons'] = { 'None': [] };
					sections['Android AVDs'] = { 'None': [] };
				}
			}
			
			// find the max length of the left column
			maxlen = 0;
			Object.keys(sections).forEach(function (section) {
				var s = sections[section];
				if (Array.isArray(s)) {
					s.forEach(function (i) {
						if (i[0].length > maxlen) {
							maxlen = i[0].length;
						}
					});
				} else {
					Object.keys(s).forEach(function (i) {
						if (i.length > maxlen) {
							maxlen = i.length;
						}
						s[i].forEach(function (j) {
							if (j[0].length > maxlen) {
								maxlen = j[0].length;
							}
						});
					});
				}
			});
			
			logger.banner();
			
			// print the sections and data
			Object.keys(sections).forEach(function (section) {
				var s = sections[section];
				logger.log(section.bold);
				
				if (Array.isArray(s)) {
					s.forEach(function (i) {
						if (typeof i[1] === 'string') {
							logger.log('  %s = %s', appc.string.rpad(i[0], maxlen), ('' + i[1]).cyan);
						} else if (Array.isArray(i[1])) {
							logger.log('  %s = %s', appc.string.rpad(i[0], maxlen), ('' + i[1][0]).cyan);
							for (var k = 1; k < i[1].length; k++) {
								logger.log('  %s   %s', appc.string.rpad('', maxlen), ('' + i[1][k]).cyan);
							}
						}
					});
				} else {
					Object.keys(s).forEach(function (i) {
						logger.log((''+i).grey);
						s[i].forEach(function (j) {
							if (typeof j[1] === 'string') {
								logger.log('  %s = %s', appc.string.rpad(j[0], maxlen), ('' + j[1]).cyan);
							} else if (Array.isArray(j[1])) {
								logger.log('  %s = %s', appc.string.rpad(j[0], maxlen), ('' + j[1][0]).cyan);
								for (var k = 1; k < j[1].length; k++) {
									logger.log('  %s   %s', appc.string.rpad('', maxlen), ('' + j[1][k]).cyan);
								}
							}
						});
					});
				}
				
				logger.log();
			});
		}
	});
};
