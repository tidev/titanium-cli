import { unique } from '../../src/util/unique.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('unique', () => {
	it('should return empty array if no elements', () => {
		assert.deepStrictEqual(unique(), []);
		assert.deepStrictEqual(unique([]), []);
	});

	it('should remove duplicates, null, and undefined values', () => {
		assert.deepStrictEqual(
			unique([1, '1', 'a', true, null, undefined, 1, '1', 'a', true, null, undefined]),
			[1, '1', 'a', true]
		);
	});
});
