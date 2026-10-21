<script lang="ts">
	import { encodeTrip } from '#lib/logic/share.ts';
	import { toasts } from '#lib/stores/toast.svelte.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';

	let fallbackUrl = $state<string | null>(null);

	function shareUrl(): string {
		const url = new URL(window.location.href);
		url.search = '';
		url.hash = '';
		url.searchParams.set('t', encodeTrip(trip.state));
		return url.toString();
	}

	function legacyCopy(text: string): boolean {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', '');
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		ta.remove();
		return ok;
	}

	async function copy() {
		const url = shareUrl();
		fallbackUrl = null;
		try {
			if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
			await navigator.clipboard.writeText(url);
			toasts.show('Link copied', 'success');
		} catch {
			if (legacyCopy(url)) toasts.show('Link copied', 'success');
			else fallbackUrl = url; // Let the user copy it by hand.
		}
	}
</script>

<button
	type="button"
	class="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
	disabled={trip.setStops.length === 0}
	onclick={copy}
>
	Copy share link
</button>
{#if fallbackUrl}
	<div class="mt-2 w-full">
		<label for="share-url" class="mb-1 block text-sm">Copy this link:</label>
		<input
			id="share-url"
			type="text"
			readonly
			class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
			value={fallbackUrl}
			onfocus={(e) => e.currentTarget.select()}
		/>
	</div>
{/if}
