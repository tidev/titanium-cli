exports.config = function (logger, config, cli) {
	return {
		skipBanner: true,
		noAuth: true,
		flags: {
			append: {
				abbr: 'a'
			},
			remove: {
				abbr: 'r'
			}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				values: ['report', 'json', 'json-object']
			}
		},
		args: [
			{
				name: 'key'
			},
			{
				name: 'value'
			}
		]
	};
};
