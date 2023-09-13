import { describe, expect, it } from 'vitest';
import * as version from '../src/util/version.js';

describe('version', () => {
	describe('compare', () => {
		it('should compare two versions', () => {
			expect(version.compare('1.0.0', '2.0.0')).toBeLessThan(0);
			expect(version.compare('2.0.0', '1.0.0')).toBeGreaterThan(0);
			expect(version.compare('1.0.0', '1.0.0')).toEqual(0);

			expect(version.compare('1.1.0', '1.2.0')).toBeLessThan(0);
			expect(version.compare('1.2.0', '1.1.0')).toBeGreaterThan(0);
			expect(version.compare('1.1.0', '1.1.0')).toEqual(0);

			expect(version.compare('1.1.1', '1.1.2')).toBeLessThan(0);
			expect(version.compare('1.1.2', '1.1.1')).toBeGreaterThan(0);
			expect(version.compare('1.1.1', '1.1.1')).toEqual(0);

			expect(version.compare('1.0.0.v20220102', '1.0.0.v20230809')).toBeLessThan(0);
			expect(version.compare('1.0.0.v20230809', '1.0.0.v20220102')).toBeGreaterThan(0);
			expect(version.compare('1.0.0.v20220102', '1.0.0.v20220102')).toEqual(0);

			expect(version.compare('1.0.0', '1.0.0.v20220102')).toBeLessThan(0);
			expect(version.compare('1.0.0.v20220102', '1.0.0')).toBeGreaterThan(0);
		});
	});

	describe('format', () => {
		it('should format a version', () => {
			expect(version.format(0)).toEqual('0');
			expect(version.format('1')).toEqual('1');
			expect(version.format('1-tag')).toEqual('1-tag');

			expect(version.format('1', 1)).toEqual('1');
			expect(version.format('1.2', 1)).toEqual('1.2');
			expect(version.format('1.2-tag', 1)).toEqual('1.2-tag');
			expect(version.format('1.2-tag', 1, 3, true)).toEqual('1.2');

			expect(version.format('1', 2)).toEqual('1.0');
			expect(version.format('1.2', 2)).toEqual('1.2');
			expect(version.format('1.2-tag', 2)).toEqual('1.2-tag');
			expect(version.format('1.2-tag', 2, 3, true)).toEqual('1.2');

			expect(version.format('1.2.3', 3)).toEqual('1.2.3');
			expect(version.format('1.2.3-tag', 3, 3)).toEqual('1.2.3-tag');
			expect(version.format('1.2.3-tag', 3, 3, true)).toEqual('1.2.3');

			expect(version.format('1.2', 1, 2)).toEqual('1.2');
			expect(version.format('1.2-tag', 1, 2)).toEqual('1.2-tag');
			expect(version.format('1.2-tag', 1, 2, true)).toEqual('1.2');

			expect(version.format('1.2.3', 1, 2)).toEqual('1.2');
			expect(version.format('1.2.3-tag', 1, 2)).toEqual('1.2');
			expect(version.format('1.2.3-tag', 1, 2, true)).toEqual('1.2');
		});
	});

	describe('eq', () => {
		it('should determine if two versions equal each other', () => {
			expect(version.eq('1', '1')).toEqual(true);
			expect(version.eq('1.2', '1.2')).toEqual(true);
			expect(version.eq('1.2.3', '1.2.3')).toEqual(true);
			expect(version.eq('1.2.3.4', '1.2.3.4')).toEqual(true);
			expect(version.eq('1.2.3.4', '1.2.3.5')).toEqual(true);

			expect(version.eq('1', '2')).toEqual(false);
			expect(version.eq('1.2', '2.2')).toEqual(false);
			expect(version.eq('1.2.3', '2.2.3')).toEqual(false);
			expect(version.eq('1.2.3.4', '2.2.3.4')).toEqual(false);
			expect(version.eq('1.2.3.4', '2.2.3.5')).toEqual(false);
		});
	});

	describe('lt', () => {
		it('should determine if a version is less than', () => {
			expect(version.lt('1', '1')).toEqual(false);
			expect(version.lt('1.2', '1.2')).toEqual(false);
			expect(version.lt('1.2.3', '1.2.3')).toEqual(false);
			expect(version.lt('1.2.3.4', '1.2.3.4')).toEqual(false);
			expect(version.lt('1.2.3.4', '1.2.3.5')).toEqual(false);

			expect(version.lt('1', '2')).toEqual(true);
			expect(version.lt('1.2', '1.3')).toEqual(true);
			expect(version.lt('1.2', '2.2')).toEqual(true);
			expect(version.lt('1.2.3', '2.2.3')).toEqual(true);
			expect(version.lt('1.2.3.4', '2.2.3.4')).toEqual(true);
			expect(version.lt('1.2.3.4', '2.2.3.5')).toEqual(true);
		});
	});

	describe('lte', () => {
		it('should determine if a version is less than or equal', () => {
			expect(version.lte('1', '1')).toEqual(true);
			expect(version.lte('1.2', '1.2')).toEqual(true);
			expect(version.lte('1.2.3', '1.2.3')).toEqual(true);
			expect(version.lte('1.2.3.4', '1.2.3.4')).toEqual(true);
			expect(version.lte('1.2.3.4', '1.2.3.5')).toEqual(true);

			expect(version.lte('1', '2')).toEqual(true);
			expect(version.lte('1.2', '1.3')).toEqual(true);
			expect(version.lte('1.2', '2.2')).toEqual(true);
			expect(version.lte('1.2.3', '2.2.3')).toEqual(true);
			expect(version.lte('1.2.3.4', '2.2.3.4')).toEqual(true);
			expect(version.lte('1.2.3.4', '2.2.3.5')).toEqual(true);

			expect(version.lte('2', '1')).toEqual(false);
			expect(version.lte('2.2', '1.2')).toEqual(false);
			expect(version.lte('2.2.3', '1.2.3')).toEqual(false);
			expect(version.lte('2.2.3.4', '1.2.3.4')).toEqual(false);
			expect(version.lte('2.2.3.4', '1.2.3.5')).toEqual(false);
		});
	});

	describe('gt', () => {
		it('should determine if a version is greater than', () => {
			expect(version.gt('1', '1')).toEqual(false);
			expect(version.gt('1.2', '1.2')).toEqual(false);
			expect(version.gt('1.2.3', '1.2.3')).toEqual(false);
			expect(version.gt('1.2.3.4', '1.2.3.4')).toEqual(false);
			expect(version.gt('1.2.3.4', '1.2.3.5')).toEqual(false);

			expect(version.gt('1', '2')).toEqual(false);
			expect(version.gt('1.2', '1.3')).toEqual(false);
			expect(version.gt('1.2', '2.2')).toEqual(false);
			expect(version.gt('1.2.3', '2.2.3')).toEqual(false);
			expect(version.gt('1.2.3.4', '2.2.3.4')).toEqual(false);
			expect(version.gt('1.2.3.4', '2.2.3.5')).toEqual(false);

			expect(version.gt('2', '1')).toEqual(true);
			expect(version.gt('2.2', '1.2')).toEqual(true);
			expect(version.gt('2.2.3', '1.2.3')).toEqual(true);
			expect(version.gt('2.2.3.4', '1.2.3.4')).toEqual(true);
			expect(version.gt('2.2.3.4', '1.2.3.5')).toEqual(true);
		});
	});

	describe('gte', () => {
		it('should determine if a version is greater than or equal', () => {
			expect(version.gte('1', '1')).toEqual(true);
			expect(version.gte('1.2', '1.2')).toEqual(true);
			expect(version.gte('1.2.3', '1.2.3')).toEqual(true);
			expect(version.gte('1.2.3.4', '1.2.3.4')).toEqual(true);
			expect(version.gte('1.2.3.4', '1.2.3.5')).toEqual(true);

			expect(version.gte('2', '1')).toEqual(true);
			expect(version.gte('1.3', '1.2')).toEqual(true);
			expect(version.gte('2.2', '1.2')).toEqual(true);
			expect(version.gte('2.2.3', '1.2.3')).toEqual(true);
			expect(version.gte('2.2.3.4', '1.2.3.4')).toEqual(true);
			expect(version.gte('2.2.3.4', '1.2.3.5')).toEqual(true);

			expect(version.gte('1', '2')).toEqual(false);
			expect(version.gte('1.2', '2.2')).toEqual(false);
			expect(version.gte('2.2.3', '2.2.3')).toEqual(true);
			expect(version.gte('1.2.3.4', '2.2.3.4')).toEqual(false);
			expect(version.gte('1.2.3.4', '2.2.3.5')).toEqual(false);
		});
	});

	describe('isValid', () => {
		it('should determine if a version is valid', () => {
			expect(version.isValid(1)).toEqual('1.0.0');
			expect(version.isValid('1')).toEqual('1.0.0');
			expect(version.isValid('1.2')).toEqual('1.2.0');
			expect(version.isValid('1.2.3')).toEqual('1.2.3');
			expect(version.isValid('1.2.3.4')).toEqual('1.2.3');
			expect(version.isValid('1.2.3-tag')).toEqual('1.2.3-tag');

			expect(version.isValid('a')).toEqual(null);
		});
	});

	describe('parseMin', () => {
		it('should parse the min version from a range', () => {
			expect(version.parseMin('1')).toEqual('1');
			expect(version.parseMin('1.2')).toEqual('1.2');
			expect(version.parseMin('>=1.0')).toEqual('1.0');
			expect(version.parseMin('<1.0')).toEqual('1.0');
			expect(version.parseMin('>=2.3.3 <=4.2')).toEqual('2.3.3');
			expect(version.parseMin('>=2.3.3 <=4.2 || >=1.0')).toEqual('1.0');
			expect(version.parseMin('>=2.3.3 <=4.2 || 2.0')).toEqual('2.0');
		});
	});

	describe('parseMax', () => {
		it('should parse the max version from a range', () => {
			expect(version.parseMax('1')).toEqual('1');
			expect(version.parseMax('1.2')).toEqual('1.2');
			expect(version.parseMax('>=1.0')).toEqual('1.0');
			expect(version.parseMax('<1.0')).toEqual('1.0');
			expect(version.parseMax('<18')).toEqual('<18');
			expect(version.parseMax('>=2.3.3 <=4.2')).toEqual('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2.x')).toEqual('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2.x', true)).toEqual('4.2.x');
			expect(version.parseMax('>=2.3.3 <=4.2 || >=1.0')).toEqual('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2 || 5.0')).toEqual('5.0');
		});
	});

	describe('satisfies', () => {
		it('in range', function () {
			expect(version.satisfies('1.0.0', '1.0.0')).toEqual(true);
			expect(version.satisfies('1.0.0', '*')).toEqual(true);
			expect(version.satisfies('1.0.0', '>=2.0.0 || *')).toEqual(true);
			expect(version.satisfies('1.0.0', '>=1.0.0')).toEqual(true);
			expect(version.satisfies('3.0.0', '>=2.3.3 <=4.2')).toEqual(true);
			expect(version.satisfies('4', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(true);
			expect(version.satisfies('5', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(true);
			expect(version.satisfies('6', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(true);
			expect(version.satisfies('7', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(true);
			expect(version.satisfies('18.0.1', '<=18.x')).toEqual(true);
			expect(version.satisfies('18.0.1', '>=18.x')).toEqual(true);
			expect(version.satisfies('18.0.1', '>=19.x')).toEqual(false);
		});

		it('not in range', function () {
			expect(version.satisfies('2.0.0', '1.0.0')).toEqual(false);
			expect(version.satisfies('2.0.0', '>=2.3.3 <=4.2')).toEqual(false);
			expect(version.satisfies('2.3', '>=2.3.3 <=4.2')).toEqual(false);
			expect(version.satisfies('4.3', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(false);
			expect(version.satisfies('5.1', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toEqual(false);
		});

		it('maybe', function () {
			expect(version.satisfies('2.0', '1.0', true)).toEqual('maybe');
			expect(version.satisfies('2.0', '>=1.0', true)).toEqual(true);
			expect(version.satisfies('2.0', '<1.0', true)).toEqual('maybe');
			expect(version.satisfies('2.0', '>=2.3.3 <=4.2', true)).toEqual(false);
			expect(version.satisfies('5.0', '>=2.3.3 <=4.2', true)).toEqual('maybe');
			expect(version.satisfies('18', '>=10 <=18', true)).toEqual(true);
		});
	});

	describe('sort', () => {
		it('should sort an array of versions', () => {
			expect(version.sort([
				'1.2.3',
				'1.0',
				'0.5',
				'10',
				'1.2.3-tag',
				'4.5.6.7'
			])).toEqual([
				'0.5',
				'1.0',
				'1.2.3',
				'1.2.3-tag',
				'4.5.6.7',
				'10'
			]);
		});
	});
});
