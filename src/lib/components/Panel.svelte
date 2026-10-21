<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		/** One line describing the current values, shown while collapsed. */
		summary: string;
		children: Snippet;
	}

	let { id, title, summary, children }: Props = $props();
</script>

<details
	class="group rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-700 dark:bg-slate-900"
>
	<summary class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
		<div class="min-w-0 flex-1">
			<h2 {id} class="text-base font-semibold">{title}</h2>
			<p class="truncate text-xs text-slate-600 dark:text-slate-400">{summary}</p>
		</div>
		<span
			class="text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
			aria-hidden="true">▾</span
		>
	</summary>
	<div class="border-t border-slate-200 p-4 dark:border-slate-700">
		{@render children()}
	</div>
</details>
