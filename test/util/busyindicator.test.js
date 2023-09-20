import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BusyIndicator } from '../../src/util/busyindicator.js';
import { setTimeout } from 'node:timers/promises';

class MockStream {
	buffer = '';

	cursorTo(n) {
		// noop
	}

	write(str) {
		this.buffer = str;
	}
}

describe('BusyIndicator', { concurrency: true }, () => {
	it('should render a busy indicator', async () => {
		const stream = new MockStream();
		const busy = new BusyIndicator(stream);

		busy.start();
		await setTimeout(200);

		busy.stop();
		assert.match(stream.buffer, /^ +$/);

		stream.buffer = 'foo';
		await setTimeout(100);
		assert.strictEqual(stream.buffer, 'foo');
	});
});
