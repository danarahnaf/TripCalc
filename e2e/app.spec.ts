import { expect, test } from '@playwright/test';
import {
	mockServices,
	modeCard,
	openPanel,
	pickPlace,
	planSurabayaMalang,
	searchMessage
} from './fixtures';

test.describe('errors and limits', () => {
	test('routing failure shows a friendly error and retries only once', async ({ page }) => {
		const calls = await mockServices(page, { routing: 'down' });
		await page.goto('/');
		await pickPlace(page, 'Start', 'Surabaya');
		await pickPlace(page, 'Destination', 'Malang');

		const alert = page.getByRole('alert').filter({ hasText: 'busy' });
		await expect(alert).toBeVisible({ timeout: 10_000 });
		await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
		// One request plus one retry after 2 s per route kind, then nothing more.
		await page.waitForTimeout(3000);
		expect(calls.osrmToll).toBe(2);
		expect(calls.osrmNotoll).toBe(2);
	});

	test('search failure is shown inline', async ({ page }) => {
		await mockServices(page, { search: 'down' });
		await page.goto('/');
		await page.getByRole('combobox', { name: 'Search Start' }).fill('Surabaya');
		await expect(searchMessage(page, 'Place search failed. Try again in a moment.')).toBeVisible();
	});

	test('no horizontal scrolling at 360 px', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		await mockServices(page);
		await planSurabayaMalang(page);
		for (const title of ['Vehicles & fuel', 'Toll roads', 'Shared extras', 'Saved trips']) {
			await openPanel(page, title);
		}
		const widths = await page.evaluate(() => ({
			scroll: document.documentElement.scrollWidth,
			client: document.documentElement.clientWidth
		}));
		expect(widths.scroll).toBeLessThanOrEqual(widths.client);
	});
});

test.describe('theme', () => {
	test('stored dark theme is applied before first paint', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.addInitScript(() => {
			localStorage.setItem('lajur:v1:theme', 'dark');
			document.addEventListener('readystatechange', () => {
				if (document.readyState === 'interactive') {
					(window as unknown as { darkAtParse: boolean }).darkAtParse =
						document.documentElement.classList.contains('dark');
				}
			});
		});
		await page.goto('/');
		expect(await page.evaluate(() => (window as unknown as { darkAtParse: boolean }).darkAtParse)).toBe(
			true
		);
	});

	test('system mode follows the OS setting', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		await expect(page.locator('html')).toHaveClass(/dark/);
		await page.emulateMedia({ colorScheme: 'light' });
		await expect(page.locator('html')).not.toHaveClass(/dark/);
		await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Dark' }).click();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await page.reload();
		await expect(page.locator('html')).toHaveClass(/dark/);
	});
});

test.describe('print', () => {
	test('print view hides controls and fits on about one page', async ({ page }) => {
		await mockServices(page);
		await planSurabayaMalang(page);
		await page.emulateMedia({ media: 'print' });

		await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeHidden();
		await expect(page.getByRole('combobox', { name: 'Search Start' })).toHaveCount(0);
		await expect(page.locator('header')).toBeHidden();
		await expect(page.locator('.leaflet-control-container')).toBeHidden();
		await expect(modeCard(page, 'Car — via toll')).toBeHidden();
		await expect(page.locator('table').filter({ hasText: 'Per person' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Cost breakdown' })).toBeVisible();
		await expect(page.locator('main ol li:visible')).toHaveText(['Surabaya', 'Pasuruan', 'Malang']);

		const pdf = await page.pdf({ format: 'A4' });
		const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
		expect(pages).toBeLessThanOrEqual(2);
	});
});

test.describe('PWA', () => {
	test.use({ serviceWorkers: 'allow' });

	test('has a valid manifest and service worker, and opens offline', async ({ page, context }) => {
		await page.goto('/');
		const href = await page.locator('link[rel="manifest"]').getAttribute('href');
		const manifest = await (await page.request.get(href!)).json();
		expect(manifest.name).toBe('TripCalc — Java Trip Cost Planner');
		expect(manifest.display).toBe('standalone');
		const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
		expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
		for (const icon of manifest.icons) {
			expect((await page.request.get(icon.src)).ok()).toBe(true);
		}

		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

		await context.setOffline(true);
		await expect(page.getByText("You're offline. Saved trips work; search and routing need internet.")).toBeVisible();
		await page.reload();
		await expect(page.locator('header').getByText('TripCalc')).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Search Start' })).toBeVisible();
		await context.setOffline(false);
	});
});
