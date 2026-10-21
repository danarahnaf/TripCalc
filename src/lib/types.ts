export type TravelMode = 'car_toll' | 'car_notoll' | 'motorcycle' | 'train' | 'bus';

export const TRAVEL_MODES: TravelMode[] = ['car_toll', 'car_notoll', 'motorcycle', 'train', 'bus'];

export interface Stop {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

export interface RouteResult {
	distanceKm: number;
	durationMin: number;
	geometry: [number, number][]; // [lat, lon]
	tollStepNames: string[];
	fallbackUsed?: boolean;
	/** Set by providers that know whether the route uses toll roads (Valhalla). */
	usesToll?: boolean;
}

export interface RoutePair {
	toll: RouteResult | null;
	notoll: RouteResult | null;
}

export type CarPreset = 'city' | 'mpv' | 'suv' | 'suv_diesel' | 'custom';

export interface TripState {
	version: 1;
	name: string;
	stops: Stop[];
	passengers: number;
	roundTrip: boolean;
	car: { preset: CarPreset; kmPerLiter: number; fuelId: string; fuelPrice: number };
	motorcycle: { kmPerLiter: number; fuelId: string; fuelPrice: number };
	toll: { selectedIds: string[]; overrides: Record<string, number>; other: number };
	transit: { trainTicket: number | null; busTicket: number | null; localTransport: number };
	extras: { parking: number; food: number; lodging: number; other: number };
	selectedMode: TravelMode;
}

export interface TollData {
	meta: {
		wilayah: string;
		mata_uang: string;
		acuan_data: string;
		sumber: string[];
		jenis_tarif: string;
		catatan: string;
		golongan: string;
	};
	ruas: TollSegment[];
}

export interface TollSegment {
	id: string;
	nama: string;
	provinsi: string;
	tarif: number;
	perlu_verifikasi: boolean;
}

export interface Fuel {
	id: string;
	name: string;
	price: number;
}

export interface FuelData {
	updated: string;
	note: string;
	fuels: Fuel[];
}

export interface CostLine {
	label: string;
	amount: number;
	detail?: string;
}

export interface CostBreakdown {
	mode: TravelMode;
	distanceKm: number | null;
	durationMin: number | null;
	lines: CostLine[];
	/** null when the cost cannot be computed yet (no route, or missing ticket price). */
	total: number | null;
	perPerson: number | null;
	/** Cars or motorcycles needed; null for train and bus. */
	vehicles: number | null;
	notes: string[];
	/** Why `total` is null, e.g. "Enter ticket price". */
	missing: string | null;
}

export interface GeocodeResult {
	id: string;
	name: string;
	context: string;
	lat: number;
	lon: number;
	state: string;
}
