import { describe, it, expect } from 'vitest';
import { BusyIndicator } from '../../src/util/busyindicator.js';
import { setTimeout } from 'node:timers/promises';
import { MockStream } from '../helpers/mock-stream.js';

describe('BusyIndicator', () => {
	it('should render a busy indicator', async () => {
		const stream = new MockStream();
		const busy = new BusyIndicator(stream);

		busy.start();
		await setTimeout(200);

		busy.stop();
		expect(stream.buffer).toMatch(/ |\n \/\n -\n +\n/);

		stream.buffer = 'foo';
		await setTimeout(100);
		expect(stream.buffer).toBe('foo');
	});
});
