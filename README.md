# Lajur — Java Trip Cost Planner

Plan a road trip within Java and compare total cost and travel time for car (via toll / no toll), motorcycle, train and bus, side by side.

## Screenshots

| | Light | Dark |
|---|---|---|
| Mobile | _screenshot placeholder_ | _screenshot placeholder_ |
| Desktop | _screenshot placeholder_ | _screenshot placeholder_ |

## Features

- Stops editor: start, destination and up to 8 stops in between. Search with autocomplete (Nominatim) or tap the map to drop a pin; rename, reorder (↑/↓) and remove stops.
- Routing via OSRM: a via-toll route and a no-toll route, drawn on the map (solid / dashed) with numbered markers. The selected mode's line is highlighted.
- Five mode cards with distance, time, total and cost per person; the cheapest and fastest are marked.
- Detailed cost breakdown per mode: fuel, toll (suggested from the route, editable per segment, plus "other toll"), tickets, local transport and shared extras.
- Passengers (1–50) with automatic car (7 per car) and motorcycle (2 per bike) counts, round-trip toggle, split per person rounded up to Rp 500.
- Save, load, rename and delete trips in `localStorage`; share a trip as a compressed `?t=` link; print / save as PDF.
- Light / dark / system theme with no flash on load; installable PWA with an offline app shell.

## Tech stack

SvelteKit 3 (SPA mode, `adapter-static`) · Svelte 5 runes · TypeScript (strict) · Tailwind CSS v4 · Leaflet + OpenStreetMap tiles · lz-string · @vite-pwa/sveltekit + Workbox · Vitest.

## Data sources and disclaimers

- **Map, search, routing**: © OpenStreetMap contributors, Nominatim, and the OSRM public demo server. The demo server is for light use only and **not for production**. It can be slow or unavailable, and it does not support `exclude=toll` (see Decisions).
- **Toll tariffs** (`src/lib/data/tarif_tol_jawa.json`): full-segment, end-to-end, **Class I only** tariffs from the sources in the file's `meta.sumber`. Partial use of a segment may cost less. Segments marked `perlu_verifikasi` show an "unverified" badge. Every price is editable.
- **Fuel prices** (`src/lib/data/fuel.json`) are reference prices and can be edited per trip.
- **Train and bus** fares are entered manually. Travel time is estimated from road distance (train 70 km/h, bus 45 km/h, +30 min each).

## Local setup

```bash
npm install
npm run dev
npm test
```

Other scripts: `npm run check` (svelte-check), `npm run build` (static site in `build/` plus the service worker), `npm run preview`, `npm run generate-pwa-assets` (regenerates the PNG icons in `static/icons/` from `static/icons/favicon.svg`).

## Testing and CI

- `npm test`: Vitest unit tests for the pure logic in `tests/` (cost, toll matching, share links, Java checks, formatting, services with a mocked `fetch`).
- `npm run test:e2e`: Playwright end-to-end tests in `e2e/` against the production build. The first run needs a browser: `npx playwright install chromium`. The config builds the app and serves `build/` on port 4180 with `scripts/serve-build.mjs`.
  - OSM tiles, Nominatim and OSRM are mocked in `e2e/fixtures.ts`, so tests are fast, deterministic and never call the public servers. The OSRM mock rejects `exclude=toll` like the real demo server, and returns toll road names along the Surabaya–Malang corridor.
  - Covered: Surabaya → Pasuruan → Malang with five modes and toll suggestions, route drawn at the stop markers, instant total updates, rejection outside Java (search and map pins), keyboard search, save → reload → load, share link in a fresh context, corrupted links, routing/search errors with a single retry, 360 px width, theme without flash and system mode, the print view (≤ 2 A4 pages), and the PWA manifest, service worker and offline shell.
- `.github/workflows/ci.yml` runs on every push to `main` and on every pull request, in two jobs: **check + unit tests + build** (the `build/` folder is uploaded as an artifact), and **E2E** (the Playwright report is uploaded when it fails).

## Deploy (Vercel)

1. Push the repository to GitHub and import it in Vercel.
2. Framework preset: SvelteKit (auto-detected). Build command `npm run build`, output directory `build`.
3. No environment variables are needed.

The app has a single route, so no `vercel.json` rewrite is needed. If you add client routes that 404 on refresh, add `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.

## Decisions

- **SvelteKit 3 config lives in `vite.config.ts`.** SvelteKit 3 removed `svelte.config.js` and the `$lib` alias, so the adapter (`fallback: 'index.html'`) is configured in the `sveltekit()` Vite plugin, and imports use the `#lib/...` subpath import with explicit `.ts` extensions.
- **Service worker generated after the build.** `@vite-pwa/sveltekit` 1.1 (supports Kit 1–2) only writes the service worker during SvelteKit 2's separate SSR build, which Kit 3 no longer runs. The plugin still provides the web manifest and the `virtual:pwa-register` module, and `scripts/generate-sw.mjs` runs Workbox `generateSW` on `build/` (precache only, no runtime caching, so map tiles and APIs always hit the network). `.npmrc` sets `legacy-peer-deps=true` because of the plugin's peer range.
- **No-toll route on the demo server.** `router.project-osrm.org` answers `exclude=toll` with `InvalidValue: Exclude flag combination is not supported`. The app falls back to the default route, as the spec requires, and shows "No-toll route unavailable, showing default route". So on the demo server, "Car — no toll" and "Motorcycle" reuse the default road route.
- **Toll suggestions depend on OSRM's route.** For some trips (e.g. Surabaya → Malang) the demo server prefers the national road over the toll road, so no toll segments are suggested. Check the segments manually in that case.
- **Java check for search results** accepts the Indonesian province names from the spec, their English names (Nominatim localizes `address.state` to the browser language, e.g. "East Java") and the ISO 3166-2 codes `ID-BT/JK/JB/JT/YO/JI`.
- **Toll matching**: besides the ≥2-token rule, a one-word id (`jorr`) or a nickname in parentheses (`Cipali`, `Cipularang`, `Jagorawi`…) matches on its own. "Lingkar Luar Jakarta" is an alias for JORR, and "Yogyakarta" for "jogja". A match is dropped if another segment matched a strict superset of its words (so "JORR II Kunciran–Cengkareng" does not also suggest plain JORR).
- **Pinned points** fill the first empty stop; if all stops are filled, the pin is inserted before the destination.
- **Unfilled stop slots** are kept in memory with non-finite coordinates and are dropped when saving or sharing.
- **Train/bus** need ≥2 stops only for distance and time; the cost total works as soon as a ticket price is entered.
- **Print** hides all forms and buttons and shows a print-only header, the stop list, a comparison table and the selected breakdown, with a small map without controls.
- **Fuel cost** is rounded to the rupiah per vehicle, then multiplied by the vehicle count.

## Future ideas

- Stop-order optimization.
- Toll gate-to-gate tariffs instead of full-segment prices.
- Other toll vehicle classes (II–V).
- A self-hosted OSRM with the `toll` exclude class enabled.
