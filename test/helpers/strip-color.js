export function stripColor(str) {
	// eslint-disable-next-line no-control-regex
	return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}
