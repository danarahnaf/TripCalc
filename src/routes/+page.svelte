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
	import Sticker from '#lib/components/Sticker.svelte';
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
		} else if (trip.restoreDraft()) {
			toasts.show('Restored your last trip', 'info', 3000);
		}
	});

	// Auto-save the trip being edited, so a refresh or closed tab loses nothing.
	$effect(() => {
		void JSON.stringify(trip.state);
		void trip.savedId;
		const timer = setTimeout(() => trip.persistDraft(), 400);
		return () => clearTimeout(timer);
	});

	// A route that ends at its start already includes the way back.
	$effect(() => {
		if (trip.isLoop && trip.state.roundTrip) trip.state.roundTrip = false;
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
		return `${preset}, ${formatDecimal(c.kmPerLiter)} km/L, ${fuelName(c.fuelId)} ${formatIDR(c.fuelPrice)}/L`;
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

	let roadWidth = $state(360);

	const today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date());
	const h2 = 'mb-3 text-2xl';
	const section = 'print:hidden';
</script>

<div class="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
	<div
		class="print-map isolate sticky top-0 z-10 h-[40vh] shrink-0 border-b-2 border-line lg:static lg:order-2 lg:h-auto lg:flex-1 lg:border-b-0"
	>
		<MapView {onpick} />
	</div>

	<main
		class="min-w-0 space-y-6 px-4 py-4 lg:order-1 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:border-r-2 lg:border-line"
	>
		<h1 class="sr-only">TripCalc: plan a trip within Java</h1>

		<!-- Print header and stop summary -->
		<div class="hidden print:block">
			<p class="text-xl font-bold">TripCalc — {trip.state.name || 'Trip cost summary'}</p>
			<p class="text-sm">{today} · {trip.state.passengers} passengers{trip.state.roundTrip ? ' · round trip' : ''}</p>
			<ol class="mt-2 list-decimal pl-5 text-sm">
				{#each trip.setStops as s (s.id)}
					<li>{s.name}</li>
				{/each}
			</ol>
		</div>

		<section class={section} aria-labelledby="stops-h">
			<div class="mb-3 flex items-end justify-between">
				<h2 id="stops-h" class="text-2xl">Route</h2>
				<Sticker name="car" size={52} tilt={8} class="-mb-1" />
			</div>
			<StopList />
		</section>

		<section class={section} aria-labelledby="trip-h">
			<h2 id="trip-h" class={h2}>Travellers</h2>
			<div class="flex flex-wrap items-end gap-4">
				<div>
					<label for="passengers" class="mb-1 block text-sm font-medium">Passengers</label>
					<div
						class="flex items-center overflow-hidden rounded-xl border-2 border-line bg-surface shadow-retro-sm"
					>
						<button
							type="button"
							class="size-11 bg-mustard-soft font-display text-xl text-ink hover:bg-mustard disabled:opacity-40"
							aria-label="Fewer passengers"
							disabled={trip.state.passengers <= DEFAULTS.minPassengers}
							onclick={() => trip.setPassengers(trip.state.passengers - 1)}>−</button
						>
						<input
							id="passengers"
							type="text"
							inputmode="numeric"
							class="h-11 w-14 border-x-2 border-line bg-surface text-center font-display text-lg tabular-nums"
							value={trip.state.passengers}
							onchange={(e) => {
								const n = Number(e.currentTarget.value.replace(/\D/g, ''));
								trip.setPassengers(n || DEFAULTS.minPassengers);
								e.currentTarget.value = String(trip.state.passengers);
							}}
						/>
						<button
							type="button"
							class="size-11 bg-mustard-soft font-display text-xl text-ink hover:bg-mustard disabled:opacity-40"
							aria-label="More passengers"
							disabled={trip.state.passengers >= DEFAULTS.maxPassengers}
							onclick={() => trip.setPassengers(trip.state.passengers + 1)}>+</button
						>
					</div>
				</div>
				<label
					class="flex min-h-11 items-center gap-2 text-sm font-medium {trip.isLoop
						? 'cursor-not-allowed opacity-60'
						: 'cursor-pointer'}"
				>
					<input
						type="checkbox"
						class="size-6 accent-brand"
						bind:checked={trip.state.roundTrip}
						disabled={trip.isLoop}
						aria-describedby={trip.isLoop ? 'loop-hint' : undefined}
					/>
					Round trip
				</label>
			</div>
			{#if trip.isLoop}
				<p id="loop-hint" class="mt-1 text-xs text-ink-soft">
					Your route already ends at the start, so the way back is included.
				</p>
			{/if}
		</section>

		<section aria-labelledby="compare-h">
			<h2 id="compare-h" class={h2}>Compare modes</h2>
			{#if trip.routeStatus === 'error'}
				<div
					class="mb-3 rounded-xl border-2 border-danger bg-danger-soft p-3 text-sm text-danger-ink shadow-retro-sm print:hidden"
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
				<div class="mb-3 print:hidden">
					<div
						class="road border-2 border-line"
						bind:clientWidth={roadWidth}
						style="--road-width: {roadWidth}px"
						aria-hidden="true"
					>
						<span class="road-car"><Sticker name="car" size={24} tilt={0} /></span>
					</div>
					<p class="mt-1 text-sm text-ink-soft" role="status">Finding routes…</p>
				</div>
			{:else if trip.setStops.length < 2}
				<div class="retro-card mb-3 flex items-center gap-3 bg-mustard-soft p-3 print:hidden">
					<div class="relative h-16 w-20 shrink-0">
						<Sticker name="volcano" size={60} tilt={-4} class="absolute bottom-0 left-0" />
						<Sticker name="sun" size={30} tilt={10} class="absolute -top-1 right-0" />
					</div>
					<p class="text-sm">
						<span class="block font-display text-base">Where to?</span>
						Add a start and a destination to compare costs.
					</p>
				</div>
			{/if}
			<ModeCards />
		</section>

		<section aria-labelledby="breakdown-h">
			<h2 id="breakdown-h" class={h2}>Cost breakdown</h2>
			<CostBreakdown />
		</section>

		<div class="space-y-3 print:hidden">
			<p class="text-xs text-ink-soft">
				Defaults are filled in. Open a section only if you want to adjust it.
			</p>
			<Panel id="vehicles-h" title="Car & fuel" summary={vehicleSummary}>
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
					class="retro-btn min-h-11 bg-surface px-4 text-sm font-semibold hover:bg-sunk"
					onclick={() => window.print()}>Print / Save as PDF</button
				>
			</div>
		</section>

		<section class={section}>
			<AboutData />
		</section>
	</main>
</div>
