import { describe, expect, it } from 'vitest';
import { defaultTrip } from '../src/lib/data/defaults';
import tollData from '../src/lib/data/tarif_tol_jawa.json';
import {
	carsNeeded,
	computeAllModes,
	computeMode,
	fuelCost,
	motorcyclesNeeded,
	perPersonCost,
	pickBest,
	presetKmPerLiter,
	tollCost
} from '../src/lib/logic/cost';
import type { RoutePair, RouteResult, TripState } from '../src/lib/types';

const segments = tollData.ruas;

function route(distanceKm: number, durationMin: number): RouteResult {
	return { distanceKm, durationMin, geometry: [], tollStepNames: [] };
}

const routes: RoutePair = { toll: route(100, 90), notoll: route(120, 150) };

function trip(patch: (t: TripState) => void = () => {}): TripState {
	const t = defaultTrip();
	t.toll.selectedIds = ['cikopo-palimanan']; // Rp 132.000
	patch(t);
	return t;
}

describe('vehicle counts', () => {
	it('needs one car per 7 passengers', () => {
		expect(carsNeeded(1)).toBe(1);
		expect(carsNeeded(7)).toBe(1);
		expect(carsNeeded(8)).toBe(2);
		expect(carsNeeded(15)).toBe(3);
	});
	it('needs one motorcycle per 2 passengers', () => {
		expect(motorcyclesNeeded(1)).toBe(1);
		expect(motorcyclesNeeded(2)).toBe(1);
		expect(motorcyclesNeeded(3)).toBe(2);
		expect(motorcyclesNeeded(50)).toBe(25);
	});
});

describe('car presets', () => {
	it('maps presets to km/L', () => {
		expect(presetKmPerLiter('city')).toBe(15);
		expect(presetKmPerLiter('mpv')).toBe(12);
		expect(presetKmPerLiter('suv')).toBe(9);
		expect(presetKmPerLiter('suv_diesel')).toBe(11);
		expect(presetKmPerLiter('custom')).toBeNull();
	});
});

describe('per person split', () => {
	it('rounds up to the nearest Rp 500', () => {
		expect(perPersonCost(1000, 1)).toBe(1000);
		expect(perPersonCost(1001, 1)).toBe(1500);
		expect(perPersonCost(10000, 3)).toBe(3500);
		expect(perPersonCost(0, 2)).toBe(0);
	});
});

describe('toll cost', () => {
	it('sums selected segments, overrides and other toll', () => {
		const t = trip();
		expect(tollCost(t.toll, segments)).toBe(132000);
		t.toll.overrides = { 'cikopo-palimanan': 100000 };
		t.toll.other = 5000;
		expect(tollCost(t.toll, segments)).toBe(105000);
		t.toll.selectedIds.push('palimanan-kanci'); // 13.500
		expect(tollCost(t.toll, segments)).toBe(118500);
	});
	it('ignores unknown ids and duplicates', () => {
		const t = trip((x) => (x.toll.selectedIds = ['cikopo-palimanan', 'cikopo-palimanan', 'nope']));
		expect(tollCost(t.toll, segments)).toBe(132000);
	});
});

describe('car via toll', () => {
	it('one way: fuel + toll', () => {
		const r = computeMode('car_toll', trip(), routes, segments);
		expect(fuelCost(100, 12, 10000)).toBe(83333);
		expect(r.total).toBe(83333 + 132000);
		expect(r.perPerson).toBe(108000);
		expect(r.distanceKm).toBe(100);
		expect(r.durationMin).toBe(90);
	});
	it('round trip doubles fuel and toll but not shared extras', () => {
		const t = trip((x) => {
			x.roundTrip = true;
			x.extras.parking = 20000;
		});
		const r = computeMode('car_toll', t, routes, segments);
		expect(r.total).toBe(166667 + 264000 + 20000);
		expect(r.distanceKm).toBe(200);
		expect(r.durationMin).toBe(180);
	});
	it('8 passengers need 2 cars: fuel and toll × 2', () => {
		const r = computeMode('car_toll', trip((x) => (x.passengers = 8)), routes, segments);
		expect(r.vehicles).toBe(2);
		expect(r.total).toBe((83333 + 132000) * 2);
		expect(r.notes).toContain('Needs 2 cars');
	});
	it('applies toll overrides and other toll', () => {
		const t = trip((x) => {
			x.toll.overrides = { 'cikopo-palimanan': 120000 };
			x.toll.other = 10000;
		});
		expect(computeMode('car_toll', t, routes, segments).total).toBe(83333 + 130000);
	});
	it('is null without a route', () => {
		const r = computeMode('car_toll', trip(), { toll: null, notoll: null }, segments);
		expect(r.total).toBeNull();
	});
});

describe('car no toll', () => {
	it('fuel only, with and without round trip', () => {
		const one = computeMode('car_notoll', trip(), routes, segments);
		expect(one.total).toBe(100000); // 120 km / 12 × 10.000
		const two = computeMode('car_notoll', trip((x) => (x.roundTrip = true)), routes, segments);
		expect(two.total).toBe(200000);
		expect(two.durationMin).toBe(300);
	});
});

describe('motorcycle', () => {
	it('fuel × motorcycles', () => {
		const r = computeMode('motorcycle', trip((x) => (x.passengers = 3)), routes, segments);
		expect(r.vehicles).toBe(2);
		expect(r.total).toBe(30000 * 2); // 120 km / 40 × 10.000
	});
	it('round trip doubles fuel', () => {
		const r = computeMode('motorcycle', trip((x) => (x.roundTrip = true)), routes, segments);
		expect(r.total).toBe(60000);
	});
});

describe('train and bus', () => {
	it('needs a ticket price', () => {
		const r = computeMode('train', trip(), routes, segments);
		expect(r.total).toBeNull();
		expect(r.missing).toBe('Enter ticket price');
		expect(r.distanceKm).toBe(100);
	});
	it('ticket × passengers + local transport + extras', () => {
		const t = trip((x) => {
			x.transit.trainTicket = 150000;
			x.transit.localTransport = 50000;
			x.extras.food = 40000;
		});
		const r = computeMode('train', t, routes, segments);
		expect(r.total).toBe(150000 * 2 + 50000 + 40000);
		expect(r.durationMin).toBeCloseTo((100 / 70) * 60 + 30);
	});
	it('round trip doubles tickets and local transport, not extras', () => {
		const t = trip((x) => {
			x.roundTrip = true;
			x.transit.busTicket = 100000;
			x.transit.localTransport = 50000;
			x.extras.lodging = 300000;
		});
		const r = computeMode('bus', t, routes, segments);
		expect(r.total).toBe(100000 * 2 * 2 + 50000 * 2 + 300000);
		expect(r.durationMin).toBeCloseTo(((100 / 45) * 60 + 30) * 2);
	});
});

describe('pickBest', () => {
	it('marks the cheapest and fastest computed modes', () => {
		const t = trip((x) => {
			x.transit.trainTicket = 10000;
		});
		const best = pickBest(computeAllModes(t, routes, segments));
		expect(best.cheapest).toBe('train'); // 20.000
		expect(best.fastest).toBe('car_toll'); // 90 min
	});
});
