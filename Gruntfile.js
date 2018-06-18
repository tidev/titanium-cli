'use strict';

module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			src: [
				'Gruntfile.js',
				'bin/*',
				'lib/**/*.js',
				'tests/**/test-*.js',
				'!tests/resources/hooks/errorhook.js',
				'!tests/resources/commands/badcommand.js'
			]
		},
		mocha_istanbul: {
			options: {
				timeout: 30000,
				reporter: 'mocha-jenkins-reporter',
				ignoreLeaks: false,
				globals: [ 'Hyperloop', 'HyperloopObject' ],
				reportFormats: [ 'lcov', 'cobertura' ],
				check: {
					statements: 61,
					branches: 50,
					functions: 48,
					lines: 62
				}
			},
			src: [ 'tests/**/test-*.js' ]
		},
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-istanbul');
	grunt.loadNpmTasks('grunt-appc-js');

	// register tasks
	grunt.registerTask('lint', [ 'appcJs' ]);
	grunt.registerTask('test', [ 'mocha_istanbul' ]);
	grunt.registerTask('default', [ 'lint', 'test' ]);
};
