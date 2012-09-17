/*
 * info.js: Titanium CLI info command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	env = appc.environ,
	mix = appc.util.mix,
	async = require('async');

exports.config = function (logger, config, cli) {
	return {
		desc: __('display development environment information'),
		noAuth: true,
		skipBanner: true,
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				desc: __('output format'),
				values: ['report', 'json']
			}
		}
	};
};

exports.run = function (logger, config, cli) {
	// important: we must duplicate every bit of info as to not accidentally
	// break the contract of the JSON formatted output.
	async.parallel([
		function (next) {
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
		},
		
		function (next) {
			appc.ios.detect(function (info) {
				var result = { xcode: {} };
				Object.keys(info.xcode).forEach(function (ver) {
					if (ver != '__selected__') {
						result.xcode[ver] = {
							path: info.xcode[ver].path,
							xcodebuild: info.xcode[ver].xcodebuild,
							selected: info.xcode[ver].selected,
							version: info.xcode[ver].version,
							build: info.xcode[ver].build,
							sdks: [].concat(info.xcode[ver].sdks),
							sims: [].concat(info.xcode[ver].sims)
						};
					}
				});
				result.iosCerts = {
					dev: info.certs.dev,
					devNames: [].concat(info.certs.devNames),
					dist: info.certs.dist,
					distNames: [].concat(info.certs.distNames),
					wwdr: info.certs.wwdr
				};
				
				var pp = result.iOSProvisioningProfiles = {};
				Object.keys(info.provisioningProfiles).forEach(function (type) {
					pp[type] || (pp[type] = []);
					info.provisioningProfiles[type].forEach(function (profile) {
						pp[type].push(mix({}, profile));
					});
				});
				
				next(null, result);
			});
		},
		
		function (next) {
			appc.android.detect(function (info) {
				var result = {};
				
				next(null, { android: result });
			});
		},
		
		function (next) {
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
		}
	], function (err, results) {
		var data = mix.apply(null, results);
		
		if (cli.argv.output == 'json') {
			logger.log(JSON.stringify(data, null, '\t'));
		} else {
			var sections = {
				'Operating System': [
					['Name', data.os.name],
					['Version', data.os.version],
					['Architecture', data.os.architecture],
					['# CPUs', data.os.numcpus],
					['Memory', (data.os.memory / 1024 / 1024 / 1024).toFixed(1) + 'GB']
				],
				'node.js': [
					['node.js Version', data.node.version],
					['npm Version', data.npm.version]
				]
			};
			
			if (process.platform == 'darwin') {
				var xcode = sections['Xcode'] = {};
				Object.keys(data.xcode).forEach(function (ver) {
					var x = data.xcode[ver];
					xcode[x.version + ' (build ' + x.build + ')'] = [
						['Install Location', x.path],
						['Selected', x.selected],
						['iOS SDKs', x.sdks.length ? x.sdks.join(', ') : 'none'],
						['iOS Simulators', x.sims.length ? x.sims.join(', ') : 'none']
					];
				});
				
				sections['iOS Certificates'] = [
					['Development', data.iosCerts.dev ? data.iosCerts.devNames.join(', ') : 'not found'],
					['Distribution', data.iosCerts.dist ? data.iosCerts.distNames.join(', ') : 'not found'],
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
			}
			
			var titanium = sections['Titanium SDKs'] = {};
			Object.keys(data.titanium).forEach(function (ver) {
				var x = data.titanium[ver];
				titanium[ver] = [
					['Install Location', x.path],
					['Platforms', Object.keys(x.platforms).join(', ')],
					['git Hash', x.githash || 'unknown'],
					['git Timestamp', x.timestamp || 'unknown']
				];
			});
			
			// find the max length of the left column
			var maxlen = 0;
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
						logger.log('  %s = %s', appc.string.rpad(i[0], maxlen), ('' + i[1]).cyan);
					});
				} else {
					Object.keys(s).forEach(function (i) {
						logger.log((''+i).grey);
						s[i].forEach(function (j) {
							logger.log('  %s = %s', appc.string.rpad(j[0], maxlen), ('' + j[1]).cyan);
						});
					});
				}
				
				logger.log();
			});
		}
	});
};
