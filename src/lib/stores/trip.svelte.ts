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
import { formatLatLon, isSamePlace, javaPointError } from '../logic/geo';
import { serializeTrip, validateTrip } from '../logic/share';
import { suggestTollSegments } from '../logic/toll-match';
import { fetchRoutes } from '../services/routing';
import { isAbortError } from '../services/throttle';
import type { CarPreset, RoutePair, Stop, TollData, TravelMode, TripState } from '../types';

export const tollData: TollData = tollJson;
export const tollSegments = tollData.ruas;

export type RouteStatus = 'idle' | 'loading' | 'ok' | 'error';

const DRAFT_KEY = 'lajur:v1:draft';

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
	/** The route ends where it starts, so it already includes the way back. */
	isLoop = $derived(
		this.setStops.length >= 3 &&
			isSamePlace(this.setStops[0], this.setStops[this.setStops.length - 1])
	);

	#controller: AbortController | null = null;
	/** Once the user picks a mode, routing stops auto-selecting the cheapest one. */
	#modeChosen = false;
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
	/** Puts a point (e.g. the user's location) in one slot. Returns an error message, or null. */
	placeAt(index: number, lat: number, lon: number, name: string): string | null {
		const err = javaPointError(lat, lon);
		if (err) return err;
		this.setStop(index, { name, lat, lon });
		return null;
	}

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
		const p = CAR_PRESETS.find((x) => x.id === preset);
		if (p?.kmPerLiter != null) this.state.car.kmPerLiter = p.kmPerLiter;
		if (p?.fuelId) this.setFuel('car', p.fuelId);
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
		this.#modeChosen = true;
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
		// Respect the mode stored with a saved, shared or restored trip.
		this.#modeChosen = true;
	}

	reset() {
		this.load(defaultTrip());
		this.#modeChosen = false;
	}

	// --- draft (auto-save of the trip being edited) -----------------------

	/** Restores the last edited trip. Returns true when it had at least one stop. */
	restoreDraft(): boolean {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) return false;
			const data = JSON.parse(raw);
			const draft = validateTrip(data?.trip);
			if (!draft) return false;
			this.load(draft, typeof data.savedId === 'string' ? data.savedId : null);
			return draft.stops.length > 0;
		} catch {
			return false;
		}
	}

	/** Writes the current trip as the draft; storage errors are ignored. */
	persistDraft() {
		try {
			localStorage.setItem(
				DRAFT_KEY,
				JSON.stringify({ trip: serializeTrip(this.state), savedId: this.savedId })
			);
		} catch {
			// Full or blocked storage: the draft is a convenience only.
		}
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
			if (!this.#modeChosen && this.best.cheapest) this.state.selectedMode = this.best.cheapest;
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
