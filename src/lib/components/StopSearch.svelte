<script lang="ts">
	import { onDestroy } from 'svelte';
	import { MIN_QUERY_LENGTH, searchPlaces } from '#lib/services/geocode.ts';
	import { isAbortError } from '#lib/services/throttle.ts';
	import { recent } from '#lib/stores/recent.svelte.ts';
	import type { GeocodeResult } from '#lib/types.ts';

	interface Props {
		id: string;
		label: string;
		onselect: (place: GeocodeResult) => void;
	}

	let { id, label, onselect }: Props = $props();

	const listId = $derived(`${id}-list`);
	let query = $state('');
	let results = $state<GeocodeResult[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let status = $state<'idle' | 'short' | 'loading' | 'done' | 'error'>('idle');
	let error = $state('');

	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;

	// An empty box lists recently used places instead of search results.
	const showingRecent = $derived(query.trim() === '');
	const items = $derived(showingRecent ? recent.list : results);

	const statusText = $derived(
		status === 'short'
			? `Type at least ${MIN_QUERY_LENGTH} characters`
			: status === 'loading'
				? 'Searching…'
				: status === 'error'
					? error
					: status === 'done'
						? results.length === 0
							? 'No places found in Java'
							: `${results.length} result${results.length === 1 ? '' : 's'}`
						: ''
	);

	function stop() {
		clearTimeout(timer);
		controller?.abort();
		controller = null;
	}

	function openRecent() {
		recent.load();
		open = recent.list.length > 0;
		active = -1;
	}

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		query = e.currentTarget.value;
		stop();
		const q = query.trim();
		active = -1;
		if (q.length === 0) {
			status = 'idle';
			results = [];
			openRecent();
			return;
		}
		open = true;
		if (q.length < MIN_QUERY_LENGTH) {
			status = 'short';
			results = [];
			return;
		}
		status = 'loading';
		timer = setTimeout(() => run(q), 600);
	}

	async function run(q: string) {
		const c = new AbortController();
		controller = c;
		try {
			const found = await searchPlaces(q, c.signal);
			if (c.signal.aborted) return;
			results = found;
			active = found.length ? 0 : -1;
			status = 'done';
		} catch (e) {
			if (isAbortError(e)) return;
			status = 'error';
			error = e instanceof Error ? e.message : 'Search failed. Try again.';
		}
	}

	function choose(place: GeocodeResult) {
		stop();
		recent.add(place);
		onselect(place);
		query = '';
		results = [];
		open = false;
		status = 'idle';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!open && showingRecent) openRecent();
			open = open || items.length > 0;
			if (items.length) active = (active + 1) % items.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (items.length) active = active <= 0 ? items.length - 1 : active - 1;
		} else if (e.key === 'Enter') {
			if (open && active >= 0 && items[active]) {
				e.preventDefault();
				choose(items[active]);
			}
		} else if (e.key === 'Escape') {
			if (open) {
				e.preventDefault();
				open = false;
			}
		}
	}

	onDestroy(stop);
</script>

<div class="relative">
	<label for={id} class="sr-only">{label}</label>
	<input
		{id}
		type="text"
		role="combobox"
		autocomplete="off"
		spellcheck="false"
		placeholder="Search a place in Java…"
		class="h-11 w-full retro-input px-3 text-base"
		aria-autocomplete="list"
		aria-expanded={open && items.length > 0}
		aria-controls={listId}
		aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
		aria-describedby="{id}-status"
		value={query}
		oninput={onInput}
		onkeydown={onKeydown}
		onblur={() => (open = false)}
		onfocus={() => {
			if (query.trim()) open = true;
			else openRecent();
		}}
	/>
	<span id="{id}-status" class="sr-only" aria-live="polite">{statusText}</span>
	{#if open}
		<div
			class="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border-2 border-line bg-surface shadow-retro"
		>
			{#if showingRecent && items.length > 0}
				<div class="flex items-center justify-between px-3 pt-2 text-xs text-ink-soft">
					<span>Recent places</span>
					<button
						type="button"
						class="rounded px-2 py-1 font-medium text-brand-ink underline"
						onmousedown={(e) => {
							e.preventDefault();
							recent.clear();
							open = false;
						}}>Clear</button
					>
				</div>
			{/if}
			{#if items.length > 0}
				<ul
					id={listId}
					role="listbox"
					aria-label={showingRecent ? 'Recent places' : `${label} results`}
				>
					{#each items as r, i (r.id)}
						<li
							id="{listId}-{i}"
							role="option"
							aria-selected={i === active}
							class="cursor-pointer px-3 py-2 {i === active
								? 'bg-brand-soft'
								: ''}"
							onmousedown={(e) => {
								e.preventDefault();
								choose(r);
							}}
							onmouseenter={() => (active = i)}
						>
							<span class="block text-sm font-medium">{r.name}</span>
							<span class="block truncate text-xs text-ink-soft">{r.context}</span>
						</li>
					{/each}
				</ul>
			{:else if statusText}
				<p
					class="px-3 py-2 text-sm {status === 'error'
						? 'text-danger-ink'
						: 'text-ink-soft'}"
				>
					{statusText}
				</p>
			{/if}
		</div>
	{/if}
</div>
