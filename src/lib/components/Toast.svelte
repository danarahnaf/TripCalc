<script lang="ts">
	import { toasts } from '#lib/stores/toast.svelte.ts';

	const styles = {
		info: 'bg-ink text-paper',
		success: 'bg-brand text-on-brand',
		error: 'bg-danger text-[#fffaf0]'
	};
	const icons = { info: '✦', success: '✔', error: '!' };
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4 print:hidden"
	aria-live="polite"
	role="status"
>
	{#each toasts.items as t (t.id)}
		<div
			class="toast pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border-2 border-line px-4 py-2 text-sm font-medium shadow-retro {styles[
				t.kind
			]}"
		>
			<span class="font-display text-base" aria-hidden="true">{icons[t.kind]}</span>
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
