module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true
            },
            src: ['lib/**/*.js']
        },
        jscs: {
            options: {
                config: '.jscsrc',
                reporter: 'inline'

            },
            src: ['lib/**/*.js']
        }
    });

    // Load grunt plugins for modules
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-jscs');

    // register tasks. You might do this under a test 'test'
    grunt.registerTask('default', ['jshint', 'jscs']);
};
