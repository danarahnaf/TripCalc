import { expect, test } from '@playwright/test';
import {
	cardTotal,
	mockServices,
	modeCard,
	modeCards,
	openPanel,
	pickPlace,
	planSurabayaMalang,
	searchMessage
} from './fixtures';

test.describe('trip planner', () => {
	test('Surabaya → Pasuruan → Malang shows routes, five modes and toll suggestions', async ({
		page
	}) => {
		const calls = await mockServices(page);
		await planSurabayaMalang(page);

		await expect(modeCards(page)).toHaveCount(5);
		for (const label of ['Car — via toll', 'Car — no toll', 'Motorcycle', 'Train', 'Bus']) {
			await expect(modeCard(page, label)).not.toContainText('— km');
		}
		await expect(modeCard(page, 'Train')).toContainText('Enter ticket price');

		// Route drawn, and its bounding box contains the stop markers (coordinates flipped correctly).
		const line = page.locator('.leaflet-overlay-pane path').first();
		await expect(line).toBeVisible();
		await expect(page.locator('.lajur-marker')).toHaveCount(3);
		// Poll: fitBounds animates, so positions settle after a moment.
		await expect
			.poll(() =>
				page.evaluate(() => {
					const p = document.querySelector('.leaflet-overlay-pane path')!.getBoundingClientRect();
					return [...document.querySelectorAll('.lajur-marker')].every((m) => {
						const r = m.getBoundingClientRect();
						const cx = r.x + r.width / 2;
						const cy = r.y + r.height / 2;
						return cx > p.left - 20 && cx < p.right + 20 && cy > p.top - 20 && cy < p.bottom + 20;
					});
				})
			)
			.toBe(true);

		// Toll suggestions from the route's step names.
		const toll = await openPanel(page, 'Toll roads');
		await expect(toll).toContainText('Suggested from route, please confirm');
		for (const id of ['dupak-waru', 'waru-porong', 'porong-gempol', 'gempol-pandaan', 'pandaan-malang']) {
			await expect(page.locator(`#sel-${id}`)).toBeChecked();
		}

		// Demo server rejects exclude=toll → fallback badge on the no-toll breakdown.
		await modeCard(page, 'Car — no toll').click();
		await expect(page.getByText('No-toll route unavailable, showing default route')).toBeVisible();

		// One request per route kind per stop change (2 then 3 stops); no retries for a 400.
		expect(calls.osrmToll).toBe(2);
		expect(calls.osrmNotoll).toBe(2);
	});

	test('totals update instantly when settings change', async ({ page }) => {
		await mockServices(page);
		await planSurabayaMalang(page);
		// The cheapest mode is selected automatically; look at the car breakdown instead.
		await modeCard(page, 'Car — via toll').click();
		const base = await cardTotal(page, 'Car — via toll');

		// Passengers: 8 people need 2 cars, so fuel and toll double.
		for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'More passengers' }).click();
		await expect(page.getByText('Needs 2 cars').first()).toBeVisible();
		expect(await cardTotal(page, 'Car — via toll')).toBe(base * 2);
		for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Fewer passengers' }).click();

		// Round trip doubles fuel and toll.
		await page.getByRole('checkbox', { name: 'Round trip' }).check();
		expect(await cardTotal(page, 'Car — via toll')).toBeGreaterThanOrEqual(base * 2 - 1);
		await page.getByRole('checkbox', { name: 'Round trip' }).uncheck();
		expect(await cardTotal(page, 'Car — via toll')).toBe(base);

		// Fuel price.
		await openPanel(page, 'Car & fuel');
		await page.locator('#car-price').fill('20000');
		expect(await cardTotal(page, 'Car — via toll')).toBeGreaterThan(base);
		await page.locator('#car-price').fill('10000');
		expect(await cardTotal(page, 'Car — via toll')).toBe(base);

		// Consumption: switching the preset to custom.
		await page.locator('#car-kml').fill('24');
		await expect(page.locator('#car-preset')).toHaveValue('custom');
		expect(await cardTotal(page, 'Car — via toll')).toBeLessThan(base);
		await page.locator('#car-preset').selectOption('mpv');
		expect(await cardTotal(page, 'Car — via toll')).toBe(base);

		// Tolls: unchecking a suggested segment lowers the total; overriding a price changes it.
		await openPanel(page, 'Toll roads');
		// Unchecking removes the row from the "selected" list, so click instead of uncheck().
		await page.locator('#sel-pandaan-malang').click();
		await expect(page.locator('#sel-pandaan-malang')).toHaveCount(0);
		await expect(page.locator('#toll-pandaan-malang')).not.toBeChecked();
		const withoutSegment = await cardTotal(page, 'Car — via toll');
		expect(withoutSegment).toBe(base - 38000);
		await page.locator('#price-gempol-pandaan').fill('20000');
		expect(await cardTotal(page, 'Car — via toll')).toBe(withoutSegment + 5500);
		await page.locator('#toll-other').fill('7000');
		expect(await cardTotal(page, 'Car — via toll')).toBe(withoutSegment + 5500 + 7000);

		// Shared extras apply to every mode.
		const moto = await cardTotal(page, 'Motorcycle');
		await openPanel(page, 'Shared extras');
		await page.locator('#extra-parking').fill('50.000');
		expect(await cardTotal(page, 'Motorcycle')).toBe(moto + 50000);

		// Train needs a ticket price, then totals tickets × passengers.
		await modeCard(page, 'Train').click();
		await page.locator('#train-ticket').fill('150000');
		expect(await cardTotal(page, 'Train')).toBe(150000 * 2 + 50000);
	});

	test('rejects searched places and map pins outside Java', async ({ page }) => {
		await mockServices(page);
		await page.goto('/');

		const start = page.getByRole('combobox', { name: 'Search Start' });
		await start.fill('Gilimanuk');
		await expect(searchMessage(page, 'No places found in Java')).toBeVisible();
		await start.fill('Bakauheni');
		await expect(searchMessage(page, 'No places found in Java')).toBeVisible();
		await start.fill('');

		// Zoom the map out to level 5 around central Java, then click on Bali and on Lampung.
		const map = page.locator('.leaflet-container');
		await expect(map).toBeVisible();
		for (let i = 0; i < 2; i++) {
			await page.locator('.leaflet-control-zoom-out').click();
			await page.waitForTimeout(500);
		}
		const box = (await map.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		const pxPerDeg = (256 * 2 ** 5) / 360;

		// Denpasar area (115.2, −8.4).
		await page.mouse.click(cx + 5 * pxPerDeg, cy + 1.1 * pxPerDeg);
		await expect(page.getByText('That point is outside Java.')).toBeVisible();
		// Bakauheni (105.75, −5.87).
		await page.mouse.click(cx - 4.45 * pxPerDeg, cy - 1.45 * pxPerDeg);
		await expect(page.getByText('That point is in Lampung (Sumatra), not Java.')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveCount(0);

		// A pin inside Java is accepted and named "Pinned point …".
		await page.mouse.click(cx, cy);
		await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveValue(/^Pinned point -7\./);
	});

	test('search is keyboard usable', async ({ page }) => {
		await mockServices(page);
		await page.goto('/');
		const box = page.getByRole('combobox', { name: 'Search Start' });
		await box.fill('Ma');
		await expect(searchMessage(page, 'Type at least 3 characters')).toBeVisible();
		await box.fill('Mal');
		await expect(page.getByRole('option', { name: /Malang/ })).toBeVisible();
		await box.press('Escape');
		await expect(page.getByRole('listbox')).toHaveCount(0);
		await box.press('ArrowDown');
		await box.press('Enter');
		await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveValue('Malang');
		await pickPlace(page, 'Destination', 'Surabaya');
	});
});
