import { Logger } from '../../src/util/logger.js';
import { stripColor } from '../helpers/strip-color.js';
import { WritableStream } from 'memory-streams';
import { describe, expect, it } from 'vitest';

describe('Logger', () => {
	it('should log using all log levels', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('trace', {
			stdout,
			stderr,
		});

		logger.log('log test');
		logger.log('log', 'test');
		logger.log('log %s', 'test');
		logger.trace('trace test');
		logger.debug('debug test');
		logger.error('error test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe(
			['log test', 'log test', 'log test', '[INFO]  info test', ''].join('\n')
		);

		expect(stripColor(stderr.toString())).toBe(
			[
				'[TRACE] trace test',
				'[DEBUG] debug test',
				'[ERROR] error test',
				'[WARN]  warn test',
				'',
			].join('\n')
		);
	});

	it('should only log warnings and above', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('warn', {
			stdout,
			stderr,
		});

		logger.log('log test');
		logger.log('log', 'test');
		logger.log('log %s', 'test');
		logger.trace('trace test');
		logger.debug('debug test');
		logger.error('error test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe(['log test', 'log test', 'log test', ''].join('\n'));

		expect(stripColor(stderr.toString())).toBe(
			['[ERROR] error test', '[WARN]  warn test', ''].join('\n')
		);
	});

	it('should allow the level to be dynamically changed', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});

		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe(['[INFO]  info test', ''].join('\n'));

		expect(stripColor(stderr.toString())).toBe(['[WARN]  warn test', ''].join('\n'));

		logger.setLevel('warn');
		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe(['[INFO]  info test', ''].join('\n'));

		expect(stripColor(stderr.toString())).toBe(
			['[WARN]  warn test', '[WARN]  warn test', ''].join('\n')
		);

		logger.setLevel(2); // debug
		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe(
			['[INFO]  info test', '[INFO]  info test', ''].join('\n')
		);

		expect(stripColor(stderr.toString())).toBe(
			[
				'[WARN]  warn test',
				'[WARN]  warn test',
				'[DEBUG] debug test',
				'[WARN]  warn test',
				'',
			].join('\n')
		);
	});

	it('should be silent', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});
		logger.silence();

		logger.debug('debug test');
		logger.info('info test');
		logger.warn('warn test');

		expect(stripColor(stdout.toString())).toBe('');
		expect(stripColor(stderr.toString())).toBe('');
	});

	it('should get the levels', () => {
		const logger = new Logger();
		expect(logger.getLevels()).toEqual(['trace', 'debug', 'info', 'warn', 'error']);
	});

	it('should display the banner', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		const expected = new RegExp(
			['foo v1.2.3 SDK v4.5.6', 'bar', '', 'Please star us on GitHub!'].join('\n'),
			's'
		);

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });
		expect(stripColor(logger.getBanner())).toMatch(expected);

		expect(logger.bannerEnabled()).toBe(true);
		expect(logger.skipBanner()).toBe(false);
		expect(logger.bannerWasRendered()).toBe(false);
		expect(emittedCount).toBe(0);

		logger.banner();
		expect(logger.bannerWasRendered()).toBe(true);
		expect(emittedCount).toBe(1);

		expect(stripColor(stdout.toString())).toMatch(expected);

		logger.banner();
		expect(emittedCount).toBe(1);

		expect(stripColor(stdout.toString())).toMatch(expected);
	});

	it('should not render banner if disabled', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });
		logger.bannerEnabled(false);

		expect(logger.bannerEnabled()).toBe(false);
		expect(logger.skipBanner()).toBe(false);
		expect(logger.bannerWasRendered()).toBe(false);
		expect(emittedCount).toBe(0);

		logger.banner();
		expect(logger.bannerWasRendered()).toBe(false);
		expect(emittedCount).toBe(0);
		expect(stripColor(stdout.toString())).toBe('');
	});

	it('should not render banner if skipped', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});
		let emittedCount = 0;
		logger.on('cli:logger-banner', () => {
			emittedCount++;
		});

		logger.setBanner({ name: 'foo', copyright: 'bar', version: '1.2.3', sdkVersion: '4.5.6' });

		expect(logger.skipBanner()).toBe(false);
		logger.skipBanner(true);
		expect(logger.skipBanner()).toBe(true);

		logger.banner();
		expect(logger.bannerWasRendered()).toBe(false);
		expect(emittedCount).toBe(0);
		expect(stripColor(stdout.toString())).toBe('');
	});

	it('should log with timestamps', () => {
		const stderr = new WritableStream();
		const stdout = new WritableStream();
		const logger = new Logger('info', {
			stdout,
			stderr,
		});

		expect(logger.timestampEnabled()).toBe(false);
		expect(logger.timestampEnabled(false)).toBe(false);
		expect(logger.timestampEnabled(true)).toBe(true);

		logger.info('- [INFO]  info test');
		expect(stripColor(stdout.toString())).toMatch(/\[INFO\]  info test/);
	});
});
