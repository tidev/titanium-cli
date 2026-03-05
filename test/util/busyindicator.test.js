import { BusyIndicator } from '../../src/util/busyindicator.js';
import { MockStream } from '../helpers/mock-stream.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';

describe('BusyIndicator', () => {
	it('should render a busy indicator', async () => {
		const stream = new MockStream();
		const busy = new BusyIndicator(stream);

		busy.start();
		await setTimeout(200);

		busy.stop();
		assert.match(stream.buffer, / |\n \/\n -\n +\n/);

		stream.buffer = 'foo';
		await setTimeout(100);
		assert.strictEqual(stream.buffer, 'foo');
	});
});
