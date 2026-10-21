# Build Spec: **Lajur** — Java Trip Cost Planner

> Instructions for an AI coding agent. Build the complete app described below in **one phase**, from empty folder to a deployable, working product. Follow every section. When something is ambiguous, choose the simplest option that satisfies the acceptance criteria and note the decision in `README.md` under "Decisions".

---

## 1. Product summary

Lajur is a client-only web app for planning road trips **within Java, Indonesia**. The user adds a start point, optional intermediate stops, and a destination. The app draws the route on a map and estimates the **total cost and travel time** for five travel modes, side by side:

| Mode | Route source | Main cost |
|---|---|---|
| Car — via toll | OSRM (default routing) | fuel + toll |
| Car — no toll | OSRM with `exclude=toll` | fuel |
| Motorcycle (never uses toll) | OSRM with `exclude=toll` | fuel |
| Train | road distance as reference | ticket × passengers |
| Bus | road distance as reference | ticket × passengers |

Hard constraints:
- **No backend, no login, no API keys, no paid services.**
- Must deploy to **Vercel** from GitHub as a static site.
- UI language: **English**. Place names stay as returned by OpenStreetMap.
- Currency: IDR, formatted with `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.

---

## 2. Tech stack (use exactly this)

- **SvelteKit** (latest) + **Svelte 5 runes** + **TypeScript** (strict)
- **@sveltejs/adapter-static** with `fallback: 'index.html'` (SPA mode)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Leaflet** for the map (OpenStreetMap raster tiles)
- **lz-string** for compressing trip state into share URLs
- **@vite-pwa/sveltekit** for installable PWA + offline app shell
- **Vitest** for unit tests of pure logic
- No other UI library. No state library (use runes in `.svelte.ts` files; see Section 13).

Root layout config (`src/routes/+layout.ts`):
```ts
export const ssr = false;      // Leaflet needs window; SPA shell comes from adapter fallback
```
Do **not** set `prerender = true`. Read `?t=` only on the client (in the page component after mount), never in a `load` function.

---

## 3. External services (free, public, no key)

| Purpose | Endpoint | Rules to follow |
|---|---|---|
| Map tiles | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Show attribution "© OpenStreetMap contributors". |
| Geocoding | `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=id&addressdetails=1&viewbox=105.0,-5.8,114.7,-8.95&bounded=1&limit=5&q=…` | Max **1 request/second**: debounce input 600 ms **and** enforce a global 1 s throttle. Min 3 characters. Cache results in memory by query. |
| Routing | `https://router.project-osrm.org/route/v1/driving/{lon,lat;lon,lat;…}?overview=full&geometries=geojson&steps=true` | Add `&exclude=toll` for no-toll routes. Demo server: handle failures gracefully, never retry in a loop (max 1 retry after 2 s). |

- **Java validation** (the bounding box alone also covers south Lampung, e.g. Bakauheni, and west Bali, e.g. Gilimanuk):
  - Search results: keep only results whose `address.state` is one of: `Banten`, `Daerah Khusus Ibukota Jakarta` / `DKI Jakarta` / `Jakarta`, `Jawa Barat`, `Jawa Tengah`, `Daerah Istimewa Yogyakarta` / `DI Yogyakarta`, `Jawa Timur` (match case-insensitively; also accept a "Daerah Khusus Jakarta" variant).
  - Pinned map points (no address): check the bounding box (lon 105.0–114.7, lat −8.95 to −5.8) and additionally reject lon < 106.0 with lat > −6.0 (Lampung tip) and lon > 114.42 (Bali side). Show a clear message on rejection.
- **OSRM coordinates**: GeoJSON geometry is `[lon, lat]`. Flip every pair to `[lat, lon]` before storing in `RouteResult.geometry` and before passing to Leaflet. Request URLs use `lon,lat` order.
- **No-toll fallback**: if the `exclude=toll` request fails or returns an error, fall back to the normal route and show the badge "No-toll route unavailable, showing default route". If it succeeds but its steps still contain road names with "Tol" (`tollStepNames.length > 0`), keep it but show the badge "Route may still use toll roads".
- Show an "About data" panel crediting OSM, Nominatim, OSRM, and the toll data sources from `meta.sumber`.

---

## 4. Static data

### 4.1 Toll tariffs — `src/lib/data/tarif_tol_jawa.json`
The file is **provided by the user** and is placed in the project root before you start. Move it to `src/lib/data/` unchanged. Do not rename its Indonesian keys. **If the file is not found, stop and ask the user for it. Do not create dummy toll data.** Schema:

```ts
interface TollData {
  meta: {
    wilayah: string; mata_uang: string; acuan_data: string;
    sumber: string[]; jenis_tarif: string; catatan: string; golongan: string;
  };
  ruas: TollSegment[];
}
interface TollSegment {
  id: string;            // e.g. "cikopo-palimanan"
  nama: string;          // display name
  provinsi: string;
  tarif: number;         // IDR, Class I, end-to-end for the whole segment
  perlu_verifikasi: boolean;
}
```

Rules:
- Tariffs are **end-to-end per segment, Class I only**. Show a permanent note: "Toll prices are full-segment Class I tariffs (data: {meta.acuan_data}). Partial use may cost less."
- Segments with `perlu_verifikasi: true` show a small "unverified" badge.
- Every selected segment's price is **editable** by the user (override stored in trip state).
- Also provide a free "Other toll cost" number input for segments not in the list.

### 4.2 Toll auto-suggestion
OSRM `steps` contain road names. For the via-toll route:
1. Collect unique step `name` values containing "Tol" (case-insensitive).
2. Match them to segments by comparing normalized tokens (lowercase, remove "jalan", "tol", punctuation, en/em dashes) against tokens from `nama` and `id`. A segment matches if ≥2 of its place tokens appear (or 1 if the segment has only 1 distinctive token, e.g. "jorr").
3. Pre-check matched segments and label the list "Suggested from route, please confirm".
4. The user can always check/uncheck any segment manually (searchable list grouped by `provinsi`).

### 4.3 Fuel prices — `src/lib/data/fuel.json`
```json
{
  "updated": "October 2026 (Pertamina prices effective since 2 Sep 2026)",
  "note": "Reference prices for regions with 5% PBBKB (e.g. DKI Jakarta). Other regions may differ slightly. User can edit.",
  "fuels": [
    { "id": "pertalite",       "name": "Pertalite (RON 90)",       "price": 10000 },
    { "id": "pertamax",        "name": "Pertamax (RON 92)",        "price": 15950 },
    { "id": "pertamax-green",  "name": "Pertamax Green (RON 95)",  "price": 19150 },
    { "id": "pertamax-turbo",  "name": "Pertamax Turbo (RON 98)",  "price": 19600 },
    { "id": "biosolar",        "name": "Biosolar",                 "price": 6800 },
    { "id": "dexlite",         "name": "Dexlite",                  "price": 23700 },
    { "id": "pertamina-dex",   "name": "Pertamina Dex",            "price": 25200 }
  ]
}
```
The price field in the UI is always editable; the edited value is saved with the trip.

### 4.4 Defaults — `src/lib/data/defaults.ts`
| Setting | Default |
|---|---|
| Car type preset | MPV 1.5L → 12 km/L, fuel Pertalite |
| Motorcycle consumption | 40 km/L, fuel Pertalite |
| Passengers | 2 (min 1, max 50) |
| Car capacity | 7 per car → cars needed = ceil(passengers / 7); fuel and toll × cars; show info "Needs N cars" when N > 1 |
| Motorcycle capacity | 2 per motorcycle → motorcycles needed = ceil(passengers / 2); fuel cost × motorcycles |
| Train avg speed | 70 km/h + 30 min buffer |
| Bus avg speed | 45 km/h + 30 min buffer |
| Max stops | 10 (including start and destination) |

Car type presets (selecting one fills km/L; the value stays editable and switches the preset to "Custom" when edited):

| Preset | km/L |
|---|---|
| City car / LCGC | 15 |
| MPV 1.5L (default) | 12 |
| SUV 2.0L+ | 9 |
| Custom | user value |

---

## 5. Features (MVP — all required)

1. **Stops editor**: start, destination, up to 8 intermediate stops. Search with autocomplete (Nominatim), or tap the map to drop a point (reverse geocode not required; label it "Pinned point lat, lon" and allow renaming). Reorder with ↑/↓ buttons. Remove stop.
2. **Routing**: fetch the via-toll route and the no-toll route once stops change (debounced 800 ms, only when ≥2 valid stops). Motorcycle reuses the no-toll route. Train and bus use the via-toll route distance as reference distance.
3. **Map**: show both road routes as polylines (via-toll solid, no-toll dashed), numbered markers, fit bounds on change. Highlight the polyline of the currently selected mode.
4. **Mode comparison**: a card per mode showing distance, duration, total cost, cost per person. Mark the cheapest and the fastest. Selecting a card opens its detailed breakdown.
5. **Cost breakdown per mode**:
   - Car via toll: (fuel + selected toll segments with overrides + other toll) × cars + shared extras.
   - Car no toll: fuel × cars + shared extras.
   - Motorcycle: fuel × motorcycles + shared extras.
   - Train / Bus: ticket price per person (manual input, default empty → show "Enter ticket price") × passengers + "local transport to/from station" (manual, total) + shared extras.
6. **Shared extras** (apply to all modes): parking, food, lodging, other. Each is a total amount.
7. **Round trip toggle**: doubles distance, duration, fuel, toll, tickets, and local transport to/from station. Shared extras (parking, food, lodging, other) are **not** doubled.
8. **Split per person**: total ÷ passengers, rounded up to the nearest Rp 500.
9. **Save trips**: save/load/rename/delete named trips in `localStorage` (key `lajur:v1:trips`). Handle quota and parse errors without crashing.
10. **Share via URL**: serialize trip state → JSON → `LZString.compressToEncodedURIComponent` → `?t=`. On load, if `?t=` exists, restore the trip and show a "Shared trip loaded" toast. Copy-link button uses the Clipboard API with a fallback.
11. **Export**: "Print / Save as PDF" button using `window.print()` with a dedicated print stylesheet (hide map controls and buttons, show stops, comparison table, and the selected breakdown).
12. **Dark mode**: light / dark / system toggle, persisted in `localStorage` (`lajur:v1:theme`). Apply the class before first paint (inline script in `app.html`) to avoid flashing. Darken map tiles with a CSS filter on `.leaflet-tile-pane` in dark mode.
13. **PWA**: installable, offline app shell. When offline, show a banner: "You're offline. Saved trips work; search and routing need internet." Map tiles are not cached.

Out of scope for this phase: stop-order optimization, real train/bus schedules or fares, accounts, sync, toll vehicle classes other than Class I.

---

## 6. Folder structure

```
lajur/
├─ src/
│  ├─ app.html                 # theme init script, meta viewport, theme-color
│  ├─ app.css                  # Tailwind import, dark variant, print styles, leaflet css import
│  ├─ app.d.ts
│  ├─ lib/
│  │  ├─ data/
│  │  │  ├─ tarif_tol_jawa.json
│  │  │  ├─ fuel.json
│  │  │  └─ defaults.ts
│  │  ├─ types.ts              # Stop, TravelMode, RouteResult, TripState, CostBreakdown…
│  │  ├─ services/
│  │  │  ├─ geocode.ts         # Nominatim + throttle + cache
│  │  │  ├─ routing.ts         # OSRM, exclude=toll, fallback, retry once
│  │  │  └─ throttle.ts
│  │  ├─ logic/
│  │  │  ├─ cost.ts            # pure cost functions per mode
│  │  │  ├─ duration.ts        # train/bus estimates, round trip
│  │  │  ├─ toll-match.ts      # step names → suggested segments
│  │  │  ├─ geo.ts             # Java validation (province + bbox), coord flip, km/time format
│  │  │  ├─ share.ts           # encode/decode ?t= with validation
│  │  │  └─ format.ts          # IDR, rounding to Rp 500
│  │  ├─ stores/
│  │  │  ├─ trip.svelte.ts     # main trip state (runes) + derived results
│  │  │  ├─ saved.svelte.ts    # localStorage trips
│  │  │  └─ theme.svelte.ts
│  │  └─ components/
│  │     ├─ MapView.svelte
│  │     ├─ StopList.svelte
│  │     ├─ StopSearch.svelte
│  │     ├─ ModeCards.svelte
│  │     ├─ CostBreakdown.svelte
│  │     ├─ TollPicker.svelte
│  │     ├─ VehicleSettings.svelte
│  │     ├─ ExtrasForm.svelte
│  │     ├─ SavedTrips.svelte
│  │     ├─ ShareButton.svelte
│  │     ├─ ThemeToggle.svelte
│  │     ├─ OfflineBanner.svelte
│  │     ├─ Toast.svelte
│  │     └─ AboutData.svelte
│  └─ routes/
│     ├─ +layout.ts            # ssr=false only
│     ├─ +layout.svelte        # header, theme, offline banner, toasts
│     └─ +page.svelte          # main planner
├─ static/
│  ├─ icons/                   # PNGs generated from favicon.svg (see Section 13)
│  └─ favicon.svg
├─ tests/
│  ├─ cost.test.ts
│  ├─ toll-match.test.ts
│  ├─ share.test.ts
│  └─ geo.test.ts
├─ svelte.config.js            # adapter-static, fallback: 'index.html'
├─ vite.config.ts              # tailwind, sveltekit, pwa plugins
├─ tsconfig.json
├─ package.json
└─ README.md
```

---

## 7. Core types (starting point)

```ts
export type TravelMode = 'car_toll' | 'car_notoll' | 'motorcycle' | 'train' | 'bus';

export interface Stop { id: string; name: string; lat: number; lon: number; }

export interface RouteResult {
  distanceKm: number; durationMin: number;
  geometry: [number, number][];   // [lat, lon]
  tollStepNames: string[];
  fallbackUsed?: boolean;
}

export interface TripState {
  version: 1;
  name: string;
  stops: Stop[];
  passengers: number;
  roundTrip: boolean;
  car: { preset: 'city' | 'mpv' | 'suv' | 'custom'; kmPerLiter: number; fuelId: string; fuelPrice: number };
  motorcycle: { kmPerLiter: number; fuelId: string; fuelPrice: number };
  toll: { selectedIds: string[]; overrides: Record<string, number>; other: number };
  transit: { trainTicket: number | null; busTicket: number | null; localTransport: number };
  extras: { parking: number; food: number; lodging: number; other: number };
  selectedMode: TravelMode;
}
```
Route results are **not** stored in saved/shared state; recompute them on load.

---

## 8. Layout & UX

- **Mobile first** (design at 360–430 px width, then scale up).
  - Mobile: map on top (~40 vh, sticky), content below in a scrollable panel. Mode cards in a horizontally scrollable row.
  - Desktop (≥1024 px): left panel 420 px with all forms, map fills the right side.
- Touch targets ≥ 44 px. Money/number inputs use `<input type="text" inputmode="numeric">` (never `type="number"`), display values formatted as "50.000", and parse by stripping non-digits. Decimal fields (km/L) use `inputmode="decimal"` and accept both `,` and `.` as decimal separator.
- Show loading skeletons during routing; show inline errors per section, never `alert()`.
- Accessibility: labeled inputs, visible focus rings, keyboard-usable autocomplete (↑/↓/Enter/Esc), color contrast AA in both themes.
- Tailwind v4 dark mode via class:
  ```css
  @import 'tailwindcss';
  @custom-variant dark (&:where(.dark, .dark *));
  ```
- Fix Leaflet's default marker icons under Vite (import the PNGs and set `L.Icon.Default.mergeOptions`), or use custom numbered `divIcon` markers (preferred).
- Destroy the Leaflet map in the component's cleanup to avoid leaks.

---

## 9. Tests (Vitest, must pass)

- `cost.ts`: each mode with and without round trip; car count (e.g. 8 passengers → 2 cars) and motorcycle count rounding; car preset → km/L; per-person rounding to Rp 500; toll overrides and "other toll".
- `toll-match.ts`: e.g. step name "Jalan Tol Cikopo–Palimanan" → `cikopo-palimanan`; "Jalan Tol Lingkar Luar Jakarta" or "JORR" → `jorr`; unrelated names → no match.
- `share.ts`: encode → decode round trip equals input; corrupted or wrong-version input returns `null` without throwing.
- `geo.ts`: Surabaya, Jakarta, Yogyakarta accepted; Denpasar (115.21), Bakauheni (105.75, −5.87), and Gilimanuk (114.43, −8.17) rejected; province names accepted/rejected; `[lon, lat]` → `[lat, lon]` flip.
- `format.ts`: parsing "50.000" → 50000, "12,5" → 12.5, empty → 0 or null as specified.

---

## 10. Deployment (Vercel)

- `npm run build` outputs to `build/`. Vercel auto-detects SvelteKit; if not, set Output Directory to `build`.
- No environment variables needed.
- Add `vercel.json` only if client routes 404 on refresh:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

---

## 11. README.md (generate it)

Include: one-line pitch, screenshot placeholders (mobile + desktop, light + dark), features, tech stack, data sources and disclaimers (tolls are Class I end-to-end, fuel prices placeholder/editable, train/bus prices manual, OSRM demo server not for production), local setup (`npm install`, `npm run dev`, `npm test`), deploy steps, "Decisions" section, and "Future ideas" (stop-order optimization, toll gate-to-gate tariffs, other vehicle classes).

---

## 12. Acceptance criteria (definition of done)

- [ ] `npm run check`, `npm run build`, and `npm test` pass with zero errors.
- [ ] Surabaya → Malang with one stop in Pasuruan shows routes, all five mode cards, and toll suggestions that include Surabaya–Gempol / Gempol–Pandaan / Pandaan–Malang segments where the route uses them.
- [ ] Changing passengers, fuel price, consumption, tolls, extras, or round trip updates totals instantly.
- [ ] Points outside Java (e.g. Denpasar, Bakauheni, Gilimanuk) are rejected with a clear message.
- [ ] Route polylines are drawn on land along the roads (coordinates correctly flipped).
- [ ] Save → reload page → trip appears in saved list and loads correctly.
- [ ] Share link opened in a private window restores the same trip.
- [ ] Print view shows a clean one-page-ish summary without controls.
- [ ] Dark mode works with no flash on reload; system mode follows OS setting.
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] PWA: valid manifest and service worker; Chrome shows the install option; app shell opens offline.
- [ ] Works at 360 px width without horizontal scrolling.
- [ ] OSRM/Nominatim failures show friendly errors; the app never crashes or spams requests.

---

## 13. Implementation guardrails (critical)

- **Svelte 5 runes only.** Do NOT use `svelte/store`, `writable`, or `$store` syntax. In `.svelte.ts` files, never export a `$state` variable that gets reassigned; wrap state in a class or an exported object and mutate its properties, or expose getter/setter functions. Use `$derived` for computed values and `$effect` only for side effects (map updates, localStorage writes).
- **SPA config.** `+layout.ts` sets only `ssr = false`. No `prerender = true`. Query params are read on the client only.
- **OSRM coordinates.** Responses are `[lon, lat]`; always flip to `[lat, lon]` for `RouteResult.geometry` and Leaflet. Add a unit test for this.
- **Numeric inputs.** `type="text" inputmode="numeric"`, strip non-digits, format with thousand separators on blur. Never `type="number"` for money.
- **PWA icons.** Create `static/favicon.svg` first (simple original road/lane mark). Generate PNG icons (64, 192, 512, maskable 512, apple-touch 180) with `@vite-pwa/assets-generator` as a dev dependency and an npm script `generate-pwa-assets`; commit the generated files. The build must not depend on missing icon files.
- **Toll data.** Use only the user's `tarif_tol_jawa.json`. If it's missing, stop and ask. No dummy data.
- **External APIs.** Never call Nominatim or OSRM in tests; mock `fetch`. Respect the throttles in Section 3.
- **Leaflet lifecycle.** Create the map in `onMount`, remove it on destroy, and call `map.invalidateSize()` after layout changes (panel resize, theme switch on mobile).
