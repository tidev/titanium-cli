import { describe, it, expect } from 'vitest';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti project', () => {
	it('should show help', initMockSDKHome(async ({ run, _tmpSDKDir }) => {
		const { exitCode, stdout } = await run(['project', '-h']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Titanium Command-Line Interface/);
		expect(output).toMatch(/Usage: titanium project \[options\]/);
		expect(output).toMatch(/Get and set tiapp.xml settings./);
		expect(output).toMatch(/Project Arguments:/);
		expect(output).toMatch(/Project Options:/);
		expect(output).toMatch(/Global Options:/);

		expect(exitCode).toBe(0);
	}));
});
