const idrFormatter = new Intl.NumberFormat('id-ID', {
	style: 'currency',
	currency: 'IDR',
	maximumFractionDigits: 0
});
const thousandsFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

/** Max digits accepted from money inputs, to stay within safe integers. */
const MAX_DIGITS = 15;

export function formatIDR(amount: number): string {
	return idrFormatter.format(Math.round(amount));
}

/** "50000" → "50.000"; null/NaN → "". */
export function formatThousands(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '';
	return thousandsFormatter.format(Math.round(value));
}

/** 12.5 → "12,5"; null/NaN → "". */
export function formatDecimal(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '';
	return decimalFormatter.format(value);
}

function digitsOf(text: string): string {
	return text.replace(/\D/g, '').slice(0, MAX_DIGITS);
}

/** Money input: strips non-digits. "50.000" → 50000, "" → 0. */
export function parseIntInput(text: string): number {
	const digits = digitsOf(text);
	return digits ? Number(digits) : 0;
}

/** Optional money input: like parseIntInput, but "" → null. */
export function parseNullableInt(text: string): number | null {
	const digits = digitsOf(text);
	return digits ? Number(digits) : null;
}

/** Decimal input accepting "," or "." as separator. "12,5" → 12.5, "" → null. */
export function parseDecimal(text: string): number | null {
	let t = text.trim().replace(/,/g, '.').replace(/[^\d.]/g, '');
	const dot = t.indexOf('.');
	if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '');
	if (t === '' || t === '.') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

/** Rounds up to the nearest Rp 500. */
export function roundUpTo500(amount: number): number {
	if (!(amount > 0)) return 0;
	// Subtract a tiny epsilon so float noise like 1500.0000001 does not jump to 2000.
	return Math.ceil(amount / 500 - 1e-9) * 500;
}
