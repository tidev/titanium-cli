import { describe, it } from 'node:test';
import assert from 'node:assert';
import { columns } from '../../src/util/columns.js';

const data = [
	'aaaa',
	'bbbb',
	'cccc',
	'dddd',
	'eeee',
	'ffff',
	'gggg',
	'hhhh',
	'iiii',
	'jjjj',
	'kkkk',
	'llll',
	'mmmm',
	'nnnn',
	'oooo',
	'pppp',
	'qqqq',
	'rrrr',
	'ssss',
	'tttt',
	'uuuu',
	'vvvv',
	'wwww',
	'xxxx',
	'yyyy',
	'zzzz'
];

describe('columns', () => {
	it('should render columns with no wrapping', () => {
		assert.strictEqual(columns([
			'foo',
			'bar'
		]), 'foo      bar');
	});

	it('should render columns with margin', () => {
		assert.strictEqual(columns([
			'foo',
			'bar'
		], '  '), '  foo      bar');
	});

	it('should render lots of data in columns with wrapping', () => {
		assert.strictEqual(columns(data, '  ', 50), [
			'  aaaa      hhhh      oooo      vvvv',
			'  bbbb      iiii      pppp      wwww',
			'  cccc      jjjj      qqqq      xxxx',
			'  dddd      kkkk      rrrr      yyyy',
			'  eeee      llll      ssss      zzzz',
			'  ffff      mmmm      tttt',
			'  gggg      nnnn      uuuu'
		].join('\n'));
	});

	it('should render lots of data with huge width', () => {
		assert.strictEqual(columns(data, '  ', 1000), [
			'  aaaa      eeee      iiii      mmmm      qqqq      uuuu      yyyy',
			'  bbbb      ffff      jjjj      nnnn      rrrr      vvvv      zzzz',
			'  cccc      gggg      kkkk      oooo      ssss      wwww',
			'  dddd      hhhh      llll      pppp      tttt      xxxx'
		].join('\n'));
	});

	it('should render lots of data with zero width', () => {
		assert.strictEqual(columns(data, '  ', 0), [
			'  aaaa      eeee      iiii      mmmm      qqqq      uuuu      yyyy',
			'  bbbb      ffff      jjjj      nnnn      rrrr      vvvv      zzzz',
			'  cccc      gggg      kkkk      oooo      ssss      wwww',
			'  dddd      hhhh      llll      pppp      tttt      xxxx'
		].join('\n'));
	});
});
