import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `npm run generate-pwa-assets` writes PNG icons next to the source SVG in static/icons/.
export default defineConfig({
	preset: {
		...minimal2023Preset,
		maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0f766e' } },
		apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0f766e' } }
	},
	images: ['static/icons/favicon.svg']
});
