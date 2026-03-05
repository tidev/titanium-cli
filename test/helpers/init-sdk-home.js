import { initCLI } from './init-cli.js';
import { tmpDirName } from './tmp-dir-name.js';
import { cpSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function initSDKHome(fn, mock) {
	const tmpSDKDir = tmpDirName();

	if (mock) {
		const os = process.platform === 'darwin' ? 'osx' : process.platform;
		const dest = join(tmpSDKDir, 'mobilesdk', os, '0.0.0.GA');
		mkdirSync(dirname(dest), { recursive: true });
		cpSync(join(fileURLToPath(import.meta.url), '../../mock-sdk'), dest, { recursive: true });
	}

	return initCLI(async (opts) => {
		const { run } = opts;
		try {
			await run(['config', 'paths.sdks', tmpSDKDir]);
			await run(['config', 'sdk.defaultInstallLocation', tmpSDKDir]);
			await fn({
				...opts,
				tmpSDKDir,
			});
		} finally {
			await rm(tmpSDKDir, { force: true, recursive: true });
		}
	});
}

export function initMockSDKHome(fn) {
	return initSDKHome(fn, true);
}
