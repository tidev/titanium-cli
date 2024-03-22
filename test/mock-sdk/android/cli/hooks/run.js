'use strict';

exports.cliVersion = '>=3.2';

exports.init = function (logger, config, cli) {
	let deviceInfo = [];
	const ignoreLog = config.cli.ignoreLog || [];

	cli.on('build.pre.compile', {
		priority: 8000,
		post(builder, finished) {
			if (builder.buildOnly) {
				return finished();
			}

			if (builder.target === 'emulator') {
				cli.createHook('build.android.startEmulator', function (_deviceId, _opts, cb) {
					setTimeout(() => cb(), 100);
				})(builder.deviceId, {
					logger: logger
				}, finished);

			} else if (builder.target === 'device') {
				setTimeout(() => finished(), 100);
			} else {
				finished();
			}
		}
	});

	cli.on('build.post.compile', {
		priority: 10000,
		post(builder, finished) {
			if (builder.target !== 'emulator' && builder.target !== 'device') {
				return finished();
			}

			if (builder.buildOnly) {
				return finished();
			}

			cli.emit('build.post.install', builder, finished);
		}
	});

};
