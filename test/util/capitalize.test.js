import { describe, it } from 'node:test';
import assert from 'node:assert';
import { capitalize } from '../../src/util/capitalize.js';

describe('capitalize', () => {
	it('should capitalize a string', () => {
		assert.strictEqual(capitalize('foo'), 'Foo');
		assert.strictEqual(capitalize('123 foo'), '123 foo');
		assert.strictEqual(capitalize(''), '');
	});
});
