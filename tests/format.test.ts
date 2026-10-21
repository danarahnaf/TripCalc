import { describe, expect, it } from 'vitest';
import {
	formatIDR,
	formatThousands,
	parseDecimal,
	parseIntInput,
	parseNullableInt,
	roundUpTo500
} from '../src/lib/logic/format';

describe('parsing', () => {
	it('parses money by stripping non-digits', () => {
		expect(parseIntInput('50.000')).toBe(50000);
		expect(parseIntInput('Rp 1.250.000')).toBe(1250000);
		expect(parseIntInput('')).toBe(0);
		expect(parseNullableInt('')).toBeNull();
		expect(parseNullableInt('75.000')).toBe(75000);
	});
	it('parses decimals with comma or dot', () => {
		expect(parseDecimal('12,5')).toBe(12.5);
		expect(parseDecimal('12.5')).toBe(12.5);
		expect(parseDecimal('1,2,3')).toBe(1.23);
		expect(parseDecimal('')).toBeNull();
		expect(parseDecimal('abc')).toBeNull();
	});
});

describe('formatting', () => {
	it('formats thousands and IDR', () => {
		expect(formatThousands(50000)).toBe('50.000');
		expect(formatThousands(null)).toBe('');
		expect(formatIDR(1250000).replace(/\s/g, ' ')).toBe('Rp 1.250.000');
	});
	it('rounds up to Rp 500', () => {
		expect(roundUpTo500(1)).toBe(500);
		expect(roundUpTo500(500)).toBe(500);
		expect(roundUpTo500(501)).toBe(1000);
		expect(roundUpTo500(0)).toBe(0);
	});
});
