<script lang="ts">
	import { formatIDR } from '#lib/logic/format.ts';
	import { segmentPrice, tollCost } from '#lib/logic/cost.ts';
	import { tollData, tollSegments, trip } from '#lib/stores/trip.svelte.ts';
	import type { TollSegment } from '#lib/types.ts';
	import NumberInput from './NumberInput.svelte';

	let filter = $state('');
	let browseOpen = $state(false);

	const selected = $derived(new Set(trip.state.toll.selectedIds));
	const suggested = $derived(new Set(trip.suggestedIds));
	const selectedSegments = $derived(tollSegments.filter((s) => selected.has(s.id)));
	const total = $derived(tollCost(trip.state.toll, tollSegments));

	const groups = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		const map = new Map<string, TollSegment[]>();
		for (const s of tollSegments) {
			if (q && !`${s.nama} ${s.id} ${s.provinsi}`.toLowerCase().includes(q)) continue;
			const list = map.get(s.provinsi) ?? [];
			list.push(s);
			map.set(s.provinsi, list);
		}
		return [...map.entries()];
	});
</script>

{#snippet badges(seg: TollSegment)}
	{#if suggested.has(seg.id)}
		<span
			class="ml-1 rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-200"
			>suggested</span
		>
	{/if}
	{#if seg.perlu_verifikasi}
		<span
			class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200"
			title="Tariff from an older or conflicting source">unverified</span
		>
	{/if}
{/snippet}

<p class="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
	Toll prices are full-segment Class I tariffs (data: {tollData.meta.acuan_data}). Partial use may
	cost less.
</p>

{#if trip.suggestedIds.length > 0}
	<p class="mt-3 text-sm font-medium text-teal-800 dark:text-teal-300">
		Suggested from route, please confirm
	</p>
{:else if trip.routeStatus === 'ok'}
	<p class="mt-3 text-sm text-slate-600 dark:text-slate-400">
		No listed toll segments matched this route. Pick them manually if needed.
	</p>
{/if}

<div class="mt-3 space-y-2">
	{#if selectedSegments.length === 0}
		<p class="text-sm text-slate-600 dark:text-slate-400">No toll segments selected.</p>
	{/if}
	{#each selectedSegments as seg (seg.id)}
		<div class="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
			<div class="flex items-start gap-2">
				<input
					id="sel-{seg.id}"
					type="checkbox"
					class="mt-0.5 size-6 shrink-0 accent-teal-700"
					checked
					onchange={(e) => trip.toggleToll(seg.id, e.currentTarget.checked)}
				/>
				<label for="sel-{seg.id}" class="flex-1 text-sm">
					{seg.nama}{@render badges(seg)}
				</label>
			</div>
			<div class="mt-2 flex items-end gap-2">
				<NumberInput
					id="price-{seg.id}"
					label="Price for {seg.nama}"
					hideLabel
					class="flex-1"
					value={segmentPrice(seg, trip.state.toll.overrides)}
					onchange={(v) => trip.setTollOverride(seg.id, v)}
				/>
				{#if trip.state.toll.overrides[seg.id] != null}
					<button
						type="button"
						class="min-h-11 rounded-lg px-3 text-xs font-medium text-teal-700 underline dark:text-teal-300"
						onclick={() => trip.setTollOverride(seg.id, null)}
						aria-label="Reset price for {seg.nama} to {formatIDR(seg.tarif)}">Reset</button
					>
				{/if}
			</div>
		</div>
	{/each}
</div>

<details
	class="mt-3 rounded-lg border border-slate-200 dark:border-slate-700"
	bind:open={browseOpen}
>
	<summary class="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
		All toll segments ({tollSegments.length})
	</summary>
	<div class="border-t border-slate-200 p-3 dark:border-slate-700">
		<label for="toll-filter" class="sr-only">Search toll segments</label>
		<input
			id="toll-filter"
			type="search"
			placeholder="Search segments, e.g. Cipali"
			class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900"
			bind:value={filter}
		/>
		{#if groups.length === 0}
			<p class="mt-2 text-sm text-slate-600 dark:text-slate-400">No segments match.</p>
		{/if}
		{#each groups as [prov, segs] (prov)}
			<fieldset class="mt-3">
				<legend class="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400"
					>{prov}</legend
				>
				{#each segs as seg (seg.id)}
					<div class="flex min-h-11 items-center gap-2">
						<input
							id="toll-{seg.id}"
							type="checkbox"
							class="size-6 shrink-0 accent-teal-700"
							checked={selected.has(seg.id)}
							onchange={(e) => trip.toggleToll(seg.id, e.currentTarget.checked)}
						/>
						<label for="toll-{seg.id}" class="flex-1 py-1 text-sm">
							{seg.nama}{@render badges(seg)}
						</label>
						<span class="text-sm text-slate-600 tabular-nums dark:text-slate-400"
							>{formatIDR(seg.tarif)}</span
						>
					</div>
				{/each}
			</fieldset>
		{/each}
	</div>
</details>

<NumberInput
	id="toll-other"
	class="mt-3"
	label="Other toll cost"
	hint="For toll roads not in the list (one way, per car)."
	value={trip.state.toll.other}
	onchange={(v) => (trip.state.toll.other = v ?? 0)}
/>

<p class="mt-3 flex justify-between text-sm font-medium">
	<span>Toll total (one way, per car)</span>
	<span class="tabular-nums">{formatIDR(total)}</span>
</p>
