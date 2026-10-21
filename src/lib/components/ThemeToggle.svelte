<script lang="ts">
	import { theme, type ThemeMode } from '#lib/stores/theme.svelte.ts';

	const options: { value: ThemeMode; label: string; icon: string }[] = [
		{ value: 'light', label: 'Light', icon: '☀' },
		{ value: 'dark', label: 'Dark', icon: '☾' },
		{ value: 'system', label: 'System', icon: '◐' }
	];
</script>

<div
	class="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600"
	role="group"
	aria-label="Color theme"
>
	{#each options as o (o.value)}
		<button
			type="button"
			class="inline-flex min-h-10 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-sm {theme.mode ===
			o.value
				? 'bg-teal-700 text-white'
				: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}"
			aria-pressed={theme.mode === o.value}
			title="{o.label} theme"
			onclick={() => theme.set(o.value)}
		>
			<span aria-hidden="true">{o.icon}</span><span class="sr-only sm:not-sr-only">{o.label}</span>
		</button>
	{/each}
</div>
