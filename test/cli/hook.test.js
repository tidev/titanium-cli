import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CLI } from '../../src/cli.js';
import { setTimeout } from 'timers/promises';

describe('CLI hooks', () => {
	it('should fire sync event hooks', async () => {
		const cli = new CLI();
		let fooCounter = 0;
		let barCounter = 0;
		let bazPreCounter = 0;
		let bazPostCounter = 0;

		cli.on('foo', data => {
			fooCounter += data.count;
		});

		cli.addHook('bar', () => {
			barCounter++;
		});

		cli.addHook('baz', {
			pre() {
				bazPreCounter++;
			},
			post() {
				bazPostCounter++;
			}
		});

		await cli.emit('foo', { count: 2 });
		assert.strictEqual(fooCounter, 2);

		await cli.emit('bar');
		assert.strictEqual(barCounter, 1);

		await cli.emit('baz');
		assert.strictEqual(bazPreCounter, 1);
		assert.strictEqual(bazPostCounter, 1);
	});

	it('should fire async event hooks', async () => {
		const cli = new CLI();

		let fooCounter = 0;

		cli.on('foo', async data => {
			await setTimeout(1);
			fooCounter += data.count;
		});

		await cli.emit('foo', { count: 2 });
		assert.strictEqual(fooCounter, 2);

		let barCounter = 0;

		cli.addHook('bar', async () => {
			await setTimeout(1);
			barCounter++;
		});

		await cli.emit('bar');
		assert.strictEqual(barCounter, 1);
	});

	it('should fire function hooks', async () => {
		const cli = new CLI();
		let fooCounter = 0;

		cli.on('foo', data => {
			fooCounter += data.ctx.count;
		});

		const foo = cli.createHook('foo', { count: 2 }, function (x, cb) {
			fooCounter += x;
			fooCounter += this.count;
			cb();
		});
		await new Promise(resolve => foo(3, resolve));
		assert.strictEqual(fooCounter, 7);

		let barCounter = 0;

		cli.on('bar', {
			pre() {
				barCounter++;
			},
			post(data) {
				barCounter += data.result[0];
			}
		});

		const bar = cli.createHook('bar', cb => {
			barCounter += 3;
			cb(9);
		});
		await new Promise(resolve => bar(resolve));
		assert.strictEqual(barCounter, 13);
	});

	it('should fire event hook with a data payload', async () => {
		const cli = new CLI();
		let foo = {
			counter: 0
		};

		cli.on('foo', {
			priority: 1200,
			post: async (data, callback) => {
				data.counter++;
				callback();
			}
		});

		await new Promise((resolve, reject) => {
			const r = cli.emit('foo', foo, err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});

		assert.strictEqual(foo.counter, 1);
	});
});
