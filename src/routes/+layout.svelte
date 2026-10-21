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
	<header class="shrink-0 bg-surface print:hidden">
		<div class="flex h-16 items-center gap-3 px-4">
			<span class="sticker" style="--tilt: -8deg">
				<img
					src="/favicon.svg"
					alt=""
					width="38"
					height="38"
					class="rounded-[10px] border-2 border-line"
				/>
			</span>
			<div class="leading-tight">
				<p class="font-display text-2xl" aria-label="TripCalc">
					Trip<span class="text-brand-ink">Calc</span>
				</p>
				<p class="hidden text-xs font-medium tracking-wide text-ink-soft uppercase sm:block">
					Java road trip cost planner
				</p>
			</div>
			<div class="ml-auto"><ThemeToggle /></div>
		</div>
		<div class="retro-stripes border-y-2 border-line" aria-hidden="true"></div>
	</header>
	<OfflineBanner />
	{@render children()}
</div>
<Toast />
