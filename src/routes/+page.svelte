<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import AboutData from '#lib/components/AboutData.svelte';
	import CostBreakdown from '#lib/components/CostBreakdown.svelte';
	import ExtrasForm from '#lib/components/ExtrasForm.svelte';
	import MapView from '#lib/components/MapView.svelte';
	import ModeCards from '#lib/components/ModeCards.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SavedTrips from '#lib/components/SavedTrips.svelte';
	import ShareButton from '#lib/components/ShareButton.svelte';
	import StopList from '#lib/components/StopList.svelte';
	import TollPicker from '#lib/components/TollPicker.svelte';
	import VehicleSettings from '#lib/components/VehicleSettings.svelte';
	import { CAR_PRESETS, DEFAULTS, fuelData } from '#lib/data/defaults.ts';
	import { extrasTotal, tollCost } from '#lib/logic/cost.ts';
	import { formatDecimal, formatIDR } from '#lib/logic/format.ts';
	import { decodeTrip } from '#lib/logic/share.ts';
	import { saved } from '#lib/stores/saved.svelte.ts';
	import { toasts } from '#lib/stores/toast.svelte.ts';
	import { tollSegments, trip } from '#lib/stores/trip.svelte.ts';

	onMount(() => {
		saved.load();
		// Shared trips come in as ?t=… and are read on the client only.
		const t = new URL(window.location.href).searchParams.get('t');
		if (t) {
			const shared = decodeTrip(t);
			if (shared) {
				trip.load(shared);
				toasts.show('Shared trip loaded', 'success');
			} else {
				toasts.show('This share link is invalid or from another version.', 'error');
			}
			replaceState(window.location.pathname, {});
		}
	});

	// Re-route 800 ms after the stops settle, only with ≥2 valid stops.
	$effect(() => {
		const key = trip.stopsKey;
		if (key.split(';').filter(Boolean).length < 2) {
			trip.clearRoutes();
			return;
		}
		const timer = setTimeout(() => trip.refreshRoutes(), 800);
		return () => clearTimeout(timer);
	});

	function onpick(lat: number, lon: number) {
		const err = trip.pinPoint(lat, lon);
		if (err) toasts.show(err, 'error', 5000);
	}

	const fuelName = (id: string) => fuelData.fuels.find((f) => f.id === id)?.name.split(' (')[0] ?? id;

	const vehicleSummary = $derived.by(() => {
		const c = trip.state.car;
		const preset = CAR_PRESETS.find((p) => p.id === c.preset)?.label ?? 'Custom';
		return `Car: ${preset}, ${formatDecimal(c.kmPerLiter)} km/L, ${fuelName(c.fuelId)} · Motorcycle: ${formatDecimal(trip.state.motorcycle.kmPerLiter)} km/L`;
	});
	const tollSummary = $derived.by(() => {
		const n = new Set(trip.state.toll.selectedIds).size;
		const total = tollCost(trip.state.toll, tollSegments);
		const base = n === 0 && total === 0 ? 'None selected' : `${n} segment${n === 1 ? '' : 's'} · ${formatIDR(total)} one way`;
		return trip.suggestedIds.length > 0 ? `${base} · suggested from route, please confirm` : base;
	});
	const extrasSummary = $derived.by(() => {
		const total = extrasTotal(trip.state.extras);
		return total > 0 ? `${formatIDR(total)} total (parking, food, lodging, other)` : 'None: parking, food, lodging, other';
	});

	const today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date());
	const h2 = 'mb-3 text-base font-semibold';
	const section = 'print:hidden';
</script>

<div class="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
	<div
		class="print-map isolate sticky top-0 z-10 h-[40vh] shrink-0 border-b border-slate-200 lg:static lg:order-2 lg:h-auto lg:flex-1 lg:border-b-0 dark:border-slate-800"
	>
		<MapView {onpick} />
	</div>

	<main
		class="min-w-0 space-y-6 px-4 py-4 lg:order-1 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-slate-200 lg:dark:border-slate-800"
	>
		<h1 class="sr-only">Lajur: plan a trip within Java</h1>

		<!-- Print header and stop summary -->
		<div class="hidden print:block">
			<p class="text-xl font-bold">Lajur — {trip.state.name || 'Trip cost summary'}</p>
			<p class="text-sm">{today} · {trip.state.passengers} passengers{trip.state.roundTrip ? ' · round trip' : ''}</p>
			<ol class="mt-2 list-decimal pl-5 text-sm">
				{#each trip.setStops as s (s.id)}
					<li>{s.name}</li>
				{/each}
			</ol>
		</div>

		<section class={section} aria-labelledby="stops-h">
			<h2 id="stops-h" class={h2}>Route</h2>
			<StopList />
		</section>

		<section class={section} aria-labelledby="trip-h">
			<h2 id="trip-h" class={h2}>Travellers</h2>
			<div class="flex flex-wrap items-end gap-4">
				<div>
					<label for="passengers" class="mb-1 block text-sm font-medium">Passengers</label>
					<div class="flex items-center">
						<button
							type="button"
							class="size-11 rounded-l-lg border border-slate-300 text-lg disabled:opacity-40 dark:border-slate-600"
							aria-label="Fewer passengers"
							disabled={trip.state.passengers <= DEFAULTS.minPassengers}
							onclick={() => trip.setPassengers(trip.state.passengers - 1)}>−</button
						>
						<input
							id="passengers"
							type="text"
							inputmode="numeric"
							class="h-11 w-14 border-y border-slate-300 bg-white text-center text-base tabular-nums dark:border-slate-600 dark:bg-slate-900"
							value={trip.state.passengers}
							onchange={(e) => {
								const n = Number(e.currentTarget.value.replace(/\D/g, ''));
								trip.setPassengers(n || DEFAULTS.minPassengers);
								e.currentTarget.value = String(trip.state.passengers);
							}}
						/>
						<button
							type="button"
							class="size-11 rounded-r-lg border border-slate-300 text-lg disabled:opacity-40 dark:border-slate-600"
							aria-label="More passengers"
							disabled={trip.state.passengers >= DEFAULTS.maxPassengers}
							onclick={() => trip.setPassengers(trip.state.passengers + 1)}>+</button
						>
					</div>
				</div>
				<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
					<input type="checkbox" class="size-6 accent-teal-700" bind:checked={trip.state.roundTrip} />
					Round trip
				</label>
			</div>
		</section>

		<section aria-labelledby="compare-h">
			<h2 id="compare-h" class={h2}>Compare modes</h2>
			{#if trip.routeStatus === 'error'}
				<div
					class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden dark:border-red-900 dark:bg-red-950 dark:text-red-200"
					role="alert"
				>
					<p>{trip.routeError}</p>
					<button
						type="button"
						class="mt-1 min-h-11 font-semibold underline"
						onclick={() => trip.refreshRoutes()}>Try again</button
					>
				</div>
			{:else if trip.routeStatus === 'loading'}
				<p class="mb-2 text-sm text-slate-600 print:hidden dark:text-slate-400" role="status">
					Finding routes…
				</p>
			{:else if trip.setStops.length < 2}
				<p class="mb-2 text-sm text-slate-600 print:hidden dark:text-slate-400">
					Add a start and a destination to compare costs.
				</p>
			{/if}
			<ModeCards />
		</section>

		<section aria-labelledby="breakdown-h">
			<h2 id="breakdown-h" class={h2}>Cost breakdown</h2>
			<CostBreakdown />
		</section>

		<div class="space-y-3 print:hidden">
			<p class="text-xs text-slate-600 dark:text-slate-400">
				Defaults are filled in. Open a section only if you want to adjust it.
			</p>
			<Panel id="vehicles-h" title="Vehicles & fuel" summary={vehicleSummary}>
				<VehicleSettings />
			</Panel>
			<Panel id="toll-h" title="Toll roads" summary={tollSummary}>
				<TollPicker />
			</Panel>
			<Panel id="extras-h" title="Shared extras" summary={extrasSummary}>
				<ExtrasForm />
			</Panel>
		</div>

		<section class="{section} space-y-3">
			<Panel
				id="saved-h"
				title="Saved trips"
				summary={saved.list.length > 0
					? `${saved.list.length} saved in this browser · save, load, rename`
					: 'Save this trip in your browser'}
			>
				<SavedTrips />
			</Panel>
			<div class="flex flex-wrap gap-2">
				<ShareButton />
				<button
					type="button"
					class="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
					onclick={() => window.print()}>Print / Save as PDF</button
				>
			</div>
		</section>

		<section class={section}>
			<AboutData />
		</section>
	</main>
</div>
