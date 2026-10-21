<script lang="ts">
	import { toasts } from '#lib/stores/toast.svelte.ts';

	const styles = {
		info: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
		success: 'bg-teal-800 text-white',
		error: 'bg-red-700 text-white'
	};
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4 print:hidden"
	aria-live="polite"
	role="status"
>
	{#each toasts.items as t (t.id)}
		<div
			class="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-lg {styles[t.kind]}"
		>
			<span>{t.message}</span>
			<button
				type="button"
				class="-mr-2 inline-flex size-9 items-center justify-center rounded opacity-80 hover:opacity-100"
				aria-label="Dismiss"
				onclick={() => toasts.dismiss(t.id)}>✕</button
			>
		</div>
	{/each}
</div>
