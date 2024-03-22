import { join, resolve } from 'node:path';

const homeDirRegExp = /^~([\\|/].*)?$/;
const winRegExp = /^win/;
const winEnvVarRegExp = /(%([^%]*)%)/g;

export function expand(...segments) {
	segments[0] = segments[0].replace(homeDirRegExp, (process.env.HOME || process.env.USERPROFILE) + '$1');
	if (winRegExp.test(process.platform)) {
		return resolve(join(...segments).replace(winEnvVarRegExp, (_s, m, n) => {
			return process.env[n] || m;
		}));
	}
	return resolve(...segments);
}
