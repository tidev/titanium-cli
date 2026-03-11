import { initMockSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';
import { describe, expect, it } from 'vitest';

describe('ti project', () => {
	it(
		'should show help',
		initMockSDKHome(async ({ run }) => {
			const { exitCode, stdout } = await run(['project', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium project \[options\]/);
			expect(output).toMatch(/Get and set tiapp.xml settings./);
			expect(output).toMatch(/Project Arguments:/);
			expect(output).toMatch(/Project Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);
});
