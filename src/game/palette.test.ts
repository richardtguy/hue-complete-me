import { describe, expect, it } from 'vitest';
import { deltaE, isInGamut, oklabToOklch } from './colour.ts';
import {
  MIN_NEIGHBOUR_DELTA_E,
  generatePalette,
  minNeighbourDeltaE,
  randomCorners,
  tileColours,
} from './palette.ts';
import { CORNERS, SIZE } from './puzzle.ts';
import { mulberry32 } from './random.ts';

describe('tileColours', () => {
  const corners = randomCorners(mulberry32(1));
  const colours = tileColours(corners);

  it('produces one in-gamut colour per position', () => {
    expect(colours).toHaveLength(SIZE);
    for (const c of colours) expect(isInGamut(c)).toBe(true);
  });

  it('puts the corner colours in the corners', () => {
    CORNERS.forEach((pos, i) => {
      expect(deltaE(colours[pos]!, corners[i]!)).toBeLessThan(1e-9);
    });
  });

  it('blends evenly along the top edge', () => {
    const steps = [0, 1, 2, 3].map((c) => deltaE(colours[c]!, colours[c + 1]!));
    for (const s of steps) expect(s).toBeCloseTo(steps[0]!, 2);
  });
});

describe('randomCorners', () => {
  it('makes in-gamut corners with one light and one dark diagonal', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [tl, tr, bl, br] = randomCorners(mulberry32(seed));
      for (const c of [tl, tr, bl, br]) expect(isInGamut(c)).toBe(true);
      const diag1 = [tl.L, br.L];
      const diag2 = [tr.L, bl.L];
      const [light, dark] = tl.L > tr.L ? [diag1, diag2] : [diag2, diag1];
      expect(Math.min(...light)).toBeGreaterThan(Math.max(...dark));
    }
  });

  it('spreads hues roughly 90° apart', () => {
    const hues = randomCorners(mulberry32(3))
      .map((c) => oklabToOklch(c).h)
      .sort((a, b) => a - b);
    const gaps = hues.map((h, i) => (hues[(i + 1) % 4]! - h + 360) % 360 || 360);
    for (const g of gaps) {
      expect(g).toBeGreaterThan(90 - 40);
      expect(g).toBeLessThan(90 + 40);
    }
  });
});

describe('generatePalette', () => {
  it('always yields distinguishable neighbours', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { colours } = generatePalette(mulberry32(seed));
      expect(minNeighbourDeltaE(colours)).toBeGreaterThanOrEqual(MIN_NEIGHBOUR_DELTA_E);
    }
  });

  it('returns colours matching its corners', () => {
    const { corners, colours } = generatePalette(mulberry32(8));
    expect(colours).toEqual(tileColours(corners));
  });
});

describe('minNeighbourDeltaE', () => {
  it('is zero for a flat colour', () => {
    const flat = Array.from({ length: SIZE }, () => ({ L: 0.5, a: 0, b: 0 }));
    expect(minNeighbourDeltaE(flat)).toBe(0);
  });
});
