import { describe, expect, it } from 'vitest';
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
		expect(columns([
			'foo',
			'bar'
		])).toEqual('foo      bar');
	});

	it('should render columns with margin', () => {
		expect(columns([
			'foo',
			'bar'
		], '  ')).toEqual('  foo      bar');
	});

	it('should render lots of data in columns with wrapping', () => {
		expect(columns(data, '  ', 50)).toEqual([
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
		expect(columns(data, '  ', 1000)).toEqual([
			'  aaaa      eeee      iiii      mmmm      qqqq      uuuu      yyyy',
			'  bbbb      ffff      jjjj      nnnn      rrrr      vvvv      zzzz',
			'  cccc      gggg      kkkk      oooo      ssss      wwww',
			'  dddd      hhhh      llll      pppp      tttt      xxxx'
		].join('\n'));
	});

	it('should render lots of data with zero width', () => {
		expect(columns(data, '  ', 0)).toEqual([
			'  aaaa      eeee      iiii      mmmm      qqqq      uuuu      yyyy',
			'  bbbb      ffff      jjjj      nnnn      rrrr      vvvv      zzzz',
			'  cccc      gggg      kkkk      oooo      ssss      wwww',
			'  dddd      hhhh      llll      pppp      tttt      xxxx'
		].join('\n'));
	});
});
