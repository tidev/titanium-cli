exports.config = function () {
	return {
		noAuth: true,
		flags: {
			empty: undefined,
			quiet: {
				abbr: 'q'
			},
			colors: {
				negate: true
			}
		},
		options: {
			platform: {},
			sdk: {
				abbr: 's',
				default: 'latest'
			},
			target: null
		},
		platforms: {
			ios: {}
		},
		subcommands: {
			list: null
		}
	};
};
