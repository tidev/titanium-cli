export function stripColor(str) {
	return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}
