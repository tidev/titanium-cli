'use strict';

const Creator = require('../creator');
const ti = require('../node-titanium-sdk/ti');
const util = require('util');

module.exports = AppCreator;

function AppCreator(_logger, _config, _cli) {
	Creator.apply(this, arguments);

	this.title = 'Titanium App';
	this.titleOrder = 1;
	this.type = 'app';

	// build list of all valid platforms
	const availablePlatforms = {};
	const validPlatforms = {};

	ti.platforms.forEach(platform => {
		if (/^iphone|ios|ipad$/.test(platform)) {
			validPlatforms['iphone'] = availablePlatforms['iphone'] = 1;
			validPlatforms['ipad'] = availablePlatforms['ipad'] = 1;
			validPlatforms['ios'] = 1;
		} else {
			validPlatforms[platform] = availablePlatforms[platform] = 1;
		}
	});

	// add "all"
	validPlatforms['all'] = 1;

	this.availablePlatforms = ['all', ...Object.keys(availablePlatforms)];
	this.validPlatforms = validPlatforms;
}

util.inherits(AppCreator, Creator);

AppCreator.prototype.init = function init() {
	return {
		options: {
			id:            this.configOptionId(150),
			name:          this.configOptionName(140),
			platforms:     this.configOptionPlatforms(120),
			template:      this.configOptionTemplate(110),
			url:           this.configOptionUrl(160),
			'workspace-dir': this.configOptionWorkspaceDir(170)
		}
	};
};

AppCreator.prototype.run = function run(callback) {
	callback();
};
