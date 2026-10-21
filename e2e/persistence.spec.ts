import { expect, test } from '@playwright/test';
import { cardTotal, mockServices, openPanel, planSurabayaMalang } from './fixtures';

const STOP_NAMES = ['Surabaya', 'Pasuruan', 'Malang'];

async function stopNames(page: import('@playwright/test').Page) {
	return page.locator('input[id^="stop-name-"]').evaluateAll((els) =>
		els.map((e) => (e as HTMLInputElement).value)
	);
}

test('saved trip survives a reload and loads back', async ({ page }) => {
	await mockServices(page);
	await planSurabayaMalang(page);
	const total = await cardTotal(page, 'Car — via toll');

	const panel = await openPanel(page, 'Saved trips');
	await panel.getByLabel('Trip name').fill('Mudik test');
	await panel.getByRole('button', { name: 'Save trip' }).click();
	await expect(page.getByText('Trip saved')).toBeVisible();

	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Name of Start' })).toHaveCount(0);
	const saved = await openPanel(page, 'Saved trips');
	await expect(saved.getByText('Mudik test')).toBeVisible();
	await saved.getByRole('button', { name: 'Load' }).click();

	expect(await stopNames(page)).toEqual(STOP_NAMES);
	await expect.poll(() => cardTotal(page, 'Car — via toll').catch(() => 0)).toBe(total);
});

test('share link restores the same trip in a fresh browser context', async ({
	page,
	context,
	browser
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await mockServices(page);
	await planSurabayaMalang(page);
	await page.getByRole('checkbox', { name: 'Round trip' }).check();
	const total = await cardTotal(page, 'Car — via toll');

	await page.getByRole('button', { name: 'Copy share link' }).click();
	await expect(page.getByText('Link copied')).toBeVisible();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toContain('?t=');

	// Like a private window: nothing in storage.
	const fresh = await browser.newContext({ serviceWorkers: 'block' });
	const other = await fresh.newPage();
	await mockServices(other);
	await other.goto(link);
	await expect(other.getByText('Shared trip loaded')).toBeVisible();
	expect(await stopNames(other)).toEqual(STOP_NAMES);
	await expect(other.getByRole('checkbox', { name: 'Round trip' })).toBeChecked();
	await expect.poll(() => cardTotal(other, 'Car — via toll').catch(() => 0)).toBe(total);
	// The ?t= parameter is removed after loading.
	expect(new URL(other.url()).search).toBe('');
	await fresh.close();
});

test('a corrupted share link shows an error instead of crashing', async ({ page }) => {
	await mockServices(page);
	await page.goto('/?t=not-a-real-trip');
	await expect(page.getByText('This share link is invalid or from another version.')).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Search Start' })).toBeVisible();
});
