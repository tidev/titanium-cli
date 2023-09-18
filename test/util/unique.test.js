import { describe, it } from 'node:test';
import assert from 'node:assert';
import { unique } from '../../src/util/unique.js';

describe('unique', () => {
	it('should return empty array if no elements', () => {
		assert.deepStrictEqual(unique(), []);
		assert.deepStrictEqual(unique([]), []);
	});

	it('should remove duplicates, null, and undefined values', () => {
		assert.deepStrictEqual(
			unique([
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
			]),
			[
				1,
				'1',
				'a',
				true
			]
		);
	});
});
