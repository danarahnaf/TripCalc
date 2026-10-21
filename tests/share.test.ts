import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { defaultTrip, emptyStop } from '../src/lib/data/defaults';
import { decodeTrip, encodeTrip, validateTrip } from '../src/lib/logic/share';
import type { TripState } from '../src/lib/types';

function sampleTrip(): TripState {
	const t = defaultTrip();
	t.name = 'Mudik Malang';
	t.stops = [
		{ id: 'a', name: 'Surabaya', lat: -7.2575, lon: 112.7521 },
		{ id: 'b', name: 'Pasuruan', lat: -7.6453, lon: 112.9075 },
		{ id: 'c', name: 'Malang', lat: -7.9666, lon: 112.6326 }
	];
	t.passengers = 5;
	t.roundTrip = true;
	t.car = { preset: 'custom', kmPerLiter: 13.5, fuelId: 'pertamax', fuelPrice: 16000 };
	t.toll = { selectedIds: ['pandaan-malang'], overrides: { 'pandaan-malang': 35000 }, other: 2500 };
	t.transit = { trainTicket: 75000, busTicket: null, localTransport: 40000 };
	t.extras = { parking: 10000, food: 150000, lodging: 0, other: 0 };
	t.selectedMode = 'train';
	return t;
}

describe('share encode/decode', () => {
	it('round-trips a trip unchanged', () => {
		const t = sampleTrip();
		expect(decodeTrip(encodeTrip(t))).toEqual(t);
	});
	it('drops unfilled stop slots', () => {
		const t = sampleTrip();
		t.stops.splice(1, 0, emptyStop());
		expect(decodeTrip(encodeTrip(t))?.stops).toHaveLength(3);
	});
	it('returns null for corrupted input without throwing', () => {
		expect(decodeTrip('not-a-valid-payload!!')).toBeNull();
		expect(decodeTrip('')).toBeNull();
		expect(decodeTrip(null)).toBeNull();
		expect(decodeTrip(LZString.compressToEncodedURIComponent('{"version":1,'))).toBeNull();
		expect(decodeTrip(encodeTrip(sampleTrip()).slice(0, 20))).toBeNull();
	});
	it('returns null for a wrong version', () => {
		const bad = { ...sampleTrip(), version: 2 };
		expect(decodeTrip(LZString.compressToEncodedURIComponent(JSON.stringify(bad)))).toBeNull();
	});
	it('rejects stops with bad coordinates', () => {
		const bad = { ...sampleTrip(), stops: [{ id: 'x', name: 'X', lat: 'a', lon: 1 }] };
		expect(validateTrip(bad)).toBeNull();
	});
	it('fills defaults for missing optional fields', () => {
		const t = validateTrip({ version: 1, stops: [] });
		expect(t?.passengers).toBe(2);
		expect(t?.selectedMode).toBe('car_toll');
	});
});
