import { initCLI } from './init-cli.js';
import { tmpDirName } from './tmp-dir-name.js';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export function initSDKHome(fn, mock) {
	const tmpSDKDir = tmpDirName();

	if (mock) {
		const os = process.platform === 'darwin' ? 'osx' : process.platform;
		fs.copySync(
			join(fileURLToPath(import.meta.url), '../../mock-sdk'),
			join(tmpSDKDir, 'mobilesdk', os, '0.0.0.GA')
		);
	}

	return initCLI(async (opts) => {
		const { run } = opts;
		try {
			await run(['config', 'paths.sdks', tmpSDKDir]);
			await run(['config', 'sdk.defaultInstallLocation', tmpSDKDir]);
			await fn({
				...opts,
				tmpSDKDir
			});
		} finally {
			await fs.remove(tmpSDKDir);
		}
	});
}

export function initMockSDKHome(fn) {
	return initSDKHome(fn, true);
}
