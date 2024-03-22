import { tmpDirName } from '../helpers/tmp-dir-name.js';
import fs from 'fs-extra';

export async function initHome(fixture) {
	const tmpHome = tmpDirName();
	if (fixture) {
		await fs.copy(fixture, tmpHome);
	} else {
		await fs.mkdirp(tmpHome);
	}

	return tmpHome;
}
