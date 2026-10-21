// Generates the Workbox service worker for the static build.
// @vite-pwa/sveltekit only emits it during a separate SSR build (SvelteKit 2), which SvelteKit 3
// no longer runs, so we precache the finished `build/` folder here instead.
import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
	globDirectory: 'build',
	globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json,woff2}'],
	globIgnores: ['sw.js', 'workbox-*.js'],
	swDest: 'build/sw.js',
	mode: 'production',
	sourcemap: false,
	inlineWorkboxRuntime: true,
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	skipWaiting: true,
	// SPA: every navigation is answered with the app shell.
	navigateFallback: '/index.html',
	navigateFallbackDenylist: [/^\/_app\//, /\/[^/?]+\.[^/]+$/],
	dontCacheBustURLsMatching: /^_app\/immutable\//
	// No runtime caching: map tiles, Nominatim and OSRM always go to the network.
});

for (const w of warnings) console.warn(w);
console.log(`✔ sw.js precaches ${count} files (${(size / 1024).toFixed(0)} KiB)`);
