const fs = require('fs');
const path = require('path');

const manifest = {
	platforms: ['android'],
	sdkVersion: '0.0.0.GA'
};
const platformAliases = {
	// add additional aliases here for new platforms
	ipad: 'iphone',
	ios: 'iphone'
};

exports.manifest = manifest;
exports.platforms = manifest.platforms;
exports.targetPlatforms = ['android'];
exports.availablePlatforms = ['android'];
exports.availablePlatformsNames = ['Android'];
exports.allPlatformNames = ['android', 'ios', 'iphone', 'ipad', 'mobileweb', 'blackberry', 'windows', 'tizen'];

function commonOptions(logger, config) {
	return {
		'log-level': {
			abbr: 'l',
			callback(value) {
				Object.prototype.hasOwnProperty.call(logger.levels, value) && logger.setLevel(value);
			},
			desc: 'minimum logging level',
			default: config.cli.logLevel || 'trace',
			hint: 'level',
			values: logger.getLevels()
		}
	};
}

function loadPlugins(_logger, config, cli, projectDir, finished, silent, compact) {
	let searchPaths = {
		project: [path.join(projectDir, 'plugins')],
		config: [],
		global: []
	};
	let confPaths = config.get('paths.plugins');
	let defaultInstallLocation = cli.env.installPath;
	let sdkLocations = cli.env.os.sdkPaths.map(function (p) { return path.resolve(p); });

	// set our paths from the config file
	Array.isArray(confPaths) || (confPaths = [ confPaths ]);
	confPaths.forEach(function (p) {
		p && fs.existsSync(p = path.resolve(p)) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && (searchPaths.config.push(p));
	});

	// add any plugins from various sdk locations
	sdkLocations.indexOf(defaultInstallLocation) === -1 && sdkLocations.push(defaultInstallLocation);
	cli.sdk && sdkLocations.push(path.resolve(cli.sdk.path, '..', '..', '..'));
	sdkLocations.forEach(p => {
		p = path.resolve(p, 'plugins');
		if (fs.existsSync(p) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && searchPaths.global.indexOf(p) === -1) {
			searchPaths.global.push(p);
		}
	});

	if (!silent) {
		cli.emit('cli:check-plugins', { compact: compact === undefined ? true : compact });
	}

	finished();
}

function platformOptions(logger, config, cli, commandName, finished) {
	const result = {};
	let targetPlatform = !cli.argv.help && (cli.argv.platform || cli.argv.p);

	if (!commandName) {
		finished(result);
		return;
	}

	function set(obj, title, platform) {
		// add the platform and title to the options and flags
		['options', 'flags'].forEach(type => {
			if (obj && obj[type]) {
				result[platform] || (result[platform] = {
					platform: platform,
					title: title || platform
				});
				result[platform][type] = obj[type];
			}
		});
	}

	// translate the platform name
	targetPlatform = platformAliases[targetPlatform] || targetPlatform;

	// for each platform, fetch their specific flags/options
	manifest.platforms.reduce((promise, platform) => {
		return promise.then(() => new Promise(resolve => {
			// only configure target platform
			if (targetPlatform && platform !== targetPlatform) {
				return resolve();
			}

			let platformDir = path.join(path.dirname(module.filename), '..', '..', '..', platform);
			let platformCommand = path.join(platformDir, 'cli', 'commands', '_' + commandName + '.js');
			let command;
			let conf;
			let title;

			if (!fs.existsSync(platformCommand)) {
				return resolve();
			}

			command = require(platformCommand);
			if (!command || !command.config) {
				return resolve();
			}

			// try to get the platform specific configuration
			conf = command.config(logger, config, cli);

			try {
				// try to read a title from the platform's package.json
				title = JSON.parse(fs.readFileSync(path.join(platformDir, 'package.json'))).title;
			} catch (e) {}

			if (typeof conf === 'function') {
				// async callback
				conf(function (obj) {
					set(obj, title, platform);
					resolve();
				});
				return;
			}

			set(conf, title, platform);
			resolve();
		}));
	}, Promise.resolve())
		.then(() => finished(result))
		.catch(() => finished(result));
}

function resolvePlatform(platform) {
	return platformAliases[platform] || platform;
}

function scrubPlatforms(platforms) {
	const scrubbed = {}; // distinct list of un-aliased platforms
	const original = {};
	const bad = {};

	platforms.toLowerCase().split(',').forEach(platform => {
		const name = platformAliases[platform] || platform;
		// if name is falsey, then it's invalid anyways
		if (name) {
			if (manifest.platforms.indexOf(name) === -1) {
				bad[platform] = 1;
			} else {
				scrubbed[name] = 1;
				original[platform] = 1;
			}
		}
	});

	return {
		scrubbed: Object.keys(scrubbed).sort(), // distinct list of un-aliased platforms
		original: Object.keys(original).sort(),
		bad: Object.keys(bad).sort()
	};
}

function validAppId(id) {
	const words = {
		abstract: 1,
		assert: 1,
		boolean: 1,
		break: 1,
		byte: 1,
		case: 1,
		catch: 1,
		char: 1,
		class: 1,
		const: 1,
		continue: 1,
		default: 1,
		do: 1,
		double: 1,
		else: 1,
		enum: 1,
		extends: 1,
		false: 1,
		final: 1,
		finally: 1,
		float: 1,
		for: 1,
		goto: 1,
		if: 1,
		implements: 1,
		import: 1,
		instanceof: 1,
		int: 1,
		interface: 1,
		long: 1,
		native: 1,
		new: 1,
		null: 1,
		package: 1,
		private: 1,
		protected: 1,
		public: 1,
		return: 1,
		short: 1,
		static: 1,
		strictfp: 1,
		super: 1,
		switch: 1,
		synchronized: 1,
		this: 1,
		throw: 1,
		throws: 1,
		transient: 1,
		true: 1,
		try: 1,
		void: 1,
		volatile: 1,
		while: 1
	};
	const parts = id.split('.');
	const l = parts.length;

	for (let i = 0; i < l; i++) {
		if (words[parts[i]]) {
			return false;
		}
	}

	return true;
}

function validateModuleManifest(logger, cli, manifest) {
	const requiredModuleKeys = [
		'name',
		'version',
		'moduleid',
		'description',
		'copyright',
		'license',
		'copyright',
		'platform',
		'minsdk',
		'architectures'
	];

	// check if all the required module keys are in the list
	requiredModuleKeys.forEach(function (key) {
		if (!manifest[key]) {
			logger.error(`Missing required manifest key "${key}"`);
			logger.log();
			process.exit(1);
		}
	});

	if (cli.argv.platform !== resolvePlatform(manifest.platform)) {
		logger.error(`Unable to find "${cli.argv.platform}" module`);
		logger.log();
		process.exit(1);
	}
}

function validatePlatformOptions(logger, config, cli, commandName) {
	const platform = exports.resolvePlatform(cli.argv.platform),
		platformCommand = path.join(path.dirname(module.filename), '..', '..', '..', manifest.platforms[manifest.platforms.indexOf(platform)], 'cli', 'commands', '_' + commandName + '.js');
	if (fs.existsSync(platformCommand)) {
		const command = require(platformCommand);
		return command && typeof command.validate === 'function' ? command.validate(logger, config, cli) : null;
	}
}

function validateProjectDir(logger, cli, argv, name) {
	const dir = argv[name] || '.';
	let projectDir = argv[name] = path.resolve(dir);

	if (!fs.existsSync(projectDir)) {
		logger.banner();
		logger.error('Project directory does not exist\n');
		process.exit(1);
	}

	let tiapp = path.join(projectDir, 'tiapp.xml');
	while (!fs.existsSync(tiapp) && tiapp.split(path.sep).length > 2) {
		projectDir = argv[name] = path.dirname(projectDir);
		tiapp = path.join(projectDir, 'tiapp.xml');
	}

	if (tiapp.split(path.sep).length === 2) {
		logger.banner();
		logger.error(`Invalid project directory "${dir}"\n`);
		dir === '.' && logger.log(`Use the ${'--project-dir'.cyan} property to specify the project's directory\n`);
		process.exit(1);
	}

	// load the tiapp.xml
	cli.tiapp = {};
}

exports.commonOptions = commonOptions;
exports.loadPlugins = loadPlugins;
exports.platformOptions = platformOptions;
exports.resolvePlatform = resolvePlatform;
exports.scrubPlatforms = scrubPlatforms;
exports.validAppId = validAppId;
exports.validateModuleManifest = validateModuleManifest;
exports.validatePlatformOptions = validatePlatformOptions;
exports.validateProjectDir = validateProjectDir;
