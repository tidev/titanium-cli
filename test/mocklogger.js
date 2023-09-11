'use strict';

function MockLogger() {
	this.buffer = '';
	this.calls = [];
	this.debug = function (s) {
		this.calls.push([ 'debug', s ]);
		this.buffer += s + '\n';
	};
	this.info = function (s) {
		this.calls.push([ 'info', s ]);
		this.buffer += s + '\n';
	};
	this.warn = function (s) {
		this.calls.push([ 'warn', s ]);
		this.buffer += s + '\n';
	};
	this.error = function (s) {
		this.calls.push([ 'error', s ]);
		this.buffer += s + '\n';
	};
	this.banner = function () {
		this.calls.push([ 'banner', undefined ]);
	};
	this.log = function (s) {
		this.calls.push([ 'log', s ]);
		this.buffer += (s || '') + '\n';
	};
}

module.exports = MockLogger;
