'use strict';

const androidDetect = require('../lib/detect').detect;
const Builder = require('../../../cli/lib/node-titanium-sdk/builder');
const fields = require('fields');
const util = require('util');
const version = '0.0.0';

function AndroidModuleBuilder() {
	Builder.apply(this, arguments);

	this.requiredArchitectures = this.packageJson.architectures;
	this.compileSdkVersion = this.packageJson.compileSDKVersion; // this should always be >= maxSupportedApiLevel
	this.minSupportedApiLevel = parseInt(this.packageJson.minSDKVersion);
	this.minTargetApiLevel = parseInt(version.parseMin(this.packageJson.vendorDependencies['android sdk']));
	this.maxSupportedApiLevel = parseInt(version.parseMax(this.packageJson.vendorDependencies['android sdk']));
}

util.inherits(AndroidModuleBuilder, Builder);

AndroidModuleBuilder.prototype.validate = function validate(logger, config, cli) {
	Builder.prototype.config.apply(this, arguments);
	Builder.prototype.validate.apply(this, arguments);

	return finished => {
		this.projectDir = cli.argv['project-dir'];
		this.buildOnly = cli.argv['build-only'];
		this.target = cli.argv['target'];
		this.deviceId = cli.argv['device-id'];

		this.cli = cli;
		this.logger = logger;
		fields.setup({ colors: cli.argv.colors });

		this.manifest = this.cli.manifest;

		// detect android environment
		androidDetect(config, { packageJson: this.packageJson }, androidInfo => {
			this.androidInfo = androidInfo;

			const targetSDKMap = {

				// placeholder for gradle to use
				[this.compileSdkVersion]: {
					sdk: this.compileSdkVersion
				}
			};
			Object.keys(this.androidInfo.targets).forEach(function (id) {
				var t = this.androidInfo.targets[id];
				if (t.type === 'platform') {
					targetSDKMap[t.id.replace('android-', '')] = t;
				}
			}, this);

			// check the Android SDK we require to build exists
			this.androidCompileSDK = targetSDKMap[this.compileSdkVersion];

			// if no target sdk, then default to most recent supported/installed
			if (!this.targetSDK) {
				this.targetSDK = this.maxSupportedApiLevel;
			}
			this.androidTargetSDK = targetSDKMap[this.targetSDK];

			if (!this.androidTargetSDK) {
				this.androidTargetSDK = {
					sdk: this.targetSDK
				};
			}

			if (this.targetSDK < this.minSDK) {
				logger.error(`Target Android SDK version must be ${this.minSDK} or newer\n`);
				process.exit(1);
			}

			if (this.maxSDK && this.maxSDK < this.targetSDK) {
				logger.error(`Maximum Android SDK version must be greater than or equal to the target SDK ${this.targetSDK}, but is currently set to ${this.maxSDK}\n`);
				process.exit(1);
			}

			if (this.maxSupportedApiLevel && this.targetSDK > this.maxSupportedApiLevel) {
				// print warning that version this.targetSDK is not tested
				logger.warn(`Building with Android SDK ${('' + this.targetSDK).cyan} which hasn't been tested against Titanium SDK ${this.titaniumSdkVersion}`);
			}

			// get javac params
			this.javacMaxMemory = config.get('android.javac.maxMemory', '3072M');

			// TODO remove in the next SDK
			if (cli.timodule.properties['android.javac.maxmemory'] && cli.timodule.properties['android.javac.maxmemory'].value) {
				logger.error('android.javac.maxmemory is deprecated and will be removed in the next version. Please use android.javac.maxMemory\n');
				this.javacMaxMemory = cli.timodule.properties['android.javac.maxmemory'].value;
			}

			if (cli.timodule.properties['android.javac.maxMemory'] && cli.timodule.properties['android.javac.maxMemory'].value) {
				this.javacMaxMemory = cli.timodule.properties['android.javac.maxMemory'].value;
			}

			// detect java development kit
			this.jdkInfo = {}; // mocked

			finished();
		});
	};
};

AndroidModuleBuilder.prototype.run = function run(_logger, _config, _cli, finished) {
	if (finished) {
		finished();
	}
};

// create the builder instance and expose the public api
(function (androidModuleBuilder) {
	exports.config   = androidModuleBuilder.config.bind(androidModuleBuilder);
	exports.validate = androidModuleBuilder.validate.bind(androidModuleBuilder);
	exports.run      = androidModuleBuilder.run.bind(androidModuleBuilder);
}(new AndroidModuleBuilder(module)));
