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
			class="flex w-44 shrink-0 snap-start flex-col rounded-xl border bg-white p-3 text-left transition-colors dark:bg-slate-900 {selected
				? 'border-teal-600 ring-2 ring-teal-600'
				: 'border-slate-200 hover:border-slate-400 dark:border-slate-700'}"
			aria-pressed={selected}
			onclick={() => trip.selectMode(m)}
		>
			<span class="flex items-center gap-1.5 text-sm font-semibold">
				<span aria-hidden="true">{ICONS[m]}</span>{MODE_LABELS[m]}
			</span>
			<span class="mt-1 flex min-h-5 flex-wrap gap-1">
				{#if trip.best.cheapest === m}
					<span
						class="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800 dark:bg-green-950 dark:text-green-300"
						>Cheapest</span
					>
				{/if}
				{#if trip.best.fastest === m}
					<span
						class="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300"
						>Fastest</span
					>
				{/if}
			</span>
			{#if loading && r.distanceKm == null}
				<span class="mt-2 block h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></span>
				<span class="mt-2 block h-5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></span>
				<span class="sr-only">Loading route…</span>
			{:else}
				<span class="mt-1 text-xs text-slate-600 dark:text-slate-400">
					{r.distanceKm != null ? formatKm(r.distanceKm) : '— km'} ·
					{r.durationMin != null ? formatDuration(r.durationMin) : '—'}
				</span>
				<span
					class="mt-1 text-lg leading-tight font-bold tabular-nums {r.total == null
						? 'text-base text-slate-600 dark:text-slate-400'
						: ''}">{totalText(m)}</span
				>
				<span class="text-xs text-slate-600 tabular-nums dark:text-slate-400">
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
			<tr class="border-b border-slate-300">
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
