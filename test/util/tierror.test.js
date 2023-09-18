import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TiError } from '../../src/util/tierror.js';

describe('TiError', () => {
	it('should support no meta info', () => {
		const e = new TiError('oh no');
		assert.strictEqual(e.toString(), 'Error: oh no');
	});

	it('should mix in meta info', () => {
		const e = new TiError('oh no', { reason: 'something' });
		assert.strictEqual(e.toString(), 'Error: oh no');
		assert.strictEqual(e.reason, 'something');
	});

	it('should also be an error', () => {
		const e = new TiError('oh no');
		assert(e instanceof Error);
	});
});
