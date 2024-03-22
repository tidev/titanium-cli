/**
 * Capitalizes the specified string. Only the first character is uppercased.
 * @param {String} s - The string to capitalize
 * @returns {String} The capitalized string
 */
export function capitalize(s) {
	return s.substring(0, 1).toUpperCase() + s.substring(1);
}
