'use strict';

exports.config = function (_logger, _config, _cli) {
	return {
		noAuth: true,
		skipBanner: true,
		flags: {
			legacy: {},
			dummyflag: {}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				values: [ 'report', 'json' ]
			},
			types: {
				abbr: 't',
				default: 'all',
				skipValueCheck: true,
				values: [ 'all', 'os', 'nodejs', 'titanium', 'ios', 'jdk', 'android' ]
			}
		}
	};
};
