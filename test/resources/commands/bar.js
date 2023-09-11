'use strict';

exports.config = function () {
	return function (cb) {
		cb({
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
				list: {
					noAuth: true
				}
			},
			platforms: {
				ios: {
					options: {
						target: {}
					}
				}
			}
		});
	};
};
