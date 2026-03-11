import { initMockSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';
import { describe, expect, it } from 'vitest';

describe('ti build', () => {
	it(
		'should show help',
		initMockSDKHome(async ({ run }) => {
			const { exitCode, stdout } = await run(['build', '-h']);

			const output = stripColor(stdout);
			expect(output).toMatch(/Titanium Command-Line Interface/);
			expect(output).toMatch(/Usage: titanium build \[options\]/);
			expect(output).toMatch(/Builds an existing app or module project./);
			expect(output).toMatch(/Build Options:/);
			expect(output).toMatch(/Global Options:/);

			expect(exitCode).toBe(0);
		})
	);
});
