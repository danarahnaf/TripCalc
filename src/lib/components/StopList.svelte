<script lang="ts">
	import { DEFAULTS, isStopSet } from '#lib/data/defaults.ts';
	import { formatLatLon } from '#lib/logic/geo.ts';
	import { toasts } from '#lib/stores/toast.svelte.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';
	import StopSearch from './StopSearch.svelte';

	const stops = $derived(trip.state.stops);
	let locating = $state(false);

	function useMyLocation() {
		if (!('geolocation' in navigator)) {
			toasts.show('Location is not available in this browser.', 'error');
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				locating = false;
				const err = trip.placeAt(0, pos.coords.latitude, pos.coords.longitude, 'My location');
				if (err) toasts.show(err, 'error', 5000);
			},
			(e) => {
				locating = false;
				toasts.show(
					e.code === e.PERMISSION_DENIED
						? 'Location permission was denied. Search for a place instead.'
						: 'Could not get your location. Search for a place instead.',
					'error'
				);
			},
			{ enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
		);
	}

	function label(i: number): string {
		if (i === 0) return 'Start';
		if (i === stops.length - 1) return 'Destination';
		return `Stop ${i}`;
	}

	function markerClass(i: number): string {
		if (i === 0) return 'bg-good';
		if (i === stops.length - 1) return 'bg-danger';
		return 'bg-info';
	}

	const btn =
		'inline-flex size-11 items-center justify-center rounded-lg text-lg text-ink-soft hover:bg-sunk disabled:opacity-30';
</script>

<ol class="space-y-2">
	{#each stops as stop, i (stop.id)}
		<li class="retro-card p-3">
			<div class="mb-2 flex items-center gap-2">
				<span
					class="inline-flex size-7 items-center justify-center rounded-full border-2 border-line font-display text-sm text-[#fffaf0] shadow-retro-sm {markerClass(i)}"
					aria-hidden="true">{i + 1}</span
				>
				<span class="font-display text-base">{label(i)}</span>
				<div class="ml-auto flex">
					<button
						type="button"
						class={btn}
						disabled={i === 0}
						aria-label="Move {label(i)} up"
						onclick={() => trip.moveStop(i, -1)}>↑</button
					>
					<button
						type="button"
						class={btn}
						disabled={i === stops.length - 1}
						aria-label="Move {label(i)} down"
						onclick={() => trip.moveStop(i, 1)}>↓</button
					>
					<button
						type="button"
						class={btn}
						disabled={stops.length <= 2 && !isStopSet(stop)}
						aria-label={stops.length > 2 ? `Remove ${label(i)}` : `Clear ${label(i)}`}
						onclick={() => trip.removeStop(i)}>✕</button
					>
				</div>
			</div>
			{#if isStopSet(stop)}
				<label for="stop-name-{stop.id}" class="sr-only">Name of {label(i)}</label>
				<input
					id="stop-name-{stop.id}"
					type="text"
					class="retro-input h-11 w-full px-3 text-base"
					value={stop.name}
					oninput={(e) => trip.renameStop(i, e.currentTarget.value)}
				/>
				<p class="mt-1 flex items-center justify-between text-xs text-ink-soft">
					<span>{formatLatLon(stop.lat, stop.lon)}</span>
					<button
						type="button"
						class="min-h-11 px-2 font-medium text-brand-ink underline"
						onclick={() => trip.clearStop(i)}>Change</button
					>
				</p>
			{:else}
				<StopSearch
					id="stop-search-{stop.id}"
					label="Search {label(i)}"
					onselect={(p) => trip.setStop(i, { name: p.name, lat: p.lat, lon: p.lon })}
				/>
				{#if i === 0}
					<button
						type="button"
						class="retro-btn mt-2 inline-flex min-h-11 items-center gap-2 bg-brand-soft px-3 text-sm font-semibold text-brand-ink hover:bg-surface disabled:opacity-50"
						disabled={locating}
						onclick={useMyLocation}
					>
						<span aria-hidden="true">📍</span>
						{locating ? 'Finding your location…' : 'Use my location'}
					</button>
				{/if}
			{/if}
		</li>
	{/each}
</ol>

<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
	<button
		type="button"
		class="retro-btn min-h-11 bg-mustard px-4 text-sm font-semibold text-[#2b2118] hover:bg-[#f4c25c] disabled:opacity-40"
		disabled={!trip.canAddStop}
		onclick={() => trip.addStop()}
	>
		+ Add stop
	</button>
	<p class="text-xs text-ink-soft">
		Or tap the map to drop a pin · max {DEFAULTS.maxStops} stops
	</p>
</div>
