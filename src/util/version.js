import semver from 'semver';

const versionRegExp = /^(\d+)\.(\d+)\.(\d+)(?:\.(\w+))?/i;

/**
 * Compare function for sort().
 * @param {String} a - Version A
 * @param {String} b - Version B
 * @returns {Number}
 */
export function compare(a, b) {
	const [, amajor, aminor, apatch, atag] = format(a, 3).toLowerCase().match(versionRegExp);
	const [, bmajor, bminor, bpatch, btag] = format(b, 3).toLowerCase().match(versionRegExp);

	let n = parseInt(amajor) - parseInt(bmajor);
	if (n !== 0) {
		return n;
	}

	n = parseInt(aminor) - parseInt(bminor);
	if (n !== 0) {
		return n;
	}

	n = parseInt(apatch) - parseInt(bpatch);
	if (n !== 0) {
		return n;
	}

	if (atag && btag) {
		return atag.localeCompare(btag);
	}

	return atag ? 1 : btag ? -1 : 0;
}

/**
 * Formats a version based on a minimum and maximum number of segments.
 * @param {String} ver - The version
 * @param {Number} [min] - The minimum number of segments
 * @param {Number} [max] - The maximum number of segments
 * @param {Boolean} [chopDash] - If true, chops off the dash and anything after it
 * @returns {String} The formatted version
 */
export function format(ver, min, max, chopDash) {
	ver = String(ver || 0);
	chopDash && (ver = ver.replace(/(-.*)?$/, ''));
	ver = ver.split('.');
	if (min !== undefined) {
		while (ver.length < min) {
			ver.push('0');
		}
	}
	if (max !== undefined) {
		ver = ver.slice(0, max);
	}
	return ver.join('.');
}

/**
 * Converts two versions into 3 segment format, then checks if they are equal to each other.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the versions are equal
 */
export function eq(v1, v2) {
	return semver.eq(format(v1, 3, 3), format(v2, 3, 3));
}

/**
 * Converts two versions into 3 segment format, then checks if the first version is less than the
 * second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is less than the second version
 */
export function lt(v1, v2) {
	return semver.lt(format(v1, 3, 3), format(v2, 3, 3));
}

/**
 * Converts two versions into 3 segment format, then checks if the first version is less than or
 * equal to the second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is less than or equal to the second version
 */
export function lte(v1, v2) {
	return semver.lte(format(v1, 3, 3), format(v2, 3, 3));
}

/**
 * Converts two versions into 3 segment format, then checks if the first version is greater than the
 * second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is greater than the second version
 */
export function gt(v1, v2) {
	return semver.gt(format(v1, 3, 3), format(v2, 3, 3));
}

/**
 * Converts two versions into 3 segment format, then checks if the first version is greater than or
 * equal to the second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is greater than or equal to the second version
 */
export function gte(v1, v2) {
	return semver.gte(format(v1, 3, 3), format(v2, 3, 3));
}

/**
 * Checks if a version is valid.
 * @param {String} v - The version to validate
 * @returns {Boolean}
 */
export function isValid(v) {
	return semver.valid(format(v, 3, 3));
}

/**
 * Determines the most minimum value of the supplied range.
 * @param {String} str - A string contain one or more versions or version ranges
 * @returns {String} The minimum version found or undefined
 */
export function parseMin(str) {
	let min;

	for (const range of str.split(/\s*\|\|\s*/)) {
		const x = range.split(' ').shift().replace(/[^.\d]/g, '');
		if (!min || lt(x, min)) {
			min = x.replace(/\.$/, '');
		}
	}

	return min;
}

/**
 * Determines the most maximum value of the supplied range.
 * @param {String} str - A string contain one or more versions or version ranges
 * @param {Boolean} [allowX=false] - When true, treats 'x' as apart of the version
 * @returns {String} The maximum version found or undefined
 */
export function parseMax(str, allowX) {
	let max, lt;

	for (const range of str.split(/\s*\|\|\s*/)) {
		let x = range.split(' ');
		x = x.length === 1 ? x.shift() : x.slice(1).shift();
		allowX || (x = x.replace(/.x$/i, ''));
		const y = x.replace(allowX ? /[^.xX\d]/g : /[^.\d]/g, '');
		if (!max || gt(y, max)) {
			lt = /^<[^=]\d/.test(x);
			max = y.replace(/\.$/, '');
		}
	}

	return (lt ? '<' : '') + max;
}

/**
 * Checks if a version is in any of the supplied ranges.
 * @param {String} ver - The version to check
 * @param {String} str - The version ranges to validate against
 * @param {Boolean} [maybe] - If true and the version is greater than at least
 * one of the ranges, then it will return 'maybe'.
 * @returns {Boolean|String} True if the version matches one of the ranges
 */
export function satisfies(ver, str, maybe) {
	ver = format(ver, 3, 3, true);

	// if we get 1.x, we force it to 1.99999999 so that we should match
	str = str.replace(/(<=?\d+(\.\d+)*?)\.x/g, '$1.99999999').replace(/(>=?\d+(\.\d+)*?)\.x/g, '$1.0');

	try {
		if (str === '*' || eq(ver, str)) {
			return true;
		}
	} catch {}

	const r = str.split(/\s*\|\|\s*/).some(range => {
		// semver is picky with the '-' in comparisons and it just so happens when it
		// parses versions in the range, it will add '-0' and cause '1.0.0' != '1.0.0-0',
		// so we test our version with and without the '-9'
		return range === '*' || semver.satisfies(ver, range) || (ver.indexOf('-') === -1 && semver.satisfies(ver + '-0', range));
	});

	// if true or we don't care if it maybe matches, then return now
	if (r || !maybe) {
		return r;
	}

	// need to determine if the version is greater than any range
	const range = new semver.Range(str);
	for (let i = 0; i < range.set.length; i++) {
		const set = range.set[i];
		for (let j = set.length - 1; j >= 0; j--) {
			if (set[j].semver instanceof semver.SemVer) {
				if ((set[j].operator === '<' || set[j].operator === '<=') && !semver.cmp(ver, set[j].operator, set[j].semver, set[j].loose)) {
					return 'maybe';
				}
				break;
			}
		}
	}

	return false;
}

/**
 * Sorts an array of version numbers in ascending order.
 * @param {Array} arr - The array of version numbers to sort
 * @returns {Array} The sorted versions
 */
export function sort(arr) {
	return arr.sort(compare);
}
