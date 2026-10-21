import { newId } from '../data/defaults';
import { serializeTrip, validateTrip } from '../logic/share';
import type { TripState } from '../types';

const KEY = 'lajur:v1:trips';

export interface SavedTrip {
	id: string;
	name: string;
	savedAt: number;
	trip: TripState;
}

function isQuotaError(e: unknown): boolean {
	return (
		e instanceof DOMException &&
		(e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
	);
}

class SavedTrips {
	list = $state<SavedTrip[]>([]);
	error = $state<string | null>(null);

	load() {
		let raw: string | null;
		try {
			raw = localStorage.getItem(KEY);
		} catch {
			this.error = 'Browser storage is blocked, so trips cannot be saved here.';
			return;
		}
		if (!raw) {
			this.list = [];
			return;
		}
		try {
			const arr: unknown = JSON.parse(raw);
			if (!Array.isArray(arr)) throw new Error('not an array');
			const out: SavedTrip[] = [];
			for (const item of arr) {
				const trip = validateTrip(item?.trip);
				if (!trip || typeof item.id !== 'string') continue;
				out.push({
					id: item.id,
					name: typeof item.name === 'string' && item.name ? item.name : 'Untitled trip',
					savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
					trip
				});
			}
			this.list = out;
		} catch {
			this.list = [];
			this.error = 'Saved trips could not be read and were skipped.';
		}
	}

	#persist(next: SavedTrip[]): boolean {
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
			this.list = next;
			this.error = null;
			return true;
		} catch (e) {
			this.error = isQuotaError(e)
				? 'Browser storage is full. Delete a saved trip and try again.'
				: 'Could not write to browser storage.';
			return false;
		}
	}

	/** Creates a new entry, or updates the entry with `id`. Returns the saved id or null. */
	save(trip: TripState, name: string, id?: string | null): string | null {
		const entry: SavedTrip = {
			id: id && this.list.some((t) => t.id === id) ? id : newId(),
			name: name.trim() || 'Untitled trip',
			savedAt: Date.now(),
			trip: serializeTrip({ ...trip, name: name.trim() })
		};
		const next = [entry, ...this.list.filter((t) => t.id !== entry.id)];
		return this.#persist(next) ? entry.id : null;
	}

	rename(id: string, name: string): boolean {
		const clean = name.trim() || 'Untitled trip';
		return this.#persist(
			this.list.map((t) => (t.id === id ? { ...t, name: clean, trip: { ...t.trip, name: clean } } : t))
		);
	}

	remove(id: string): boolean {
		return this.#persist(this.list.filter((t) => t.id !== id));
	}

	get(id: string): SavedTrip | undefined {
		return this.list.find((t) => t.id === id);
	}
}

export const saved = new SavedTrips();
