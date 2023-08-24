/**
 * Removes duplicates from an array and returns a new array.
 *
 * @param {Array} arr - The array to remove duplicates.
 * @returns {Array}
 */
export function unique(arr) {
	const len = Array.isArray(arr) ? arr.length : 0;

	if (len === 0) {
		return [];
	}

	return arr.reduce((prev, cur) => {
		if (typeof cur !== 'undefined' && cur !== null) {
			if (!prev.includes(cur)) {
				prev.push(cur);
			}
		}
		return prev;
	}, []);
}
