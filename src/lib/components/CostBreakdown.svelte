<script lang="ts">
	import { MODE_LABELS } from '#lib/data/defaults.ts';
	import { formatIDR } from '#lib/logic/format.ts';
	import { formatDuration, formatKm } from '#lib/logic/geo.ts';
	import { tollData, trip } from '#lib/stores/trip.svelte.ts';
	import NumberInput from './NumberInput.svelte';

	const mode = $derived(trip.state.selectedMode);
	const r = $derived(trip.results[mode]);
	const roadNotice = $derived(
		(mode === 'car_notoll' || mode === 'motorcycle') && trip.notollNotice ? trip.notollNotice : null
	);
</script>

<div
	class="print-avoid-break rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
	aria-live="polite"
>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h3 class="text-base font-semibold">{MODE_LABELS[mode]}</h3>
		<p class="text-sm text-slate-600 dark:text-slate-400">
			{r.distanceKm != null ? formatKm(r.distanceKm) : '— km'} ·
			{r.durationMin != null ? formatDuration(r.durationMin) : '—'}
			{#if trip.state.roundTrip}· round trip{/if}
		</p>
	</div>

	{#if roadNotice}
		<p
			class="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
		>
			{roadNotice}
		</p>
	{/if}

	{#if mode === 'train' || mode === 'bus'}
		{@const isTrain = mode === 'train'}
		<div class="mt-3 grid grid-cols-2 gap-3 print:hidden">
			<NumberInput
				id="{mode}-ticket"
				label="{isTrain ? 'Train' : 'Bus'} ticket / person"
				nullable
				placeholder="Enter price"
				value={isTrain ? trip.state.transit.trainTicket : trip.state.transit.busTicket}
				onchange={(v) => {
					if (isTrain) trip.state.transit.trainTicket = v;
					else trip.state.transit.busTicket = v;
				}}
			/>
			<NumberInput
				id="local-transport"
				label="To/from station (total)"
				value={trip.state.transit.localTransport}
				onchange={(v) => (trip.state.transit.localTransport = v ?? 0)}
			/>
		</div>
		<p class="mt-1 text-xs text-slate-600 print:hidden dark:text-slate-400">
			Fares are not looked up. Check the operator's price.
		</p>
	{/if}

	{#if r.lines.length > 0}
		<table class="mt-3 w-full text-sm">
			<tbody>
				{#each r.lines as line, i (i)}
					<tr class="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
						<td class="py-2 pr-2">
							<span class="block font-medium">{line.label}</span>
							{#if line.detail}
								<span class="block text-xs text-slate-600 dark:text-slate-400">{line.detail}</span>
							{/if}
						</td>
						<td class="py-2 text-right tabular-nums">{formatIDR(line.amount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<div class="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
		{#if r.total != null}
			<div class="flex items-baseline justify-between">
				<span class="font-semibold">Total</span>
				<span class="text-xl font-bold tabular-nums">{formatIDR(r.total)}</span>
			</div>
			<div class="flex items-baseline justify-between text-sm text-slate-600 dark:text-slate-400">
				<span>Per person ({trip.state.passengers}, rounded up to Rp 500)</span>
				<span class="tabular-nums">{r.perPerson != null ? formatIDR(r.perPerson) : '—'}</span>
			</div>
		{:else if r.missing === 'Enter ticket price'}
			<p class="text-sm font-medium text-amber-800 dark:text-amber-300">
				Enter the ticket price above to see the total.
			</p>
		{:else}
			<p class="text-sm text-slate-600 dark:text-slate-400">
				Add a start and a destination to see costs.
			</p>
		{/if}
	</div>

	{#if r.notes.length > 0 || mode === 'car_toll'}
		<ul class="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
			{#each r.notes as note (note)}
				<li>• {note}</li>
			{/each}
			{#if mode === 'car_toll'}
				<li>
					• Toll prices are full-segment Class I tariffs (data: {tollData.meta.acuan_data}). Partial
					use may cost less.
				</li>
			{/if}
		</ul>
	{/if}
</div>
