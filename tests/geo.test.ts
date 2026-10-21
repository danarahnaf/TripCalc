import { describe, expect, it } from 'vitest';
import {
	distanceMeters,
	flipCoords,
	formatDuration,
	isSamePlace,
	isJavaAddress,
	isJavaProvince,
	isPointInJava,
	javaPointError
} from '../src/lib/logic/geo';

describe('pinned points', () => {
	it('accepts Surabaya, Jakarta and Yogyakarta', () => {
		expect(isPointInJava(-7.2575, 112.7521)).toBe(true);
		expect(isPointInJava(-6.2088, 106.8456)).toBe(true);
		expect(isPointInJava(-7.7956, 110.3695)).toBe(true);
	});
	it('rejects Denpasar, Bakauheni and Gilimanuk with a message', () => {
		expect(isPointInJava(-8.65, 115.21)).toBe(false);
		expect(isPointInJava(-5.87, 105.75)).toBe(false);
		expect(isPointInJava(-8.17, 114.43)).toBe(false);
		expect(javaPointError(-5.87, 105.75)).toMatch(/Lampung/);
		expect(javaPointError(-8.17, 114.43)).toMatch(/Bali/);
		expect(javaPointError(-8.65, 115.21)).toMatch(/outside Java/);
	});
	it('accepts Banyuwangi, on the Java side of the strait', () => {
		expect(isPointInJava(-8.2192, 114.3691)).toBe(true);
	});
});

describe('provinces', () => {
	it('accepts Java provinces in any case and variant', () => {
		for (const s of [
			'Banten',
			'DKI Jakarta',
			'Daerah Khusus Ibukota Jakarta',
			'Daerah Khusus Jakarta',
			'Jakarta',
			'jawa barat',
			'JAWA TENGAH',
			'Daerah Istimewa Yogyakarta',
			'DI Yogyakarta',
			'Jawa Timur'
		]) {
			expect(isJavaProvince(s)).toBe(true);
		}
	});
	it('rejects other provinces', () => {
		for (const s of ['Bali', 'Lampung', 'Sumatera Selatan', '', undefined]) {
			expect(isJavaProvince(s)).toBe(false);
		}
	});
	it('accepts English names and ISO codes from localized Nominatim results', () => {
		expect(isJavaAddress({ state: 'East Java', 'ISO3166-2-lvl4': 'ID-JI' })).toBe(true);
		expect(isJavaAddress({ state: 'Daerah Khusus Jakarta' })).toBe(true);
		expect(isJavaAddress({ 'ISO3166-2-lvl4': 'ID-YO' })).toBe(true);
		expect(isJavaAddress({ state: 'Bali', 'ISO3166-2-lvl4': 'ID-BA' })).toBe(false);
		expect(isJavaAddress({ state: 'Lampung', 'ISO3166-2-lvl4': 'ID-LA' })).toBe(false);
		expect(isJavaAddress(undefined)).toBe(false);
	});
});

describe('coordinates', () => {
	it('flips [lon, lat] to [lat, lon]', () => {
		expect(
			flipCoords([
				[112.7521, -7.2575],
				[112.6326, -7.9666]
			])
		).toEqual([
			[-7.2575, 112.7521],
			[-7.9666, 112.6326]
		]);
	});
	it('treats points within 300 m as the same place', () => {
		const surabaya = { lat: -7.2575, lon: 112.7521 };
		expect(isSamePlace(surabaya, { lat: -7.2585, lon: 112.7531 })).toBe(true); // ~155 m
		expect(isSamePlace(surabaya, { lat: -7.2675, lon: 112.7521 })).toBe(false); // ~1.1 km
		expect(distanceMeters(surabaya, { lat: -7.9666, lon: 112.6326 }) / 1000).toBeCloseTo(79.9, 0);
	});
	it('formats durations', () => {
		expect(formatDuration(45)).toBe('45 min');
		expect(formatDuration(135)).toBe('2 h 15 min');
		expect(formatDuration(120)).toBe('2 h');
	});
});
