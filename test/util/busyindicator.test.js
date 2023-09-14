import { describe, expect, it } from 'vitest';
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

describe('BusyIndicator', () => {
	it('should render a busy indicator', async () => {
		const stream = new MockStream();
		const busy = new BusyIndicator(stream);

		busy.start();
		await setTimeout(200);

		busy.stop();
		expect(stream.buffer).toMatch(/^ +$/);

		stream.buffer = 'foo';
		await setTimeout(100);
		expect(stream.buffer).toEqual('foo');
	});
});
