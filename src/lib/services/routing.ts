import { flipCoords } from '../logic/geo';
import { collectTollNames } from '../logic/toll-match';
import type { RouteResult } from '../types';
import { abortError, createRateLimiter, isAbortError } from './throttle';

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

/** The routing engine answered: there is no road between these stops. Never retried. */
export class NoRouteError extends RoutingError {
	constructor() {
		super('No road route found between these stops.', false);
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
	if (data.code === 'NoRoute') throw new NoRouteError();
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

// --- Valhalla (FOSSGIS public server) ----------------------------------------
// The public OSRM servers cannot exclude tolls, and for some trips (e.g. Surabaya → Malang) their
// default route skips the toll road entirely. Valhalla can prefer or avoid tolls per request and
// reports which road segments are tolled, so it is the main provider; OSRM is the fallback.

const VALHALLA = 'https://valhalla1.openstreetmap.de';
/** Fair use of the free server: at most one Valhalla request per second. */
const valhallaLimit = createRateLimiter(1000);
/** Long shapes are thinned before map-matching to keep the trace request small. */
const MAX_TRACE_POINTS = 4000;

/** Decodes a Valhalla polyline (precision 6) to `[lat, lon]` pairs. */
export function decodePolyline6(str: string): [number, number][] {
	const out: [number, number][] = [];
	let i = 0;
	let lat = 0;
	let lon = 0;
	const next = () => {
		let result = 0;
		let shift = 0;
		let b: number;
		do {
			b = str.charCodeAt(i++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		return result & 1 ? ~(result >> 1) : result >> 1;
	};
	while (i < str.length) {
		lat += next();
		lon += next();
		out.push([lat / 1e6, lon / 1e6]);
	}
	return out;
}

/** Encodes `[lat, lon]` pairs as a precision-6 polyline. */
export function encodePolyline6(points: [number, number][]): string {
	let out = '';
	let pLat = 0;
	let pLon = 0;
	const put = (v: number) => {
		let n = v < 0 ? ~(v << 1) : v << 1;
		while (n >= 0x20) {
			out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
			n >>= 5;
		}
		out += String.fromCharCode(n + 63);
	};
	for (const [la, lo] of points) {
		const lat = Math.round(la * 1e6);
		const lon = Math.round(lo * 1e6);
		put(lat - pLat);
		put(lon - pLon);
		pLat = lat;
		pLon = lon;
	}
	return out;
}

export function buildValhallaRouteUrl(
	points: { lat: number; lon: number }[],
	avoidTolls: boolean
): string {
	const query = {
		locations: points.map((p) => ({ lat: p.lat, lon: p.lon, type: 'break' })),
		costing: 'auto',
		costing_options: { auto: { use_tolls: avoidTolls ? 0 : 1 } },
		units: 'kilometers'
	};
	return `${VALHALLA}/route?json=${encodeURIComponent(JSON.stringify(query))}`;
}

interface ValhallaManeuver {
	toll?: boolean;
	street_names?: string[];
}

interface ValhallaTrip {
	summary?: { length: number; time: number; has_toll?: boolean };
	legs?: { shape: string; maneuvers?: ValhallaManeuver[] }[];
}

export function parseValhalla(json: unknown): RouteResult {
	const data = json as { trip?: ValhallaTrip; error_code?: number; error?: string } | null;
	if (!data || typeof data !== 'object') {
		throw new RoutingError('The routing server returned an unexpected response.', true);
	}
	const trip = data.trip;
	if (!trip?.summary || !Array.isArray(trip.legs)) {
		// 442: no path between locations; 171: no suitable edges near a location.
		if (data.error_code === 442 || data.error_code === 171) throw new NoRouteError();
		throw new RoutingError('The routing server could not plan this route.', false);
	}
	const geometry: [number, number][] = [];
	for (const leg of trip.legs) {
		const pts = decodePolyline6(leg.shape);
		// Each leg starts where the previous one ended; skip the duplicate point.
		geometry.push(...(geometry.length ? pts.slice(1) : pts));
	}
	const tollNames = trip.legs.flatMap((leg) =>
		(leg.maneuvers ?? []).filter((m) => m.toll).flatMap((m) => m.street_names ?? [])
	);
	return {
		distanceKm: trip.summary.length,
		durationMin: trip.summary.time / 60,
		geometry,
		tollStepNames: collectTollNames(tollNames),
		usesToll: trip.summary.has_toll === true
	};
}

/** One Valhalla route with at most one retry after 2 s (network errors, 429, 5xx). */
export async function fetchValhallaRoute(
	points: { lat: number; lon: number }[],
	avoidTolls: boolean,
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch,
	retryDelayMs = RETRY_DELAY_MS
): Promise<RouteResult> {
	const url = buildValhallaRouteUrl(points, avoidTolls);
	let lastError: RoutingError = new RoutingError('Routing failed.', true);
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt > 0) await sleep(retryDelayMs, signal);
		try {
			const res = await valhallaLimit(() => {
				if (signal?.aborted) throw abortError();
				return fetchImpl(url, { signal });
			});
			if (res.status === 429 || res.status >= 500) {
				throw new RoutingError('The free routing server is busy. Try again in a moment.', true);
			}
			return parseValhalla(await res.json().catch(() => null));
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

/**
 * Full names of the toll roads along a route ("Jalan Tol Surabaya–Gempol"…), from Valhalla's
 * per-segment attributes. Maneuvers often only carry route numbers like "8" or "AH2".
 * Returns [] on any failure; suggestions then fall back to the maneuver names.
 */
export async function fetchTollRoadNames(
	geometry: [number, number][],
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch
): Promise<string[]> {
	if (geometry.length < 2) return [];
	const step = Math.ceil(geometry.length / MAX_TRACE_POINTS);
	const shape = geometry.filter((_, i) => i % step === 0 || i === geometry.length - 1);
	try {
		const res = await valhallaLimit(() => {
			if (signal?.aborted) throw abortError();
			// text/plain keeps this a "simple" request (no CORS preflight).
			return fetchImpl(`${VALHALLA}/trace_attributes`, {
				method: 'POST',
				signal,
				headers: { 'Content-Type': 'text/plain' },
				body: JSON.stringify({
					encoded_polyline: encodePolyline6(shape),
					shape_match: 'walk_or_snap',
					costing: 'auto',
					filters: { attributes: ['edge.names', 'edge.toll'], action: 'include' }
				})
			});
		});
		if (!res.ok) return [];
		const data = (await res.json()) as { edges?: { toll?: boolean; names?: string[] }[] };
		return collectTollNames((data.edges ?? []).filter((e) => e.toll).flatMap((e) => e.names ?? []));
	} catch (e) {
		if (isAbortError(e)) throw e;
		return [];
	}
}

export interface RoutesOutcome {
	toll: RouteResult;
	notoll: RouteResult;
	/** Badge text for the no-toll route, or null. */
	notollNotice: string | null;
}

/**
 * Via-toll and no-toll routes from Valhalla (tolls preferred / avoided). If Valhalla is down,
 * the via-toll route comes from OSRM and the no-toll route falls back to it with a badge.
 */
export async function fetchRoutes(
	points: { lat: number; lon: number }[],
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch,
	retryDelayMs = RETRY_DELAY_MS
): Promise<RoutesOutcome> {
	let toll: RouteResult;
	let viaValhalla = true;
	try {
		toll = await fetchValhallaRoute(points, false, signal, fetchImpl, retryDelayMs);
	} catch (e) {
		if (isAbortError(e) || signal?.aborted) throw e;
		// "No route" is an answer, not an outage; don't ask a second provider.
		if (e instanceof NoRouteError) throw e;
		viaValhalla = false;
		toll = await fetchRoute(points, false, signal, fetchImpl, retryDelayMs);
	}

	let notoll: RouteResult | null = null;
	try {
		notoll = viaValhalla
			? await fetchValhallaRoute(points, true, signal, fetchImpl, retryDelayMs)
			: await fetchRoute(points, true, signal, fetchImpl, retryDelayMs);
	} catch (e) {
		if (isAbortError(e) || signal?.aborted) throw e;
	}

	if (viaValhalla && toll.usesToll) {
		const names = await fetchTollRoadNames(toll.geometry, signal, fetchImpl);
		toll = { ...toll, tollStepNames: [...new Set([...names, ...toll.tollStepNames])] };
	}
	if (signal?.aborted) throw abortError();

	if (!notoll) {
		return { toll, notoll: { ...toll, fallbackUsed: true }, notollNotice: NOTOLL_UNAVAILABLE };
	}
	const stillToll = notoll.usesToll ?? notoll.tollStepNames.length > 0;
	return { toll, notoll, notollNotice: stillToll ? NOTOLL_MAY_USE_TOLL : null };
}
