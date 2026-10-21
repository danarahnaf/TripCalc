/// <reference types="node" />
import { expect, type Locator, type Page } from '@playwright/test';

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
	/** 'down' answers every OSRM request with 503. */
	routing?: 'ok' | 'down';
	/** 'unsupported' mimics the public demo server, which rejects exclude=toll. */
	notoll?: 'unsupported' | 'ok';
	search?: 'ok' | 'down';
	tollNames?: string[];
}

export interface MockCounters {
	search: number;
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
	const counters: MockCounters = { search: 0, osrmToll: 0, osrmNotoll: 0 };
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
	const routed = page.waitForResponse((r) => {
		const url = r.url();
		if (!url.startsWith('https://router.project-osrm.org/') || url.includes('exclude')) return false;
		return url.split('/driving/')[1].split('?')[0].split(';').length === 3;
	});
	await pickPlace(page, 'Stop 1', 'Pasuruan');
	await routed;
	await expect(page.getByText('Finding routes…')).toHaveCount(0);
	await expect(modeCard(page, 'Car — via toll')).toContainText('Rp', { timeout: 10_000 });
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
