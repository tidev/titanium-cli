import { describe, it, expect } from 'vitest';
import { capitalize } from '../../src/util/capitalize.js';

describe('capitalize', () => {
	it('should capitalize a string', () => {
		expect(capitalize('foo')).toBe('Foo');
		expect(capitalize('123 foo')).toBe('123 foo');
		expect(capitalize('')).toBe('');
	});
});
