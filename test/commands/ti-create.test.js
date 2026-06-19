import { describe, it, expect } from 'vitest';
import { stripColor } from '../helpers/strip-color.js';
import { initMockSDKHome } from '../helpers/init-sdk-home.js';

describe('ti create', () => {
	it('should show help', initMockSDKHome(async ({ run }) => {
		const { exitCode, stdout } = await run(['create', '-h']);

		const output = stripColor(stdout);
		expect(output).toMatch(/Titanium Command-Line Interface/);
		expect(output).toMatch(/Usage: titanium create \[options\]/);
		expect(output).toMatch(/Creates a new Titanium application, native module, or Apple Watch™ app./);
		expect(output).toMatch(/Create Options:/);
		expect(output).toMatch(/Create --type=app Options:/);
		expect(output).toMatch(/Create --type=module Options:/);
		expect(output).toMatch(/Global Options:/);

		expect(exitCode).toBe(0);
	}));
});
