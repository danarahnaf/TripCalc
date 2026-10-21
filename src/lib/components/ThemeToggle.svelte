<script lang="ts">
	import { theme, type ThemeMode } from '#lib/stores/theme.svelte.ts';

	const options: { value: ThemeMode; label: string; icon: string }[] = [
		{ value: 'light', label: 'Light', icon: '☀' },
		{ value: 'dark', label: 'Dark', icon: '☾' },
		{ value: 'system', label: 'System', icon: '◐' }
	];
</script>

<div
	class="inline-flex rounded-xl border-2 border-line bg-surface p-0.5 shadow-retro-sm"
	role="group"
	aria-label="Color theme"
>
	{#each options as o (o.value)}
		<button
			type="button"
			class="inline-flex min-h-10 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors {theme.mode ===
			o.value
				? 'bg-mustard text-[#2b2118]'
				: 'text-ink hover:bg-sunk'}"
			aria-pressed={theme.mode === o.value}
			title="{o.label} theme"
			onclick={() => theme.set(o.value)}
		>
			<span aria-hidden="true">{o.icon}</span><span class="sr-only sm:not-sr-only">{o.label}</span>
		</button>
	{/each}
</div>
