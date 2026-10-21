<script lang="ts">
	import { onMount } from 'svelte';
	import type * as Leaflet from 'leaflet';
	import { isStopSet } from '#lib/data/defaults.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';

	interface Props {
		onpick: (lat: number, lon: number) => void;
	}

	let { onpick }: Props = $props();

	let el: HTMLDivElement;
	let L = $state.raw<typeof Leaflet | null>(null);
	let map = $state.raw<Leaflet.Map | null>(null);
	let markers: Leaflet.LayerGroup | null = null;
	let lines: Leaflet.LayerGroup | null = null;

	const JAVA_CENTER: [number, number] = [-7.3, 110.2];

	onMount(() => {
		let disposed = false;
		let ro: ResizeObserver | undefined;
		const relayout = () => map?.invalidateSize();
		const beforePrint = () => {
			map?.invalidateSize();
			fit();
		};

		(async () => {
			const mod = await import('leaflet');
			if (disposed) return;
			const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
			const m = lf.map(el, { zoomControl: true }).setView(JAVA_CENTER, 7);
			lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution:
					'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			}).addTo(m);
			m.on('click', (e: Leaflet.LeafletMouseEvent) => onpick(e.latlng.lat, e.latlng.lng));
			lines = lf.layerGroup().addTo(m);
			markers = lf.layerGroup().addTo(m);
			ro = new ResizeObserver(relayout);
			ro.observe(el);
			L = lf;
			map = m;
		})();

		window.addEventListener('lajur:layout', relayout);
		window.addEventListener('beforeprint', beforePrint);
		return () => {
			disposed = true;
			ro?.disconnect();
			window.removeEventListener('lajur:layout', relayout);
			window.removeEventListener('beforeprint', beforePrint);
			map?.remove();
			map = null;
			markers = lines = null;
		};
	});

	function escapeHtml(s: string): string {
		return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
	}

	// Numbered markers.
	$effect(() => {
		const stops = trip.state.stops;
		if (!L || !map || !markers) return;
		markers.clearLayers();
		const last = stops.length - 1;
		stops.forEach((s, i) => {
			if (!isStopSet(s)) return;
			const kind = i === 0 ? 'start' : i === last ? 'end' : 'mid';
			const icon = L!.divIcon({
				className: '',
				html: `<span class="lajur-marker lajur-marker--${kind}">${i + 1}</span>`,
				iconSize: [28, 28],
				iconAnchor: [14, 14]
			});
			L!.marker([s.lat, s.lon], { icon, title: s.name, alt: `${i + 1}. ${s.name}`, keyboard: false })
				.bindTooltip(escapeHtml(s.name))
				.addTo(markers!);
		});
	});

	// Route polylines: via-toll solid, no-toll dashed; the selected mode's line is highlighted.
	$effect(() => {
		const { toll, notoll } = trip.routes;
		const mode = trip.state.selectedMode;
		if (!L || !map || !lines) return;
		lines.clearLayers();
		const notollActive = mode === 'car_notoll' || mode === 'motorcycle';
		const drawNotoll = notoll && !notoll.fallbackUsed && notoll.geometry.length > 1;
		const tollLine =
			toll && toll.geometry.length > 1
				? L.polyline(toll.geometry, {
						color: '#1d4ed8',
						weight: notollActive && drawNotoll ? 4 : 6,
						opacity: notollActive && drawNotoll ? 0.45 : 0.9
					})
				: null;
		const notollLine = drawNotoll
			? L.polyline(notoll.geometry, {
					color: '#c2410c',
					dashArray: '8 8',
					weight: notollActive ? 6 : 4,
					opacity: notollActive ? 0.95 : 0.55
				})
			: null;
		// Highlighted line goes on top.
		const order = notollActive ? [tollLine, notollLine] : [notollLine, tollLine];
		for (const line of order) line?.addTo(lines);
	});

	function fit() {
		if (!L || !map) return;
		const pts: [number, number][] = [];
		const g = trip.routes.toll?.geometry;
		if (g && g.length > 1) pts.push(...g);
		const ng = trip.routes.notoll?.geometry;
		if (ng && ng.length > 1 && !trip.routes.notoll?.fallbackUsed) pts.push(...ng);
		for (const s of trip.setStops) pts.push([s.lat, s.lon]);
		if (pts.length === 0) return;
		if (pts.length === 1) map.setView(pts[0], 12);
		else map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 14 });
	}

	// Fit bounds when stops or routes change (not when only the selected mode changes).
	$effect(() => {
		void trip.stopsKey;
		void trip.routes;
		if (map) fit();
	});
</script>

<div
	bind:this={el}
	class="h-full w-full"
	role="region"
	aria-label="Route map. Click or tap the map to drop a pin as a stop."
></div>
