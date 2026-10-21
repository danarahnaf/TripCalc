<script lang="ts">
	import { onDestroy } from 'svelte';
	import { MIN_QUERY_LENGTH, searchPlaces } from '#lib/services/geocode.ts';
	import { isAbortError } from '#lib/services/throttle.ts';
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

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		query = e.currentTarget.value;
		stop();
		const q = query.trim();
		active = -1;
		if (q.length === 0) {
			status = 'idle';
			results = [];
			open = false;
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
		onselect(place);
		query = '';
		results = [];
		open = false;
		status = 'idle';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			if (results.length) active = (active + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (results.length) active = active <= 0 ? results.length - 1 : active - 1;
		} else if (e.key === 'Enter') {
			if (open && active >= 0 && results[active]) {
				e.preventDefault();
				choose(results[active]);
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
		class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900"
		aria-autocomplete="list"
		aria-expanded={open && results.length > 0}
		aria-controls={listId}
		aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
		aria-describedby="{id}-status"
		value={query}
		oninput={onInput}
		onkeydown={onKeydown}
		onblur={() => (open = false)}
		onfocus={() => {
			if (query.trim()) open = true;
		}}
	/>
	<span id="{id}-status" class="sr-only" aria-live="polite">{statusText}</span>
	{#if open}
		<div
			class="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
		>
			{#if results.length > 0}
				<ul id={listId} role="listbox" aria-label="{label} results">
					{#each results as r, i (r.id)}
						<li
							id="{listId}-{i}"
							role="option"
							aria-selected={i === active}
							class="cursor-pointer px-3 py-2 {i === active
								? 'bg-teal-50 dark:bg-teal-950'
								: ''}"
							onmousedown={(e) => {
								e.preventDefault();
								choose(r);
							}}
							onmouseenter={() => (active = i)}
						>
							<span class="block text-sm font-medium">{r.name}</span>
							<span class="block truncate text-xs text-slate-600 dark:text-slate-400">{r.context}</span>
						</li>
					{/each}
				</ul>
			{:else if statusText}
				<p
					class="px-3 py-2 text-sm {status === 'error'
						? 'text-red-700 dark:text-red-400'
						: 'text-slate-600 dark:text-slate-400'}"
				>
					{statusText}
				</p>
			{/if}
		</div>
	{/if}
</div>
