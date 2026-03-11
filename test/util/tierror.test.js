import { TiError } from '../../src/util/tierror.js';
import { describe, expect, it } from 'vitest';

describe('TiError', () => {
	it('should support no meta info', () => {
		const e = new TiError('oh no');
		expect(e.toString()).toBe('Error: oh no');
	});

	it('should mix in meta info', () => {
		const e = new TiError('oh no', { reason: 'something' });
		expect(e.toString()).toBe('Error: oh no');
		expect(e.reason).toBe('something');
	});

	it('should also be an error', () => {
		const e = new TiError('oh no');
		expect(e instanceof Error).toBe(true);
	});
});
