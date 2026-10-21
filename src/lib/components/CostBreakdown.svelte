<script lang="ts">
	import { DEFAULTS, MODE_LABELS, fuelData } from '#lib/data/defaults.ts';
	import { formatIDR } from '#lib/logic/format.ts';
	import { formatDuration, formatKm } from '#lib/logic/geo.ts';
	import { tollData, trip } from '#lib/stores/trip.svelte.ts';
	import NumberInput from './NumberInput.svelte';
	import Sticker from './Sticker.svelte';

	const mode = $derived(trip.state.selectedMode);
	const r = $derived(trip.results[mode]);
	const roadNotice = $derived(
		(mode === 'car_notoll' || mode === 'motorcycle') && trip.notollNotice ? trip.notollNotice : null
	);
</script>

<div
	class="print-avoid-break retro-card p-4"
	aria-live="polite"
>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h3 class="flex items-center gap-2 text-xl">
			<Sticker
				name={mode === 'train' || mode === 'bus' ? 'ticket' : 'car'}
				size={34}
				tilt={mode === 'train' || mode === 'bus' ? -10 : 6}
			/>
			{MODE_LABELS[mode]}
		</h3>
		<p class="text-sm text-ink-soft">
			{r.distanceKm != null ? formatKm(r.distanceKm) : '— km'} ·
			{r.durationMin != null ? formatDuration(r.durationMin) : '—'}
			{#if trip.state.roundTrip}· round trip{/if}
		</p>
	</div>

	{#if roadNotice}
		<p
			class="mt-2 inline-block rounded bg-warn-soft px-2 py-1 text-xs font-medium text-warn-ink"
		>
			{roadNotice}
		</p>
	{/if}

	{#if mode === 'motorcycle'}
		<div class="mt-3 grid grid-cols-2 gap-3 print:hidden">
			<NumberInput
				id="moto-kml"
				kind="decimal"
				label="Consumption"
				suffix="km/L"
				value={trip.state.motorcycle.kmPerLiter}
				onchange={(v) => (trip.state.motorcycle.kmPerLiter = v ?? 0)}
			/>
			<div>
				<label for="moto-fuel" class="mb-1 block text-sm font-medium">Fuel</label>
				<select
					id="moto-fuel"
					class="h-11 w-full retro-input px-3 text-base"
					value={trip.state.motorcycle.fuelId}
					onchange={(e) => trip.setFuel('motorcycle', e.currentTarget.value)}
				>
					{#each fuelData.fuels as f (f.id)}
						<option value={f.id}>{f.name}</option>
					{/each}
				</select>
			</div>
			<NumberInput
				id="moto-price"
				class="col-span-2"
				label="Fuel price per liter"
				value={trip.state.motorcycle.fuelPrice}
				onchange={(v) => (trip.state.motorcycle.fuelPrice = v ?? 0)}
			/>
		</div>
		<p class="mt-1 text-xs text-ink-soft print:hidden">
			{DEFAULTS.motorcycleCapacity} people per motorcycle. Motorcycles never use toll roads.
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
		<p class="mt-1 text-xs text-ink-soft print:hidden">
			Fares are not looked up. Check the operator's price.
		</p>
	{/if}

	{#if r.lines.length > 0}
		<table class="mt-3 w-full text-sm">
			<tbody>
				{#each r.lines as line, i (i)}
					<tr class="border-b border-line-soft align-top last:border-0">
						<td class="py-2 pr-2">
							<span class="block font-medium">{line.label}</span>
							{#if line.detail}
								<span class="block text-xs text-ink-soft">{line.detail}</span>
							{/if}
						</td>
						<td class="py-2 text-right tabular-nums">{formatIDR(line.amount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<div class="mt-3 border-t border-line-soft pt-3">
		{#if r.total != null}
			<div class="flex items-baseline justify-between">
				<span class="flex items-center gap-2 font-display text-lg">
					<Sticker name="coin" size={30} tilt={-12} />Total
				</span>
				<span class="text-xl font-bold tabular-nums">{formatIDR(r.total)}</span>
			</div>
			<div class="flex items-baseline justify-between text-sm text-ink-soft">
				<span>Per person ({trip.state.passengers}, rounded up to Rp 500)</span>
				<span class="tabular-nums">{r.perPerson != null ? formatIDR(r.perPerson) : '—'}</span>
			</div>
		{:else if r.missing === 'Enter ticket price'}
			<p class="text-sm font-medium text-warn-ink">
				Enter the ticket price above to see the total.
			</p>
		{:else}
			<p class="text-sm text-ink-soft">
				Add a start and a destination to see costs.
			</p>
		{/if}
	</div>

	{#if r.notes.length > 0 || mode === 'car_toll'}
		<ul class="mt-3 space-y-1 text-xs text-ink-soft">
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
