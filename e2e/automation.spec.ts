import { expect, test } from '@playwright/test';
import { cardTotal, mockServices, modeCard, openPanel, pickPlace, planSurabayaMalang } from './fixtures';

async function stopNames(page: import('@playwright/test').Page) {
	return page.locator('input[id^="stop-name-"]').evaluateAll((els) =>
		els.map((e) => (e as HTMLInputElement).value)
	);
}

test('the trip being edited is restored after a reload', async ({ page }) => {
	await mockServices(page);
	await planSurabayaMalang(page);
	await page.getByRole('button', { name: 'More passengers' }).click();
	const total = await cardTotal(page, 'Car — via toll');
	await page.waitForTimeout(600); // auto-save is debounced

	await page.reload();
	await expect(page.getByText('Restored your last trip')).toBeVisible();
	expect(await stopNames(page)).toEqual(['Surabaya', 'Pasuruan', 'Malang']);
	await expect(page.locator('#passengers')).toHaveValue('3');
	await expect.poll(() => cardTotal(page, 'Car — via toll').catch(() => 0)).toBe(total);
});

test.describe('use my location', () => {
	test('fills the start with the current position', async ({ page, context }) => {
		await context.grantPermissions(['geolocation']);
		await context.setGeolocation({ latitude: -7.2575, longitude: 112.7521 });
		await mockServices(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Use my location' }).click();
		await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveValue('My location');
		// The button only shows while the start is empty.
		await expect(page.getByRole('button', { name: 'Use my location' })).toHaveCount(0);
	});

	test('rejects a position outside Java', async ({ page, context }) => {
		await context.grantPermissions(['geolocation']);
		await context.setGeolocation({ latitude: -8.65, longitude: 115.21 }); // Denpasar
		await mockServices(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Use my location' }).click();
		await expect(page.getByText('That point is outside Java.')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveCount(0);
	});
});

test('recent places are offered in an empty search box without a new search', async ({ page }) => {
	const calls = await mockServices(page);
	await page.goto('/');
	await pickPlace(page, 'Start', 'Surabaya');
	await pickPlace(page, 'Destination', 'Malang');
	const searches = calls.search;

	await page.getByRole('button', { name: 'Change' }).first().click();
	await page.getByRole('combobox', { name: 'Search Start' }).focus();
	const list = page.getByRole('listbox', { name: 'Recent places' });
	await expect(list.getByRole('option')).toHaveText([/Malang/, /Surabaya/]);
	await page.getByRole('combobox', { name: 'Search Start' }).press('ArrowDown');
	await page.getByRole('combobox', { name: 'Search Start' }).press('ArrowDown');
	await page.getByRole('combobox', { name: 'Search Start' }).press('Enter');
	await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveValue('Surabaya');
	expect(calls.search).toBe(searches);

	// Survives a reload, and can be cleared.
	await page.waitForTimeout(600); // let the draft auto-save
	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Name of Destination' })).toHaveValue('Malang');
	await page.getByRole('button', { name: 'Change' }).first().click();
	await page.getByRole('combobox', { name: 'Search Start' }).focus();
	await expect(page.getByRole('listbox', { name: 'Recent places' })).toBeVisible();
	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Recent places' })).toHaveCount(0);
});

test('motorcycle settings appear only for the motorcycle mode', async ({ page }) => {
	await mockServices(page);
	await planSurabayaMalang(page);
	await modeCard(page, 'Car — via toll').click();
	await expect(page.locator('#moto-kml')).toHaveCount(0);
	await openPanel(page, 'Car & fuel');
	await expect(page.locator('#moto-kml')).toHaveCount(0);

	await modeCard(page, 'Motorcycle').click();
	const before = await cardTotal(page, 'Motorcycle');
	await page.locator('#moto-kml').fill('20');
	expect(await cardTotal(page, 'Motorcycle')).toBe(before * 2);
});

test('choosing a car type also picks its usual fuel', async ({ page }) => {
	await mockServices(page);
	await page.goto('/');
	await openPanel(page, 'Car & fuel');
	await page.locator('#car-preset').selectOption('suv_diesel');
	await expect(page.locator('#car-fuel')).toHaveValue('dexlite');
	await expect(page.locator('#car-kml')).toHaveValue('11');
	await expect(page.locator('#car-price')).toHaveValue('23.700');
	await page.locator('#car-preset').selectOption('suv');
	await expect(page.locator('#car-fuel')).toHaveValue('pertamax');
	await page.locator('#car-preset').selectOption('city');
	await expect(page.locator('#car-fuel')).toHaveValue('pertalite');
});

test('a route that ends at its start turns round trip off', async ({ page }) => {
	await mockServices(page);
	await page.goto('/');
	const roundTrip = page.getByRole('checkbox', { name: 'Round trip' });
	await roundTrip.check();

	await pickPlace(page, 'Start', 'Surabaya');
	await pickPlace(page, 'Destination', 'Malang');
	await page.getByRole('button', { name: '+ Add stop' }).click();
	// Stop 1 becomes Malang, the destination becomes Surabaya again.
	await page.getByRole('button', { name: 'Move Destination up' }).click();
	await pickPlace(page, 'Destination', 'Surabaya');

	await expect(roundTrip).not.toBeChecked();
	await expect(roundTrip).toBeDisabled();
	await expect(page.getByText('Your route already ends at the start')).toBeVisible();
});

test('the cheapest mode is selected until the user picks one', async ({ page }) => {
	await mockServices(page);
	await planSurabayaMalang(page);
	const cheapest = modeCards(page).filter({ hasText: 'Cheapest' });
	await expect(cheapest).toHaveAttribute('aria-pressed', 'true');

	// After a manual choice, re-routing keeps it.
	await modeCard(page, 'Car — via toll').click();
	const rerouted = page.waitForResponse(
		(r) =>
			r.url().startsWith('https://router.project-osrm.org/') &&
			r.url().split('/driving/')[1].split('?')[0].split(';').length === 2
	);
	await page.getByRole('button', { name: 'Remove Stop 1' }).click();
	await rerouted;
	await expect(page.getByText('Finding routes…')).toHaveCount(0);
	await expect(modeCard(page, 'Car — via toll')).toHaveAttribute('aria-pressed', 'true');
});

function modeCards(page: import('@playwright/test').Page) {
	return page.getByRole('group', { name: 'Travel modes' }).getByRole('button');
}
