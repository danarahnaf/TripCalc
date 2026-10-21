<script lang="ts">
	import { MODE_LABELS } from '#lib/data/defaults.ts';
	import { formatIDR } from '#lib/logic/format.ts';
	import { formatDuration, formatKm } from '#lib/logic/geo.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';
	import { TRAVEL_MODES, type TravelMode } from '#lib/types.ts';

	const ICONS: Record<TravelMode, string> = {
		car_toll: '🚗',
		car_notoll: '🚙',
		motorcycle: '🛵',
		train: '🚆',
		bus: '🚌'
	};

	const loading = $derived(trip.routeStatus === 'loading');

	function totalText(m: TravelMode): string {
		const r = trip.results[m];
		if (r.total != null) return formatIDR(r.total);
		if (r.missing === 'Enter ticket price') return 'Enter ticket price';
		return '—';
	}
</script>

<div
	class="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 print:hidden"
	role="group"
	aria-label="Travel modes"
>
	{#each TRAVEL_MODES as m (m)}
		{@const r = trip.results[m]}
		{@const selected = trip.state.selectedMode === m}
		<button
			type="button"
			class="mode-card my-1 flex w-44 shrink-0 snap-start flex-col rounded-2xl border-2 border-line p-3 text-left shadow-retro {selected
				? 'bg-mustard-soft'
				: 'bg-surface hover:bg-sunk'}"
			aria-pressed={selected}
			onclick={() => trip.selectMode(m)}
		>
			<span class="flex items-center gap-2 text-sm font-semibold">
				<span
					class="inline-flex size-8 shrink-0 -rotate-6 items-center justify-center rounded-full border-2 border-line bg-surface text-base shadow-retro-sm"
					aria-hidden="true">{ICONS[m]}</span
				>{MODE_LABELS[m]}
			</span>
			<span class="mt-2 flex min-h-6 flex-wrap gap-1">
				{#if trip.best.cheapest === m}
					<span
						class="stamp rounded-md border-2 border-line bg-good px-1.5 py-0.5 font-display text-[11px] tracking-wide text-[#fffaf0] uppercase"
						>Cheapest</span
					>
				{/if}
				{#if trip.best.fastest === m}
					<span
						class="stamp rounded-md border-2 border-line bg-info px-1.5 py-0.5 font-display text-[11px] tracking-wide text-[#fffaf0] uppercase"
						>Fastest</span
					>
				{/if}
			</span>
			{#if loading && r.distanceKm == null}
				<span class="mt-2 block h-3 w-24 animate-pulse rounded bg-line-soft motion-reduce:animate-none"></span>
				<span class="mt-2 block h-5 w-28 animate-pulse rounded bg-line-soft motion-reduce:animate-none"></span>
				<span class="sr-only">Loading route…</span>
			{:else}
				<span class="mt-1 text-xs text-ink-soft">
					{r.distanceKm != null ? formatKm(r.distanceKm) : '— km'} ·
					{r.durationMin != null ? formatDuration(r.durationMin) : '—'}
				</span>
				<span
					class="mt-1 font-display text-xl leading-tight tabular-nums {r.total == null
						? 'text-base text-ink-soft'
						: ''}">{totalText(m)}</span
				>
				<span class="text-xs text-ink-soft tabular-nums">
					{r.perPerson != null ? `${formatIDR(r.perPerson)} / person` : ' '}
				</span>
			{/if}
		</button>
	{/each}
</div>

<!-- Print-only comparison table -->
<table class="hidden w-full border-collapse text-sm print:table">
	<thead>
		<tr class="border-b border-black text-left">
			<th class="py-1">Mode</th>
			<th class="py-1 text-right">Distance</th>
			<th class="py-1 text-right">Time</th>
			<th class="py-1 text-right">Total</th>
			<th class="py-1 text-right">Per person</th>
		</tr>
	</thead>
	<tbody>
		{#each TRAVEL_MODES as m (m)}
			{@const r = trip.results[m]}
			<tr class="border-b border-line">
				<td class="py-1">
					{MODE_LABELS[m]}
					{#if trip.best.cheapest === m}(cheapest){/if}
					{#if trip.best.fastest === m}(fastest){/if}
				</td>
				<td class="py-1 text-right">{r.distanceKm != null ? formatKm(r.distanceKm) : '—'}</td>
				<td class="py-1 text-right">{r.durationMin != null ? formatDuration(r.durationMin) : '—'}</td>
				<td class="py-1 text-right">{totalText(m)}</td>
				<td class="py-1 text-right">{r.perPerson != null ? formatIDR(r.perPerson) : '—'}</td>
			</tr>
		{/each}
	</tbody>
</table>
