/** 2 for a round trip, 1 for one way. */
export function tripFactor(roundTrip: boolean): number {
	return roundTrip ? 2 : 1;
}

export function applyRoundTrip(value: number, roundTrip: boolean): number {
	return value * tripFactor(roundTrip);
}

/** One-way train/bus estimate: distance at an average speed plus a fixed buffer. */
export function transitDurationMin(distanceKm: number, speedKmh: number, bufferMin: number): number {
	if (!(distanceKm > 0) || !(speedKmh > 0)) return 0;
	return (distanceKm / speedKmh) * 60 + bufferMin;
}
