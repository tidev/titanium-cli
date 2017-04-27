module.exports = function (grunt) {

	var source = ['Gruntfile.js', 'bin/*', 'lib/**/*.js', 'tests/**/*.js'];
	var tests = ['tests/**/test-*.js'];

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			check: {
				src: source
			}
		},
		mochaTest: {
			options: {
				timeout: 3000,
				reporter: 'mocha-jenkins-reporter',
				reporterOptions: {
					junit_report_name: 'Tests',
					junit_report_path: 'junit_report.xml',
					junit_report_stack: 1
				},
				ignoreLeaks: false
			},
			src: tests
		},
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-appc-js');

	// register tasks
	grunt.registerTask('lint', ['appcJs:check']);
	grunt.registerTask('test', ['mochaTest']);
	grunt.registerTask('default', ['lint']);
};
