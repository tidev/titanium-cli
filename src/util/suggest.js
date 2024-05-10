import chalk from 'chalk';

const { cyan } = chalk;

export function suggest(value, choices, threshold = 3) {
	value = `${value}`;

	const suggestions = choices.filter(choice => {
		return choice.startsWith(value) || levenshtein(value, choice) <= threshold;
	});

	return suggestions.length
		? `Did you mean this?\n${suggestions.map(s => `    ${cyan(s)}`).join('\n')}\n\n`
		: '';
}

/**
 * Measures the distance between two strings.
 * @param {String} s - The first string
 * @param {String} c - The second string
 * @returns {Number} The distance
 */
function levenshtein(s, c) {
	var len1 = (s = s.split('')).length,
		len2 = (c = c.split('')).length,
		a = [],
		i = len1 + 1,
		j;

	for (; i; a[--i] = [i]) {
		//
	}
	for (i = len2 + 1; a[0][--i] = i;) {
		//
	}
	for (i = -1; ++i < len1;) {
		for (j = -1; ++j < len2;) {
			a[i + 1][j + 1] = Math.min(a[i][j + 1] + 1, a[i + 1][j] + 1, a[i][j] + (s[i] != c[j]));
		}
	}
	return a[len1][len2];
}
