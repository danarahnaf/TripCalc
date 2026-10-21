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
			class="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-ink"
			>suggested</span
		>
	{/if}
	{#if seg.perlu_verifikasi}
		<span
			class="ml-1 rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink"
			title="Tariff from an older or conflicting source">unverified</span
		>
	{/if}
{/snippet}

<p class="rounded-lg bg-sunk p-3 text-xs text-ink-soft">
	Toll prices are full-segment Class I tariffs (data: {tollData.meta.acuan_data}). Partial use may
	cost less.
</p>

{#if trip.suggestedIds.length > 0}
	<p class="mt-3 text-sm font-medium text-brand-ink">
		Suggested from route, please confirm
	</p>
{:else if trip.routeStatus === 'ok'}
	<p class="mt-3 text-sm text-ink-soft">
		No listed toll segments matched this route. Pick them manually if needed.
	</p>
{/if}

<div class="mt-3 space-y-2">
	{#if selectedSegments.length === 0}
		<p class="text-sm text-ink-soft">No toll segments selected.</p>
	{/if}
	{#each selectedSegments as seg (seg.id)}
		<div class="rounded-xl border-2 border-line bg-surface p-2 shadow-retro-sm">
			<div class="flex items-start gap-2">
				<input
					id="sel-{seg.id}"
					type="checkbox"
					class="mt-0.5 size-6 shrink-0 accent-brand"
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
						class="min-h-11 rounded-lg px-3 text-xs font-medium text-brand-ink underline"
						onclick={() => trip.setTollOverride(seg.id, null)}
						aria-label="Reset price for {seg.nama} to {formatIDR(seg.tarif)}">Reset</button
					>
				{/if}
			</div>
		</div>
	{/each}
</div>

<details
	class="retro-panel mt-3 rounded-xl border-2 border-line"
	bind:open={browseOpen}
>
	<summary class="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
		All toll segments ({tollSegments.length})
	</summary>
	<div class="border-t border-line-soft p-3">
		<label for="toll-filter" class="sr-only">Search toll segments</label>
		<input
			id="toll-filter"
			type="search"
			placeholder="Search segments, e.g. Cipali"
			class="h-11 w-full retro-input px-3 text-base"
			bind:value={filter}
		/>
		{#if groups.length === 0}
			<p class="mt-2 text-sm text-ink-soft">No segments match.</p>
		{/if}
		{#each groups as [prov, segs] (prov)}
			<fieldset class="mt-3">
				<legend class="text-xs font-semibold tracking-wide text-ink-soft uppercase"
					>{prov}</legend
				>
				{#each segs as seg (seg.id)}
					<div class="flex min-h-11 items-center gap-2">
						<input
							id="toll-{seg.id}"
							type="checkbox"
							class="size-6 shrink-0 accent-brand"
							checked={selected.has(seg.id)}
							onchange={(e) => trip.toggleToll(seg.id, e.currentTarget.checked)}
						/>
						<label for="toll-{seg.id}" class="flex-1 py-1 text-sm">
							{seg.nama}{@render badges(seg)}
						</label>
						<span class="text-sm text-ink-soft tabular-nums"
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
