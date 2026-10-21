import type { CarPreset, FuelData, Stop, TravelMode, TripState } from '../types';
import fuelJson from './fuel.json';

export const fuelData: FuelData = fuelJson;

export const DEFAULTS = {
	passengers: 2,
	minPassengers: 1,
	maxPassengers: 50,
	carCapacity: 7,
	motorcycleCapacity: 2,
	carPreset: 'mpv' as CarPreset,
	motorcycleKmPerLiter: 40,
	fuelId: 'pertalite',
	train: { speedKmh: 70, bufferMin: 30 },
	bus: { speedKmh: 45, bufferMin: 30 },
	maxStops: 10
} as const;

/** Selecting a preset fills km/L and the usual fuel for that car type; "custom" keeps both. */
export const CAR_PRESETS: {
	id: CarPreset;
	label: string;
	kmPerLiter: number | null;
	fuelId: string | null;
}[] = [
	{ id: 'city', label: 'City car / LCGC', kmPerLiter: 15, fuelId: 'pertalite' },
	{ id: 'mpv', label: 'MPV 1.5L', kmPerLiter: 12, fuelId: 'pertalite' },
	{ id: 'suv', label: 'SUV 2.0L+ (petrol)', kmPerLiter: 9, fuelId: 'pertamax' },
	{ id: 'suv_diesel', label: 'SUV 2.4L (diesel)', kmPerLiter: 11, fuelId: 'dexlite' },
	{ id: 'custom', label: 'Custom', kmPerLiter: null, fuelId: null }
];

export const MODE_LABELS: Record<TravelMode, string> = {
	car_toll: 'Car — via toll',
	car_notoll: 'Car — no toll',
	motorcycle: 'Motorcycle',
	train: 'Train',
	bus: 'Bus'
};

export function fuelPriceFor(fuelId: string): number {
	return fuelData.fuels.find((f) => f.id === fuelId)?.price ?? 0;
}

export function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** A stop slot the user has not filled yet. Unset stops have non-finite coordinates. */
export function emptyStop(): Stop {
	return { id: newId(), name: '', lat: Number.NaN, lon: Number.NaN };
}

export function isStopSet(stop: Stop): boolean {
	return Number.isFinite(stop.lat) && Number.isFinite(stop.lon);
}

export function defaultTrip(): TripState {
	return {
		version: 1,
		name: '',
		stops: [emptyStop(), emptyStop()],
		passengers: DEFAULTS.passengers,
		roundTrip: false,
		car: {
			preset: DEFAULTS.carPreset,
			kmPerLiter: 12,
			fuelId: DEFAULTS.fuelId,
			fuelPrice: fuelPriceFor(DEFAULTS.fuelId)
		},
		motorcycle: {
			kmPerLiter: DEFAULTS.motorcycleKmPerLiter,
			fuelId: DEFAULTS.fuelId,
			fuelPrice: fuelPriceFor(DEFAULTS.fuelId)
		},
		toll: { selectedIds: [], overrides: {}, other: 0 },
		transit: { trainTicket: null, busTicket: null, localTransport: 0 },
		extras: { parking: 0, food: 0, lodging: 0, other: 0 },
		selectedMode: 'car_toll'
	};
}
