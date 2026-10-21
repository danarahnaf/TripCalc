<script lang="ts">
	import { saved } from '#lib/stores/saved.svelte.ts';
	import { toasts } from '#lib/stores/toast.svelte.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';

	let renamingId = $state<string | null>(null);
	let renameText = $state('');
	let confirmDeleteId = $state<string | null>(null);

	const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

	function save() {
		const name = trip.state.name.trim() || defaultName();
		const id = saved.save(trip.state, name, trip.savedId);
		if (id) {
			trip.savedId = id;
			trip.state.name = name;
			toasts.show('Trip saved', 'success');
		}
	}

	function saveAsNew() {
		const name = trip.state.name.trim() || defaultName();
		const id = saved.save(trip.state, name, null);
		if (id) {
			trip.savedId = id;
			trip.state.name = name;
			toasts.show('Saved as a new trip', 'success');
		}
	}

	function defaultName(): string {
		const s = trip.setStops;
		if (s.length >= 2) return `${s[0].name.split(',')[0]} → ${s[s.length - 1].name.split(',')[0]}`;
		return 'Untitled trip';
	}

	function load(id: string) {
		const t = saved.get(id);
		if (!t) return;
		trip.load(t.trip, t.id);
		trip.state.name = t.name;
		toasts.show(`Loaded “${t.name}”`, 'success');
	}

	function startRename(id: string, name: string) {
		renamingId = id;
		renameText = name;
	}

	function commitRename() {
		if (renamingId && saved.rename(renamingId, renameText)) {
			if (trip.savedId === renamingId) trip.state.name = renameText.trim() || 'Untitled trip';
		}
		renamingId = null;
	}

	const btn =
		'min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-sunk';
</script>

<div class="space-y-3">
	<div>
		<label for="trip-name" class="mb-1 block text-sm font-medium">Trip name</label>
		<input
			id="trip-name"
			type="text"
			maxlength="100"
			placeholder="e.g. Mudik Surabaya → Malang"
			class="h-11 w-full retro-input px-3 text-base"
			bind:value={trip.state.name}
		/>
	</div>
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="retro-btn min-h-11 bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-strong"
			onclick={save}>{trip.savedId ? 'Update saved trip' : 'Save trip'}</button
		>
		{#if trip.savedId}
			<button
				type="button"
				class="retro-btn min-h-11 bg-surface px-4 text-sm font-semibold hover:bg-sunk"
				onclick={saveAsNew}>Save as new</button
			>
		{/if}
		<button
			type="button"
			class="retro-btn min-h-11 bg-surface px-4 text-sm font-semibold hover:bg-sunk"
			onclick={() => trip.reset()}>New trip</button
		>
	</div>
	{#if saved.error}
		<p class="text-sm text-danger-ink" role="alert">{saved.error}</p>
	{/if}

	{#if saved.list.length > 0}
		<ul class="divide-y-2 divide-dashed divide-line-soft retro-card">
			{#each saved.list as t (t.id)}
				<li class="p-2">
					{#if renamingId === t.id}
						<form
							class="flex gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								commitRename();
							}}
						>
							<label for="rename-{t.id}" class="sr-only">New name</label>
							<input
								id="rename-{t.id}"
								type="text"
								maxlength="100"
								class="h-11 min-w-0 flex-1 retro-input px-3 text-base"
								bind:value={renameText}
							/>
							<button type="submit" class={btn}>OK</button>
							<button type="button" class={btn} onclick={() => (renamingId = null)}>Cancel</button>
						</form>
					{:else}
						<div class="flex flex-wrap items-center gap-1">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">
									{t.name}
									{#if trip.savedId === t.id}<span class="text-xs text-brand-ink">· open</span>{/if}
								</p>
								<p class="text-xs text-ink-soft">
									{t.trip.stops.length} stops · {dateFmt.format(t.savedAt)}
								</p>
							</div>
							{#if confirmDeleteId === t.id}
								<button
									type="button"
									class="{btn} text-danger-ink"
									onclick={() => {
										saved.remove(t.id);
										if (trip.savedId === t.id) trip.savedId = null;
										confirmDeleteId = null;
									}}>Delete?</button
								>
								<button type="button" class={btn} onclick={() => (confirmDeleteId = null)}>Keep</button>
							{:else}
								<button type="button" class="{btn} text-brand-ink" onclick={() => load(t.id)}
									>Load</button
								>
								<button type="button" class={btn} onclick={() => startRename(t.id, t.name)}>Rename</button>
								<button type="button" class={btn} onclick={() => (confirmDeleteId = t.id)}>Delete</button>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-ink-soft">No saved trips yet. They stay in this browser.</p>
	{/if}
</div>
