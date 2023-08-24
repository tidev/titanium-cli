export class BusyIndicator {
	_timer = null;
	_running = false;
	margin = ' ';
	sprites = ['|', '/', '-', '\\'];
	current = 0;

	/**
	 * Starts rendering the busy indicator.
	 */
	start() {
		const render = () => {
			process.stdout.cursorTo && process.stdout.cursorTo(0);
			process.stdout.write(this.margin + this.sprites[this.current++]);
			if (this.current >= this.sprites.length) {
				this.current = 0;
			}
			this._timer = setTimeout(render, 60);
		};

		if (!this._running) {
			this._running = true;
			render();
		}
	}

	/**
	 * Stops rendering the busy indicator.
	 */
	stop() {
		clearTimeout(this._timer);
		if (this._running) {
			this._running = false;
			process.stdout.cursorTo && process.stdout.cursorTo(0);
			process.stdout.write(new Array(this.margin.length + 2).join(' '));
			process.stdout.cursorTo && process.stdout.cursorTo(0);
		}
	}
}
