import chalk from 'chalk';
import { EventEmitter } from 'node:events';
import { format } from 'node:util';

const { bold, cyan, gray, green, magenta, red, yellow } = chalk;

const ansiRE = /\x1B\[\d+m/g;

export class Logger extends EventEmitter {
	#banner = '';
	#bannerEnabled = true;
	#skipBanner = false;
	#bannerRendered = false;
	#level = 3;
	#timestampEnabled = false;

	levels = {
		trace: 1,
		debug: 2,
		info: 3,
		warn: 4,
		error: 5
		// log: 9
		// silent: 10
	};

	constructor(logLevel, opts = {}) {
		super();

		this.stdout = opts.stdout || process.stdout;
		this.stderr = opts.stderr || process.stderr;

		this.log = (msg = '', ...args) => {
			this.render(9, this.stdout, format(msg, ...args));
		};

		this.logerr = (msg = '', ...args) => {
			this.render(9, this.stderr, format(msg, ...args));
		};

		this.trace = (msg = '', ...args) => {
			this.render(1, this.stderr, gray(`[TRACE] ${format(msg, ...args)}`));
		};

		this.debug = (msg = '', ...args) => {
			this.render(2, this.stderr, `${magenta('[DEBUG]')} ${format(msg, ...args)}`);
		};

		this.info = (msg = '', ...args) => {
			this.render(3, this.stdout, `${green('[INFO]')}  ${format(msg, ...args)}`);
		};

		this.warn = (msg = '', ...args) => {
			this.render(4, this.stderr, `${yellow(`[WARN]  ${format(msg, ...args).replace(ansiRE, '')}`)}`);
		};

		this.error = (msg = '', ...args) => {
			this.render(5, this.stderr, red(`[ERROR] ${format(msg, ...args).replace(ansiRE, '')}`));
		};

		if (logLevel !== undefined) {
			this.setLevel(logLevel);
		}
	}

	banner() {
		if (this.#bannerEnabled && !this.#skipBanner && this.#level && !this.#bannerRendered) {
			this.stdout.write(this.#banner);
			this.stdout.write('\n');
			this.#bannerRendered = true;
			this.emit('cli:logger-banner');
		}
	}

	// get or set the bannerEnabled flag
	bannerEnabled(b) {
		if (b !== undefined) {
			this.#bannerEnabled = !!b;
		}
		return this.#bannerEnabled;
	}

	bannerWasRendered() {
		return this.#bannerRendered;
	}

	getBanner() {
		return this.#banner;
	}

	getLevels() {
		return Object.keys(this.levels);
	}

	render(level, out, msg) {
		if (level >= this.#level) {
			if (this.#timestampEnabled) {
				out.write(gray(`${new Date().toISOString()} - `));
			}
			out.write(msg);
			out.write('\n');
		}
	}

	setBanner({ name, copyright, version, sdkVersion }) {
		this.#banner = `${bold(cyan(name))} v${version}${
			sdkVersion ? ` SDK v${sdkVersion}` : ''
		}\n${
			copyright
		}\n\nWant to help? ${
			cyan('https://tidev.io/donate')
		} or ${
			cyan('https://tidev.io/contribute')
		}\n`;
	}

	setLevel(level) {
		if (typeof level === 'string' && this.levels[level]) {
			this.#level = this.levels[level];
		} else if (typeof level === 'number') {
			this.#level = level;
		}
	}

	silence() {
		this.#level = 10;
	}

	skipBanner(b) {
		if (b !== undefined) {
			this.#skipBanner = !!b;
		}
		return this.#skipBanner;
	}

	timestampEnabled(b) {
		if (b !== undefined) {
			this.#timestampEnabled = !!b;
		}
		return this.#timestampEnabled;
	}
}
