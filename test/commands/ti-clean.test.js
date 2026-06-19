import { describe, it, expect } from 'vitest';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti clean', () => {
	it('should show help', initMockSDKHome(async ({ run }) => {
		const { exitCode, stdout } = await run(['clean', '-h']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Titanium Command-Line Interface/);
		expect(output).toMatch(/Usage: titanium clean \[options\]/);
		expect(output).toMatch(/Removes previous build directories./);
		expect(output).toMatch(/Clean Options:/);
		expect(output).toMatch(/Global Options:/);

		expect(exitCode).toBe(0);
	}));
});
