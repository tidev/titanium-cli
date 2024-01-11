import { describe, it } from 'node:test';
import assert from 'node:assert';
import { arrayify } from '../../src/util/arrayify.js';

describe('arrayify', () => {
	it('should init undefined array', () => {
		assert.deepStrictEqual(arrayify(), []);
	});

	it('should arrayify a non-array', () => {
		assert.deepStrictEqual(arrayify(1), [1]);
		assert.deepStrictEqual(arrayify('a'), ['a']);
		assert.deepStrictEqual(arrayify(true), [true]);
		assert.deepStrictEqual(arrayify(false), [false]);
	});

	it('should arrayify a set', () => {
		assert.deepStrictEqual(
			arrayify(new Set([1, 'a', true])),
			[1, 'a', true]
		);
	});

	it('should remove falsey values', () => {
		assert.deepStrictEqual(
			arrayify([
				0,
				1,
				null,
				undefined,
				'',
				'a',
				true,
				false
			], true),
			[
				0,
				1,
				'a',
				true
			]
		);
	});
});
