'use strict';

const fields = require('fields');
const fs = require('fs');
const path = require('path');
const ti = require('../lib/node-titanium-sdk/ti');

exports.cliVersion = '>=3.2.1';
exports.title = 'Create';
exports.desc = 'creates a new project';
exports.extendedDesc = 'Creates a new Titanium application, native module, or Apple Watch™ app.\n\n'
	+ 'Apple, iPhone, and iPad are registered trademarks of Apple Inc. Apple Watch is a trademark of Apple Inc.\n\n'
	+ 'Android is a trademark of Google Inc.';

function CreateCommand() {
	this.creators = {};
}

CreateCommand.prototype.config = function config(logger, config, cli) {
	this.logger = logger;
	this.config = config;
	this.cli = cli;

	fields.setup({ colors: cli.argv.colors });

	return finished => {
		// find and load the creators
		const creatorDir = path.join(__dirname, '..', 'lib', 'creators');
		const jsRegExp = /\.js$/;
		const typeConf = {};

		fs.readdirSync(creatorDir).reduce((promise, filename) => {
			return promise.then(() => new Promise(resolve => {
				if (!jsRegExp.test(filename)) {
					return resolve();
				}

				const CreatorConstructor = require(path.join(creatorDir, filename));
				const creator = new CreatorConstructor(logger, config, cli);
				this.creators[creator.type] = creator;

				try {
					if (typeof creator.init === 'function') {
						if (creator.init.length > 1) {
							typeConf[creator.type] = creator.init(function (conf) {
								typeConf[creator.type] = conf;
								resolve();
							});
							return;
						}
						typeConf[creator.type] = creator.init();
					}
				} catch (ex) {
					// squeltch
					delete this.creators[creator.type];
				} finally {
					resolve();
				}
			}));
		}, Promise.resolve())
			.then(() => {
				cli.createHook('create.config', this, callback => {
					const conf = {
						flags: {
							force: {
								abbr: 'f',
								desc: 'force project creation even if path already exists'
							}
						},
						options: Object.assign({
							type: {
								abbr: 't',
								default: cli.argv.prompt ? undefined : 'app',
								desc: 'the type of project to create',
								order: 100,
								prompt: callback => {
									callback(fields.select({
										title: 'What type of project would you like to create?',
										promptLabel: 'Select a type by number or name',
										default: 'app',
										margin: '',
										numbered: true,
										relistOnError: true,
										complete: true,
										suggest: false,
										options: Object.keys(this.creators)
											.map(function (type) {
												return {
													label: this.creators[type].title || type,
													value: type,
													order: this.creators[type].titleOrder
												};
											}, this)
											.sort(function (a, b) {
												return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
											})
									}));
								},
								required: true,
								values: Object.keys(this.creators)
							}
						}, ti.commonOptions(logger, config)),
						type: typeConf
					};

					callback(null, conf);
				})((_err, result) => finished(result));
			})
			.catch(err => {
				console.log(err);
			});
	};
};

CreateCommand.prototype.run = function run(_logger, _config, _cli, finished) {
	finished();
};

// create the builder instance and expose the public api
(function (createCommand) {
	exports.config   = createCommand.config.bind(createCommand);
	exports.run      = createCommand.run.bind(createCommand);
}(new CreateCommand()));
