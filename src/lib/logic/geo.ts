export const JAVA_BBOX = { minLon: 105.0, maxLon: 114.7, minLat: -8.95, maxLat: -5.8 } as const;

const JAVA_PROVINCES = new Set([
	'banten',
	'daerah khusus ibukota jakarta',
	'daerah khusus jakarta',
	'dki jakarta',
	'jakarta',
	'jawa barat',
	'jawa tengah',
	'daerah istimewa yogyakarta',
	'di yogyakarta',
	'jawa timur',
	// Nominatim localizes names to the browser language, so accept the English forms too.
	'west java',
	'central java',
	'east java',
	'special region of yogyakarta',
	'jakarta special capital region',
	'special capital region of jakarta'
]);

/** ISO 3166-2 codes of Java's provinces; Nominatim returns these regardless of language. */
const JAVA_ISO_CODES = new Set(['ID-BT', 'ID-JK', 'ID-JB', 'ID-JT', 'ID-YO', 'ID-JI']);

/** True when a Nominatim `address.state` value is a province on Java. */
export function isJavaProvince(state: string | null | undefined): boolean {
	if (!state) return false;
	return JAVA_PROVINCES.has(state.trim().toLowerCase().replace(/\s+/g, ' '));
}

/** True when a Nominatim `address` object is in a Java province (by name or ISO code). */
export function isJavaAddress(address: Record<string, string> | null | undefined): boolean {
	if (!address) return false;
	const iso = address['ISO3166-2-lvl4'];
	return isJavaProvince(address.state) || (!!iso && JAVA_ISO_CODES.has(iso.toUpperCase()));
}

/**
 * Message explaining why a pinned point is outside Java, or null when it is accepted.
 * The bounding box alone also covers south Lampung and west Bali, so both are cut out.
 */
export function javaPointError(lat: number, lon: number): string | null {
	const outside = 'That point is outside Java. TripCalc only plans trips within Java.';
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'That point has invalid coordinates.';
	const { minLon, maxLon, minLat, maxLat } = JAVA_BBOX;
	if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return outside;
	if (lon < 106.0 && lat > -6.0) return 'That point is in Lampung (Sumatra), not Java.';
	if (lon > 114.42) return 'That point is on the Bali side of the strait, not Java.';
	return null;
}

export function isPointInJava(lat: number, lon: number): boolean {
	return javaPointError(lat, lon) === null;
}

/** OSRM/GeoJSON `[lon, lat]` → Leaflet `[lat, lon]`. */
export function flipCoords(coords: [number, number][]): [number, number][] {
	return coords.map(([lon, lat]) => [lat, lon]);
}

/** Great-circle distance in meters. */
export function distanceMeters(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number }
): number {
	const rad = Math.PI / 180;
	const h =
		Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
		Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
	return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** True when two points are close enough to count as the same place (default 300 m). */
export function isSamePlace(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number },
	maxMeters = 300
): boolean {
	return distanceMeters(a, b) <= maxMeters;
}

export function formatKm(km: number): string {
	const digits = km < 10 ? 1 : 0;
	return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(km)} km`;
}

export function formatDuration(minutes: number): string {
	const total = Math.max(0, Math.round(minutes));
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatLatLon(lat: number, lon: number): string {
	return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
