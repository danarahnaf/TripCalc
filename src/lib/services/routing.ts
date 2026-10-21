import { flipCoords } from '../logic/geo';
import { collectTollNames } from '../logic/toll-match';
import type { RouteResult } from '../types';
import { abortError, isAbortError } from './throttle';

const BASE = 'https://router.project-osrm.org/route/v1/driving/';
const RETRY_DELAY_MS = 2000;

export const NOTOLL_UNAVAILABLE = 'No-toll route unavailable, showing default route';
export const NOTOLL_MAY_USE_TOLL = 'Route may still use toll roads';

export class RoutingError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean
	) {
		super(message);
	}
}

export function buildRouteUrl(points: { lat: number; lon: number }[], excludeToll: boolean): string {
	const coords = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
	return `${BASE}${coords}?overview=full&geometries=geojson&steps=true${excludeToll ? '&exclude=toll' : ''}`;
}

interface OsrmRoute {
	distance: number;
	duration: number;
	geometry: { coordinates: [number, number][] };
	legs?: { steps?: { name?: string }[] }[];
}

export function parseOsrm(json: unknown): RouteResult {
	const data = json as { code?: string; routes?: OsrmRoute[] } | null;
	if (!data || typeof data !== 'object' || typeof data.code !== 'string') {
		throw new RoutingError('The routing server returned an unexpected response.', true);
	}
	if (data.code === 'NoRoute') {
		throw new RoutingError('No road route found between these stops.', false);
	}
	const route = data.routes?.[0];
	if (data.code !== 'Ok' || !route || !Array.isArray(route.geometry?.coordinates)) {
		throw new RoutingError('The routing server could not plan this route.', false);
	}
	const names = (route.legs ?? []).flatMap((leg) => (leg.steps ?? []).map((s) => s.name ?? ''));
	return {
		distanceKm: route.distance / 1000,
		durationMin: route.duration / 60,
		geometry: flipCoords(route.geometry.coordinates),
		tollStepNames: collectTollNames(names)
	};
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(abortError());
		const t = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(t);
				reject(abortError());
			},
			{ once: true }
		);
	});
}

/** One OSRM request with at most one retry after 2 s (network errors, 429, 5xx). */
export async function fetchRoute(
	points: { lat: number; lon: number }[],
	excludeToll: boolean,
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch,
	retryDelayMs = RETRY_DELAY_MS
): Promise<RouteResult> {
	const url = buildRouteUrl(points, excludeToll);
	let lastError: RoutingError = new RoutingError('Routing failed.', true);
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt > 0) await sleep(retryDelayMs, signal);
		try {
			const res = await fetchImpl(url, { signal });
			if (res.status === 429 || res.status >= 500) {
				throw new RoutingError('The free routing server is busy. Try again in a moment.', true);
			}
			const json = await res.json().catch(() => null);
			return parseOsrm(json);
		} catch (e) {
			if (isAbortError(e)) throw e;
			lastError =
				e instanceof RoutingError
					? e
					: new RoutingError('Could not reach the routing server. Check your connection.', true);
			if (!lastError.retryable) break;
		}
	}
	throw lastError;
}

export interface RoutesOutcome {
	toll: RouteResult;
	notoll: RouteResult;
	/** Badge text for the no-toll route, or null. */
	notollNotice: string | null;
}

/** Via-toll and no-toll routes. Falls back to the default route if `exclude=toll` fails. */
export async function fetchRoutes(
	points: { lat: number; lon: number }[],
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch,
	retryDelayMs = RETRY_DELAY_MS
): Promise<RoutesOutcome> {
	const [tollRes, notollRes] = await Promise.allSettled([
		fetchRoute(points, false, signal, fetchImpl, retryDelayMs),
		fetchRoute(points, true, signal, fetchImpl, retryDelayMs)
	]);
	if (signal?.aborted) throw abortError();
	if (tollRes.status === 'rejected') throw tollRes.reason;
	const toll = tollRes.value;
	if (notollRes.status === 'rejected') {
		return { toll, notoll: { ...toll, fallbackUsed: true }, notollNotice: NOTOLL_UNAVAILABLE };
	}
	const notoll = notollRes.value;
	return {
		toll,
		notoll,
		notollNotice: notoll.tollStepNames.length > 0 ? NOTOLL_MAY_USE_TOLL : null
	};
}
