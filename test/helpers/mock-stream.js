export class MockStream {
	buffer = '';

	cursorTo(_n) {
		// noop
	}

	write(str) {
		this.buffer += str + '\n';
	}
}
