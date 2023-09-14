import { describe, expect, it } from 'vitest';
import { suggest } from '../../src/util/suggest.js';

const cmds = ['build', 'clean', 'config', 'create', 'info'];

function stripColor(str) {
	return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}

describe('suggest', () => {
	it('should suggest a value', () => {
		expect(stripColor(suggest('buid', cmds)))
			.toEqual('Did you mean this?\n    build\n\n');
	});

	it('should suggest multiple values', () => {
		expect(stripColor(suggest('cre', cmds)))
			.toEqual('Did you mean this?\n    clean\n    create\n\n');

		expect(stripColor(suggest('eat', cmds)))
			.toEqual('Did you mean this?\n    clean\n    create\n\n');
	});

	it('should suggest everything if empty', () => {
		expect(stripColor(suggest('', cmds)))
			.toEqual('Did you mean this?\n    build\n    clean\n    config\n    create\n    info\n\n');
	});

	it('should not find any suggestions', () => {
		expect(stripColor(suggest('zzz', cmds)))
			.toEqual('');
	});
});
