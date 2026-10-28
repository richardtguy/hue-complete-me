import { describe, expect, it } from 'vitest';
import { mulberry32, randInt, randRange, shuffle } from './random.ts';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, a);
    expect(Array.from({ length: 10 }, b)).toEqual(seqA);
    expect(Array.from({ length: 10 }, mulberry32(43))).not.toEqual(seqA);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('randRange / randInt', () => {
  it('stays within bounds', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const x = randRange(rng, -2, 3);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(3);
      const n = randInt(rng, 4);
      expect(Number.isInteger(n) && n >= 0 && n < 4).toBe(true);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(mulberry32(3), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
  });
});
