import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Logger } from '../../src/util/logger.js';
import { WritableStream } from 'memory-streams';
import { stripColor } from '../helpers/strip-color.js';

describe('Logger', () => {
	it('should log using all log levels', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('trace', {
			stdout,
			stderr
		});

		logger.log('log test');
		logger.log('log', 'test');
		logger.log('log %s', 'test');
		logger.trace('trace test');
		logger.debug('debug test');
		logger.error('error test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(
			stripColor(stdout.toString()),
			[
				'log test',
				'log test',
				'log test',
				'[INFO]  info test',
				''
			].join('\n')
		);

		assert.strictEqual(
			stripColor(stderr.toString()),
			[
				'[TRACE] trace test',
				'[DEBUG] debug test',
				'[ERROR] error test',
				'[WARN]  warn test',
				''
			].join('\n')
		);
	});

	it('should only log warnings and above', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('warn', {
			stdout,
			stderr
		});

		logger.log('log test');
		logger.log('log', 'test');
		logger.log('log %s', 'test');
		logger.trace('trace test');
		logger.debug('debug test');
		logger.error('error test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(
			stripColor(stdout.toString()),
			[
				'log test',
				'log test',
				'log test',
				''
			].join('\n')
		);

		assert.strictEqual(
			stripColor(stderr.toString()),
			[
				'[ERROR] error test',
				'[WARN]  warn test',
				''
			].join('\n')
		);
	});

	it('should allow the level to be dynamically changed', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});

		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(
			stripColor(stdout.toString()),
			[
				'[INFO]  info test',
				''
			].join('\n')
		);

		assert.strictEqual(
			stripColor(stderr.toString()),
			[
				'[WARN]  warn test',
				''
			].join('\n')
		);

		logger.setLevel('warn');
		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(
			stripColor(stdout.toString()),
			[
				'[INFO]  info test',
				''
			].join('\n')
		);

		assert.strictEqual(
			stripColor(stderr.toString()),
			[
				'[WARN]  warn test',
				'[WARN]  warn test',
				''
			].join('\n')
		);

		logger.setLevel(2); // debug
		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(
			stripColor(stdout.toString()),
			[
				'[INFO]  info test',
				'[INFO]  info test',
				''
			].join('\n')
		);

		assert.strictEqual(
			stripColor(stderr.toString()),
			[
				'[WARN]  warn test',
				'[WARN]  warn test',
				'[DEBUG] debug test',
				'[WARN]  warn test',
				''
			].join('\n')
		);
	});

	it('should be silent', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});
		logger.silence();

		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		assert.strictEqual(stripColor(stdout.toString()), '');
		assert.strictEqual(stripColor(stderr.toString()), '');
	});

	it('should get the levels', () => {
		const logger = new Logger();
		assert.deepStrictEqual(logger.getLevels(), ['trace', 'debug', 'info', 'warn', 'error']);
	});

	it('should display the banner', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		const expected = new RegExp([
			'foo v1.2.3 SDK v4.5.6',
			'bar',
			'',
			'Want to help?'
		].join('\n'), 's');

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });
		assert.match(stripColor(logger.getBanner()), expected);

		assert.strictEqual(logger.bannerEnabled(), true);
		assert.strictEqual(logger.skipBanner(), false);
		assert.strictEqual(logger.bannerWasRendered(), false);
		assert.strictEqual(emittedCount, 0);

		logger.banner();
		assert.strictEqual(logger.bannerWasRendered(), true);
		assert.strictEqual(emittedCount, 1);

		assert.match(stripColor(stdout.toString()), expected);

		logger.banner();
		assert.strictEqual(emittedCount, 1);

		assert.match(stripColor(stdout.toString()), expected);
	});

	it('should not render banner if disabled', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });
		logger.bannerEnabled(false);

		assert.strictEqual(logger.bannerEnabled(), false);
		assert.strictEqual(logger.skipBanner(), false);
		assert.strictEqual(logger.bannerWasRendered(), false);
		assert.strictEqual(emittedCount, 0);

		logger.banner();
		assert.strictEqual(logger.bannerWasRendered(), false);
		assert.strictEqual(emittedCount, 0);
		assert.strictEqual(stripColor(stdout.toString()), '');
	});

	it('should not render banner if skipped', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });

		assert.strictEqual(logger.skipBanner(), false);
		logger.skipBanner(true);
		assert.strictEqual(logger.skipBanner(), true);

		logger.banner();
		assert.strictEqual(logger.bannerWasRendered(), false);
		assert.strictEqual(emittedCount, 0);
		assert.strictEqual(stripColor(stdout.toString()), '');
	});

	it('should log with timestamps', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr
		});

		assert.strictEqual(logger.timestampEnabled(), false);
		assert.strictEqual(logger.timestampEnabled(false), false);
		assert.strictEqual(logger.timestampEnabled(true), true);

		logger.info('- [INFO]  info test');
		assert.match(stripColor(stdout.toString()), /\[INFO\]  info test/);
	});
});
