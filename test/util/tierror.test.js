import { describe, it, expect } from 'vitest';
import { TiError } from '../../src/util/tierror.js';

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
		expect(e).toBeInstanceOf(Error);
	});
});
