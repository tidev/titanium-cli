/**
 * Ensures that a value is an array. If not, it wraps the value in an array.
 *
 * @param {*} it - The value to ensure is an array.
 * @param {Boolean} [removeFalsey=false] - When `true`, filters out all falsey items.
 * @returns {Array}
 */
export function arrayify(it, removeFalsey) {
	const arr = typeof it === 'undefined' ? [] : it instanceof Set ? Array.from(it) : Array.isArray(it) ? it : [it];
	return removeFalsey ? arr.filter(v => typeof v !== 'undefined' && v !== null && v !== '' && v !== false && (typeof v !== 'number' || !isNaN(v))) : arr;
}
