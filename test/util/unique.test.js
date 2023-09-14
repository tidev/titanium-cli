import { describe, expect, it } from 'vitest';
import { unique } from '../src/util/unique.js';

describe('unique', () => {
	it('should return empty array if no elements', () => {
		expect(unique()).toEqual([]);
		expect(unique([])).toEqual([]);
	});

	it('should remove duplicates, null, and undefined values', () => {
		expect(unique([
			1,
			'1',
			'a',
			true,
			null,
			undefined,
			1,
			'1',
			'a',
			true,
			null,
			undefined
		])).toEqual([
			1,
			'1',
			'a',
			true
		]);
	});
});
