import { capitalize } from '../../src/util/capitalize.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('capitalize', () => {
	it('should capitalize a string', () => {
		assert.strictEqual(capitalize('foo'), 'Foo');
		assert.strictEqual(capitalize('123 foo'), '123 foo');
		assert.strictEqual(capitalize(''), '');
	});
});
