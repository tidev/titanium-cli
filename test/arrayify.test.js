import { describe, expect, it } from 'vitest';
import { arrayify } from '../src/util/arrayify.js';

describe('arrayify', () => {
	it('should init undefined array', () => {
		expect(arrayify()).toEqual([]);
	});

	it('should arrayify a non-array', () => {
		expect(arrayify(1)).toEqual([1]);
		expect(arrayify('a')).toEqual(['a']);
		expect(arrayify(true)).toEqual([true]);
		expect(arrayify(false)).toEqual([false]);
	});

	it('should remove falsey values', () => {
		expect(arrayify([
			0,
			1,
			null,
			undefined,
			'',
			'a',
			true,
			false
		], true)).toEqual([
			0,
			1,
			'a',
			true
		]);
	});
});
