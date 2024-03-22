import { describe, it } from 'node:test';
import assert from 'node:assert';
import { suggest } from '../../src/util/suggest.js';
import { stripColor } from '../helpers/strip-color.js';

const cmds = ['build', 'clean', 'config', 'create', 'info'];

describe('suggest', () => {
	it('should suggest a value', () => {
		assert.strictEqual(
			stripColor(suggest('buid', cmds)),
			'Did you mean this?\n    build\n\n'
		);
	});

	it('should suggest multiple values', () => {
		assert.strictEqual(
			stripColor(suggest('cre', cmds)),
			'Did you mean this?\n    clean\n    create\n\n'
		);

		assert.strictEqual(
			stripColor(suggest('eat', cmds)),
			'Did you mean this?\n    clean\n    create\n\n'
		);
	});

	it('should suggest everything if empty', () => {
		assert.strictEqual(
			stripColor(suggest('', cmds)),
			'Did you mean this?\n    build\n    clean\n    config\n    create\n    info\n\n'
		);
	});

	it('should not find any suggestions', () => {
		assert.strictEqual(
			stripColor(suggest('zzz', cmds)),
			''
		);
	});
});
