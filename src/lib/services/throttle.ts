/**
 * Serializes tasks so that each one starts at least `intervalMs` after the previous one started.
 * Used to keep Nominatim at max 1 request/second across the whole app.
 */
export function createRateLimiter(intervalMs: number, now: () => number = () => Date.now()) {
	let nextSlot = 0;
	return async function run<T>(task: () => Promise<T>): Promise<T> {
		const t = now();
		const start = Math.max(t, nextSlot);
		nextSlot = start + intervalMs;
		const wait = start - t;
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		return task();
	};
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const call = (...args: A) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
	call.cancel = () => clearTimeout(timer);
	return call;
}

export function isAbortError(e: unknown): boolean {
	return e instanceof DOMException
		? e.name === 'AbortError'
		: typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

export function abortError(): DOMException {
	return new DOMException('Aborted', 'AbortError');
}
