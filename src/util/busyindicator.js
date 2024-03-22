export class BusyIndicator {
	timer = null;
	running = false;
	margin = ' ';
	sprites = ['|', '/', '-', '\\'];
	current = 0;

	constructor(stream = process.stdout) {
		this.stream = stream;
	}

	render() {
		this.stream.cursorTo && this.stream.cursorTo(0);
		this.stream.write(this.margin + this.sprites[this.current++]);
		if (this.current >= this.sprites.length) {
			this.current = 0;
		}
		this.timer = setTimeout(() => this.render(), 60);
	}

	/**
	 * Starts rendering the busy indicator.
	 */
	start() {
		if (!this.running) {
			this.running = true;
			this.render();
		}
	}

	/**
	 * Stops rendering the busy indicator.
	 */
	stop() {
		clearTimeout(this.timer);
		if (this.running) {
			this.running = false;
			this.stream.cursorTo && this.stream.cursorTo(0);
			this.stream.write(' '.repeat(this.margin.length + 2));
			this.stream.cursorTo && this.stream.cursorTo(0);
		}
	}
}
