'use strict';

const fs = require('fs');
const path = require('path');
const ti = require('./ti');

module.exports = Builder;

function Builder(buildModule) {
	this.titaniumSdkPath = (function scan(dir) {
		const file = path.join(dir, 'manifest.json');
		if (fs.existsSync(file)) {
			return dir;
		}
		dir = path.dirname(dir);
		return dir !== '/' && scan(dir);
	}(__dirname));

	this.titaniumSdkName = path.basename(this.titaniumSdkPath);

	this.titaniumSdkVersion = ti.manifest.version;

	this.platformPath = (function scan(dir) {
		const file = path.join(dir, 'package.json');
		if (fs.existsSync(file)) {
			return dir;
		}
		dir = path.dirname(dir);
		return dir !== '/' && scan(dir);
	}(path.dirname(buildModule.filename)));

	this.platformName = path.basename(this.platformPath);

	this.globalModulesPath = path.join(this.titaniumSdkPath, '..', '..', '..', 'modules');

	this.packageJson = require(path.join(this.platformPath, 'package.json'));

	this.conf = {};

	this.buildDirFiles = {};
}

Builder.prototype.config = function config(logger, config, cli) {
	// note: this function must be sync!
	this.logger = logger;
	this.config = config;
	this.cli = cli;
	this.symlinkFilesOnCopy = false;
	this.ignoreDirs = new RegExp(config.get('cli.ignoreDirs'));
	this.ignoreFiles = new RegExp(config.get('cli.ignoreFiles'));
};

Builder.prototype.validate = function validate(logger, config, cli) {
	// note: this function must be sync!

	this.tiapp = cli.tiapp;
	this.timodule = cli.timodule;
	this.projectDir = cli.argv['project-dir'];
	this.buildDir = path.join(this.projectDir, 'build', this.platformName);

	this.defaultIcons = [
		path.join(this.projectDir, 'DefaultIcon-' + this.platformName + '.png'),
		path.join(this.projectDir, 'DefaultIcon.png')
	];
};

Builder.prototype.run = function run(_logger, _config, _cli, _finished) {
};

Builder.prototype.validateTiModules = function validateTiModules(_platformName, _deployType, callback) {
	callback(null, []);
};
