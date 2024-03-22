'use strict';

const ti = require('../lib/node-titanium-sdk/ti');

exports.cliVersion = '>=3.2.1';
exports.desc = 'get and set tiapp.xml settings';
exports.extendedDesc = [
	'Get and set tiapp.xml settings.',
	`Run ${'titanium project --project-dir /path/to/project'.cyan} to see all available entries that can be changed.`,
	[
		`When setting the ${'deployment-targets'.cyan} entry, it will non-destructively copy each specified `,
		'platform\'s default resources into your project\'s Resources folder. For ',
		`example, if your app currently supports ${'iphone'.cyan} and you wish to add Android `,
		`support, you must specify ${'iphone,android'.cyan}, otherwise only specifying ${'android'.cyan} will remove `,
		'support for iPhone.'
	].join('')
].join('\n\n');

exports.config = function (logger, config) {
	return {
		skipBanner: true,
		options: Object.assign({
			output: {
				abbr: 'o',
				default: 'report',
				desc: 'output format',
				values: ['report', 'json', 'text']
			},
			'project-dir': {
				desc: 'the directory of the project to analyze',
				default: '.'
			},
			template: {
				desc: 'the name of the project template to use',
				default: 'default'
			}
		}, ti.commonOptions(logger, config)),
		args: [
			{
				name: 'key',
				desc: 'the key to get or set'
			},
			{
				name: 'value',
				desc: 'the value to set the specified key'
			}
		]
	};
};

exports.validate = function (logger, config, cli) {
	ti.validateProjectDir(logger, cli, cli.argv, 'project-dir');

	// Validate the key, if it exists
	if (cli.argv._.length > 0) {
		const key = cli.argv._[0];
		if (!/^([A-Za-z_]{1}[A-Za-z0-9-_]*(\.[A-Za-z-_]{1}[A-Za-z0-9-_]*)*)$/.test(key)) {
			logger.error(`Invalid key "${key}"\n`);
			process.exit(1);
		}
	}

	return function (finished) {
		ti.loadPlugins(null, config, cli, cli.argv['project-dir'], finished, cli.argv.output !== 'report' || cli.argv._.length, false);
	};
};

exports.run = function (_logger, _config, _cli, finished) {
	finished();
};
