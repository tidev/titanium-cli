import { execaNode } from 'execa';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHome } from './init-home.js';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ti = join(__dirname, '../../src/main.js');

export function initCLI(fixture, fn, sharedOpts = {}) {
	if (typeof fixture === 'function') {
		sharedOpts = fn || {};
		fn = fixture;
		fixture = null;
	}

	return async () => {
		const tmpHome = await initHome(fixture);

		try {
			return await fn({
				async run(args = [], opts = {}) {
					try {
						return await execaNode(ti, args, {
							...sharedOpts,
							...opts,
							env: {
								...process.env,
								...sharedOpts.env,
								...opts.env,
								HOME: tmpHome
							}
						});
					} catch (e) {
						return e;
					}
				},
				tmpHome
			});
		} finally {
			await fs.remove(tmpHome);
		}
	};
}
