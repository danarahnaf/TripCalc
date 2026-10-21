<script lang="ts">
	import { onMount } from 'svelte';

	let online = $state(true);

	onMount(() => {
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

{#if !online}
	<div
		class="bg-warn-soft px-4 py-2 text-center text-sm font-medium text-warn-ink print:hidden"
		role="status"
	>
		You're offline. Saved trips work; search and routing need internet.
	</div>
{/if}
