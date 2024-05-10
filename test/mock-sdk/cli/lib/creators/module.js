'use strict';

const Creator = require('../creator');
const ti = require('../node-titanium-sdk/ti');
const util = require('util');
const fields = require('fields');

module.exports = ModuleCreator;

function ModuleCreator(_logger, _config, _cli) {
	Creator.apply(this, arguments);

	this.title = 'Titanium Module';
	this.titleOrder = 2;
	this.type = 'module';

	// build list of all valid platforms
	const availablePlatforms = {};
	const validPlatforms = {};

	ti.platforms.forEach(platform => {
		if (/^iphone|ios|ipad$/.test(platform)) {
			validPlatforms['iphone'] = 1;
			validPlatforms['ipad'] = 1;
			validPlatforms['ios'] = availablePlatforms['ios'] = 1;
		} else {
			validPlatforms[platform] = availablePlatforms[platform] = 1;
		}
	});

	// add "all"
	validPlatforms['all'] = 1;

	this.availablePlatforms = ['all', ...Object.keys(availablePlatforms)];
	this.validPlatforms = validPlatforms;
}

util.inherits(ModuleCreator, Creator);

ModuleCreator.prototype.init = function init() {
	return {
		options: {
			id:              this.configOptionId(150),
			name:            this.configOptionName(140),
			platforms:       this.configOptionPlatforms(120),
			template:        this.configOptionTemplate(110),
			'workspace-dir': this.configOptionWorkspaceDir(170),
			'code-base':	 this.configOptionCodeBase(150),
			'android-code-base': this.configOptionAndroidCodeBase(150),
			'ios-code-base': this.configOptionIosCodeBase(140)

		}
	};
};

ModuleCreator.prototype.configOptionAndroidCodeBase = function configAndroidCodeBase(order) {
	const cli = this.cli;
	const validTypes = ['java', 'kotlin'];
	const logger = this.logger;

	function validate(value, callback) {
		if (!value || !validTypes.includes(value)) {
			logger.error('Please specify a valid code base\n');
			return callback(true);
		}
		callback(null, value);
	}

	return {
		desc: 'the code base of the Android project',
		order: order,
		default: !cli.argv.prompt ? 'java' : undefined,
		prompt(callback) {
			callback(fields.text({
				promptLabel: `Android code base (${validTypes.join('|')})`,
				default: 'java',
				validate: validate
			}));
		},
		required: true,
		validate: validate,
		values: validTypes,
		verifyIfRequired(callback) {
			if (cli.argv.platforms.includes('android')) {
				return callback(true);
			}
			return callback();
		}
	};
};

ModuleCreator.prototype.configOptionIosCodeBase = function configIosCodeBase(order) {
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
		desc: 'the code base of the iOS project',
		order: order,
		default: !cli.argv.prompt ? 'objc' : undefined, // if we're prompting, then force the platforms to be prompted for, otherwise force 'all'
		prompt(callback) {
			callback(fields.text({
				promptLabel: `iOS code base (${validTypes.join('|')})`,
				default: 'objc',
				validate: validate
			}));
		},
		required: true,
		validate: validate,
		values: validTypes,
		verifyIfRequired(callback) {
			if (cli.argv.platforms.includes('ios') || cli.argv.platforms.includes('iphone') || cli.argv.platforms.includes('ipad')) {
				return callback(true);
			}
			return callback();
		}
	};
};

ModuleCreator.prototype.run = function run(callback) {
	callback();
};
