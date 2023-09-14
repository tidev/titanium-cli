import { describe, expect, it } from 'vitest';
import { capitalize } from '../../src/util/capitalize.js';

describe('capitalize', () => {
	it('should capitalize a string', () => {
		expect(capitalize('foo')).toEqual('Foo');
		expect(capitalize('123 foo')).toEqual('123 foo');
		expect(capitalize('')).toEqual('');
	});
});
