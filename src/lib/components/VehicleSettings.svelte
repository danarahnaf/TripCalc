<script lang="ts">
	import { CAR_PRESETS, DEFAULTS, fuelData } from '#lib/data/defaults.ts';
	import { carsNeeded } from '#lib/logic/cost.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';
	import type { CarPreset } from '#lib/types.ts';
	import NumberInput from './NumberInput.svelte';

	const s = $derived(trip.state);
	const cars = $derived(carsNeeded(s.passengers));

	const select =
		'h-11 w-full retro-input px-3 text-base';
	const legend = 'mb-2 text-sm font-semibold';
</script>

<div class="space-y-5">
	<fieldset>
		<legend class={legend}>Car</legend>
		<div class="grid grid-cols-2 gap-3">
			<div class="col-span-2">
				<label for="car-preset" class="mb-1 block text-sm font-medium">Car type</label>
				<select
					id="car-preset"
					class={select}
					value={s.car.preset}
					onchange={(e) => trip.setCarPreset(e.currentTarget.value as CarPreset)}
				>
					{#each CAR_PRESETS as p (p.id)}
						<option value={p.id}>{p.label}{p.kmPerLiter ? ` (${p.kmPerLiter} km/L)` : ''}</option>
					{/each}
				</select>
			</div>
			<NumberInput
				id="car-kml"
				kind="decimal"
				label="Consumption"
				suffix="km/L"
				value={s.car.kmPerLiter}
				onchange={(v) => trip.setCarKmPerLiter(v)}
			/>
			<div>
				<label for="car-fuel" class="mb-1 block text-sm font-medium">Fuel</label>
				<select
					id="car-fuel"
					class={select}
					value={s.car.fuelId}
					onchange={(e) => trip.setFuel('car', e.currentTarget.value)}
				>
					{#each fuelData.fuels as f (f.id)}
						<option value={f.id}>{f.name}</option>
					{/each}
				</select>
			</div>
			<NumberInput
				id="car-price"
				class="col-span-2"
				label="Fuel price per liter"
				value={s.car.fuelPrice}
				onchange={(v) => (s.car.fuelPrice = v ?? 0)}
			/>
		</div>
		{#if !(s.car.kmPerLiter > 0)}
			<p class="mt-1 text-xs text-danger-ink" role="alert">Enter car consumption in km/L.</p>
		{/if}
		{#if cars > 1}
			<p class="mt-2 text-sm font-medium text-info-ink">
				Needs {cars} cars ({DEFAULTS.carCapacity} people per car)
			</p>
		{/if}
	</fieldset>

	<p class="text-xs text-ink-soft">
		Choosing a car type also picks its usual fuel. Motorcycle settings appear when you select the
		Motorcycle card. Fuel prices: {fuelData.updated}. {fuelData.note}
	</p>

</div>
