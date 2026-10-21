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

<details class="retro-panel retro-card group print:hidden">
	<summary class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
		<div class="min-w-0 flex-1">
			<h2 {id} class="text-lg">{title}</h2>
			<p class="truncate text-xs text-ink-soft">{summary}</p>
		</div>
		<span
			class="inline-flex size-8 items-center justify-center rounded-full border-2 border-line bg-mustard text-sm text-[#2b2118] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
			aria-hidden="true">▾</span
		>
	</summary>
	<div class="border-t-2 border-dashed border-line-soft p-4">
		{@render children()}
	</div>
</details>
