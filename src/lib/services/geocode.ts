import { isJavaAddress } from '../logic/geo';
import type { GeocodeResult } from '../types';
import { abortError, createRateLimiter, isAbortError } from './throttle';

const BASE = 'https://nominatim.openstreetmap.org/search';
export const MIN_QUERY_LENGTH = 3;

const cache = new Map<string, GeocodeResult[]>();
const limit = createRateLimiter(1000);

export class GeocodeError extends Error {}

export function buildSearchUrl(query: string): string {
	return (
		`${BASE}?format=jsonv2&countrycodes=id&addressdetails=1` +
		`&viewbox=105.0,-5.8,114.7,-8.95&bounded=1&limit=5&q=${encodeURIComponent(query)}`
	);
}

interface NominatimItem {
	place_id?: number;
	lat?: string;
	lon?: string;
	name?: string;
	display_name?: string;
	address?: Record<string, string>;
}

/** Keeps only results whose province is on Java. */
export function parseNominatim(data: unknown): GeocodeResult[] {
	if (!Array.isArray(data)) return [];
	const out: GeocodeResult[] = [];
	for (const item of data as NominatimItem[]) {
		const state = item.address?.state ?? '';
		if (!isJavaAddress(item.address)) continue;
		const lat = Number(item.lat);
		const lon = Number(item.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		const parts = (item.display_name ?? '').split(',').map((p) => p.trim());
		const name = item.name?.trim() || parts[0] || 'Unnamed place';
		out.push({
			id: String(item.place_id ?? `${lat},${lon}`),
			name,
			context: parts.filter((p) => p !== name).slice(0, 3).join(', '),
			lat,
			lon,
			state
		});
	}
	return out;
}

export async function searchPlaces(
	query: string,
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch
): Promise<GeocodeResult[]> {
	const q = query.trim();
	if (q.length < MIN_QUERY_LENGTH) return [];
	const key = q.toLowerCase();
	const hit = cache.get(key);
	if (hit) return hit;

	return limit(async () => {
		if (signal?.aborted) throw abortError();
		const again = cache.get(key);
		if (again) return again;
		let res: Response;
		try {
			res = await fetchImpl(buildSearchUrl(q), { signal, headers: { Accept: 'application/json' } });
		} catch (e) {
			if (isAbortError(e)) throw e;
			throw new GeocodeError('Place search is unavailable. Check your connection and try again.');
		}
		if (!res.ok) {
			throw new GeocodeError(
				res.status === 429
					? 'Place search is busy. Wait a moment and try again.'
					: 'Place search failed. Try again in a moment.'
			);
		}
		let data: unknown;
		try {
			data = await res.json();
		} catch {
			throw new GeocodeError('Place search returned an unexpected response.');
		}
		const results = parseNominatim(data);
		cache.set(key, results);
		return results;
	});
}
