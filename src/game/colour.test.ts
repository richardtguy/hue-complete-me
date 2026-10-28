import { describe, expect, it } from 'vitest';
import {
  deltaE,
  isInGamut,
  maxChroma,
  mixOklab,
  oklabToOklch,
  oklabToSrgb,
  oklchToOklab,
  srgbToOklab,
  toCss,
  toGamut,
} from './colour.ts';
import { mulberry32 } from './random.ts';

describe('OKLab conversion', () => {
  it('matches reference values', () => {
    // Reference values from https://bottosson.github.io/posts/oklab/
    const white = srgbToOklab({ r: 1, g: 1, b: 1 });
    expect(white.L).toBeCloseTo(1, 4);
    expect(white.a).toBeCloseTo(0, 4);
    expect(white.b).toBeCloseTo(0, 4);

    const red = srgbToOklab({ r: 1, g: 0, b: 0 });
    expect(red.L).toBeCloseTo(0.628, 3);
    expect(red.a).toBeCloseTo(0.225, 3);
    expect(red.b).toBeCloseTo(0.126, 3);

    expect(srgbToOklab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 6);
  });

  it('round-trips sRGB -> OKLab -> sRGB', () => {
    // The published matrices are rounded, so the round trip is accurate to ~1e-6:
    // far below one 8-bit step (1/255).
    const rng = mulberry32(11);
    for (let i = 0; i < 500; i++) {
      const rgb = { r: rng(), g: rng(), b: rng() };
      const back = oklabToSrgb(srgbToOklab(rgb));
      expect(back.r).toBeCloseTo(rgb.r, 5);
      expect(back.g).toBeCloseTo(rgb.g, 5);
      expect(back.b).toBeCloseTo(rgb.b, 5);
    }
  });

  it('round-trips OKLab <-> OKLCH', () => {
    const lab = { L: 0.6, a: -0.08, b: 0.11 };
    const lch = oklabToOklch(lab);
    expect(lch.h).toBeGreaterThanOrEqual(0);
    expect(lch.h).toBeLessThan(360);
    const back = oklchToOklab(lch);
    expect(back.a).toBeCloseTo(lab.a, 10);
    expect(back.b).toBeCloseTo(lab.b, 10);
  });
});

describe('mixOklab / deltaE', () => {
  it('interpolates linearly', () => {
    const a = { L: 0.2, a: -0.1, b: 0.1 };
    const b = { L: 0.8, a: 0.1, b: -0.1 };
    expect(mixOklab(a, b, 0)).toEqual(a);
    expect(mixOklab(a, b, 1)).toEqual(b);
    const mid = mixOklab(a, b, 0.5);
    expect(mid.L).toBeCloseTo(0.5);
    expect(deltaE(a, mid)).toBeCloseTo(deltaE(mid, b));
  });
});

describe('gamut mapping', () => {
  it('leaves in-gamut colours unchanged', () => {
    const lab = srgbToOklab({ r: 0.4, g: 0.5, b: 0.6 });
    expect(toGamut(lab)).toEqual(lab);
  });

  it('reduces chroma at constant lightness and hue', () => {
    const vivid = oklchToOklab({ L: 0.7, C: 0.4, h: 150 });
    expect(isInGamut(vivid)).toBe(false);
    const mapped = toGamut(vivid);
    expect(isInGamut(mapped)).toBe(true);
    const lch = oklabToOklch(mapped);
    expect(lch.L).toBeCloseTo(0.7, 10);
    expect(lch.h).toBeCloseTo(150, 6);
    expect(lch.C).toBeLessThan(0.4);
    expect(lch.C).toBeGreaterThan(0.05);
  });

  it('clamps lightness outside [0, 1]', () => {
    expect(toGamut({ L: 1.3, a: 0, b: 0 }).L).toBe(1);
    expect(toGamut({ L: -0.2, a: 0.05, b: 0 }).L).toBe(0);
  });

  it('finds the gamut boundary with maxChroma', () => {
    const C = maxChroma(0.6, 30);
    expect(isInGamut(oklchToOklab({ L: 0.6, C, h: 30 }))).toBe(true);
    expect(isInGamut(oklchToOklab({ L: 0.6, C: C + 0.005, h: 30 }))).toBe(false);
  });
});

describe('toCss', () => {
  it('formats hex colours', () => {
    expect(toCss(srgbToOklab({ r: 1, g: 1, b: 1 }))).toBe('#ffffff');
    expect(toCss(srgbToOklab({ r: 0, g: 0, b: 0 }))).toBe('#000000');
    expect(toCss(srgbToOklab({ r: 1, g: 0, b: 0 }))).toBe('#ff0000');
    expect(toCss(srgbToOklab({ r: 0x3a / 255, g: 0x7b / 255, b: 0xd5 / 255 }))).toBe('#3a7bd5');
  });
});
