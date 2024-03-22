export class MockStream {
	buffer = '';

	cursorTo(n) {
		// noop
	}

	write(str) {
		this.buffer += str + '\n';
	}
}
