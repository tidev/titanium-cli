export class TiError extends Error {
	constructor(msg, meta = {}) {
		super(msg);
		Object.assign(this, meta);
	}
}
