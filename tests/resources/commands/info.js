'use strict';

exports.config = function (logger, config, cli) {
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
