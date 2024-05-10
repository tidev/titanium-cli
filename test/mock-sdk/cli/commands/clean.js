'use strict';

const ti = require('../lib/node-titanium-sdk/ti');
const fs = require('fs');
const path = require('path');
const fields = require('fields');

exports.cliVersion = '>=3.2.1';
exports.desc = 'removes previous build directories';

exports.config = function (logger, config, cli) {
	// start patching the logger here
	patchLogger(logger, cli);

	return (finished) => {
		cli.createHook('clean.config', callback => {
			var conf = {
				options: Object.assign({
					platform: {
						// this is for backwards compatibility and eventually should be dropped
						hidden: true
					},
					platforms: {
						// note: --platforms is not required for the clean command
						abbr: 'p',
						desc: 'one or more platforms to clean',
						values: ['android'],
						skipValueCheck: true // we do our own validation
					},
					'project-dir': {
						abbr: 'd',
						callback: function (projectDir) {
							if (projectDir === '') {
								// no option value was specified
								// set project dir to current directory
								projectDir = conf.options['project-dir'].default;
							}

							projectDir = path.resolve(projectDir);

							// load the tiapp.xml/timodule.xml
							if (fs.existsSync(path.join(projectDir, 'tiapp.xml'))) {
								cli.tiapp = {};
								cli.tiapp.properties ||= {};
								cli.argv.type = 'app';

							} else if (fs.existsSync(path.join(projectDir, 'timodule.xml'))) {
								cli.tiapp = cli.timodule = {};
								cli.manifest = {
									platform: 'android'
								};

								if (!cli.argv.platform) {
									cli.argv.platform = cli.manifest.platform;
									conf.options.platform.required = false;
								}

								cli.timodule.properties ||= {};
								cli.argv.type = 'module';

							} else {
								// neither app nor module
								return;
							}

							cli.scanHooks(path.join(projectDir, 'hooks'));

							return projectDir;
						},
						desc: 'the directory containing the project, otherwise the current working directory',
						default: '.',
						order: 1,
						prompt(callback) {
							callback(fields.file({
								promptLabel: 'Where is the __project directory__?',
								complete: true,
								showHidden: true,
								ignoreDirs: new RegExp(config.get('cli.ignoreDirs')),
								ignoreFiles: /.*/,
								validate: conf.options['project-dir'].validate
							}));
						},
						validate: function (projectDir, callback) {
							const isDefault = (projectDir == conf.options['project-dir'].default);
							let dir = path.resolve(projectDir);

							if (!fs.existsSync(dir)) {
								return callback(new Error('Project directory does not exist'));
							}

							const root = path.resolve('/');
							let isFound;
							let projDir = dir;

							['tiapp.xml', 'timodule.xml'].some(tiXml => {
								let tiFile = path.join(dir, tiXml);

								while (!fs.existsSync(tiFile)) {
									dir = path.dirname(dir);
									if (dir == root) {
										isFound = false;
										break;
									}
									tiFile = path.join(dir, tiXml);
								}

								// Found the xml file, break the loop
								if (fs.existsSync(tiFile)) {
									isFound = true;
									return true;
								}

								dir = projDir;
							});

							if (!isFound && dir == root && isDefault) {
								callback(true);
								return;
							}

							if (!isFound) {
								callback(new Error(`Invalid project directory "${projectDir}" because tiapp.xml or timodule.xml not found`));
								return;
							}
							callback(null, dir);
						}
					}
				}, ti.commonOptions(logger, config))
			};
			callback(null, conf);
		})((_err, result) => finished(result));
	};
};

exports.validate = function (logger, config, cli) {
	// Determine if the project is an app or a module, run appropriate clean command
	if (cli.argv.type === 'module') {

		// make sure the module manifest is sane
		ti.validateModuleManifest(logger, cli, cli.manifest);

		return finished => {
			logger.log.init(() => {
				const result = ti.validatePlatformOptions(logger, config, cli, 'cleanModule');
				if (result && typeof result === 'function') {
					result(finished);
				} else {
					finished(result);
				}
			});
		};

	} else {
		let platforms = cli.argv.platforms || cli.argv.platform;
		if (platforms) {
			platforms = ti.scrubPlatforms(platforms);

			if (platforms.bad.length) {
				logger.error(`Invalid platform${platforms.bad.length === 1 ? '' : 's'}: ${platforms.bad.join(', ')}\n`);
				logger.log(`Available platforms for SDK version ${ti.manifest.sdkVersion}:\n`);
				ti.targetPlatforms.forEach(function (p) {
					logger.log('    ' + p.cyan);
				});
				logger.log();
				process.exit(1);
			}

			cli.argv.platforms = platforms.scrubbed;
		} else {
			cli.argv.platforms = null;
		}

		ti.validateProjectDir(logger, cli, cli.argv, 'project-dir');

		return finished =>{
			ti.loadPlugins(logger, config, cli, cli.argv['project-dir'], () => finished());
		};
	}
};

exports.run = function (logger, config, cli) {
	if (cli.argv.type === 'module') {
		const platform = ti.resolvePlatform(cli.argv.platform);
		const cleanModule = path.join(__dirname, '..', '..', platform, 'cli', 'commands', '_cleanModule.js');
		if (!fs.existsSync(cleanModule)) {
			process.exit(1);
		}

		// Now wrap the actual cleaning of the module (specific to a given platform),
		// in hooks so a module itself could potentially do additional cleanup itself
		cli.fireHook('clean.module.pre', function () {
			cli.fireHook(`clean.module.${platform}.pre`, () => {
				cli.fireHook(`clean.module.${platform}.post`, () => {
					cli.fireHook('clean.module.post', () => {});
				});
			});
		});
	} else {
		const buildDir = path.join(cli.argv['project-dir'], 'build');

		if (cli.argv.platforms) {
			cli.argv.platforms.reduce((prom, platform) => {
				return prom.then(new Promise(resolve => {
					// scan platform SDK specific clean hooks
					cli.scanHooks(path.join(__dirname, '..', '..', platform, 'cli', 'hooks'));
					cli.fireHook('clean.pre', function () {
						cli.fireHook(`clean.${platform}.pre`, function () {
							cli.fireHook(`clean.${platform}.post`, function () {
								cli.fireHook('clean.post', () => resolve());
							});
						});
					});
				}));
			}, Promise.resolve());
		} else if (fs.existsSync(buildDir)) {
			logger.debug('Deleting all platform build directories');

			// scan platform SDK specific clean hooks
			if (ti.targetPlatforms) {
				ti.targetPlatforms.forEach(platform => {
					cli.scanHooks(path.join(__dirname, '..', '..', platform, 'cli', 'hooks'));
				});
			}

			cli.fireHook('clean.pre', function () {
				fs.readdirSync(buildDir).reduce((prom, dir) => {
					return prom.then(new Promise(resolve => {
						cli.fireHook(`clean.${dir}.pre`, () => {
							cli.fireHook(`clean.${dir}.post`, () => resolve());
						});
					}));
				}, Promise.resolve()).then(new Promise(resolve => {
					cli.fireHook('clean.post', () => resolve());
				}));
			});
		}
	}
};

/**
 * Monkey-patch the logger object to enable file logging during build
 * @param {Object} logger - The logger instance
 * @param {Object} cli - The CLI instance
 */
function patchLogger(logger, cli) {
	var origLoggerLog = logger.log;

	// override the existing log function
	logger.log = function patchedLog() {
		// most of this copied from the CLI's logger.js logger.log() function
		let args = Array.prototype.slice.call(arguments);
		let padLevels = logger.padLevels;

		// if there are no args (i.e. a blank line), we need at least one space
		args.length || args.unshift(' ');

		// if we're not being called from info/warn/error/debug, then set this as a general log entry
		args[0] in logger.levels || args.unshift('_');

		// turn off padding
		logger.padLevels = args[0] !== '_';

		// get rid of any null args
		while (args.length && args[args.length - 1] == null) {
			args.pop();
		}

		// if we're logging an error, we need to cast to a string so that sprintf doesn't complain
		if (args[1] instanceof Error || Object.prototype.toString.call(args[1]) === '[object Error]') {
			args[1] = (args[1].stack || args[1].toString()) + '\n';
		} else if (args[1] === null || args[1] === undefined) {
			args[1] = '';
		}

		typeof type !== 'string' && (args[1] = '' + args[1]);

		// call the original logger with our cleaned up args
		origLoggerLog.apply(logger, arguments);

		// restore padding
		logger.padLevels = padLevels;
	};

	logger.log.init = function (callback) {
		function styleHeading(s) {
			return ('' + s).bold;
		}

		function styleValue(s) {
			return ('' + s).magenta;
		}

		function rpad(s) {
			return s.padEnd(27);
		}

		cli.env.getOSInfo(function (osInfo) {
			logger.log([
				new Date().toLocaleString(),
				'',
				styleHeading('Operating System'),
				'  ' + rpad('Name')            + ' = ' + styleValue(osInfo.os),
				'  ' + rpad('Version')         + ' = ' + styleValue(osInfo.osver),
				'  ' + rpad('Architecture')    + ' = ' + styleValue(osInfo.ostype),
				'  ' + rpad('# CPUs')          + ' = ' + styleValue(osInfo.oscpu),
				'  ' + rpad('Memory')          + ' = ' + styleValue(osInfo.memory),
				'',
				styleHeading('Node.js'),
				'  ' + rpad('Node.js Version') + ' = ' + styleValue(osInfo.node),
				'  ' + rpad('npm Version')     + ' = ' + styleValue(osInfo.npm),
				'',
				styleHeading('Titanium CLI'),
				'  ' + rpad('CLI Version')     + ' = ' + styleValue(cli.version),
				'',
				styleHeading('Titanium SDK'),
				'  ' + rpad('SDK Version')     + ' = ' + styleValue(cli.argv.sdk),
				'  ' + rpad('SDK Path')        + ' = ' + styleValue(cli.sdk.path),
				'  ' + rpad('Target Platform') + ' = ' + styleValue(ti.resolvePlatform(cli.argv.platform)),
				'',
				styleHeading('Command'),
				'  ' + styleValue(process.argv.join(' ')),
				''
			].join('\n'));

			logger.log.flush();
			callback();
		});
	};

	logger.log.flush = function () {
	};

	logger.log.end = function () {
	};

	logger.log.buffer = '';
}
