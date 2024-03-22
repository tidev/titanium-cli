'use strict';

exports.id = 'com.appcelerator.hyperloop-fix';

exports.init = function init(_logger, _config, cli, _appc) {
	cli.env.os.sdkPaths.forEach(_sdkPath => {
		// noop
	});
};
