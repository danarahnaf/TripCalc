import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNominatim, searchPlaces } from '../src/lib/services/geocode';
import {
	buildRouteUrl,
	fetchRoute,
	fetchRoutes,
	NOTOLL_MAY_USE_TOLL,
	NOTOLL_UNAVAILABLE
} from '../src/lib/services/routing';

const points = [
	{ lat: -7.2575, lon: 112.7521 },
	{ lat: -7.9666, lon: 112.6326 }
];

function osrmBody(names: string[]) {
	return {
		code: 'Ok',
		routes: [
			{
				distance: 95000,
				duration: 5400,
				geometry: {
					coordinates: [
						[112.7521, -7.2575],
						[112.6326, -7.9666]
					]
				},
				legs: [{ steps: names.map((name) => ({ name })) }]
			}
		]
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

afterEach(() => vi.restoreAllMocks());

describe('routing', () => {
	it('builds lon,lat URLs and adds exclude=toll', () => {
		const url = buildRouteUrl(points, true);
		expect(url).toContain('112.752100,-7.257500;112.632600,-7.966600');
		expect(url).toContain('overview=full&geometries=geojson&steps=true&exclude=toll');
		expect(buildRouteUrl(points, false)).not.toContain('exclude');
	});
	it('parses and flips geometry to [lat, lon]', async () => {
		const f = vi.fn(async () => jsonResponse(osrmBody(['Jalan Tol Pandaan-Malang', 'Jalan A'])));
		const r = await fetchRoute(points, false, undefined, f as unknown as typeof fetch, 0);
		expect(r.distanceKm).toBe(95);
		expect(r.durationMin).toBe(90);
		expect(r.geometry[0]).toEqual([-7.2575, 112.7521]);
		expect(r.tollStepNames).toEqual(['Jalan Tol Pandaan-Malang']);
	});
	it('retries once, then gives up', async () => {
		const f = vi.fn(async () => new Response('busy', { status: 503 }));
		await expect(
			fetchRoute(points, false, undefined, f as unknown as typeof fetch, 0)
		).rejects.toThrow();
		expect(f).toHaveBeenCalledTimes(2);
	});
	it('does not retry NoRoute', async () => {
		const f = vi.fn(async () => jsonResponse({ code: 'NoRoute' }, 400));
		await expect(
			fetchRoute(points, false, undefined, f as unknown as typeof fetch, 0)
		).rejects.toThrow(/No road route/);
		expect(f).toHaveBeenCalledTimes(1);
	});
	it('falls back to the default route when exclude=toll fails', async () => {
		const f = vi.fn(async (url: string) =>
			url.includes('exclude=toll')
				? jsonResponse({ code: 'InvalidValue' }, 400)
				: jsonResponse(osrmBody([]))
		);
		const r = await fetchRoutes(points, undefined, f as unknown as typeof fetch, 0);
		expect(r.notoll.fallbackUsed).toBe(true);
		expect(r.notollNotice).toBe(NOTOLL_UNAVAILABLE);
	});
	it('flags a no-toll route that still has toll names', async () => {
		const f = vi.fn(async () => jsonResponse(osrmBody(['Jalan Tol Waru-Juanda'])));
		const r = await fetchRoutes(points, undefined, f as unknown as typeof fetch, 0);
		expect(r.notollNotice).toBe(NOTOLL_MAY_USE_TOLL);
	});
});

describe('geocode', () => {
	it('keeps only results in Java provinces', () => {
		const out = parseNominatim([
			{ place_id: 1, lat: '-7.25', lon: '112.75', name: 'Surabaya', display_name: 'Surabaya, Jawa Timur, Indonesia', address: { state: 'Jawa Timur' } },
			{ place_id: 2, lat: '-8.17', lon: '114.43', name: 'Gilimanuk', display_name: 'Gilimanuk, Bali, Indonesia', address: { state: 'Bali' } },
			{ place_id: 3, lat: '-5.87', lon: '105.75', name: 'Bakauheni', display_name: 'Bakauheni, Lampung, Indonesia', address: { state: 'Lampung' } }
		]);
		expect(out.map((r) => r.name)).toEqual(['Surabaya']);
	});
	it('ignores short queries and caches results', async () => {
		const f = vi.fn(async () =>
			jsonResponse([
				{ place_id: 9, lat: '-7.97', lon: '112.63', name: 'Malang', display_name: 'Malang, Jawa Timur', address: { state: 'Jawa Timur' } }
			])
		);
		expect(await searchPlaces('ma', undefined, f as unknown as typeof fetch)).toEqual([]);
		const a = await searchPlaces('Malang', undefined, f as unknown as typeof fetch);
		const b = await searchPlaces('malang ', undefined, f as unknown as typeof fetch);
		expect(a).toEqual(b);
		expect(f).toHaveBeenCalledTimes(1);
	});
});
