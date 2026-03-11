#!/usr/bin/env node
/**
 * Builds node-titanium-sdk in a temp directory (outside node_modules) because
 * tsdown refuses to process config files under node_modules.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const sdkPath = join(root, 'node_modules', 'node-titanium-sdk');

if (!existsSync(sdkPath) || existsSync(join(sdkPath, 'dist'))) {
	process.exit(0);
}

const sdkRealPath = realpathSync(sdkPath);

const buildDir = join(tmpdir(), `node-titanium-sdk-build-${process.pid}`);
try {
	mkdirSync(buildDir, { recursive: true });
	for (const entry of readdirSync(sdkRealPath, { withFileTypes: true })) {
		cpSync(join(sdkRealPath, entry.name), join(buildDir, entry.name), {
			recursive: true,
			dereference: true,
		});
	}
	await execa('pnpm', ['install'], { cwd: buildDir });
	await execa('pnpm', ['run', 'build'], { cwd: buildDir });
	cpSync(join(buildDir, 'dist'), join(sdkPath, 'dist'), { recursive: true });
} finally {
	rmSync(buildDir, { recursive: true, force: true });
}
