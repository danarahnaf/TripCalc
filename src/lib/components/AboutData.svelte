<script lang="ts">
	import { fuelData } from '#lib/data/defaults.ts';
	import { tollData } from '#lib/stores/trip.svelte.ts';
	import Sticker from './Sticker.svelte';

	const meta = tollData.meta;
	const link = 'font-medium text-brand-ink underline';
</script>

<details class="retro-panel retro-card">
	<summary class="flex min-h-14 cursor-pointer items-center gap-3 px-4 font-display text-lg">
		<Sticker name="sign" size={40} tilt={-4} />About data
	</summary>
	<div class="space-y-3 border-t border-line-soft p-4 text-sm text-ink-soft">
		<p>
			Map data © <a class={link} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
				>OpenStreetMap contributors</a
			>. Place search by
			<a class={link} href="https://nominatim.org/" target="_blank" rel="noopener">Nominatim</a>. Routes with
			and without tolls by
			<a class={link} href="https://valhalla.github.io/valhalla/" target="_blank" rel="noopener"
				>Valhalla</a
			>
			on the free
			<a class={link} href="https://www.fossgis.de/" target="_blank" rel="noopener">FOSSGIS</a> server, with
			<a class={link} href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a> (public demo
			server) as a fallback. Both are for light use only, not production.
		</p>
		<div>
			<p class="font-medium">Toll tariffs ({meta.wilayah}, {meta.mata_uang})</p>
			<ul class="mt-1 list-disc pl-5">
				{#each meta.sumber as s (s)}
					<li>{s}</li>
				{/each}
			</ul>
			<p class="mt-1">
				Reference: {meta.acuan_data}. Type: {meta.jenis_tarif}. Class: {meta.golongan}. Note: {meta.catatan}
			</p>
		</div>
		<p>Fuel prices: {fuelData.updated}. {fuelData.note}</p>
		<p>
			Train and bus fares are entered by you; travel time is estimated from road distance (train
			70 km/h, bus 45 km/h, plus 30 min each). Estimates only, always check before you go.
		</p>
	</div>
</details>
