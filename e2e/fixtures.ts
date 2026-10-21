/// <reference types="node" />
import { expect, type Locator, type Page } from '@playwright/test';
import { encodePolyline6 } from '../src/lib/services/routing';

/** Synthetic Nominatim results, keyed by lowercase name prefix. */
const PLACES = [
	{ id: 1, name: 'Surabaya', lat: -7.2575, lon: 112.7521, state: 'East Java', iso: 'ID-JI' },
	{ id: 2, name: 'Pasuruan', lat: -7.6453, lon: 112.9075, state: 'East Java', iso: 'ID-JI' },
	{ id: 3, name: 'Malang', lat: -7.9666, lon: 112.6326, state: 'East Java', iso: 'ID-JI' },
	{ id: 4, name: 'Gilimanuk', lat: -8.17, lon: 114.43, state: 'Bali', iso: 'ID-BA' },
	{ id: 5, name: 'Bakauheni', lat: -5.87, lon: 105.75, state: 'Lampung', iso: 'ID-LA' }
];

export const DEFAULT_TOLL_NAMES = [
	'Jalan Tol Surabaya-Gempol',
	'Jalan Tol Gempol-Pandaan',
	'Jalan Tol Pandaan-Malang'
];

// 1×1 transparent PNG so map tiles never hit the network.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

export interface MockOptions {
	/** 'down' answers every routing request (Valhalla and OSRM) with 503. */
	routing?: 'ok' | 'down';
	/** 'down' fails only Valhalla, so the app falls back to OSRM. */
	valhalla?: 'ok' | 'down';
	/** 'unsupported' mimics the public OSRM demo server, which rejects exclude=toll. */
	notoll?: 'unsupported' | 'ok';
	search?: 'ok' | 'down';
	tollNames?: string[];
}

export interface MockCounters {
	search: number;
	valhallaToll: number;
	valhallaNotoll: number;
	trace: number;
	osrmToll: number;
	osrmNotoll: number;
}

function haversineKm(a: [number, number], b: [number, number]): number {
	const rad = Math.PI / 180;
	const [lon1, lat1] = a;
	const [lon2, lat2] = b;
	const h =
		Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
		Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Mocks OSM tiles, Nominatim and OSRM for one page. Returns live request counters. */
export async function mockServices(page: Page, opts: MockOptions = {}): Promise<MockCounters> {
	const counters: MockCounters = {
		search: 0,
		valhallaToll: 0,
		valhallaNotoll: 0,
		trace: 0,
		osrmToll: 0,
		osrmNotoll: 0
	};
	const tollNames = opts.tollNames ?? DEFAULT_TOLL_NAMES;

	await page.route('https://tile.openstreetmap.org/**', (route) =>
		route.fulfill({ contentType: 'image/png', body: PNG })
	);

	await page.route('https://nominatim.openstreetmap.org/**', (route) => {
		counters.search++;
		if (opts.search === 'down') return route.fulfill({ status: 500, body: 'error' });
		const q = (new URL(route.request().url()).searchParams.get('q') ?? '').trim().toLowerCase();
		const body = PLACES.filter((p) => p.name.toLowerCase().startsWith(q)).map((p) => ({
			place_id: p.id,
			lat: String(p.lat),
			lon: String(p.lon),
			name: p.name,
			display_name: `${p.name}, ${p.state}, Indonesia`,
			address: { state: p.state, 'ISO3166-2-lvl4': p.iso, country_code: 'id' }
		}));
		return route.fulfill({ json: body });
	});

	// Valhalla: the via-toll route goes straight through the stops; the no-toll route bends
	// inland between them, so the two lines (and distances) differ like real ones do.
	await page.route('https://valhalla1.openstreetmap.de/**', (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === '/trace_attributes') {
			counters.trace++;
			if (opts.routing === 'down' || opts.valhalla === 'down') {
				return route.fulfill({ status: 503, body: 'busy' });
			}
			return route.fulfill({
				json: {
					edges: [
						{ toll: false, names: ['Jalan Ahmad Yani'] },
						...tollNames.map((n) => ({ toll: true, names: ['8', n] }))
					]
				}
			});
		}
		const q = JSON.parse(url.searchParams.get('json') ?? '{}');
		const avoid = q.costing_options?.auto?.use_tolls === 0;
		if (avoid) counters.valhallaNotoll++;
		else counters.valhallaToll++;
		if (opts.routing === 'down' || opts.valhalla === 'down') {
			return route.fulfill({ status: 503, body: 'busy' });
		}
		const stops = (q.locations as { lat: number; lon: number }[]).map(
			(l) => [l.lon, l.lat] as [number, number]
		);
		const path: [number, number][] = [];
		let km = 0;
		stops.forEach((p, i) => {
			if (i > 0) {
				const prev = stops[i - 1];
				if (avoid) path.push([(prev[0] + p[0]) / 2 - 0.06, (prev[1] + p[1]) / 2]);
				km += haversineKm(prev, p) * (avoid ? 1.15 : 1.25);
			}
			path.push(p);
		});
		const shape = encodePolyline6(path.map(([lon, lat]) => [lat, lon]));
		return route.fulfill({
			json: {
				trip: {
					summary: { length: km, time: (km / (avoid ? 40 : 75)) * 3600, has_toll: !avoid },
					legs: [
						{
							shape,
							maneuvers: avoid
								? [{ street_names: ['Jalan Raya Porong'] }]
								: [{ toll: true, street_names: ['8', 'AH2'] }]
						}
					]
				}
			}
		});
	});

	await page.route('https://router.project-osrm.org/**', (route) => {
		const url = new URL(route.request().url());
		const notoll = url.searchParams.get('exclude') === 'toll';
		if (notoll) counters.osrmNotoll++;
		else counters.osrmToll++;
		if (opts.routing === 'down') return route.fulfill({ status: 503, body: 'busy' });
		if (notoll && (opts.notoll ?? 'unsupported') === 'unsupported') {
			return route.fulfill({
				status: 400,
				json: { code: 'InvalidValue', message: 'Exclude flag combination is not supported.' }
			});
		}
		const coords = decodeURIComponent(url.pathname.split('/driving/')[1])
			.split(';')
			.map((pair) => pair.split(',').map(Number) as [number, number]);
		let km = 0;
		for (let i = 1; i < coords.length; i++) km += haversineKm(coords[i - 1], coords[i]) * 1.25;
		const names = notoll ? ['Jalan Raya Porong'] : tollNames;
		return route.fulfill({
			json: {
				code: 'Ok',
				routes: [
					{
						distance: km * 1000,
						duration: (km / (notoll ? 45 : 75)) * 3600,
						geometry: { type: 'LineString', coordinates: coords },
						legs: [{ steps: names.map((name) => ({ name })) }]
					}
				]
			}
		});
	});

	return counters;
}

export function modeCards(page: Page): Locator {
	return page.getByRole('group', { name: 'Travel modes' }).getByRole('button');
}

export function modeCard(page: Page, label: string): Locator {
	return modeCards(page).filter({ hasText: label });
}

/** Digits of the first "Rp …" amount in a text, e.g. "Rp 99.996" → 99996. */
export function rupiah(text: string): number {
	const m = text.match(/Rp\s?([\d.]+)/);
	if (!m) throw new Error(`No Rp amount in: ${text}`);
	return Number(m[1].replace(/\./g, ''));
}

export async function cardTotal(page: Page, label: string): Promise<number> {
	return rupiah(await modeCard(page, label).innerText());
}

/** Types into a stop's search box and picks the first result with Enter. */
export async function pickPlace(page: Page, slot: string, query: string) {
	const box = page.getByRole('combobox', { name: `Search ${slot}` });
	await box.fill(query);
	await expect(page.getByRole('option').first()).toContainText(query);
	await box.press('Enter');
	await expect(page.getByRole('textbox', { name: `Name of ${slot}` })).toHaveValue(query);
}

/** Surabaya → Pasuruan → Malang, waiting until the via-toll route has a price. */
export async function planSurabayaMalang(page: Page) {
	await page.goto('/');
	await pickPlace(page, 'Start', 'Surabaya');
	await pickPlace(page, 'Destination', 'Malang');
	await page.getByRole('button', { name: '+ Add stop' }).click();
	// The two-stop route may already be priced; wait for the three-stop one.
	const routed = waitForRoute(page, 3);
	await pickPlace(page, 'Stop 1', 'Pasuruan');
	await routed;
	await expect(page.getByText('Finding routes…')).toHaveCount(0, { timeout: 10_000 });
	await expect(modeCard(page, 'Car — via toll')).toContainText('Rp', { timeout: 10_000 });
}

/** Resolves when the via-toll Valhalla route for `stops` stops has been answered. */
export function waitForRoute(page: Page, stops: number) {
	return page.waitForResponse(
		(r) => {
			const url = new URL(r.url());
			if (url.origin !== 'https://valhalla1.openstreetmap.de' || url.pathname !== '/route') {
				return false;
			}
			const q = JSON.parse(url.searchParams.get('json') ?? '{}');
			return q.costing_options?.auto?.use_tolls === 1 && q.locations?.length === stops;
		},
		{ timeout: 15_000 }
	);
}

/** The visible status message under a search box (a screen-reader copy also exists). */
export function searchMessage(page: Page, text: string): Locator {
	return page.getByRole('paragraph').filter({ hasText: text });
}

/** Opens one of the collapsible settings panels by its title. */
export async function openPanel(page: Page, title: string) {
	const details = page.locator('details').filter({ has: page.getByRole('heading', { name: title }) });
	if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
		await details.locator(':scope > summary').click();
	}
	return details;
}
