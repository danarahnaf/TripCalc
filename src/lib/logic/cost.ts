import { CAR_PRESETS, DEFAULTS } from '../data/defaults';
import type {
	CarPreset,
	CostBreakdown,
	CostLine,
	RoutePair,
	TollSegment,
	TravelMode,
	TripState
} from '../types';
import { TRAVEL_MODES } from '../types';
import { transitDurationMin, tripFactor } from './duration';
import { formatDecimal, formatIDR, roundUpTo500 } from './format';

export function clampPassengers(n: number): number {
	if (!Number.isFinite(n)) return DEFAULTS.passengers;
	return Math.min(DEFAULTS.maxPassengers, Math.max(DEFAULTS.minPassengers, Math.round(n)));
}

export function carsNeeded(passengers: number): number {
	return Math.ceil(clampPassengers(passengers) / DEFAULTS.carCapacity);
}

export function motorcyclesNeeded(passengers: number): number {
	return Math.ceil(clampPassengers(passengers) / DEFAULTS.motorcycleCapacity);
}

/** km/L for a car preset; null for "custom". */
export function presetKmPerLiter(preset: CarPreset): number | null {
	return CAR_PRESETS.find((p) => p.id === preset)?.kmPerLiter ?? null;
}

/** Fuel cost for one vehicle, rounded to the rupiah. */
export function fuelCost(distanceKm: number, kmPerLiter: number, pricePerLiter: number): number {
	if (!(distanceKm > 0) || !(kmPerLiter > 0) || !(pricePerLiter > 0)) return 0;
	return Math.round((distanceKm / kmPerLiter) * pricePerLiter);
}

export function segmentPrice(segment: TollSegment, overrides: Record<string, number>): number {
	const o = overrides[segment.id];
	return typeof o === 'number' && Number.isFinite(o) && o >= 0 ? o : segment.tarif;
}

/** One-way toll for one car: selected segments (with overrides) plus "other toll". */
export function tollCost(toll: TripState['toll'], segments: TollSegment[]): number {
	const byId = new Map(segments.map((s) => [s.id, s]));
	let sum = 0;
	for (const id of new Set(toll.selectedIds)) {
		const seg = byId.get(id);
		if (seg) sum += segmentPrice(seg, toll.overrides);
	}
	return sum + Math.max(0, toll.other || 0);
}

export function extrasTotal(extras: TripState['extras']): number {
	return (
		Math.max(0, extras.parking || 0) +
		Math.max(0, extras.food || 0) +
		Math.max(0, extras.lodging || 0) +
		Math.max(0, extras.other || 0)
	);
}

/** Total ÷ passengers, rounded up to the nearest Rp 500. */
export function perPersonCost(total: number, passengers: number): number {
	return roundUpTo500(total / clampPassengers(passengers));
}

function extrasLines(extras: TripState['extras']): CostLine[] {
	const items: [string, number][] = [
		['Parking', extras.parking],
		['Food', extras.food],
		['Lodging', extras.lodging],
		['Other', extras.other]
	];
	return items
		.filter(([, v]) => v > 0)
		.map(([label, amount]) => ({ label, amount, detail: 'Shared extra' }));
}

function finish(
	base: Omit<CostBreakdown, 'total' | 'perPerson'>,
	passengers: number
): CostBreakdown {
	if (base.missing) return { ...base, total: null, perPerson: null };
	const total = base.lines.reduce((s, l) => s + l.amount, 0);
	return { ...base, total, perPerson: perPersonCost(total, passengers) };
}

function liters(distanceKm: number, kmPerLiter: number): string {
	return kmPerLiter > 0 ? formatDecimal(Math.round((distanceKm / kmPerLiter) * 10) / 10) : '0';
}

export function computeMode(
	mode: TravelMode,
	trip: TripState,
	routes: RoutePair,
	segments: TollSegment[]
): CostBreakdown {
	const f = tripFactor(trip.roundTrip);
	const p = clampPassengers(trip.passengers);
	const extras = extrasLines(trip.extras);
	const notes: string[] = [];
	if (trip.roundTrip) notes.push('Round trip: distance, time, fuel, toll and tickets are doubled.');
	const twice = f > 1 ? ' × 2 (round trip)' : '';

	if (mode === 'car_toll' || mode === 'car_notoll' || mode === 'motorcycle') {
		const route = mode === 'car_toll' ? routes.toll : routes.notoll;
		const isCar = mode !== 'motorcycle';
		const vehicles = isCar ? carsNeeded(p) : motorcyclesNeeded(p);
		const unit = isCar ? 'car' : 'motorcycle';
		if (vehicles > 1) notes.unshift(`Needs ${vehicles} ${unit}s`);
		if (!route) {
			return finish(
				{
					mode,
					distanceKm: null,
					durationMin: null,
					lines: [],
					vehicles,
					notes,
					missing: 'No route yet'
				},
				p
			);
		}
		const v = isCar ? trip.car : trip.motorcycle;
		const distanceKm = route.distanceKm * f;
		const perVehicles = vehicles > 1 ? ` × ${vehicles} ${unit}s` : '';
		const lines: CostLine[] = [
			{
				label: 'Fuel',
				amount: fuelCost(distanceKm, v.kmPerLiter, v.fuelPrice) * vehicles,
				detail: `${liters(distanceKm, v.kmPerLiter)} L × ${formatIDR(v.fuelPrice)}${perVehicles}`
			}
		];
		if (mode === 'car_toll') {
			const count = new Set(trip.toll.selectedIds).size;
			const parts = [`${count} segment${count === 1 ? '' : 's'}`];
			if (trip.toll.other > 0) parts.push('other toll');
			lines.push({
				label: 'Toll',
				amount: tollCost(trip.toll, segments) * f * vehicles,
				detail: `${parts.join(' + ')}${twice}${perVehicles}`
			});
		}
		lines.push(...extras);
		return finish(
			{
				mode,
				distanceKm,
				durationMin: route.durationMin * f,
				lines,
				vehicles,
				notes,
				missing: null
			},
			p
		);
	}

	// Train and bus use the via-toll road distance as a reference distance.
	const isTrain = mode === 'train';
	const ticket = isTrain ? trip.transit.trainTicket : trip.transit.busTicket;
	const speed = isTrain ? DEFAULTS.train : DEFAULTS.bus;
	const ref = routes.toll;
	const distanceKm = ref ? ref.distanceKm * f : null;
	const durationMin = ref
		? transitDurationMin(ref.distanceKm, speed.speedKmh, speed.bufferMin) * f
		: null;
	notes.push(
		`Time estimated at ${speed.speedKmh} km/h + ${speed.bufferMin} min buffer over road distance.`
	);
	const lines: CostLine[] = [];
	if (ticket != null) {
		lines.push({
			label: 'Tickets',
			amount: ticket * p * f,
			detail: `${formatIDR(ticket)} × ${p} passenger${p === 1 ? '' : 's'}${twice}`
		});
	}
	if (trip.transit.localTransport > 0) {
		lines.push({
			label: 'Local transport to/from station',
			amount: trip.transit.localTransport * f,
			detail: f > 1 ? 'Total × 2 (round trip)' : 'Total'
		});
	}
	lines.push(...extras);
	return finish(
		{
			mode,
			distanceKm,
			durationMin,
			lines,
			vehicles: null,
			notes,
			missing: ticket == null ? 'Enter ticket price' : null
		},
		p
	);
}

export function computeAllModes(
	trip: TripState,
	routes: RoutePair,
	segments: TollSegment[]
): Record<TravelMode, CostBreakdown> {
	return Object.fromEntries(
		TRAVEL_MODES.map((m) => [m, computeMode(m, trip, routes, segments)])
	) as Record<TravelMode, CostBreakdown>;
}

/** Cheapest by total and fastest by duration, among modes that can be computed. */
export function pickBest(results: Record<TravelMode, CostBreakdown>): {
	cheapest: TravelMode | null;
	fastest: TravelMode | null;
} {
	let cheapest: TravelMode | null = null;
	let fastest: TravelMode | null = null;
	for (const m of TRAVEL_MODES) {
		const r = results[m];
		if (r.total != null && (cheapest === null || r.total < results[cheapest].total!)) cheapest = m;
		if (
			r.durationMin != null &&
			r.durationMin > 0 &&
			(fastest === null || r.durationMin < results[fastest].durationMin!)
		)
			fastest = m;
	}
	return { cheapest, fastest };
}
