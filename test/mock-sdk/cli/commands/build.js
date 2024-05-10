'use strict';

const fields = require('fields');
const fs = require('fs');
const path = require('path');
const ti = require('../lib/node-titanium-sdk/ti');

fields.setup({
	formatters: {
		error(err) {
			if (err instanceof Error) {
				return `[ERROR] ${err.message}`.red + '\n';
			}
			err = '' + err;
			return '\n' + (/^(\[ERROR\])/i.test(err) ? err : '[ERROR] ' + err.replace(/^Error:/i, '').trim()).red;
		}
	},
	style: {
		accelerator: 'cyan'
	}
});

exports.cliVersion = '>=3.2.1';
exports.title = 'Build';
exports.desc = 'builds a project';
exports.extendedDesc = 'Builds an existing app or module project.';

exports.config = function config(logger, config, cli) {
	fields.setup({ colors: cli.argv.colors });

	// start patching the logger here
	patchLogger(logger, cli);

	return finished => {
		cli.createHook('build.config', callback => {
			// note: it's currently impossible for the module build to declare any
			// config options/flags.
			ti.platformOptions(logger, config, cli, 'build', platformConf => {
				var conf = {
					flags: {
						'build-only': {
							abbr: 'b',
							desc: 'only perform the build; if true, does not install or run the app'
						},
						force: {
							abbr: 'f',
							desc: 'force a full rebuild'
						},
						legacy: {
							desc: 'build using the old Python-based builder.py; deprecated'
						},
						'skip-js-minify': {
							default: false,
							desc: `bypasses JavaScript minification; ${'simulator'.cyan} builds are never minified; only supported for ${'Android'.cyan} and ${'iOS'.cyan}`
						},
						'source-maps': {
							desc: 'generate inline source maps for transpiled JS files'
						},
					},
					options: Object.assign({
						platform: {
							abbr: 'p',
							callback(platform) {
								if (!cli.argv.$originalPlatform) {
									cli.argv.$originalPlatform = platform;
								}
								platform = cli.argv.platform = ti.resolvePlatform(platform);

								const p = platformConf[platform];
								p && p.options && Object.keys(p.options).forEach(name => {
									if (p.options[name].default && cli.argv[name] === undefined) {
										cli.argv[name] = p.options[name].default;
									}
								});

								return platform;
							},
							desc: 'the target build platform',
							hint: 'platform',
							order: 2,
							prompt: {
								label: 'Target platform',
								error: 'Invalid platform',
								validator(platform) {
									if (!platform) {
										throw new Error('Invalid platform');
									} else if (ti.availablePlatforms.indexOf(platform) === -1) {
										throw new Error(`Invalid platform: ${platform}`);
									}
									return true;
								}
							},
							required: true,
							skipValueCheck: true,
							values: ti.targetPlatforms
						},
						'project-dir': {
							abbr: 'd',
							callback(projectDir) {
								if (projectDir === '') {
									// no option value was specified
									// set project dir to current directory
									projectDir = conf.options['project-dir'].default;
								}

								projectDir = path.resolve(projectDir);

								// load the tiapp.xml/timodule.xml
								if (fs.existsSync(path.join(projectDir, 'tiapp.xml'))) {
									let tiapp;
									try {
										tiapp = cli.tiapp = {};
									} catch (ex) {
										logger.error(ex);
										logger.log();
										process.exit(1);
									}

									tiapp.properties || (tiapp.properties = {});

									cli.argv.type = 'app';

								} else if (fs.existsSync(path.join(projectDir, 'timodule.xml'))) {
									let timodule;
									try {
										timodule = cli.tiapp = cli.timodule = {};
									} catch (ex) {
										logger.error(ex);
										logger.log();
										process.exit(1);
									}

									const manifest = cli.manifest = ti.loadModuleManifest(logger, path.join(projectDir, 'manifest'));

									// if they didn't explicitly set --platform and we have a platform in the manifest,
									// then just use that and skip the platform prompting
									if (!cli.argv.platform && manifest.platform) {
										cli.argv.platform = ti.resolvePlatform(manifest.platform);
										conf.options.platform.required = false;
									}

									timodule.properties || (timodule.properties = {});

									cli.argv.type = 'module';

								} else {
									// neither app nor module
									return;
								}

								cli.scanHooks(path.join(projectDir, 'hooks'));

								return projectDir;
							},
							desc: 'the directory containing the project',
							default: process.env.SOURCE_ROOT ? path.join(process.env.SOURCE_ROOT, '..', '..') : '.',
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
							required: true,
							validate(projectDir, callback) {
								const isDefault = (projectDir == conf.options['project-dir'].default);
								let dir = path.resovle(projectDir);

								if (!fs.existsSync(dir)) {
									return callback(new Error('Project directory does not exist'));
								}

								const root = path.resolve('/');
								let isFound,
									projDir = dir;

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
					}, ti.commonOptions(logger, config)),
					platforms: platformConf
				};
				callback(null, conf);
			});
		})((_err, result) => finished(result));
	};
};

exports.validate = function validate(logger, config, cli) {

	// Determine if the project is an app or a module, run appropriate build command
	if (cli.argv.type === 'module') {

		// make sure the module manifest is sane
		ti.validateModuleManifest(logger, cli, cli.manifest);

		return finished => {
			logger.log.init(() => {
				const result = ti.validatePlatformOptions(logger, config, cli, 'buildModule');
				if (result && typeof result === 'function') {
					result(finished);
				} else {
					finished(result);
				}
			});
		};

	} else {

		ti.validatePlatform(logger, cli, 'platform');

		// since we need validate() to be async, we return a function in which the cli
		// will immediately call
		return function (finished) {
			logger.log.init(function () {
				function next(result) {
					if (result !== false) {
						// no error, load the tiapp.xml plugins
						ti.loadPlugins(logger, config, cli, cli.argv['project-dir'], function () {
							finished(result);
						});
					} else {
						finished(result);
					}
				}

				// loads the platform specific bulid command and runs its validate() function
				const result = ti.validatePlatformOptions(logger, config, cli, 'build');
				if (result && typeof result === 'function') {
					result(next);
				} else {
					next(result);
				}
			});
		};
	}
};

exports.run = function run(logger, config, cli, finished) {
	const buildFile = cli.argv.type === 'module' ? '_buildModule.js' : '_build.js',
		platform = ti.resolvePlatform(cli.argv.platform),
		buildModule = path.join(__dirname, '..', '..', platform, 'cli', 'commands', buildFile);

	if (!fs.existsSync(buildModule)) {
		logger.error('Unable to find platform specific build command\n');
		logger.log(`Your SDK installation may be corrupt. You can reinstall it by running '${(cli.argv.$ + ' sdk install --force --default').cyan}'.\n`);
		process.exit(1);
	}

	let counter = 0;
	require(buildModule).run(logger, config, cli, function (err) {
		if (!counter++) {
			const delta = String(cli.startTime - Date.now());
			if (err) {
				logger.error(`An error occurred during build after ${delta}`);
				if (err instanceof Error) {
					err.dump(logger.error);
				} else if (err !== true) {
					(err.message || err.toString()).trim().split('\n').forEach(function (msg) {
						logger.error(msg);
					});
				}
				logger.log();
				process.exit(1);
			} else {
				// eventually all platforms will just show how long the build took since they
				// are responsible for showing the own logging
				if (platform !== 'iphone' || cli.argv['build-only']) {
					logger.info(`Project built successfully in ${delta.cyan}\n`);
				}
			}

			finished();
		}
	});
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
		var args = Array.prototype.slice.call(arguments),
			padLevels = logger.padLevels,
			prefix;

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

		// add [INFO] type prefixes for each line
		prefix = (args[0] !== '_') ? '[' + args[0].toUpperCase() + ']' + ((args[0].length === 5) ? '  ' : '   ') : '';

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
			callback();
		});
	};
}
