import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProgressBar } from '../../src/util/progress.js';
import { MockStream } from '../helpers/mock-stream.js';

describe('progress', () => {
	it('should render a progress bar', async () => {
		const stream = new MockStream();
		const bar = new ProgressBar(
			':paddedPercent [:bar] :current of :total (:percent)',
			{
				complete: '=',
				incomplete: '.',
				width: 40,
				total: 10,
				stream
			}
		);

		await new Promise(resolve => {
			let timer = setInterval(() => {
				bar.tick();
				if (bar.complete) {
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});

		assert.strictEqual(
			stream.buffer,
			' 10%  [====....................................] 1 of 10 (10%)\n'
			+ ' 20%  [========................................] 2 of 10 (20%)\n'
			+ ' 30%  [============............................] 3 of 10 (30%)\n'
			+ ' 40%  [================........................] 4 of 10 (40%)\n'
			+ ' 50%  [====================....................] 5 of 10 (50%)\n'
			+ ' 60%  [========================................] 6 of 10 (60%)\n'
			+ ' 70%  [============================............] 7 of 10 (70%)\n'
			+ ' 80%  [================================........] 8 of 10 (80%)\n'
			+ ' 90%  [====================================....] 9 of 10 (90%)\n'
			+ '100%  [========================================] 10 of 10 (100%)\n'
		);
	});

	it('should render a progress bar with swapped tick() params', async () => {
		const stream = new MockStream();
		const bar = new ProgressBar(
			':paddedPercent [:bar] :current of :total (:percent)',
			{
				complete: '=',
				incomplete: '.',
				width: 40,
				total: 10,
				stream
			}
		);

		await new Promise(resolve => {
			let timer = setInterval(() => {
				bar.tick({}, 1);
				if (bar.complete) {
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});

		assert.strictEqual(
			stream.buffer,
			' 10%  [====....................................] 1 of 10 (10%)\n'
			+ ' 20%  [========................................] 2 of 10 (20%)\n'
			+ ' 30%  [============............................] 3 of 10 (30%)\n'
			+ ' 40%  [================........................] 4 of 10 (40%)\n'
			+ ' 50%  [====================....................] 5 of 10 (50%)\n'
			+ ' 60%  [========================................] 6 of 10 (60%)\n'
			+ ' 70%  [============================............] 7 of 10 (70%)\n'
			+ ' 80%  [================================........] 8 of 10 (80%)\n'
			+ ' 90%  [====================================....] 9 of 10 (90%)\n'
			+ '100%  [========================================] 10 of 10 (100%)\n'
		);
	});

	it('should render custom tokens', async () => {
		const stream = new MockStream();
		const bar = new ProgressBar(
			':paddedPercent [:bar] :decimal',
			{
				complete: '=',
				incomplete: '.',
				width: 40,
				total: 10,
				stream
			}
		);

		await new Promise(resolve => {
			let timer = setInterval(() => {
				bar.tick(1, {
					decimal: ((bar.curr + 1) / bar.total).toFixed(1)
				});
				if (bar.complete) {
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});

		assert.strictEqual(
			stream.buffer,
			' 10%  [====....................................] 0.1\n'
			+ ' 20%  [========................................] 0.2\n'
			+ ' 30%  [============............................] 0.3\n'
			+ ' 40%  [================........................] 0.4\n'
			+ ' 50%  [====================....................] 0.5\n'
			+ ' 60%  [========================................] 0.6\n'
			+ ' 70%  [============================............] 0.7\n'
			+ ' 80%  [================================........] 0.8\n'
			+ ' 90%  [====================================....] 0.9\n'
			+ '100%  [========================================] 1.0\n'
		);
	});
});
