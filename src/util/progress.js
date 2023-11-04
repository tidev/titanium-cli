export class ProgressBar {
	curr = 0;

	constructor(fmt, opts = {}) {
		this.fmt = fmt;
		this.total = opts.total;
		this.width = opts.width || this.total;
		this.stream = opts.stream || process.stdout;

		this.chars = {
			complete: opts.complete || '=',
			incomplete: opts.incomplete || '-'
		};
	}

	tick(len, tokens) {
		if (len !== 0) {
			len = len || 1;
		}

		// swap tokens
		if (len && typeof len === 'object') {
			tokens = len;
			len = 1;
		}

		// start time for eta
		if (this.curr === 0) {
			this.start = new Date();
		}

		// progress complete
		if ((this.curr += len) > this.total) {
			this.complete = true;
			return;
		}

		const percent = this.curr / this.total * 100;
		let complete = Math.round(this.width * (this.curr / this.total));
		let incomplete = this.width - complete;
		const elapsed = new Date() - this.start;
		const eta = elapsed * (this.total / this.curr - 1);

		complete = Array(complete + 1).join(this.chars.complete);
		incomplete = Array(incomplete + 1).join(this.chars.incomplete);

		// The extra space at the end prevents shrinking progress bars from ghosting
		let str = this.fmt
			.replace(':bar', complete + incomplete)
			.replace(':current', this.curr)
			.replace(':total', this.total)
			.replace(':elapsed', (elapsed / 1000).toFixed(1))
			.replace(':eta', (eta / 1000).toFixed(1))
			.replace(':percent', percent.toFixed(0) + '%')
			.replace(':paddedPercent', `${percent.toFixed(0)}% `.padStart(5));

		if (tokens) {
			for (const [key, value] of Object.entries(tokens)) {
				str = str.replace(`:${key}`, value);
			}
		}

		if (str !== this.str) {
			this.str = str;
			this.stream.cursorTo?.(0);
			this.stream.write(str);
		}
	}
}
