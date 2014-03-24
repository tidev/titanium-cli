/**
 * Titanium CLI
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var assert = require('assert'),
	path = require('path'),
	Context = require(__lib('context'));

function MockLogger() {
	this.buffer = '';
	this.debug = function (s) { this.buffer += s + '\n'; };
	this.info = function (s) { this.buffer += s + '\n'; };
	this.warn = function (s) { this.buffer += s + '\n'; };
	this.error = function (s) { this.buffer += s + '\n'; };
	this.banner = function() {};
}

function createGlobalContext() {
	var g = new Context({
		title: 'Global',
		conf: {
			'flags': {
				'help': {
					abbr: 'h'
				},
				'version': {
					abbr: 'v'
				},
				'colors': {
					default: true,
					negate: true
				},
				'quiet': {
					abbr: 'q',
					default: false
				},
				'prompt': {
					default: true,
					negate: true
				},
				'progress-bars': {
					default: true,
					negate: true
				},
				'banner': {
					default: true,
					negate: true
				}
			},
			'options': {
				'config': {},
				'config-file': {},
				'sdk': {
					abbr: 's',
					default: 'latest'
				}
			}
		}
	});

	['config', 'help', 'info', 'login', 'logout', 'module', 'plugin', 'sdk', 'setup', 'status'].forEach(function (name) {
		g.command({
			name: name,
			path: path.resolve(__dirname, 'resources', 'commands', name + '.js')
		});
	});

	return g;
}

describe('context', function () {
	it('namespace exists', function () {
		assert(typeof Context === 'function', 'expected Context API to be a function, not a ' + (typeof Context));
	});

	describe('#flag()', function () {
		it('should define a single flag', function () {
			var c = new Context;
			c.flag('quiet');
			c.flags.should.have.ownProperty('quiet');
		});

		it ('should define multiple flags', function () {
			var c = new Context;
			c.flag({
				quiet: null,
				colors: {
					negate: true
				}
			});
			c.flags.should.have.ownProperty('quiet');
			c.flags.should.have.ownProperty('colors');
			c.flags.colors.should.have.ownProperty('negate');
			c.flags.colors.negate.should.equal(true);
		});

		it('should not add flag if already exists', function () {
			var c = new Context;
			c.flag('quiet', { foo: 'bar' });
			c.flag('quiet', { foo: 'baz' }, true);
			c.flags.should.have.ownProperty('quiet');
			c.flags.quiet.foo.should.equal('bar');
		});

		it('should define a single flag that has an alias', function () {
			var c = new Context;
			c.flag('quiet', {
				abbr: 'q',
				alias: 'silence'
			});
			c.flags.should.have.ownProperty('quiet');
			c.aliases.should.have.ownProperty('silence');
			c.aliases.silence.should.include('quiet');
			c.aliases.should.have.ownProperty('q');
			c.aliases.q.should.include('quiet');
		});
	});

	describe('#option()', function () {
		it('should define a single option', function () {
			var c = new Context;
			c.option('sdk');
			c.options.should.have.ownProperty('sdk');
		});

		it ('should define multiple options', function () {
			var c = new Context;
			c.option({
				sdk: {
					abbr: 's',
					default: 'latest'
				},
				target: null
			});
			c.options.should.have.ownProperty('sdk');
			c.options.sdk.should.have.ownProperty('abbr');
			c.options.sdk.abbr.should.equal('s');
			c.options.should.have.ownProperty('target');
		});

		it('should not add option if already exists', function () {
			var c = new Context;
			c.option('sdk', { foo: 'bar' });
			c.option('sdk', { foo: 'baz' }, true);
			c.options.should.have.ownProperty('sdk');
			c.options.sdk.foo.should.equal('bar');
		});

		it('should define a single option that has an alias', function () {
			var c = new Context;
			c.option('sdk', {
				abbr: 's',
				alias: 'tisdk',
				default: 'latest'
			});
			c.options.should.have.ownProperty('sdk');
			c.aliases.should.have.ownProperty('s');
			c.aliases.s.should.include('sdk');
			c.aliases.should.have.ownProperty('tisdk');
			c.aliases.tisdk.should.include('sdk');
		});
	});

	describe('#command()', function () {
		it('should define a command', function () {
			var c = new Context;
			c.command({
				name: 'test'
			});
			c.commands.should.have.ownProperty('test');
		});

		it('should define a command with flags, options, and subcommands', function () {
			var c = new Context;
			c.command({
				name: 'test',
				conf: {
					flags: {
						quiet: {
							abbr: 'q'
						},
						colors: {
							negate: true
						}
					},
					options: {
						sdk: {
							abbr: 's',
							default: 'latest'
						},
						target: null
					},
					subcommands: {
						list: null
					}
				}
			});

			c.commands.should.have.ownProperty('test');

			c.commands.test.flags.should.have.ownProperty('quiet');
			c.commands.test.flags.should.have.ownProperty('colors');

			c.commands.test.options.should.have.ownProperty('sdk');
			c.commands.test.options.should.have.ownProperty('target');

			c.commands.test.aliases.should.have.ownProperty('q');
			c.commands.test.aliases.q.should.include('quiet');
			c.commands.test.aliases.should.have.ownProperty('s');
			c.commands.test.aliases.s.should.include('sdk');

			c.commands.test.subcommands.should.have.ownProperty('list');
		});

		it('should define a command with a platform', function () {
			var c = new Context;
			c.command({
				name: 'test',
				conf: {
					platforms: {
						ios: {
							flags: {
								quiet: {
									abbr: 'q'
								},
								colors: {
									negate: true
								}
							},
							options: {
								sdk: {
									abbr: 's',
									default: 'latest'
								},
								target: null
							},
							subcommands: {
								list: null
							}
						}
					}
				}
			});

			c.commands.should.have.ownProperty('test');
			c.commands.test.should.have.ownProperty('platforms');
			c.commands.test.platforms.should.have.ownProperty('ios');

			c.commands.test.platforms.ios.flags.should.have.ownProperty('quiet');
			c.commands.test.platforms.ios.flags.should.have.ownProperty('colors');

			c.commands.test.platforms.ios.options.should.have.ownProperty('sdk');
			c.commands.test.platforms.ios.options.should.have.ownProperty('target');

			c.commands.test.platforms.ios.aliases.should.have.ownProperty('q');
			c.commands.test.platforms.ios.aliases.q.should.include('quiet');
			c.commands.test.platforms.ios.aliases.should.have.ownProperty('s');
			c.commands.test.platforms.ios.aliases.s.should.include('sdk');

			c.commands.test.platforms.ios.subcommands.should.have.ownProperty('list');
		});
	});

	describe('#subcommand()', function () {
		it('should define a subcommand', function () {
			var c = new Context;
			c.subcommand('list');
			c.subcommands.should.have.ownProperty('list');
		});

		it('should define multiple subcommands', function () {
			var c = new Context;
			c.subcommand({
				list: {},
				update: {}
			});
			c.subcommands.should.have.ownProperty('list');
			c.subcommands.should.have.ownProperty('update');
		});

		it('should define a subcommand with flags and options', function () {
			var c = new Context;
			c.subcommand({
				list: {
					flags: {
						quiet: {
							abbr: 'q'
						},
						colors: {
							negate: true
						}
					},
					options: {
						sdk: {
							abbr: 's',
							default: 'latest'
						},
						target: null
					}
				}
			});

			c.subcommands.should.have.ownProperty('list');

			c.subcommands.list.flags.should.have.ownProperty('quiet');
			c.subcommands.list.flags.should.have.ownProperty('colors');

			c.subcommands.list.options.should.have.ownProperty('sdk');
			c.subcommands.list.options.should.have.ownProperty('target');

			c.subcommands.list.aliases.should.have.ownProperty('q');
			c.subcommands.list.aliases.q.should.include('quiet');
			c.subcommands.list.aliases.should.have.ownProperty('s');
			c.subcommands.list.aliases.s.should.include('sdk');
		});
	});

	describe('#load()', function () {
		it('should error because path is undefined', function (done) {
			var c = new Context,
				logger = new MockLogger,
				origExit = process.exit,
				exitCode = null;

			process.exit = function (code) {
				process.exit = origExit;
				logger.buffer.should.include('Unable to load "" command because command file path unknown');
				code.should.equal(1);
				done();
			};

			c.load(logger, {}, {}, function (err, ctx) {
				process.exit = origExit;
				assert(false, 'expected process to exit, not the callback to be fired');
			});
		});

		it('should error because path is undefined, but with a name', function (done) {
			var c = new Context({ name: 'test' }),
				logger = new MockLogger,
				origExit = process.exit,
				exitCode = null;

			process.exit = function (code) {
				process.exit = origExit;
				logger.buffer.should.include('Unable to load "test" command because command file path unknown');
				code.should.equal(1);
				done();
			};

			c.load(logger, {}, {}, function (err, ctx) {
				process.exit = origExit;
				assert(false, 'expected process to exit, not the callback to be fired');
			});
		});

		it('should error because path is invalid', function (done) {
			var c = new Context({ name: 'doesnotexist', path: path.join(__dirname, 'resources', 'commands', 'doesnotexist.js') }),
				logger = new MockLogger,
				origExit = process.exit,
				exitCode = null;

			process.exit = function (code) {
				process.exit = origExit;
				logger.buffer.should.include('Unable to load "doesnotexist" command because command file path does not exist');
				logger.buffer.should.include('Command file: ' + path.join(__dirname, 'resources', 'commands', 'doesnotexist.js'));
				code.should.equal(1);
				done();
			};

			c.load(logger, {}, {}, function (err, ctx) {
				process.exit = origExit;
				assert(false, 'expected process to exit, not the callback to be fired');
			});
		});

		it('should error because command contains syntax errors', function (done) {
			var c = new Context({ name: 'badcommand', path: path.join(__dirname, 'resources', 'commands', 'badcommand.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err) {
				assert(err, 'Context should have errored when loading a JavaScript command with syntax errors');
				done();
			});
		});

		it('should error because the cli version is incompatible', function (done) {
			var c = new Context({ name: 'incompatible', path: path.join(__dirname, 'resources', 'commands', 'incompatible.js') }),
				logger = new MockLogger,
				origExit = process.exit,
				exitCode = null;

			process.exit = function (code) {
				process.exit = origExit;
				logger.buffer.should.include('Command "incompatible" incompatible with this version of the CLI');
				logger.buffer.should.include('Requires version 1.0.0, currently 3.2.0');
				code.should.equal(1);
				throw '';
			};

			c.load(logger, {}, { version: '3.2.0' }, function (err, ctx) {
				process.exit = origExit;
				assert(false, 'expected process to exit, not the callback to be fired');
			});
		});

		it('should load module with object-based config', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');

				ctx.flags.should.have.ownProperty('quiet');
				ctx.flags.should.have.ownProperty('colors');

				ctx.options.should.have.ownProperty('sdk');
				ctx.options.should.have.ownProperty('target');

				ctx.aliases.should.have.ownProperty('q');
				ctx.aliases.q.should.include('quiet');
				ctx.aliases.should.have.ownProperty('s');
				ctx.aliases.s.should.include('sdk');

				ctx.subcommands.should.have.ownProperty('list');

				done();
			});
		});

		it('should load module with function-based config', function (done) {
			var c = new Context({ name: 'bar', path: path.join(__dirname, 'resources', 'commands', 'bar.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "bar" to load without error');

				ctx.flags.should.have.ownProperty('quiet');
				ctx.flags.should.have.ownProperty('colors');

				ctx.options.should.have.ownProperty('sdk');
				ctx.options.should.have.ownProperty('target');

				ctx.aliases.should.have.ownProperty('q');
				ctx.aliases.q.should.include('quiet');
				ctx.aliases.should.have.ownProperty('s');
				ctx.aliases.s.should.include('sdk');

				ctx.subcommands.should.have.ownProperty('list');

				done();
			});
		});

		it('should load module with no config function', function (done) {
			var c = new Context({ name: 'baz', path: path.join(__dirname, 'resources', 'commands', 'baz.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "baz" to load without error');
				assert(ctx, 'expected command context to load despite command not having a config function');
				done();
			});
		});

		it('should not load a module if it is already loaded', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				ctx.load(logger, {}, {}, function (err, ctx) {
					assert(!err, 'expected "foo" to load without error');
					done();
				});
			});
		});

		it('should remove sdk option from child context', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');

				var c2 = new Context({ name: 'bar', path: path.join(__dirname, 'resources', 'commands', 'bar.js'), parent: c });
				c2.load(logger, {}, {}, function (err, ctx) {
					assert(!err, 'expected "bar" to load without error');
					c.options.should.have.ownProperty('sdk');
					c2.options.should.not.have.ownProperty('sdk');
					done();
				});
			});
		});

		it('should load module with cli args', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {
				argv: {
					$0: 'node titanium',
					$: 'titanium',
					$_: [],
					_: [],
					$command: null
				}
			}, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				done();
			});
		});

		it('should load module with cli args including "help" command', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger,
				cli = {
					argv: {
						$0: 'node titanium',
						$: 'titanium',
						$_: ['help'],
						_: [],
						$command: 'help'
					},
					sdk: {
						path: 'foo/bar'
					}
				};

			c.load(logger, {}, cli, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				cli.argv.should.have.ownProperty('$command');
				cli.argv.$command.should.equal('help');
				done();
			});
		});

		it('should load module with cli args including "bar list"', function (done) {
			var c = new Context({ name: 'bar', path: path.join(__dirname, 'resources', 'commands', 'bar.js') }),
				logger = new MockLogger,
				cli = {
					argv: {
						$0: 'node titanium',
						$: 'titanium',
						$_: ['bar', 'list'],
						_: ['list'],
						$command: 'bar'
					}
				};

			c.load(logger, {}, cli, function (err, ctx) {
				assert(!err, 'expected "bar" to load without error');
				cli.argv.should.have.ownProperty('$command');
				cli.argv.$command.should.equal('bar');
				cli.argv.should.have.ownProperty('$subcommand');
				cli.argv.$subcommand.should.equal('list');
				done();
			});
		});

		it('should load module without cli arg --platform', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger,
				cli = {
					argv: {
						$0: 'node titanium',
						$: 'titanium',
						$_: [],
						_: [],
						$command: 'bar'
					},
					sdk: {
						path: __dirname
					},
					scanHooks: function () {}
				};

			c.load(logger, {}, cli, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				ctx.platforms.should.haveOwnProperty('android');
				ctx.platforms.should.haveOwnProperty('ios');
				done();
			});
		});

		it('should load module with cli arg --platform', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger,
				cli = {
					argv: {
						$0: 'node titanium',
						$: 'titanium',
						$_: ['--platform', 'ios'],
						_: [],
						$command: 'bar'
					},
					sdk: {
						path: __dirname
					},
					scanHooks: function () {}
				};

			c.load(logger, {}, cli, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				cli.argv.should.have.ownProperty('platform');
				cli.argv.platform.should.equal('ios');
				done();
			});
		});
	});

	describe('#loadModuleOnly()', function () {
		it('should fail if path is undefined', function (done) {
			var c = new Context({ name: 'foo' });
			c.loadModuleOnly(function (err, ctx) {
				assert(err, 'expected "foo" to load with error');
				done();
			});
		});

		it('should fail if path is invalid', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'doesnotexist.js') });
			c.loadModuleOnly(function (err, ctx) {
				assert(err, 'expected "foo" to load with error');
				done();
			});
		});

		it('should load command module only', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') });

			c.loadModuleOnly(function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				ctx.should.have.ownProperty('module');
				ctx.module.should.have.ownProperty('desc');
				ctx.module.desc.should.equal('foo!');
				done();
			});
		});

		it('should fail if command module has syntax error', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'badcommand.js') });
			c.loadModuleOnly(function (err, ctx) {
				assert(err, 'expected "foo" to load with error');
				done();
			});
		});

		it('should return immediately if already loaded', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger,
				cli = {
					argv: {
						$0: 'node titanium',
						$: 'titanium',
						$_: [],
						_: [],
						$command: 'bar'
					},
					sdk: {
						path: __dirname
					},
					scanHooks: function () {}
				};

			c.load(logger, {}, cli, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');
				c.loadModuleOnly(function (err, ctx) {
					assert(!err, 'expected "foo" to load without error');
					ctx.should.have.ownProperty('module');
					ctx.module.should.have.ownProperty('desc');
					ctx.module.desc.should.equal('foo!');
					done();
				});
			});
		});
	});

	describe('#setArg()', function () {
		it('should set an option arg and skip callbacks', function () {
			var c = new Context;

			c.option({
				foo: {
					abbr: 'f',
					callback: function (val) {
						return val.toUpperCase();
					}
				}
			})

			c.setArg('foo', 'bar', true);

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal('bar');
		});

		it('should set an option arg and fire callbacks', function () {
			var c = new Context;

			c.option({
				foo: {
					abbr: 'f',
					callback: function (val) {
						return val.toUpperCase();
					}
				}
			})

			c.setArg('foo', 'bar', false);

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal('BAR');
		});

		it('should set an option arg using the abbreviation', function () {
			var c = new Context;

			c.option('foo', {
				abbr: 'f'
			});

			c.setArg('f', 'bar');

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal('bar');
		});

		it('should set a nested option arg', function () {
			var c = new Context;

			c.option('foo');

			c.setArg('foo.baz', 'bar');

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.have.ownProperty('baz');
			c.argv.foo.baz.should.equal('bar');
		});

		it('should append multiple option args into an array', function () {
			var c = new Context;

			c.option('foo');

			c.setArg('foo', 'bar');
			c.setArg('foo', 'baz');
			c.setArg('foo', 'baz');

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.be.an.instanceOf(Array);
			c.argv.foo.should.eql([ 'bar', 'baz' ]);
		});

		it('should set an flag arg', function () {
			var c = new Context;

			c.flag('foo');

			c.setArg('foo', true);

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal(true);

			c.setArg('foo', false);

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal(false);
		});

		it('should set an flag arg with a callback', function () {
			var c = new Context,
				result = 'hello';

			c.flag('foo', {
				abbr: 'f',
				callback: function (val) {
					result = 'world';
				}
			});

			c.setArg('foo', true);

			c.argv.should.have.ownProperty('foo');
			c.argv.foo.should.equal(true);
			result.should.equal('world');
		});
	});

	describe('#getFlagsOptions()', function () {
		it('should return flags and options', function (done) {
			var c = new Context({ name: 'foo', path: path.join(__dirname, 'resources', 'commands', 'foo.js') }),
				logger = new MockLogger;

			c.load(logger, {}, {}, function (err, ctx) {
				assert(!err, 'expected "foo" to load without error');

				var x = c.getFlagsOptions();
				x.flags.should.have.ownProperty('quiet');
				x.flags.should.have.ownProperty('colors');
				x.options.should.have.ownProperty('sdk');
				x.options.should.have.ownProperty('target');

				var c2 = new Context({ name: 'bar', path: path.join(__dirname, 'resources', 'commands', 'bar.js'), parent: c });
				c2.load(logger, {}, {}, function (err, ctx) {
					assert(!err, 'expected "bar" to load without error');

					var y = c2.getFlagsOptions();
					y.flags.should.have.ownProperty('quiet');
					y.flags.should.have.ownProperty('colors');
					y.options.should.have.ownProperty('sdk');
					y.options.should.have.ownProperty('target');

					done();
				});
			});
		});
	});

	describe('#parse()', function () {
		it('should skip parsing when no args', function () {
			var c = new Context;
			c.parse(null).should.eql({
				_: []
			});
		});

		it('should parse empty array of args', function () {
			var c = new Context;
			c.parse([]).should.eql({
				_: []
			});
		});

		// <arg>
		it('should parse <arg>', function () {
			var c = new Context;
			c.parse(['arg1']).should.eql({
				_: ['arg1']
			});
		});

		// <arg> <arg>
		it('should parse <arg1> <arg2>', function () {
			var c = new Context;
			c.parse(['arg1', 'arg2']).should.eql({
				_: ['arg1', 'arg2']
			});
		});

		// --flag
		it('should parse --foo', function () {
			var c = new Context;
			c.parse(['--foo']).should.eql({
				_: [],
				foo: ''
			});

			c = new Context;
			c.flag('foo');
			c.parse(['--foo']).should.eql({
				_: [],
				foo: true
			});
		});

		// --flag --flag
		it('should parse --foo1 --foo2', function () {
			var c = new Context;
			c.parse(['--foo1', '--foo2']).should.eql({
				_: [],
				foo1: '',
				foo2: ''
			});

			c = new Context;
			c.flag('foo1');
			c.flag('foo2');
			c.parse(['--foo1', '--foo2']).should.eql({
				_: [],
				foo1: true,
				foo2: true
			});
		});

		// -a -b
		it('should parse -a -b', function () {
			var c = new Context;
			c.parse(['-a', '-b']).should.eql({
				_: [],
				a: true,
				b: true
			});

			c = new Context;
			c.flag('foo1', { abbr: 'a' });
			c.flag('foo2', { abbr: 'b' });
			c.parse(['-a', '-b']).should.eql({
				_: [],
				foo1: true,
				foo2: true
			});
		});

		// -ab
		it('should parse -ab', function () {
			var c = new Context;
			c.parse(['-ab']).should.eql({
				_: [],
				a: true,
				b: true
			});

			c = new Context;
			c.flag('foo1', { abbr: 'a' });
			c.flag('foo2', { abbr: 'b' });
			c.parse(['-ab']).should.eql({
				_: [],
				foo1: true,
				foo2: true
			});
		});

		// -a bar
		it('should parse -a bar', function () {
			var c = new Context;
			c.parse(['-a', 'bar']).should.eql({
				_: [],
				a: 'bar'
			});

			c = new Context;
			c.flag('foo', { abbr: 'a' });
			c.parse(['-a', 'bar']).should.eql({
				_: ['bar'],
				foo: true
			});
		});

		// -ab bar
		it('should parse -ab bar as flags', function () {
			var c = new Context;
			c.parse(['-ab', 'bar']).should.eql({
				_: [],
				a: true,
				b: 'bar'
			});

			c = new Context;
			c.flag('foo1', { abbr: 'a' });
			c.flag('foo2', { abbr: 'b' });
			c.parse(['-ab', 'bar']).should.eql({
				_: ['bar'],
				foo1: true,
				foo2: true
			});
		});

		// -ab bar
		it('should parse -ab bar as options', function () {
			var c = new Context;
			c.parse(['-ab', 'bar']).should.eql({
				_: [],
				a: true,
				b: 'bar'
			});

			c = new Context;
			c.option('foo1', { abbr: 'a' });
			c.option('foo2', { abbr: 'b' });
			c.parse(['-ab', 'bar']).should.eql({
				_: [],
				foo1: true,
				foo2: 'bar'
			});
		});

		// -a true
		it('should parse -a true', function () {
			var c = new Context;
			c.parse(['-a', 'true']).should.eql({
				_: [],
				a: 'true'
			});

			c = new Context;
			c.flag('foo', { abbr: 'a' });
			c.parse(['-a', 'true']).should.eql({
				_: [],
				foo: true
			});
		});

		// --flag true
		it('should parse --foo true', function () {
			var c = new Context;
			c.parse(['--foo', 'true']).should.eql({
				_: [],
				foo: 'true'
			});

			c = new Context;
			c.flag('foo');
			c.parse(['--foo', 'true']).should.eql({
				_: [],
				foo: true
			});
		});

		// --flag false
		it('should parse --foo true', function () {
			var c = new Context;
			c.parse(['--foo', 'false']).should.eql({
				_: [],
				foo: 'false'
			});

			c = new Context;
			c.flag('foo');
			c.parse(['--foo', 'false']).should.eql({
				_: [],
				foo: false
			});
		});

		// --flag -- --flag
		it('should parse --foo1 -- --foo2', function () {
			var c = new Context;
			c.parse(['--foo1', '--', '--foo2']).should.eql({
				_: ['--foo2'],
				foo1: ''
			});

			c = new Context;
			c.flag('foo1');
			c.parse(['--foo1', '--', '--foo2']).should.eql({
				_: ['--foo2'],
				foo1: true
			});
		});

		// --no-flag
		it('should parse --no-foo', function () {
			var c = new Context;
			c.parse(['--no-foo']).should.eql({
				_: [],
				foo: false
			});

			c = new Context;
			c.flag('foo', { negate: true });
			c.parse(['--no-foo']).should.eql({
				_: [],
				foo: false
			});
		});

		// --flag <arg>
		it('should parse --foo <arg>', function () {
			var c = new Context;
			c.parse(['--foo', 'arg']).should.eql({
				_: [],
				foo: 'arg' // doesn't know --foo is a flag, treats it as an option
			});

			c = new Context;
			c.flag('foo');
			c.parse(['--foo', 'arg']).should.eql({
				_: ['arg'],
				foo: true
			});
		});

		// --option value
		it('should parse --foo bar', function () {
			var c = new Context;
			c.parse(['--foo', 'bar']).should.eql({
				_: [],
				foo: 'bar'
			});

			c = new Context;
			c.option('foo');
			c.parse(['--foo', 'bar']).should.eql({
				_: [],
				foo: 'bar'
			});
		});

		// --option=value
		it('should parse --foo=bar', function () {
			var c = new Context;
			c.parse(['--foo=bar']).should.eql({
				_: [],
				foo: 'bar'
			});

			c = new Context;
			c.option('foo');
			c.parse(['--foo=bar']).should.eql({
				_: [],
				foo: 'bar'
			});
		});

		// --option value --option value
		it('should parse --foo bar --baz qux', function () {
			var c = new Context;
			c.parse(['--foo', 'bar', '--baz', 'qux']).should.eql({
				_: [],
				foo: 'bar',
				baz: 'qux'
			});

			c = new Context;
			c.option('foo');
			c.option('baz');
			c.parse(['--foo', 'bar', '--baz', 'qux']).should.eql({
				_: [],
				foo: 'bar',
				baz: 'qux'
			});
		});

		// --option value <arg>
		it('should parse --foo bar <arg>', function () {
			var c = new Context;
			c.parse(['--foo', 'bar', 'arg']).should.eql({
				_: ['arg'],
				foo: 'bar'
			});

			c = new Context;
			c.option('foo');
			c.parse(['--foo', 'bar', 'arg']).should.eql({
				_: ['arg'],
				foo: 'bar'
			});
		});

		// --option value <arg> --option value
		it('should parse --foo bar <arg> --baz qux', function () {
			var c = new Context;
			c.parse(['--foo', 'bar', 'arg', '--baz', 'qux']).should.eql({
				_: ['arg'],
				foo: 'bar',
				baz: 'qux'
			});

			c = new Context;
			c.option('foo');
			c.option('baz');
			c.parse(['--foo', 'bar', 'arg', '--baz', 'qux']).should.eql({
				_: ['arg'],
				foo: 'bar',
				baz: 'qux'
			});
		});

		// --flag --option value
		it('should parse --foo --baz qux', function () {
			var c = new Context;
			c.parse(['--foo', '--baz', 'qux']).should.eql({
				_: [],
				foo: '',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--foo', '--baz', 'qux']).should.eql({
				_: [],
				foo: true,
				baz: 'qux'
			});
		});

		// --flag --option value <arg>
		it('should parse --foo --baz qux <arg>', function () {
			var c = new Context;
			c.parse(['--foo', '--baz', 'qux', 'arg']).should.eql({
				_: ['arg'],
				foo: '',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--foo', '--baz', 'qux', 'arg']).should.eql({
				_: ['arg'],
				foo: true,
				baz: 'qux'
			});
		});

		// --flag <arg> --option value
		it('should parse --foo <arg> --baz qux', function () {
			var c = new Context;
			c.parse(['--foo', 'arg', '--baz', 'qux']).should.eql({
				_: [],
				foo: 'arg',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--foo', 'arg', '--baz', 'qux']).should.eql({
				_: ['arg'],
				foo: true,
				baz: 'qux'
			});
		});

		// --option value --flag
		it('should parse --baz qux --foo', function () {
			var c = new Context;
			c.parse(['--baz', 'qux', '--foo']).should.eql({
				_: [],
				foo: '',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--baz', 'qux', '--foo']).should.eql({
				_: [],
				foo: true,
				baz: 'qux'
			});
		});

		// --option value <arg> --flag
		it('should parse --baz qux <arg> --foo', function () {
			var c = new Context;
			c.parse(['--baz', 'qux', 'arg', '--foo']).should.eql({
				_: ['arg'],
				foo: '',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--baz', 'qux', 'arg', '--foo']).should.eql({
				_: ['arg'],
				foo: true,
				baz: 'qux'
			});
		});

		// --option value <arg> --flag <arg>
		it('should parse --baz qux <arg1> --foo', function () {
			var c = new Context;
			c.parse(['--baz', 'qux', 'arg1', '--foo', 'arg2']).should.eql({
				_: ['arg1'],
				foo: 'arg2',
				baz: 'qux'
			});

			c = new Context;
			c.flag('foo');
			c.option('baz');
			c.parse(['--baz', 'qux', 'arg1', '--foo', 'arg2']).should.eql({
				_: ['arg1', 'arg2'],
				foo: true,
				baz: 'qux'
			});
		});

		// <unknown-command>
		it('should parse <unknown-command>', function () {
			var c = createGlobalContext();
			c.parse(['doesnotexist'], Object.keys(c.commands)).should.eql({
				_: ['doesnotexist'],
				help: false,
				version: false,
				colors: true,
				quiet: false,
				prompt: true,
				'progress-bars': true,
				banner: true
			});
		});

		// --flag <unknown-command>
		it('should parse --flag <unknown-command>', function () {
			var c = createGlobalContext();
			c.parse(['--foo', 'doesnotexist'], Object.keys(c.commands)).should.eql({
				_: [],
				help: false,
				version: false,
				colors: true,
				quiet: false,
				prompt: true,
				'progress-bars': true,
				banner: true,
				foo: 'doesnotexist'
			});

			c = createGlobalContext();
			c.flag('foo');
			c.parse(['--foo', 'doesnotexist'], Object.keys(c.commands)).should.eql({
				_: ['doesnotexist'],
				help: false,
				version: false,
				colors: true,
				quiet: false,
				prompt: true,
				'progress-bars': true,
				banner: true,
				foo: true
			});
		});

		// <command>
		it('should parse known <command>', function () {
			var c = createGlobalContext();
			c.parse(['info'], Object.keys(c.commands)).should.eql({
				_: ['info'],
				help: false,
				version: false,
				colors: true,
				quiet: false,
				prompt: true,
				'progress-bars': true,
				banner: true
			});
		});

		// --global-flag <command>
		it('should parse --global-flag <command>', function () {
			var c = createGlobalContext();
			c.parse(['--quiet', 'info'], Object.keys(c.commands)).should.eql({
				_: ['info'],
				help: false,
				version: false,
				colors: true,
				quiet: true,
				prompt: true,
				'progress-bars': true,
				banner: true
			});
		});

		// <command> --global-flag
		it('should parse <command> --global-flag', function () {
			var c = createGlobalContext();
			c.parse(['info', '--quiet'], Object.keys(c.commands)).should.eql({
				_: ['info'],
				help: false,
				version: false,
				colors: true,
				quiet: true,
				prompt: true,
				'progress-bars': true,
				banner: true
			});
		});

		// --global-flag <command> --global-flag
		it('should parse --global-flag <command> --global-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', 'info', '--no-colors'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: false,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					legacy: false,
					dummyflag: false
				});
			});
		});

		// <command> --command-flag
		it('should parse <command> --command-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['info', '--legacy'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					legacy: true,
					dummyflag: false
				});
			});
		});

		// --global-flag <command> --command-flag
		it('should parse --global-flag <command> --command-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', 'info', '--legacy'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					legacy: true,
					dummyflag: false
				});
			});
		});

		// --command-flag <command> --command-flag
		it('should parse --command-flag <command> --command-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--dummyflag', 'info', '--legacy'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					dummyflag: true,
					legacy: true,
					dummyflag: true
				});
			});
		});

		// --global-flag --command-flag <command> --command-flag
		it('should parse --global-flag --command-flag <command> --command-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', '--dummyflag', 'info', '--legacy'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					dummyflag: true,
					legacy: true,
					dummyflag: true
				});
			});
		});

		// --command-flag <command> --global-flag --command-flag
		it('should parse --command-flag <command> --global-flag --command-flag', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.info.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--dummyflag', 'info', '--quiet', '--legacy'], Object.keys(c.commands)).should.eql({
					_: [],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					legacy: true,
					dummyflag: true
				});
			});
		});

		// <command> <arg>
		it('should parse <command> <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['config', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: false,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// <command> <arg1> <arg2>
		it('should parse <command> <arg1> <arg2>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['config', 'test', 'dummy'], Object.keys(c.commands)).should.eql({
					_: ['test', 'dummy'],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: false,
					remove: false,
					key: 'test',
					value: 'dummy'
				});
			});
		});

		// --global-flag <command> <arg>
		it('should parse --global-flag <command> <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', 'config', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: false,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// <command> --global-flag <arg>
		it('should parse --global-flag <command> <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['config', '--quiet', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: false,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// --global-flag <command> --global-flag <arg>
		it('should parse --global-flag <command> --global-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--no-colors', 'config', '--quiet', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: false,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: false,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// <command> --command-flag <arg>
		it('should parse <command> --command-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['config', '--append', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: true,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// --global-flag <command> --command-flag <arg>
		it('should parse --global-flag <command> --command-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', 'config', '--append', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: true,
					remove: false,
					key: 'test',
					value: undefined
				});
			});
		});

		// --command-flag <command> --command-flag <arg>
		it('should parse --command-flag <command> --command-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--append', 'config', '--remove', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: false,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: true,
					remove: true,
					key: 'test',
					value: undefined
				});
			});
		});

		// --global-flag --command-flag <command> --command-flag <arg>
		it('should parse --global-flag --command-flag <command> --command-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--quiet', '--append', 'config', '--remove', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: true,
					remove: true,
					key: 'test',
					value: undefined
				});
			});
		});

		// --command-flag <command> --global-flag --command-flag <arg>
		it('should parse --command-flag <command> --global-flag --command-flag <arg>', function () {
			var c = createGlobalContext(),
				logger = new MockLogger;

			c.commands.config.load(logger, {}, {}, function (err, cmd) {
				cmd.parse(['--append', 'config', '--quiet', '--remove', 'test'], Object.keys(c.commands)).should.eql({
					_: ['test'],
					help: false,
					version: false,
					colors: true,
					quiet: true,
					prompt: true,
					'progress-bars': true,
					banner: true,
					append: true,
					remove: true,
					key: 'test',
					value: undefined
				});
			});
		});

		// --global-option value <command>
		// <command> --global-option value
		// --global-option value <command> --global-option value
		// <command> --command-option value
		// --global-option value <command> --command-option value
		// --command-option value <command> --command-option value
		// --global-option value --command-option value <command> --command-option value
		// --command-option value <command> --global-option value --command-option value

		// --global-option value <command> <arg>
		// <command> --global-option value <arg>
		// --global-option value <command> --global-option value <arg>
		// <command> --command-option value <arg>
		// --global-option value <command> --command-option value <arg>
		// --command-option value <command> --command-option value <arg>
		// --global-option value --command-option value <command> --command-option value <arg>
		// --command-option value <command> --global-option value --command-option value <arg>


		// --platform
		// <command> <subcommand>
		// nested contexts
	});

	describe('#printHelp()', function () {
		// printHelp(logger, config, cli, command, subcommand, finished)
	});

	describe('#printUsage()', function () {
		// printUsage(logger, config, cli, platform)
	});

	describe('#printDescription()', function () {
		// printDescription(logger, config)
	});

	describe('#printList()', function () {
		// printList(logger, config, title, items)
	});

	describe('#printSubcommands()', function () {
		// printSubcommands(logger, config)
	});

	describe('#printPlatforms()', function () {
		// printPlatforms(logger, config, cli, platform)
	});

	describe('#printArguments()', function () {
		// printArguments(logger, config)
	});

	describe('#printFlags()', function () {
		// printFlags(logger, config)
	});

	describe('#printOptions()', function () {
		// printOptions(logger, config)
	});
});
