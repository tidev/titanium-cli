'use strict';

exports.cliVersion = '>=3.2';

exports.init = function (_logger, _config, cli) {
	cli.on('build.post.compile', {
		priority: 10000,
		post(_builder, finished) {
			finished();
		}
	});
};
