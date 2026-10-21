import type { GeocodeResult } from '../types';

const KEY = 'lajur:v1:recent';
const MAX = 5;

function isPlace(v: unknown): v is GeocodeResult {
	const p = v as GeocodeResult;
	return (
		typeof p === 'object' &&
		p !== null &&
		typeof p.name === 'string' &&
		Number.isFinite(p.lat) &&
		Number.isFinite(p.lon)
	);
}

function samePlace(a: GeocodeResult, b: GeocodeResult): boolean {
	return a.name === b.name && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
}

/** The last few places picked from search, shown when a search box is empty. */
class RecentPlaces {
	list = $state<GeocodeResult[]>([]);
	#loaded = false;

	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		try {
			const arr: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
			if (Array.isArray(arr)) {
				this.list = arr.filter(isPlace).slice(0, MAX).map((p) => ({
					id: String(p.id ?? `${p.lat},${p.lon}`),
					name: p.name,
					context: typeof p.context === 'string' ? p.context : '',
					lat: p.lat,
					lon: p.lon,
					state: typeof p.state === 'string' ? p.state : ''
				}));
			}
		} catch {
			this.list = [];
		}
	}

	add(place: GeocodeResult) {
		this.load();
		this.list = [place, ...this.list.filter((p) => !samePlace(p, place))].slice(0, MAX);
		this.#save();
	}

	clear() {
		this.list = [];
		this.#save();
	}

	#save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.list));
		} catch {
			// Not persisted; recent places are a convenience only.
		}
	}
}

export const recent = new RecentPlaces();
