<script lang="ts">
	import { trip } from '#lib/stores/trip.svelte.ts';
	import NumberInput from './NumberInput.svelte';

	const extras = $derived(trip.state.extras);
	const fields = [
		{ key: 'parking', label: 'Parking' },
		{ key: 'food', label: 'Food' },
		{ key: 'lodging', label: 'Lodging' },
		{ key: 'other', label: 'Other' }
	] as const;
</script>

<div class="grid grid-cols-2 gap-3">
	{#each fields as f (f.key)}
		<NumberInput
			id="extra-{f.key}"
			label={f.label}
			value={extras[f.key]}
			onchange={(v) => (extras[f.key] = v ?? 0)}
		/>
	{/each}
</div>
<p class="mt-2 text-xs text-ink-soft">
	Totals for the whole group. Added to every mode and not doubled for round trips.
</p>
