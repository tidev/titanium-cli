'use strict';

const fields = require('fields');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ti = require('./node-titanium-sdk/ti');

module.exports = Creator;

function Creator(logger, config, cli) {
	this.logger = logger;
	this.config = config;
	this.cli = cli;

	this.availablePlatforms = [];
	this.validPlatforms = {};
}

Creator.prototype.init = function init() {
	// stub
};

Creator.prototype.run = function run() {
	this.projectType = this.cli.argv.type;
	this.sdk = this.cli.env.getSDK(this.cli.argv.sdk);
};

Creator.prototype.configOptionId = function configOptionId(order) {
	const cli = this.cli,
		config = this.config,
		logger = this.logger,
		idPrefix = config.get('app.idprefix');

	function validate(value, callback) {
		if (!value) {
			logger.error('Please specify an App ID\n');
			return callback(true);
		}

		// general app id validation
		if (!/^([a-zA-Z_]{1}[a-zA-Z0-9_-]*(\.[a-zA-Z0-9_-]*)*)$/.test(value)) {
			logger.error(`Invalid App ID "${value}"`);
			logger.error('The App ID must consist of letters, numbers, dashes, and underscores.');
			logger.error('Note: Android does not allow dashes and iOS does not allow underscores.');
			logger.error('The first character must be a letter or underscore.');
			logger.error('Usually the App ID is your company\'s reversed Internet domain name. (i.e. com.example.myapp)\n');
			return callback(true);
		}

		if (cli.argv.type !== 'app' || cli.argv.platforms.indexOf('android') !== -1) {
			if (value.indexOf('-') !== -1) {
				logger.error(`Invalid App ID "${value}"`);
				logger.error(`Dashes are not allowed in the App ID when targeting ${'Android'.cyan}.\n`);
				return callback(true);
			}

			if (!/^([a-zA-Z_]{1}[a-zA-Z0-9_]*(\.[a-zA-Z_]{1}[a-zA-Z0-9_]*)*)$/.test(value)) {
				logger.error(`Invalid App ID "${value}"`);
				logger.error(`Numbers are not allowed directly after periods when targeting ${'Android'.cyan}.\n`);
				return callback(true);
			}

			if (!ti.validAppId(value)) {
				logger.error(`Invalid App ID "${value}"`);
				logger.error(`The app must not contain Java reserved words when targeting ${'Android'.cyan}.\n`);
				return callback(true);
			}
		} else {
			// android is not in the list of platforms
			let counter = 0;

			if (value.indexOf('-') !== -1) {
				logger.warn('The specified App ID is not compatible with the Android platform.');
				logger.warn('Android does not allow dashes in the App ID.');
				counter++;
			}

			if (!/^([a-zA-Z_]{1}[a-zA-Z0-9_]*(\.[a-zA-Z_]{1}[a-zA-Z0-9_]*)*)$/.test(value)) {
				counter || logger.warn('The specified App ID is not compatible with the Android platform.');
				logger.warn('Android does not allow numbers directly following periods in the App ID.');
				counter++;
			}

			if (!ti.validAppId(value)) {
				counter || logger.warn('The specified App ID is not compatible with the Android platform.');
				logger.warn('Android does not allow Java reserved words in the App ID.');
				counter++;
			}

			counter && logger.warn('If you wish to add Android support, you will need to fix the <id> in the tiapp.xml.\n');
		}

		if (value.indexOf('_') !== -1) {
			if (cli.argv.type !== 'app' && (cli.argv.platforms.indexOf('ios') !== -1 || cli.argv.platforms.indexOf('iphone') !== -1 || cli.argv.platforms.indexOf('ipad') !== -1)) {
				logger.error(`Invalid App ID "${value}"`);
				logger.error(`Underscores are not allowed in the App ID when targeting ${'iOS'.cyan}.\n`);
				return callback(true);
			} else {
				logger.warn('The specified App ID is not compatible with the iOS platform.');
				logger.warn('iOS does not allow underscores in the App ID.');
				logger.warn('If you wish to add iOS support, you will need to fix the <id> in the tiapp.xml.\n');
			}
		}

		callback(null, value);
	}

	return {
		desc: 'the App ID in the format \'com.companyname.appname\'',
		order: order,
		prompt(callback) {
			let defaultValue;
			const name = cli.argv.name.replace(/[^a-zA-Z0-9]/g, '');
			if (idPrefix) {
				defaultValue = idPrefix.replace(/\.$/, '') + '.' + (/^[a-zA-Z]/.test(name) || (cli.argv.type === 'app' && cli.argv.platforms.indexOf('android') === -1) ? '' : 'my') + name;
			}

			callback(fields.text({
				default: defaultValue,
				promptLabel: 'App ID',
				validate: validate
			}));
		},
		required: true,
		validate: validate
	};
};

Creator.prototype.configOptionCodeBase = function configCodeBase(order) {
	const cli = this.cli;
	const validTypes = ['swift', 'objc'];
	const logger = this.logger;

	function validate(value, callback) {
		if (!value || !validTypes.includes(value)) {
			logger.error('Please specify a valid code base\n');
			return callback(true);
		}
		callback(null, value);
	}

	return {
		abbr: 'c',
		desc: 'the code base of the iOS project',
		order: order,
		default: !cli.argv.prompt ? 'objc' : undefined, // if we're prompting, then force the platforms to be prompted for, otherwise force 'all'
		required: false,
		validate: validate,
		values: validTypes,
		hidden: true
	};
};

Creator.prototype.configOptionName = function configOptionName(order) {
	const cli = this.cli;
	const config = this.config;
	const logger = this.logger;

	function validate(value, callback) {
		if (!value) {
			logger.error('Please specify a project name\n');
			return callback(true);
		}

		if ((cli.argv.type !== 'app' || cli.argv.platforms.indexOf('android') !== -1) && value.indexOf('&') !== -1) {
			if (config.get('android.allowAppNameAmpersands', false)) {
				logger.warn('The project name contains an ampersand (&) which will most likely cause problems.');
				logger.warn('It is recommended that you change the app name in the tiapp.xml or define the app name using i18n strings.');
				logger.warn('Refer to %s for more information.', 'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_How-tos/Cross-Platform_Mobile_Development_In_Titanium/Internationalization.html'.cyan);
			} else {
				logger.error('The project name contains an ampersand (&) which will most likely cause problems.');
				logger.error('It is recommended that you change the app name in the tiapp.xml or define the app name using i18n strings.');
				logger.error('Refer to %s for more information.', 'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_How-tos/Cross-Platform_Mobile_Development_In_Titanium/Internationalization.html');
				logger.error('To allow ampersands in the app name, run:');
				logger.error('    %sti config android.allowAppNameAmpersands true\n', process.env.APPC_ENV ? 'appc ' : '');
				return callback(true);
			}
		}

		callback(null, value);
	}

	return {
		abbr: 'n',
		desc: 'the name of the project',
		order: order,
		prompt(callback) {
			callback(fields.text({
				promptLabel: 'Project name',
				validate: validate
			}));
		},
		required: true,
		validate: validate
	};
};

Creator.prototype.configOptionPlatforms = function configOptionPlatforms(order) {
	const cli = this.cli;
	const logger = this.logger;
	const availablePlatforms = this.availablePlatforms;
	const validPlatforms = this.validPlatforms;

	function validate(value, callback) {
		// just in case they set -p or --platforms without a value
		if (value === true || value === '') {
			logger.error(`Invalid platforms value "${value}"\n`);
			return callback(true);
		}

		let goodValues = {};
		const badValues = {};
		value.trim().toLowerCase().split(',').forEach(function (s) {
			if (s = s.trim()) {
				if (validPlatforms[s]) {
					goodValues[s] = 1;
				} else {
					badValues[s] = 1;
				}
			}
		}, this);

		const badLen = Object.keys(badValues).length;
		if (badLen) {
			logger.error(`Invalid platform: ${Object.keys(badValues).join(', ')}\n`);
			return callback(true);
		}

		if (goodValues.ios) {
			goodValues.iphone = 1;
			goodValues.ipad = 1;
			delete goodValues.ios;
		}

		if (goodValues.all) {
			goodValues = {};
			availablePlatforms.forEach(function (p) {
				if (p !== 'all') {
					goodValues[p] = 1;
				}
			});
		}

		callback(null, Object.keys(goodValues).join(','));
	}

	return {
		abbr: 'p',
		default: !cli.argv.prompt ? 'all' : undefined, // if we're prompting, then force the platforms to be prompted for, otherwise force 'all'
		desc: 'one or more target platforms.',
		order: order,
		prompt(callback) {
			callback(fields.text({
				promptLabel: `Target platform (${availablePlatforms.join('|')})`,
				default: 'all',
				validate: validate
			}));
		},
		required: true,
		skipValueCheck: true,
		validate: validate,
		values: availablePlatforms
	};
};

Creator.prototype.configOptionTemplate = function configOptionTemplate(order, defaultValue) {
	return {
		desc: 'the name of the project template, path to template dir, path to zip file, or url to zip file',
		default: defaultValue || 'default',
		order: order,
		required: true
	};
};

Creator.prototype.configOptionUrl = function configOptionUrl(order) {
	const cli = this.cli;
	const config = this.config;
	const logger = this.logger;

	return {
		abbr: 'u',
		default: !cli.argv.prompt && config.get('app.url') || undefined,
		desc: 'your company/personal URL',
		order: order,
		prompt(callback) {
			callback(fields.text({
				default: config.get('app.url'),
				promptLabel: 'Your company/personal URL'
			}));
		},
		required: !!cli.argv.prompt,
		validate(value, callback) {
			if (!value) {
				logger.error(`The url value is "${value}"\n`);
				return callback(true);
			}

			Array.isArray(value) ? callback(null, value[value.length - 1]) : callback(null, value);
		}
	};
};

Creator.prototype.configOptionWorkspaceDir = function configOptionWorkspaceDir(order) {
	const cli = this.cli,
		config = this.config,
		logger = this.logger;
	let workspaceDir = config.app.workspace ? path.resolve(config.app.workspace) : null;

	workspaceDir && !fs.existsSync(workspaceDir) && (workspaceDir = null);

	function validate(dir, callback) {
		if (!dir) {
			logger.error('Please specify the workspace directory\n');
			return callback(true);
		}

		dir = path.resolve(dir);

		// check if the directory is writable
		let prev = null;
		let curr = dir;
		while (curr != prev) {
			if (fs.existsSync(curr)) {
				break;
			}

			prev = curr;
			curr = path.dirname(curr);
		}

		// check if the project already exists
		if (cli.argv.name && !cli.argv.force && dir) {
			const projectDir = path.join(dir, cli.argv.name);
			if (fs.existsSync(projectDir)) {
				logger.error(`Project already exists: ${projectDir}`);
				logger.error('Either change the project name, workspace directory, or re-run this command with the --force flag.\n');
				process.exit(1);
			}
		}

		callback(null, dir);
	}

	return {
		abbr: 'd',
		default: !cli.argv.prompt && workspaceDir || undefined,
		desc: 'the directory to place the project in',
		order: order,
		prompt(callback) {
			callback(fields.file({
				complete: true,
				default: workspaceDir || '.',
				ignoreDirs: new RegExp(config.get('cli.ignoreDirs')),
				ignoreFiles: new RegExp(config.get('cli.ignoreFiles')),
				promptLabel: 'Directory to place project',
				showHidden: true,
				validate: validate
			}));
		},
		required: true,
		validate: validate
	};
};
