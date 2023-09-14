import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { expand } from '../../src/util/expand.js';

const backup = {};

describe('expand', () => {
	beforeEach(() => {
		backup.HOME        = process.env.HOME;
		backup.USERPROFILE = process.env.USERPROFILE;
		backup.SystemRoot  = process.env.SystemRoot;
	});

	afterEach(() => {
		if (backup.HOME !== undefined) {
			process.env.HOME = backup.HOME;
		}
		if (backup.USERPROFILE !== undefined) {
			process.env.USERPROFILE = backup.USERPROFILE;
		}
		if (backup.SystemRoot !== undefined) {
			process.env.SystemRoot = backup.SystemRoot;
		}
	});

	const isWin = process.platform === 'win32';

	it('should resolve the home directory using HOME', () => {
		process.env.HOME = isWin ? 'C:\\Users\\username' : '/Users/username';
		delete process.env.USERPROFILE;

		const p = expand('~/foo');
		expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
	});

	it('should resolve the home directory using USERPROFILE', () => {
		delete process.env.HOME;
		process.env.USERPROFILE = isWin ? 'C:\\Users\\username' : '/Users/username';

		const p = expand('~/foo');
		expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
	});

	it('should collapse relative segments', () => {
		const p = expand('/path/./to/../foo');
		expect(p).to.equal(isWin ? 'C:\\path\\foo' : '/path/foo');
	});

	it('should resolve environment paths (Windows)', () => {
		process.env.SystemRoot = 'C:\\WINDOWS';
		const p = expand('%SystemRoot%\\foo');
		expect(isWin ? p : p.substring(process.cwd().length + 1)).to.equal('C:\\WINDOWS\\foo');
	});
});
