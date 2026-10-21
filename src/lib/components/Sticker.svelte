<script lang="ts">
	/**
	 * Decorative retro stickers. Each shape is drawn twice: a thick cream stroke for the
	 * die-cut edge, then the artwork with an ink outline. Always aria-hidden.
	 */
	export type StickerName = 'car' | 'volcano' | 'sun' | 'ticket' | 'coin' | 'sign';

	interface Props {
		name: StickerName;
		size?: number;
		/** Rotation in degrees; stickers straighten on hover. */
		tilt?: number;
		class?: string;
	}

	let { name, size = 56, tilt = -6, class: className = '' }: Props = $props();
	const uid = $props.id();
	const art = $derived(`sticker-${name}-${uid}`);

	const INK = '#2b2118';
	const CREAM = '#fffaf0';
</script>

<span class="sticker {className}" style="--tilt: {tilt}deg" aria-hidden="true">
	<svg width={size} height={size} viewBox="0 0 64 64" fill="none">
		<defs>
			<g id={art} stroke-linejoin="round" stroke-linecap="round">
				{#if name === 'car'}
					<path
						d="M7 41v-8c0-3 2-5.5 5-6.5l6.5-10c1.2-2 3-3 5.2-3h16.6c2.2 0 4 1 5.2 3l6.5 10c3 1 5 3.5 5 6.5v8z"
						fill="#f0b33a"
					/>
					<path d="M21.5 17.5h9v9h-14.5z" fill="#bfe3ef" />
					<path d="M34 17.5h8.5l5.5 9h-14z" fill="#bfe3ef" />
					<rect x="7" y="32" width="50" height="3.5" fill="#e05a33" />
					<circle cx="19" cy="42" r="6.5" fill={INK} />
					<circle cx="45" cy="42" r="6.5" fill={INK} />
					<circle cx="19" cy="42" r="2.2" fill={CREAM} />
					<circle cx="45" cy="42" r="2.2" fill={CREAM} />
				{:else if name === 'volcano'}
					<circle cx="44" cy="18" r="9" fill="#f0b33a" />
					<path d="M5 54 23 24h18l18 30z" fill="#8a5a3b" />
					<path d="M23 24h18l-4 7-5-3-5 3z" fill="#e05a33" />
					<path d="M28 18c-3-4 2-8 5-5 2-4 8-2 7 2" fill="#efdfbf" />
				{:else if name === 'sun'}
					<g fill="#e05a33">
						<path d="M32 3l4 9h-8z" />
						<path d="M32 61l-4-9h8z" />
						<path d="M3 32l9-4v8z" />
						<path d="M61 32l-9 4v-8z" />
						<path d="M11.5 11.5l9.2 3.5-5.7 5.7z" />
						<path d="M52.5 52.5l-9.2-3.5 5.7-5.7z" />
						<path d="M52.5 11.5l-3.5 9.2-5.7-5.7z" />
						<path d="M11.5 52.5l3.5-9.2 5.7 5.7z" />
					</g>
					<circle cx="32" cy="32" r="15" fill="#f0b33a" />
					<path d="M25 34c2 4 12 4 14 0" fill="none" />
					<circle cx="27" cy="28" r="1.6" fill={INK} />
					<circle cx="37" cy="28" r="1.6" fill={INK} />
				{:else if name === 'ticket'}
					<path
						d="M6 20h52v8a4 4 0 0 0 0 8v8H6v-8a4 4 0 0 0 0-8z"
						fill="#e05a33"
						transform="rotate(-8 32 32)"
					/>
					<path d="M42 22v20" stroke-dasharray="2 3" transform="rotate(-8 32 32)" />
					<text
						x="23"
						y="36"
						text-anchor="middle"
						font-family="Righteous, system-ui, sans-serif"
						stroke="none"
						font-size="9"
						fill={CREAM}
						transform="rotate(-8 32 32)">TICKET</text
					>
				{:else if name === 'coin'}
					<circle cx="32" cy="32" r="22" fill="#f0b33a" />
					<circle cx="32" cy="32" r="16" fill="#fbe2a4" />
					<text
						x="32"
						y="38.5"
						text-anchor="middle"
						font-family="Righteous, system-ui, sans-serif"
						stroke="none"
						font-size="17"
						fill={INK}>Rp</text
					>
				{:else if name === 'sign'}
					<rect x="29" y="34" width="6" height="24" fill="#8a5a3b" />
					<rect x="6" y="8" width="52" height="28" rx="5" fill="#2f7d3a" />
					<text
						x="27"
						y="27"
						text-anchor="middle"
						font-family="Righteous, system-ui, sans-serif"
						stroke="none"
						font-size="13"
						fill={CREAM}>JAVA</text
					>
					<path d="M46 16l7 6-7 6z" fill={CREAM} />
				{/if}
			</g>
		</defs>
		<!-- Die-cut edge, then artwork with an ink outline. -->
		<use href="#{art}" stroke={CREAM} stroke-width="7" />
		<use href="#{art}" stroke={INK} stroke-width="2.2" />
	</svg>
</span>
