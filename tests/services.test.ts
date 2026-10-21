import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNominatim, searchPlaces } from '../src/lib/services/geocode';
import {
	buildRouteUrl,
	buildValhallaRouteUrl,
	decodePolyline6,
	encodePolyline6,
	fetchRoute,
	fetchRoutes,
	NOTOLL_MAY_USE_TOLL,
	NOTOLL_UNAVAILABLE,
	parseValhalla
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
});

describe('valhalla', () => {
	const tollPath: [number, number][] = [
		[-7.2575, 112.7521],
		[-7.55, 112.7],
		[-7.9666, 112.6326]
	];
	const freePath: [number, number][] = [
		[-7.2575, 112.7521],
		[-7.6, 112.85],
		[-7.9666, 112.6326]
	];

	function trip(path: [number, number][], km: number, hasToll: boolean, tollNames: string[] = []) {
		return {
			trip: {
				summary: { length: km, time: km * 60, has_toll: hasToll },
				legs: [
					{
						shape: encodePolyline6(path),
						maneuvers: [
							{ street_names: ['Jalan Ahmad Yani'] },
							...tollNames.map((n) => ({ toll: true, street_names: [n] }))
						]
					}
				]
			}
		};
	}

	/** Routes by URL: Valhalla route (use_tolls 1 / 0), trace_attributes, OSRM. */
	function services(
		opts: { valhalla?: 'ok' | 'down' | 'noroute' | 'garbage'; notollHasToll?: boolean } = {}
	) {
		return vi.fn(async (url: string) => {
			if (url.includes('valhalla')) {
				if (opts.valhalla === 'down') return new Response('busy', { status: 503 });
				if (opts.valhalla === 'garbage') return jsonResponse({ hello: 'world' });
				if (opts.valhalla === 'noroute') {
					return jsonResponse({ error_code: 442, error: 'No path could be found' }, 400);
				}
				if (url.includes('trace_attributes')) {
					return jsonResponse({
						edges: [
							{ toll: false, names: ['Jalan Ahmad Yani'] },
							{ toll: true, names: ['8', 'Jalan Tol Surabaya–Gempol'] },
							{ toll: true, names: ['Jalan Tol Pandaan–Malang'] }
						]
					});
				}
				const q = JSON.parse(decodeURIComponent(url.split('json=')[1]));
				const avoid = q.costing_options.auto.use_tolls === 0;
				return jsonResponse(
					avoid
						? trip(freePath, 89, opts.notollHasToll === true)
						: trip(tollPath, 101, true, ['8'])
				);
			}
			return url.includes('exclude=toll')
				? jsonResponse({ code: 'InvalidValue' }, 400)
				: jsonResponse(osrmBody(['Jalan Tol Waru-Juanda']));
		});
	}

	it('encodes and decodes precision-6 polylines', () => {
		const pts: [number, number][] = [
			[38.5, -120.2],
			[40.7, -120.95],
			[43.252, -126.453]
		];
		const encoded = encodePolyline6(pts);
		expect(encoded).toBe('_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI');
		expect(decodePolyline6(encoded)).toEqual(pts);
	});

	it('parses a Valhalla trip into [lat, lon] geometry, km and minutes', () => {
		const r = parseValhalla(trip(tollPath, 101, true, ['Jalan Tol Gempol–Pandaan', '8']));
		expect(r.distanceKm).toBe(101);
		expect(r.durationMin).toBe(101);
		expect(r.geometry).toEqual(tollPath);
		expect(r.usesToll).toBe(true);
		expect(r.tollStepNames).toEqual(['Jalan Tol Gempol–Pandaan']);
	});

	it('asks for tolls preferred and avoided', () => {
		expect(buildValhallaRouteUrl(points, false)).toContain(encodeURIComponent('"use_tolls":1'));
		expect(buildValhallaRouteUrl(points, true)).toContain(encodeURIComponent('"use_tolls":0'));
	});

	it('returns two different routes and full toll road names', async () => {
		const f = services();
		const r = await fetchRoutes(points, undefined, f as unknown as typeof fetch, 0);
		expect(r.toll.distanceKm).toBe(101);
		expect(r.notoll.distanceKm).toBe(89);
		expect(r.notoll.fallbackUsed).toBeUndefined();
		expect(r.notoll.geometry).not.toEqual(r.toll.geometry);
		expect(r.notollNotice).toBeNull();
		expect(r.toll.tollStepNames).toEqual(
			expect.arrayContaining(['Jalan Tol Surabaya–Gempol', 'Jalan Tol Pandaan–Malang'])
		);
		// route (tolls), route (no tolls), trace_attributes; OSRM untouched.
		expect(f).toHaveBeenCalledTimes(3);
		expect(f.mock.calls.every(([u]) => String(u).includes('valhalla'))).toBe(true);
	}, 10_000);

	it('flags a no-toll route that cannot avoid tolls', async () => {
		const r = await fetchRoutes(
			points,
			undefined,
			services({ notollHasToll: true }) as unknown as typeof fetch,
			0
		);
		expect(r.notollNotice).toBe(NOTOLL_MAY_USE_TOLL);
	}, 10_000);

	it('falls back to OSRM when Valhalla is down', async () => {
		const f = services({ valhalla: 'down' });
		const r = await fetchRoutes(points, undefined, f as unknown as typeof fetch, 0);
		expect(r.toll.distanceKm).toBe(95);
		expect(r.toll.geometry[0]).toEqual([-7.2575, 112.7521]); // OSRM [lon, lat] flipped
		expect(r.notoll.fallbackUsed).toBe(true);
		expect(r.notollNotice).toBe(NOTOLL_UNAVAILABLE);
		const valhallaCalls = f.mock.calls.filter(([u]) => String(u).includes('valhalla')).length;
		expect(valhallaCalls).toBe(2); // one request plus one retry
	}, 10_000);

	it('falls back to OSRM when Valhalla answers with something unexpected', async () => {
		const r = await fetchRoutes(
			points,
			undefined,
			services({ valhalla: 'garbage' }) as unknown as typeof fetch,
			0
		);
		expect(r.toll.distanceKm).toBe(95);
		expect(r.notollNotice).toBe(NOTOLL_UNAVAILABLE);
	}, 10_000);

	it('does not ask OSRM when Valhalla finds no road route', async () => {
		const f = services({ valhalla: 'noroute' });
		await expect(fetchRoutes(points, undefined, f as unknown as typeof fetch, 0)).rejects.toThrow(
			/No road route/
		);
		expect(f).toHaveBeenCalledTimes(1);
	}, 10_000);
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
