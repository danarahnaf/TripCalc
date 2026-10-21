import tollJson from '../data/tarif_tol_jawa.json';
import {
	CAR_PRESETS,
	DEFAULTS,
	defaultTrip,
	emptyStop,
	fuelPriceFor,
	isStopSet,
	newId
} from '../data/defaults';
import { clampPassengers, computeAllModes, pickBest } from '../logic/cost';
import { formatLatLon, javaPointError } from '../logic/geo';
import { suggestTollSegments } from '../logic/toll-match';
import { fetchRoutes } from '../services/routing';
import { isAbortError } from '../services/throttle';
import type { CarPreset, RoutePair, Stop, TollData, TravelMode, TripState } from '../types';

export const tollData: TollData = tollJson;
export const tollSegments = tollData.ruas;

export type RouteStatus = 'idle' | 'loading' | 'ok' | 'error';

function stopsKeyOf(stops: Stop[]): string {
	return stops
		.filter(isStopSet)
		.map((s) => `${s.lat.toFixed(6)},${s.lon.toFixed(6)}`)
		.join(';');
}

class TripStore {
	state = $state<TripState>(defaultTrip());
	routes = $state.raw<RoutePair>({ toll: null, notoll: null });
	routeStatus = $state<RouteStatus>('idle');
	routeError = $state<string | null>(null);
	notollNotice = $state<string | null>(null);
	suggestedIds = $state<string[]>([]);
	/** Id of the saved trip this state was loaded from or last saved as. */
	savedId = $state<string | null>(null);

	setStops = $derived(this.state.stops.filter(isStopSet));
	stopsKey = $derived(stopsKeyOf(this.state.stops));
	canAddStop = $derived(this.state.stops.length < DEFAULTS.maxStops);
	results = $derived(computeAllModes(this.state, this.routes, tollSegments));
	best = $derived(pickBest(this.results));

	#controller: AbortController | null = null;
	/** When set, the next route for these stops keeps the loaded toll selection. */
	#keepSelectionFor: string | null = null;

	// --- stops -------------------------------------------------------------

	setStop(index: number, place: { name: string; lat: number; lon: number }) {
		const s = this.state.stops[index];
		if (!s) return;
		this.state.stops[index] = { id: s.id, name: place.name, lat: place.lat, lon: place.lon };
	}

	clearStop(index: number) {
		if (this.state.stops[index]) this.state.stops[index] = emptyStop();
	}

	renameStop(index: number, name: string) {
		const s = this.state.stops[index];
		if (s) s.name = name;
	}

	addStop() {
		if (!this.canAddStop) return;
		this.state.stops.splice(this.state.stops.length - 1, 0, emptyStop());
	}

	removeStop(index: number) {
		if (this.state.stops.length > 2) this.state.stops.splice(index, 1);
		else this.clearStop(index);
	}

	moveStop(index: number, delta: -1 | 1) {
		const j = index + delta;
		const stops = this.state.stops;
		if (j < 0 || j >= stops.length) return;
		[stops[index], stops[j]] = [stops[j], stops[index]];
	}

	/**
	 * Drops a pin: fills the first empty slot, otherwise adds a stop before the destination.
	 * Returns an error message, or null on success.
	 */
	pinPoint(lat: number, lon: number): string | null {
		const err = javaPointError(lat, lon);
		if (err) return err;
		const place = { name: `Pinned point ${formatLatLon(lat, lon)}`, lat, lon };
		const empty = this.state.stops.findIndex((s) => !isStopSet(s));
		if (empty !== -1) {
			this.setStop(empty, place);
			return null;
		}
		if (!this.canAddStop) return `You can plan up to ${DEFAULTS.maxStops} stops.`;
		this.state.stops.splice(this.state.stops.length - 1, 0, { id: newId(), ...place });
		return null;
	}

	// --- settings ----------------------------------------------------------

	setPassengers(n: number) {
		this.state.passengers = clampPassengers(n);
	}

	setCarPreset(preset: CarPreset) {
		this.state.car.preset = preset;
		const km = CAR_PRESETS.find((p) => p.id === preset)?.kmPerLiter;
		if (km != null) this.state.car.kmPerLiter = km;
	}

	setCarKmPerLiter(km: number | null) {
		this.state.car.kmPerLiter = km ?? 0;
		this.state.car.preset = 'custom';
	}

	setFuel(vehicle: 'car' | 'motorcycle', fuelId: string) {
		this.state[vehicle].fuelId = fuelId;
		this.state[vehicle].fuelPrice = fuelPriceFor(fuelId);
	}

	toggleToll(id: string, on: boolean) {
		const ids = this.state.toll.selectedIds.filter((x) => x !== id);
		this.state.toll.selectedIds = on ? [...ids, id] : ids;
	}

	setTollOverride(id: string, price: number | null) {
		const seg = tollSegments.find((s) => s.id === id);
		if (price == null || (seg && price === seg.tarif)) delete this.state.toll.overrides[id];
		else this.state.toll.overrides[id] = price;
	}

	selectMode(mode: TravelMode) {
		this.state.selectedMode = mode;
	}

	// --- whole trip --------------------------------------------------------

	load(trip: TripState, savedId: string | null = null) {
		const copy = $state.snapshot(trip) as TripState;
		while (copy.stops.length < 2) copy.stops.push(emptyStop());
		this.#controller?.abort();
		this.state = copy;
		this.savedId = savedId;
		this.routes = { toll: null, notoll: null };
		this.routeStatus = 'idle';
		this.routeError = null;
		this.notollNotice = null;
		this.suggestedIds = [];
		this.#keepSelectionFor = stopsKeyOf(copy.stops);
	}

	reset() {
		this.load(defaultTrip());
	}

	// --- routing -----------------------------------------------------------

	clearRoutes() {
		this.#controller?.abort();
		this.routes = { toll: null, notoll: null };
		this.routeStatus = 'idle';
		this.routeError = null;
		this.notollNotice = null;
	}

	async refreshRoutes() {
		const key = this.stopsKey;
		const points = this.setStops.map((s) => ({ lat: s.lat, lon: s.lon }));
		if (points.length < 2) return this.clearRoutes();

		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.routeStatus = 'loading';
		this.routeError = null;
		try {
			const out = await fetchRoutes(points, controller.signal);
			if (controller.signal.aborted) return;
			this.routes = { toll: out.toll, notoll: out.notoll };
			this.notollNotice = out.notollNotice;
			this.#applySuggestions(suggestTollSegments(out.toll.tollStepNames, tollSegments), key);
			this.routeStatus = 'ok';
		} catch (e) {
			if (isAbortError(e) || controller.signal.aborted) return;
			this.routes = { toll: null, notoll: null };
			this.routeStatus = 'error';
			this.routeError = e instanceof Error ? e.message : 'Routing failed.';
		}
	}

	#applySuggestions(ids: string[], key: string) {
		const previous = this.suggestedIds;
		this.suggestedIds = ids;
		if (this.#keepSelectionFor === key) {
			this.#keepSelectionFor = null;
			return;
		}
		this.#keepSelectionFor = null;
		// Keep segments the user picked by hand; replace the old suggestions with the new ones.
		const manual = this.state.toll.selectedIds.filter((id) => !previous.includes(id));
		this.state.toll.selectedIds = [...new Set([...manual, ...ids])];
	}
}

export const trip = new TripStore();
