/**
 * Helper function to renders an array of items into columns.
 * @param {Array} items - The items to render
 * @param {String} margin - The left margin
 * @param {Number} [maxwidth=80] - The the maximum width before wrapping
 * @returns {String} The rendered columns
 */
export function columns(items, margin = '', maxwidth = 80) {
	const longest = items.reduce((a, b) => {
		return Math.max(a, b.length);
	}, 0) + 6;
	const curwidth = process.stdout.columns || 80;
	const width = maxwidth ? Math.min(maxwidth, curwidth) : curwidth;
	const len = items.length;

	margin = String(margin);
	const cols = Math.floor((width - margin.length) / longest);
	const rows = Math.ceil(len / cols);

	let buffer = '';
	for (let i = 0; i < rows; i++) {
		buffer += margin;
		for (let j = 0; j < len; j += rows) {
			if (j + i < len) {
				buffer += items[i + j];
				const spaces = longest - items[i + j].length;
				if (spaces > 0 && j + i + rows < len) {
					buffer += ' '.repeat(spaces);
				}
			}
		}
		if (i + 1 < rows) {
			buffer += '\n';
		}
	}

	return buffer;
}
