exports.config = function (logger, config, cli) {
	return {
		noAuth: false,
		skipBanner: true,
		flags: {
			force: {
				abbr: 'f'
			}
		},
		options: {
			name: {
				abbr: 'n',
				values: ['footest']
			},
			id: {
				values: ['com.appcelerator.footest']
			},
			'workspace-directory': {
				abbr: 'd',
				values: ['.']
			},
			platform: {
				abbr: 'p',
				values: ['ios']
			},
			type: {
				abbr: 't',
				values: ['app']
			},
			url: {
				abbr: 'u',
				values: ['http://www.example.com']
			}
		}
	};
};
