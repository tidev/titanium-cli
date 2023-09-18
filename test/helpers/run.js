import { execaNode } from 'execa';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ti = join(__dirname, '../../src/main.js');

async function initHome(fixture) {
	const tmpHome = join(tmpdir(), `titanium-cli-${Math.floor(Math.random() * 1e6)}`);
	if (fixture) {
		await fs.copy(fixture, tmpHome);
	} else {
		await fs.mkdirp(tmpHome);
	}

	return tmpHome;
}

export async function run(args, opts = {}) {
	const tmpHome = await initHome(opts.home);
	try {
		return await execaNode(ti, args, {
			env: {
				...process.env,
				HOME: tmpHome
			}
		});
	} finally {
		await fs.remove(tmpHome);
	}
}
