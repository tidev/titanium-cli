import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import { join } from 'node:path';
import { initSDKHome } from '../helpers/init-sdk-home.js';
import { stripColor } from '../helpers/strip-color.js';

const tiapp = '<ti:app xmlns:ti="http://ti.appcelerator.org"><sdk-version>14.0.0.fixes</sdk-version></ti:app>';

async function addSDK(root, name) {
	const os = process.platform === 'darwin' ? 'osx' : process.platform;
	await fs.outputJson(join(root, 'mobilesdk', os, name, 'manifest.json'), {
		name,
		version: name.split('.').slice(0, 3).join('.'),
		platforms: []
	});
}

describe('missing project SDK', () => {
	for (const command of [ 'clean', 'build' ]) {
		it(`suggests an installed SDK for ${command} without changing the project`, initSDKHome(async ({ run, tmpHome, tmpSDKDir }) => {
			await addSDK(tmpSDKDir, '14.0.0.GA');
			const project = join(tmpHome, 'project');
			const file = join(project, 'tiapp.xml');
			await fs.outputFile(file, tiapp);

			const { stdout, stderr } = await run([command, '--no-prompt'], { cwd: project });
			const output = stripColor(stdout + stderr);

			expect(output).toContain('The <sdk-version> in the tiapp.xml is set to "14.0.0.fixes", but this version is not installed');
			expect(output).toContain('Available SDKs:');
			expect(output).toContain('Production Stable');
			expect(output).toContain(`titanium ${command} --sdk 14.0.0.GA`);
			expect(await fs.readFile(file, 'utf8')).toBe(tiapp);
		}));
	}

	for (const [label, versions, suggested] of [
		['prefers the latest stable SDK over a newer beta', ['13.4.1.GA', '14.0.0.GA', '14.1.0.beta'], '14.0.0.GA'],
		['uses the newest installed SDK when no stable SDK exists', ['14.0.0.rc', '14.1.0.beta'], '14.1.0.beta']
	]) {
		it(label, initSDKHome(async ({ run, tmpHome, tmpSDKDir }) => {
			for (const name of versions) {
				await addSDK(tmpSDKDir, name);
			}
			const project = join(tmpHome, 'project');
			await fs.outputFile(join(project, 'tiapp.xml'), tiapp);

			const { stdout, stderr } = await run(['clean', '--no-prompt'], { cwd: project });

			expect(stripColor(stdout + stderr)).toContain(`titanium clean --sdk ${suggested}`);
		}));
	}

	it('keeps the installation guidance when no SDK is installed', initSDKHome(async ({ run, tmpHome }) => {
		const project = join(tmpHome, 'project');
		await fs.outputFile(join(project, 'tiapp.xml'), tiapp);

		const { stdout, stderr } = await run(['clean', '--no-prompt'], { cwd: project });
		const output = stripColor(stdout + stderr);

		expect(output).toContain('No Titanium SDKs found');
		expect(output).toContain('titanium sdk install');
		expect(output).not.toContain('titanium clean --sdk');
	}));
});
