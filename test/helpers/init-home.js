import { tmpDirName } from '../helpers/tmp-dir-name.js';
import { cp, mkdir } from 'node:fs/promises';

export async function initHome(fixture) {
	const tmpHome = tmpDirName();
	if (fixture) {
		await cp(fixture, tmpHome);
	} else {
		await mkdir(tmpHome, { recursive: true });
	}

	return tmpHome;
}
