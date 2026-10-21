<script lang="ts">
	import {
		formatDecimal,
		formatThousands,
		parseDecimal,
		parseIntInput,
		parseNullableInt
	} from '#lib/logic/format.ts';

	interface Props {
		id: string;
		label: string;
		value: number | null;
		onchange: (value: number | null) => void;
		/** money: digits only, thousand separators; decimal: accepts "," or "." */
		kind?: 'money' | 'decimal';
		/** When true, an empty field means null instead of 0. */
		nullable?: boolean;
		placeholder?: string;
		hint?: string;
		suffix?: string;
		hideLabel?: boolean;
		class?: string;
	}

	let {
		id,
		label,
		value,
		onchange,
		kind = 'money',
		nullable = false,
		placeholder = '0',
		hint,
		suffix,
		hideLabel = false,
		class: className = ''
	}: Props = $props();

	let focused = $state(false);
	let draft = $state('');

	function format(v: number | null): string {
		if (kind === 'decimal') return formatDecimal(v);
		return formatThousands(nullable ? v : v || null);
	}

	function parse(text: string): number | null {
		if (kind === 'decimal') return parseDecimal(text);
		return nullable ? parseNullableInt(text) : parseIntInput(text);
	}

	const display = $derived(focused ? draft : format(value));
</script>

<div class={className}>
	<label for={id} class={hideLabel ? 'sr-only' : 'mb-1 block text-sm font-medium'}>{label}</label>
	<div
		class="flex h-11 items-center rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 dark:border-slate-600 dark:bg-slate-900"
	>
		{#if kind === 'money'}
			<span class="pl-3 text-sm text-slate-600 dark:text-slate-400" aria-hidden="true">Rp</span>
		{/if}
		<input
			{id}
			type="text"
			inputmode={kind === 'money' ? 'numeric' : 'decimal'}
			autocomplete="off"
			class="h-full w-full min-w-0 rounded-lg bg-transparent px-2 text-right text-base tabular-nums outline-none"
			{placeholder}
			value={display}
			aria-describedby={hint ? `${id}-hint` : undefined}
			onfocus={() => {
				draft = format(value);
				focused = true;
			}}
			oninput={(e) => {
				draft = e.currentTarget.value;
				onchange(parse(draft));
			}}
			onblur={() => (focused = false)}
		/>
		{#if suffix}
			<span class="pr-3 text-sm text-slate-600 dark:text-slate-400" aria-hidden="true">{suffix}</span>
		{/if}
	</div>
	{#if hint}
		<p id="{id}-hint" class="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
	{/if}
</div>
