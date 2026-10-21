<script lang="ts">
	import { DEFAULTS, isStopSet } from '#lib/data/defaults.ts';
	import { formatLatLon } from '#lib/logic/geo.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';
	import StopSearch from './StopSearch.svelte';

	const stops = $derived(trip.state.stops);

	function label(i: number): string {
		if (i === 0) return 'Start';
		if (i === stops.length - 1) return 'Destination';
		return `Stop ${i}`;
	}

	function markerClass(i: number): string {
		if (i === 0) return 'bg-green-700';
		if (i === stops.length - 1) return 'bg-red-700';
		return 'bg-blue-700';
	}

	const btn =
		'inline-flex size-11 items-center justify-center rounded-lg text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-800';
</script>

<ol class="space-y-2">
	{#each stops as stop, i (stop.id)}
		<li class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
			<div class="mb-2 flex items-center gap-2">
				<span
					class="inline-flex size-6 items-center justify-center rounded-full text-xs font-bold text-white {markerClass(i)}"
					aria-hidden="true">{i + 1}</span
				>
				<span class="text-sm font-semibold">{label(i)}</span>
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
					class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900"
					value={stop.name}
					oninput={(e) => trip.renameStop(i, e.currentTarget.value)}
				/>
				<p class="mt-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
					<span>{formatLatLon(stop.lat, stop.lon)}</span>
					<button
						type="button"
						class="min-h-11 px-2 font-medium text-teal-700 underline dark:text-teal-300"
						onclick={() => trip.clearStop(i)}>Change</button
					>
				</p>
			{:else}
				<StopSearch
					id="stop-search-{stop.id}"
					label="Search {label(i)}"
					onselect={(p) => trip.setStop(i, { name: p.name, lat: p.lat, lon: p.lon })}
				/>
			{/if}
		</li>
	{/each}
</ol>

<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
	<button
		type="button"
		class="min-h-11 rounded-lg border border-dashed border-slate-400 px-4 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-500 dark:hover:bg-slate-800"
		disabled={!trip.canAddStop}
		onclick={() => trip.addStop()}
	>
		+ Add stop
	</button>
	<p class="text-xs text-slate-600 dark:text-slate-400">
		Or tap the map to drop a pin · max {DEFAULTS.maxStops} stops
	</p>
</div>
