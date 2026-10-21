import LZString from 'lz-string';
import { CAR_PRESETS, DEFAULTS, defaultTrip, isStopSet, newId } from '../data/defaults';
import type { CarPreset, Stop, TravelMode, TripState } from '../types';
import { TRAVEL_MODES } from '../types';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
	return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function nullableNum(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function str(v: unknown, fallback: string, maxLen = 200): string {
	return typeof v === 'string' ? v.slice(0, maxLen) : fallback;
}

/**
 * Validates untrusted trip data (shared links, localStorage).
 * Returns null for a wrong version or corrupted stops; fills defaults for other missing fields.
 */
export function validateTrip(raw: unknown): TripState | null {
	if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.stops)) return null;
	if (raw.stops.length > DEFAULTS.maxStops) return null;

	const stops: Stop[] = [];
	for (const s of raw.stops) {
		if (!isObj(s) || typeof s.name !== 'string') return null;
		if (typeof s.lat !== 'number' || typeof s.lon !== 'number') return null;
		if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return null;
		stops.push({
			id: typeof s.id === 'string' && s.id ? s.id : newId(),
			name: s.name.slice(0, 200),
			lat: s.lat,
			lon: s.lon
		});
	}

	const d = defaultTrip();
	const car = isObj(raw.car) ? raw.car : {};
	const moto = isObj(raw.motorcycle) ? raw.motorcycle : {};
	const toll = isObj(raw.toll) ? raw.toll : {};
	const transit = isObj(raw.transit) ? raw.transit : {};
	const extras = isObj(raw.extras) ? raw.extras : {};

	const preset = CAR_PRESETS.some((p) => p.id === car.preset)
		? (car.preset as CarPreset)
		: 'custom';
	const overrides: Record<string, number> = {};
	if (isObj(toll.overrides)) {
		for (const [k, v] of Object.entries(toll.overrides)) {
			if (typeof v === 'number' && Number.isFinite(v) && v >= 0) overrides[k] = v;
		}
	}

	return {
		version: 1,
		name: str(raw.name, '', 100),
		stops,
		passengers: Math.round(
			num(raw.passengers, d.passengers, DEFAULTS.minPassengers, DEFAULTS.maxPassengers)
		),
		roundTrip: raw.roundTrip === true,
		car: {
			preset,
			kmPerLiter: num(car.kmPerLiter, d.car.kmPerLiter, 0, 1000),
			fuelId: str(car.fuelId, d.car.fuelId, 50),
			fuelPrice: num(car.fuelPrice, d.car.fuelPrice)
		},
		motorcycle: {
			kmPerLiter: num(moto.kmPerLiter, d.motorcycle.kmPerLiter, 0, 1000),
			fuelId: str(moto.fuelId, d.motorcycle.fuelId, 50),
			fuelPrice: num(moto.fuelPrice, d.motorcycle.fuelPrice)
		},
		toll: {
			selectedIds: Array.isArray(toll.selectedIds)
				? [...new Set(toll.selectedIds.filter((x): x is string => typeof x === 'string'))]
				: [],
			overrides,
			other: num(toll.other, 0)
		},
		transit: {
			trainTicket: nullableNum(transit.trainTicket),
			busTicket: nullableNum(transit.busTicket),
			localTransport: num(transit.localTransport, 0)
		},
		extras: {
			parking: num(extras.parking, 0),
			food: num(extras.food, 0),
			lodging: num(extras.lodging, 0),
			other: num(extras.other, 0)
		},
		selectedMode: TRAVEL_MODES.includes(raw.selectedMode as TravelMode)
			? (raw.selectedMode as TravelMode)
			: 'car_toll'
	};
}

/** Copy of the trip without unfilled stop slots, ready for JSON. */
export function serializeTrip(trip: TripState): TripState {
	const copy: TripState = JSON.parse(JSON.stringify({ ...trip, stops: [] }));
	copy.stops = trip.stops.filter(isStopSet).map((s) => ({ ...s }));
	return copy;
}

export function encodeTrip(trip: TripState): string {
	return LZString.compressToEncodedURIComponent(JSON.stringify(serializeTrip(trip)));
}

/** Decodes a `?t=` value. Returns null (never throws) for corrupted or wrong-version input. */
export function decodeTrip(encoded: string | null | undefined): TripState | null {
	if (!encoded) return null;
	try {
		const json = LZString.decompressFromEncodedURIComponent(encoded);
		if (!json) return null;
		return validateTrip(JSON.parse(json));
	} catch {
		return null;
	}
}
