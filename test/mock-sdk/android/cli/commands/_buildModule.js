'use strict';

const androidDetect = require('../lib/detect').detect;
const Builder = require('../../../lib/node-titanium-sdk');
const ejs = require('ejs');
const fields = require('fields');
const fs = require('fs');
const path = require('path');
const util = require('util');
const semver = require('semver');

const version = appc.version;

function AndroidModuleBuilder() {
	Builder.apply(this, arguments);

	this.requiredArchitectures = this.packageJson.architectures;
	this.compileSdkVersion = this.packageJson.compileSDKVersion; // this should always be >= maxSupportedApiLevel
	this.minSupportedApiLevel = parseInt(this.packageJson.minSDKVersion);
	this.minTargetApiLevel = parseInt(version.parseMin(this.packageJson.vendorDependencies['android sdk']));
	this.maxSupportedApiLevel = parseInt(version.parseMax(this.packageJson.vendorDependencies['android sdk']));
}

util.inherits(AndroidModuleBuilder, Builder);

/**
 * Migrates an existing module with an outdated "apiversion" in the manifest to the latest one.
 * It takes care of migrating the "apiversion", "version", "minsdk" and "architecture" properties.
 *
 * @return {Promise<undefined>}
 */
AndroidModuleBuilder.prototype.migrate = async function migrate() {
	const cliModuleAPIVersion = this.cli.sdk && this.cli.sdk.manifest && this.cli.sdk.manifest.moduleAPIVersion && this.cli.sdk.manifest.moduleAPIVersion.android;
	const cliSDKVersion = this.cli.sdk.manifest.version;
	const manifestSDKVersion = this.manifest.minsdk;
	const manifestModuleAPIVersion = this.manifest.apiversion;
	const manifestTemplateFile = path.join(this.platformPath, 'templates', 'module', 'default', 'template', 'android', 'manifest.ejs');
	let newVersion = semver.inc(this.manifest.version, 'major');

	// Determine if the "manifest" file's "apiversion" needs updating.
	let isApiVersionUpdateRequired = false;
	if (cliModuleAPIVersion) {
		isApiVersionUpdateRequired = (this.manifest.apiversion !== cliModuleAPIVersion);
	}

	// Determin if the "manifest" file's "minsdk" needs updating.
	// As of Titanium 9.0.0, modules are built as AARs to an "m2repository". Not supported on older Titanium versions.
	let isMinSdkUpdateRequired = false;
	const minSupportedSdkVersionMajorNumber = 9;
	const minSupportedSdkVersionString = '9.0.0';
	if (!this.manifest.minsdk || (parseInt(this.manifest.minsdk.split('.')[0]) < minSupportedSdkVersionMajorNumber)) {
		isMinSdkUpdateRequired = true;
	}

	// Do not continue if manifest doesn't need updating. (Everything is okay.)
	if (!isApiVersionUpdateRequired && !isMinSdkUpdateRequired) {
		return;
	}

	const logger = this.logger;
	if (!this.cli.argv.prompt) {
		if (isApiVersionUpdateRequired) {
			logger.error(__('The module manifest apiversion is currently set to %s', manifestModuleAPIVersion));
			logger.error(__('Titanium SDK %s Android module apiversion is at %s', cliSDKVersion, cliModuleAPIVersion));
			logger.error(__('Please update module manifest apiversion to match Titanium SDK module apiversion'));
			logger.error(__('and the minsdk to at least %s', minSupportedSdkVersionString));
		} else {
			logger.error(__('The module "manifest" file\'s minsdk is currently set to %s', this.manifest.minsdk));
			logger.error(__('Please update the file\'s minsdk to at least version %s', minSupportedSdkVersionString));
		}
		process.exit(1);
	}

	await new Promise((resolve, reject) => {
		let titleMessage;
		if (isApiVersionUpdateRequired) {
			titleMessage = __(
				'Detected Titanium %s that requires API-level %s, but the module currently only supports %s and API-level %s.',
				cliSDKVersion, cliModuleAPIVersion, manifestSDKVersion, manifestModuleAPIVersion);
		} else {
			titleMessage = __(
				'Modules built with Titanium %s cannot support Titanium versions older than %s. The "manifest" file\'s minsdk must be updated.',
				cliSDKVersion, minSupportedSdkVersionString);
		}
		fields.select({
			title: titleMessage,
			promptLabel: __('Do you want to migrate your module now?'),
			default: 'yes',
			display: 'prompt',
			relistOnError: true,
			complete: true,
			suggest: true,
			options: [ '__y__es', '__n__o' ]
		}).prompt((err, value) => {
			if (err) {
				reject(err);
				return;
			}

			if (value !== 'yes') {
				logger.error(__('Please update the module\'s "manifest" file in order to build it.'));
				process.exit(1);
			}

			resolve();
		});
	});

	this.logger.info(__('Migrating module manifest ...'));

	// If a version is "1.0" instead of "1.0.0", semver currently fails. Work around it for now!
	if (!newVersion) {
		this.logger.warn(__('Detected non-semantic version (%s), will try to repair it!', this.manifest.version));
		try {
			const semanticVersion = appc.version.format(this.manifest.version, 3, 3, true);
			newVersion = semver.inc(semanticVersion, 'major');
		} catch (err) {
			this.logger.error(__('Unable to migrate version for you. Please update it manually by using a semantic version like "1.0.0" and try the migration again.'));
			process.exit(1);
		}
	}

	// Update the "apiversion" to the CLI API-version
	this.logger.info(__('Setting %s to %s', 'apiversion'.cyan, cliModuleAPIVersion.cyan));
	this.manifest.apiversion = cliModuleAPIVersion;

	// Update the "minsdk" to the required CLI SDK-version
	this.logger.info(__('Setting %s to %s', 'minsdk'.cyan, minSupportedSdkVersionString.cyan));
	this.manifest.minsdk = minSupportedSdkVersionString;

	// Update the "apiversion" to the next major
	this.logger.info(__('Bumping version from %s to %s', this.manifest.version.cyan, newVersion.cyan));
	this.manifest.version = newVersion;

	// Add our new architecture(s)
	this.manifest.architectures = this.requiredArchitectures.join(' ');

	// Pre-fill placeholders
	let manifestContent = await fs.readFile(manifestTemplateFile);
	manifestContent = ejs.render(manifestContent.toString(), {
		moduleName: this.manifest.name,
		moduleId: this.manifest.moduleid,
		platform: this.manifest.platform,
		tisdkVersion: this.manifest.minsdk,
		guid: this.manifest.guid,
		author: this.manifest.author,
		publisher: this.manifest.author // The publisher does not have an own key in the manifest but can be different. Will override below
	});

	// Migrate missing keys which don't have a placeholder (version, license, copyright & publisher)
	manifestContent = manifestContent.replace(/version.*/, 'version: ' + this.manifest.version);
	manifestContent = manifestContent.replace(/license.*/, 'license: ' + this.manifest.license);
	manifestContent = manifestContent.replace(/copyright.*/, 'copyright: ' + this.manifest.copyright);
	manifestContent = manifestContent.replace(/description.*/, 'description: ' + this.manifest.description);

	// Make a backup of the old file in case something goes wrong
	this.logger.info(__('Backing up old manifest to %s', 'manifest.bak'.cyan));
	await fs.rename(path.join(this.projectDir, 'manifest'), path.join(this.projectDir, 'manifest.bak'));

	// Write the new manifest file
	this.logger.info(__('Writing new manifest'));
	await fs.writeFile(path.join(this.projectDir, 'manifest'), manifestContent);

	this.logger.info(__(''));
	this.logger.info(__('Migration completed! Building module ...'));
};

AndroidModuleBuilder.prototype.validate = function validate(logger, config, cli) {
	Builder.prototype.config.apply(this, arguments);
	Builder.prototype.validate.apply(this, arguments);

	return function (finished) {
		this.projectDir = cli.argv['project-dir'];
		this.buildOnly = cli.argv['build-only'];
		this.target = cli.argv['target'];
		this.deviceId = cli.argv['device-id'];

		this.cli = cli;
		this.logger = logger;
		fields.setup({ colors: cli.argv.colors });

		this.manifest = this.cli.manifest;

		// detect android environment
		androidDetect(config, { packageJson: this.packageJson }, function (androidInfo) {
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
				logger.error(__('Target Android SDK version must be %s or newer', this.minSDK) + '\n');
				process.exit(1);
			}

			if (this.maxSDK && this.maxSDK < this.targetSDK) {
				logger.error(__('Maximum Android SDK version must be greater than or equal to the target SDK %s, but is currently set to %s', this.targetSDK, this.maxSDK) + '\n');
				process.exit(1);
			}

			if (this.maxSupportedApiLevel && this.targetSDK > this.maxSupportedApiLevel) {
				// print warning that version this.targetSDK is not tested
				logger.warn(__('Building with Android SDK %s which hasn\'t been tested against Titanium SDK %s', ('' + this.targetSDK).cyan, this.titaniumSdkVersion));
			}

			// get javac params
			this.javacMaxMemory = config.get('android.javac.maxMemory', '3072M');

			// TODO remove in the next SDK
			if (cli.timodule.properties['android.javac.maxmemory'] && cli.timodule.properties['android.javac.maxmemory'].value) {
				logger.error(__('android.javac.maxmemory is deprecated and will be removed in the next version. Please use android.javac.maxMemory') + '\n');
				this.javacMaxMemory = cli.timodule.properties['android.javac.maxmemory'].value;
			}

			if (cli.timodule.properties['android.javac.maxMemory'] && cli.timodule.properties['android.javac.maxMemory'].value) {
				this.javacMaxMemory = cli.timodule.properties['android.javac.maxMemory'].value;
			}

			// detect java development kit
			appc.jdk.detect(config, null, function (jdkInfo) {
				if (!jdkInfo.version) {
					logger.error(__('Unable to locate the Java Development Kit') + '\n');
					logger.log(__('You can specify the location by setting the %s environment variable.', 'JAVA_HOME'.cyan) + '\n');
					process.exit(1);
				}

				if (!version.satisfies(jdkInfo.version, this.packageJson.vendorDependencies.java)) {
					logger.error(__('JDK version %s detected, but only version %s is supported', jdkInfo.version, this.packageJson.vendorDependencies.java) + '\n');
					process.exit(1);
				}

				this.jdkInfo = jdkInfo;

				finished();
			}.bind(this));
		}.bind(this));
	}.bind(this);
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
