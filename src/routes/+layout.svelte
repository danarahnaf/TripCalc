<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import OfflineBanner from '#lib/components/OfflineBanner.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		theme.init();
		if (pwaInfo) {
			import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
		}
	});
</script>

<div class="flex min-h-dvh flex-col lg:h-dvh">
	<header
		class="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden dark:border-slate-800 dark:bg-slate-900"
	>
		<img src="/favicon.svg" alt="" width="32" height="32" />
		<div class="leading-tight">
			<p class="text-lg font-extrabold tracking-tight" aria-label="TripCalc">
				Trip<span class="text-teal-700 dark:text-teal-300">Calc</span>
			</p>
			<p class="hidden text-xs text-slate-600 sm:block dark:text-slate-400">Java trip cost planner</p>
		</div>
		<div class="ml-auto"><ThemeToggle /></div>
	</header>
	<OfflineBanner />
	{@render children()}
</div>
<Toast />
