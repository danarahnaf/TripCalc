export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'lajur:v1:theme';

class Theme {
	mode = $state<ThemeMode>('system');
	systemDark = $state(false);
	dark = $derived(this.mode === 'dark' || (this.mode === 'system' && this.systemDark));
	#started = false;

	init() {
		if (this.#started) return;
		this.#started = true;
		try {
			const saved = localStorage.getItem(KEY);
			if (saved === 'light' || saved === 'dark' || saved === 'system') this.mode = saved;
		} catch {
			// Storage blocked: stay on system.
		}
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		this.systemDark = mq.matches;
		mq.addEventListener('change', (e) => {
			this.systemDark = e.matches;
			this.#apply();
		});
		this.#apply();
	}

	set(mode: ThemeMode) {
		this.mode = mode;
		try {
			localStorage.setItem(KEY, mode);
		} catch {
			// Not persisted; still applied for this visit.
		}
		this.#apply();
	}

	#apply() {
		document.documentElement.classList.toggle('dark', this.dark);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', this.dark ? '#0b1220' : '#0f766e');
		// Let the map re-measure itself after the layout settles.
		requestAnimationFrame(() => window.dispatchEvent(new Event('lajur:layout')));
	}
}

export const theme = new Theme();
