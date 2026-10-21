<script lang="ts">
	import { CAR_PRESETS, DEFAULTS, fuelData } from '#lib/data/defaults.ts';
	import { carsNeeded, motorcyclesNeeded } from '#lib/logic/cost.ts';
	import { trip } from '#lib/stores/trip.svelte.ts';
	import type { CarPreset } from '#lib/types.ts';
	import NumberInput from './NumberInput.svelte';

	const s = $derived(trip.state);
	const cars = $derived(carsNeeded(s.passengers));
	const motos = $derived(motorcyclesNeeded(s.passengers));

	const select =
		'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900';
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
			<p class="mt-1 text-xs text-red-700 dark:text-red-400" role="alert">Enter car consumption in km/L.</p>
		{/if}
		{#if cars > 1}
			<p class="mt-2 text-sm font-medium text-blue-800 dark:text-blue-300">
				Needs {cars} cars ({DEFAULTS.carCapacity} people per car)
			</p>
		{/if}
	</fieldset>

	<fieldset>
		<legend class={legend}>Motorcycle (never uses toll)</legend>
		<div class="grid grid-cols-2 gap-3">
			<NumberInput
				id="moto-kml"
				kind="decimal"
				label="Consumption"
				suffix="km/L"
				value={s.motorcycle.kmPerLiter}
				onchange={(v) => (s.motorcycle.kmPerLiter = v ?? 0)}
			/>
			<div>
				<label for="moto-fuel" class="mb-1 block text-sm font-medium">Fuel</label>
				<select
					id="moto-fuel"
					class={select}
					value={s.motorcycle.fuelId}
					onchange={(e) => trip.setFuel('motorcycle', e.currentTarget.value)}
				>
					{#each fuelData.fuels as f (f.id)}
						<option value={f.id}>{f.name}</option>
					{/each}
				</select>
			</div>
			<NumberInput
				id="moto-price"
				class="col-span-2"
				label="Fuel price per liter"
				value={s.motorcycle.fuelPrice}
				onchange={(v) => (s.motorcycle.fuelPrice = v ?? 0)}
			/>
		</div>
		{#if motos > 1}
			<p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
				{motos} motorcycles ({DEFAULTS.motorcycleCapacity} people each)
			</p>
		{/if}
	</fieldset>

	<p class="text-xs text-slate-600 dark:text-slate-400">
		Fuel prices: {fuelData.updated}. {fuelData.note}
	</p>

</div>
