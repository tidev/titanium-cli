'use strict';

require('appcd-gulp')({
	exports,
	pkgJson:  require('./package.json'),
	template: 'standard',
	babel:    'node10'
});
