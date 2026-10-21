import { describe, expect, it } from 'vitest';
import tollData from '../src/lib/data/tarif_tol_jawa.json';
import {
	collectTollNames,
	normalizeTokens,
	suggestTollSegments
} from '../src/lib/logic/toll-match';

const segments = tollData.ruas;

describe('normalizeTokens', () => {
	it('drops "jalan", "tol", punctuation and dashes', () => {
		expect(normalizeTokens('Jalan Tol Cikopo–Palimanan')).toEqual(['cikopo', 'palimanan']);
		expect(normalizeTokens('Jl. Tol Surabaya—Gempol')).toEqual(['surabaya', 'gempol']);
	});
});

describe('suggestTollSegments', () => {
	it('matches "Jalan Tol Cikopo–Palimanan" to cikopo-palimanan only', () => {
		expect(suggestTollSegments(['Jalan Tol Cikopo–Palimanan'], segments)).toEqual([
			'cikopo-palimanan'
		]);
	});
	it('matches JORR by its Indonesian name or abbreviation', () => {
		expect(suggestTollSegments(['Jalan Tol Lingkar Luar Jakarta'], segments)).toEqual(['jorr']);
		expect(suggestTollSegments(['JORR'], segments)).toEqual(['jorr']);
	});
	it('does not suggest plain JORR for a JORR II segment', () => {
		expect(suggestTollSegments(['Jalan Tol JORR II Kunciran–Cengkareng'], segments)).toEqual([
			'kunciran-cengkareng'
		]);
	});
	it('matches nicknames like Cipularang', () => {
		expect(suggestTollSegments(['Jalan Tol Cipularang'], segments)).toEqual([
			'cikampek-padalarang'
		]);
	});
	it('matches the Surabaya → Malang corridor', () => {
		const names = [
			'Jalan Tol Surabaya-Gempol',
			'Jalan Tol Gempol-Pasuruan',
			'Jalan Tol Gempol-Pandaan',
			'Jalan Tol Pandaan-Malang',
			'Jalan Raya Porong'
		];
		const ids = suggestTollSegments(names, segments);
		expect(ids).toEqual(
			expect.arrayContaining([
				'dupak-waru',
				'waru-porong',
				'porong-gempol',
				'gempol-pandaan',
				'pandaan-malang',
				'gempol-pasuruan'
			])
		);
		expect(ids).not.toContain('pasuruan-probolinggo');
		expect(ids).not.toContain('surabaya-mojokerto');
	});
	it('handles Yogyakarta → jogja alias', () => {
		expect(suggestTollSegments(['Jalan Tol Solo–Yogyakarta'], segments)).toEqual(['jogja-solo']);
	});
	it('ignores unrelated names', () => {
		expect(suggestTollSegments(['Jalan Malioboro', 'Jalan Raya Bogor'], segments)).toEqual([]);
		expect(suggestTollSegments(['Jalan Tol Antah Berantah'], segments)).toEqual([]);
		expect(suggestTollSegments([], segments)).toEqual([]);
	});
});

describe('collectTollNames', () => {
	it('keeps unique toll road names', () => {
		expect(
			collectTollNames(['Jalan Tol A–B', '', 'Jalan Sudirman', 'Jalan Tol A–B', 'Tolong'])
		).toEqual(['Jalan Tol A–B']);
	});
});
