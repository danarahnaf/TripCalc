import type { TollSegment } from '../types';

/** Words that say nothing about which segment a road is. */
const GENERIC = new Set([
	'jalan',
	'jl',
	'tol',
	'toll',
	'seksi',
	'gt',
	'termasuk',
	'dalam',
	'kota',
	'outer',
	'ring',
	'road',
	'lingkar',
	'luar',
	'i',
	'ii',
	'iii',
	'dan',
	'ruas',
	'raya',
	'bebas',
	'hambatan',
	'barat',
	'timur',
	'utara',
	'selatan'
]);

/** Multi-word names rewritten to one canonical token before splitting. */
const PHRASE_ALIASES: [string, string][] = [
	['jakarta outer ring road', 'jorr'],
	['lingkar luar jakarta', 'jorr']
];

const TOKEN_ALIASES: Record<string, string> = {
	yogyakarta: 'jogja',
	yogya: 'jogja',
	jogjakarta: 'jogja',
	surakarta: 'solo'
};

export function normalizeTokens(text: string): string[] {
	let s = text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[‐-―\-_:;/,.()'"&+]/g, ' ')
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	for (const [phrase, token] of PHRASE_ALIASES) {
		s = ` ${s} `.replaceAll(` ${phrase} `, ` ${token} `).trim();
	}
	return s
		.split(' ')
		.filter(Boolean)
		.map((t) => TOKEN_ALIASES[t] ?? t)
		.filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t));
}

interface IndexedSegment {
	id: string;
	tokens: Set<string>;
	/** Tokens that identify the segment on their own (a one-word id like "jorr", or a nickname like "Cipali"). */
	strong: Set<string>;
}

export function buildSegmentIndex(segments: TollSegment[]): IndexedSegment[] {
	return segments.map((seg) => {
		const idTokens = normalizeTokens(seg.id.replace(/-/g, ' '));
		const tokens = new Set([...normalizeTokens(seg.nama), ...idTokens]);
		const strong = new Set<string>();
		if (idTokens.length === 1) strong.add(idTokens[0]);
		for (const m of seg.nama.matchAll(/\(([^)]*)\)/g)) {
			for (const t of normalizeTokens(m[1])) strong.add(t);
		}
		return { id: seg.id, tokens, strong };
	});
}

/** Segment ids that one road name refers to. */
export function matchRoadName(name: string, index: IndexedSegment[]): string[] {
	const words = new Set(normalizeTokens(name));
	if (words.size === 0) return [];
	const hits: { id: string; matched: Set<string> }[] = [];
	for (const seg of index) {
		const matched = new Set([...seg.tokens].filter((t) => words.has(t)));
		const need = seg.tokens.size <= 1 ? 1 : 2;
		if (matched.size >= need || [...matched].some((t) => seg.strong.has(t))) {
			hits.push({ id: seg.id, matched });
		}
	}
	// Drop a hit whose matched words are a strict subset of another hit's,
	// e.g. "JORR II Kunciran–Cengkareng" should not also suggest plain JORR.
	return hits
		.filter(
			(h) =>
				!hits.some(
					(o) => o !== h && o.matched.size > h.matched.size && [...h.matched].every((t) => o.matched.has(t))
				)
		)
		.map((h) => h.id);
}

export function isTollRoadName(name: string): boolean {
	return /\b(tol|toll|jorr)\b/i.test(name);
}

/** Unique road names from OSRM steps that look like toll roads. */
export function collectTollNames(names: string[]): string[] {
	const out = new Set<string>();
	for (const n of names) {
		const t = n?.trim();
		if (t && isTollRoadName(t)) out.add(t);
	}
	return [...out];
}

/** Suggested segment ids for a list of road names, in data order. */
export function suggestTollSegments(names: string[], segments: TollSegment[]): string[] {
	const index = buildSegmentIndex(segments);
	const found = new Set<string>();
	for (const name of collectTollNames(names)) {
		for (const id of matchRoadName(name, index)) found.add(id);
	}
	return segments.filter((s) => found.has(s.id)).map((s) => s.id);
}
