import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as version from '../../src/util/version.js';

describe('version', () => {
	describe('compare', () => {
		it('should compare two versions', () => {
			assert(version.compare('1.0.0', '2.0.0') < 0);
			assert(version.compare('2.0.0', '1.0.0') > 0);
			assert.strictEqual(version.compare('1.0.0', '1.0.0'), 0);

			assert(version.compare('1.1.0', '1.2.0') < 0);
			assert(version.compare('1.2.0', '1.1.0') > 0);
			assert.strictEqual(version.compare('1.1.0', '1.1.0'), 0);

			assert(version.compare('1.1.1', '1.1.2') < 0);
			assert(version.compare('1.1.2', '1.1.1') > 0);
			assert.strictEqual(version.compare('1.1.1', '1.1.1'), 0);

			assert(version.compare('1.0.0.v20220102', '1.0.0.v20230809') < 0);
			assert(version.compare('1.0.0.v20230809', '1.0.0.v20220102') > 0);
			assert.strictEqual(version.compare('1.0.0.v20220102', '1.0.0.v20220102'), 0);

			assert(version.compare('1.0.0', '1.0.0.v20220102') < 0);
			assert(version.compare('1.0.0.v20220102', '1.0.0') > 0);
		});
	});

	describe('format', () => {
		it('should format a version', () => {
			assert.strictEqual(version.format(0), '0');
			assert.strictEqual(version.format('1'), '1');
			assert.strictEqual(version.format('1-tag'), '1-tag');

			assert.strictEqual(version.format('1', 1), '1');
			assert.strictEqual(version.format('1.2', 1), '1.2');
			assert.strictEqual(version.format('1.2-tag', 1), '1.2-tag');
			assert.strictEqual(version.format('1.2-tag', 1, 3, true), '1.2');

			assert.strictEqual(version.format('1', 2), '1.0');
			assert.strictEqual(version.format('1.2', 2), '1.2');
			assert.strictEqual(version.format('1.2-tag', 2), '1.2-tag');
			assert.strictEqual(version.format('1.2-tag', 2, 3, true), '1.2');

			assert.strictEqual(version.format('1.2.3', 3), '1.2.3');
			assert.strictEqual(version.format('1.2.3-tag', 3, 3), '1.2.3-tag');
			assert.strictEqual(version.format('1.2.3-tag', 3, 3, true), '1.2.3');

			assert.strictEqual(version.format('1.2', 1, 2), '1.2');
			assert.strictEqual(version.format('1.2-tag', 1, 2), '1.2-tag');
			assert.strictEqual(version.format('1.2-tag', 1, 2, true), '1.2');

			assert.strictEqual(version.format('1.2.3', 1, 2), '1.2');
			assert.strictEqual(version.format('1.2.3-tag', 1, 2), '1.2');
			assert.strictEqual(version.format('1.2.3-tag', 1, 2, true), '1.2');
		});
	});

	describe('eq', () => {
		it('should determine if two versions equal each other', () => {
			assert.strictEqual(version.eq('1', '1'), true);
			assert.strictEqual(version.eq('1.2', '1.2'), true);
			assert.strictEqual(version.eq('1.2.3', '1.2.3'), true);
			assert.strictEqual(version.eq('1.2.3.4', '1.2.3.4'), true);
			assert.strictEqual(version.eq('1.2.3.4', '1.2.3.5'), true);

			assert.strictEqual(version.eq('1', '2'), false);
			assert.strictEqual(version.eq('1.2', '2.2'), false);
			assert.strictEqual(version.eq('1.2.3', '2.2.3'), false);
			assert.strictEqual(version.eq('1.2.3.4', '2.2.3.4'), false);
			assert.strictEqual(version.eq('1.2.3.4', '2.2.3.5'), false);
		});
	});

	describe('lt', () => {
		it('should determine if a version is less than', () => {
			assert.strictEqual(version.lt('1', '1'), false);
			assert.strictEqual(version.lt('1.2', '1.2'), false);
			assert.strictEqual(version.lt('1.2.3', '1.2.3'), false);
			assert.strictEqual(version.lt('1.2.3.4', '1.2.3.4'), false);
			assert.strictEqual(version.lt('1.2.3.4', '1.2.3.5'), false);

			assert.strictEqual(version.lt('1', '2'), true);
			assert.strictEqual(version.lt('1.2', '1.3'), true);
			assert.strictEqual(version.lt('1.2', '2.2'), true);
			assert.strictEqual(version.lt('1.2.3', '2.2.3'), true);
			assert.strictEqual(version.lt('1.2.3.4', '2.2.3.4'), true);
			assert.strictEqual(version.lt('1.2.3.4', '2.2.3.5'), true);
		});
	});

	describe('lte', () => {
		it('should determine if a version is less than or equal', () => {
			assert.strictEqual(version.lte('1', '1'), true);
			assert.strictEqual(version.lte('1.2', '1.2'), true);
			assert.strictEqual(version.lte('1.2.3', '1.2.3'), true);
			assert.strictEqual(version.lte('1.2.3.4', '1.2.3.4'), true);
			assert.strictEqual(version.lte('1.2.3.4', '1.2.3.5'), true);

			assert.strictEqual(version.lte('1', '2'), true);
			assert.strictEqual(version.lte('1.2', '1.3'), true);
			assert.strictEqual(version.lte('1.2', '2.2'), true);
			assert.strictEqual(version.lte('1.2.3', '2.2.3'), true);
			assert.strictEqual(version.lte('1.2.3.4', '2.2.3.4'), true);
			assert.strictEqual(version.lte('1.2.3.4', '2.2.3.5'), true);

			assert.strictEqual(version.lte('2', '1'), false);
			assert.strictEqual(version.lte('2.2', '1.2'), false);
			assert.strictEqual(version.lte('2.2.3', '1.2.3'), false);
			assert.strictEqual(version.lte('2.2.3.4', '1.2.3.4'), false);
			assert.strictEqual(version.lte('2.2.3.4', '1.2.3.5'), false);
		});
	});

	describe('gt', () => {
		it('should determine if a version is greater than', () => {
			assert.strictEqual(version.gt('1', '1'), false);
			assert.strictEqual(version.gt('1.2', '1.2'), false);
			assert.strictEqual(version.gt('1.2.3', '1.2.3'), false);
			assert.strictEqual(version.gt('1.2.3.4', '1.2.3.4'), false);
			assert.strictEqual(version.gt('1.2.3.4', '1.2.3.5'), false);

			assert.strictEqual(version.gt('1', '2'), false);
			assert.strictEqual(version.gt('1.2', '1.3'), false);
			assert.strictEqual(version.gt('1.2', '2.2'), false);
			assert.strictEqual(version.gt('1.2.3', '2.2.3'), false);
			assert.strictEqual(version.gt('1.2.3.4', '2.2.3.4'), false);
			assert.strictEqual(version.gt('1.2.3.4', '2.2.3.5'), false);

			assert.strictEqual(version.gt('2', '1'), true);
			assert.strictEqual(version.gt('2.2', '1.2'), true);
			assert.strictEqual(version.gt('2.2.3', '1.2.3'), true);
			assert.strictEqual(version.gt('2.2.3.4', '1.2.3.4'), true);
			assert.strictEqual(version.gt('2.2.3.4', '1.2.3.5'), true);
		});
	});

	describe('gte', () => {
		it('should determine if a version is greater than or equal', () => {
			assert.strictEqual(version.gte('1', '1'), true);
			assert.strictEqual(version.gte('1.2', '1.2'), true);
			assert.strictEqual(version.gte('1.2.3', '1.2.3'), true);
			assert.strictEqual(version.gte('1.2.3.4', '1.2.3.4'), true);
			assert.strictEqual(version.gte('1.2.3.4', '1.2.3.5'), true);

			assert.strictEqual(version.gte('2', '1'), true);
			assert.strictEqual(version.gte('1.3', '1.2'), true);
			assert.strictEqual(version.gte('2.2', '1.2'), true);
			assert.strictEqual(version.gte('2.2.3', '1.2.3'), true);
			assert.strictEqual(version.gte('2.2.3.4', '1.2.3.4'), true);
			assert.strictEqual(version.gte('2.2.3.4', '1.2.3.5'), true);

			assert.strictEqual(version.gte('1', '2'), false);
			assert.strictEqual(version.gte('1.2', '2.2'), false);
			assert.strictEqual(version.gte('2.2.3', '2.2.3'), true);
			assert.strictEqual(version.gte('1.2.3.4', '2.2.3.4'), false);
			assert.strictEqual(version.gte('1.2.3.4', '2.2.3.5'), false);
		});
	});

	describe('isValid', () => {
		it('should determine if a version is valid', () => {
			assert.strictEqual(version.isValid(1), '1.0.0');
			assert.strictEqual(version.isValid('1'), '1.0.0');
			assert.strictEqual(version.isValid('1.2'), '1.2.0');
			assert.strictEqual(version.isValid('1.2.3'), '1.2.3');
			assert.strictEqual(version.isValid('1.2.3.4'), '1.2.3');
			assert.strictEqual(version.isValid('1.2.3-tag'), '1.2.3-tag');

			assert.strictEqual(version.isValid('a'), null);
		});
	});

	describe('parseMin', () => {
		it('should parse the min version from a range', () => {
			assert.strictEqual(version.parseMin('1'), '1');
			assert.strictEqual(version.parseMin('1.2'), '1.2');
			assert.strictEqual(version.parseMin('>=1.0'), '1.0');
			assert.strictEqual(version.parseMin('<1.0'), '1.0');
			assert.strictEqual(version.parseMin('>=2.3.3 <=4.2'), '2.3.3');
			assert.strictEqual(version.parseMin('>=2.3.3 <=4.2 || >=1.0'), '1.0');
			assert.strictEqual(version.parseMin('>=2.3.3 <=4.2 || 2.0'), '2.0');
		});
	});

	describe('parseMax', () => {
		it('should parse the max version from a range', () => {
			assert.strictEqual(version.parseMax('1'), '1');
			assert.strictEqual(version.parseMax('1.2'), '1.2');
			assert.strictEqual(version.parseMax('>=1.0'), '1.0');
			assert.strictEqual(version.parseMax('<1.0'), '1.0');
			assert.strictEqual(version.parseMax('<18'), '<18');
			assert.strictEqual(version.parseMax('>=2.3.3 <=4.2'), '4.2');
			assert.strictEqual(version.parseMax('>=2.3.3 <=4.2.x'), '4.2');
			assert.strictEqual(version.parseMax('>=2.3.3 <=4.2.x', true), '4.2.x');
			assert.strictEqual(version.parseMax('>=2.3.3 <=4.2 || >=1.0'), '4.2');
			assert.strictEqual(version.parseMax('>=2.3.3 <=4.2 || 5.0'), '5.0');
		});
	});

	describe('satisfies', () => {
		it('in range', function () {
			assert.strictEqual(version.satisfies('1.0.0', '1.0.0'), true);
			assert.strictEqual(version.satisfies('1.0.0', '*'), true);
			assert.strictEqual(version.satisfies('1.0.0', '>=2.0.0 || *'), true);
			assert.strictEqual(version.satisfies('1.0.0', '>=1.0.0'), true);
			assert.strictEqual(version.satisfies('3.0.0', '>=2.3.3 <=4.2'), true);
			assert.strictEqual(version.satisfies('4', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), true);
			assert.strictEqual(version.satisfies('5', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), true);
			assert.strictEqual(version.satisfies('6', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), true);
			assert.strictEqual(version.satisfies('7', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), true);
			assert.strictEqual(version.satisfies('18.0.1', '<=18.x'), true);
			assert.strictEqual(version.satisfies('18.0.1', '>=18.x'), true);
			assert.strictEqual(version.satisfies('18.0.1', '>=19.x'), false);
		});

		it('not in range', function () {
			assert.strictEqual(version.satisfies('2.0.0', '1.0.0'), false);
			assert.strictEqual(version.satisfies('2.0.0', '>=2.3.3 <=4.2'), false);
			assert.strictEqual(version.satisfies('2.3', '>=2.3.3 <=4.2'), false);
			assert.strictEqual(version.satisfies('4.3', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), false);
			assert.strictEqual(version.satisfies('5.1', '>=2.3.3 <=4.2 || 5.0 || >=6.0'), false);
		});

		it('maybe', function () {
			assert.strictEqual(version.satisfies('2.0', '1.0', true), 'maybe');
			assert.strictEqual(version.satisfies('2.0', '>=1.0', true), true);
			assert.strictEqual(version.satisfies('2.0', '<1.0', true), 'maybe');
			assert.strictEqual(version.satisfies('2.0', '>=2.3.3 <=4.2', true), false);
			assert.strictEqual(version.satisfies('5.0', '>=2.3.3 <=4.2', true), 'maybe');
			assert.strictEqual(version.satisfies('18', '>=10 <=18', true), true);
		});
	});

	describe('sort', () => {
		it('should sort an array of versions', () => {
			assert.deepStrictEqual(
				version.sort([
					'1.2.3',
					'1.0',
					'0.5',
					'10',
					'1.2.3-tag',
					'4.5.6.7'
				]),
				[
					'0.5',
					'1.0',
					'1.2.3',
					'1.2.3-tag',
					'4.5.6.7',
					'10'
				]
			);
		});
	});
});
