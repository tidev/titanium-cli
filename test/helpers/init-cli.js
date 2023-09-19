import { execaNode } from 'execa';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHome } from './init-home.js';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ti = join(__dirname, '../../src/main.js');

export function initCLI(fixture, fn) {
	return async () => {
		if (typeof fixture === 'function') {
			fn = fixture;
			fixture = null;
		}

		const tmpHome = await initHome(fixture);

		try {
			return await fn((args = [], opts = {}) => execaNode(ti, args, {
				...opts,
				env: {
					...process.env,
					...opts.env,
					HOME: tmpHome
				}
			}));
		} finally {
			await fs.remove(tmpHome);
		}
	};
}
