import { deltaE, maxChroma, mixOklab, type Oklab, oklchToOklab, toGamut } from './colour.ts';
import { N, SIZE, rowCol } from './puzzle.ts';
import { type Rng, randInt, randRange } from './random.ts';

/** Corner colours: top-left, top-right, bottom-left, bottom-right. */
export type Corners = readonly [Oklab, Oklab, Oklab, Oklab];

/** Smallest colour difference allowed between adjacent tiles in a solved board. */
export const MIN_NEIGHBOUR_DELTA_E = 0.03;

const MAX_ATTEMPTS = 50;
const HUE_JITTER = 20;
const LIGHT_L: readonly [number, number] = [0.75, 0.88];
const DARK_L: readonly [number, number] = [0.45, 0.6];
const CHROMA_RANGE: readonly [number, number] = [0.1, 0.18];

/** The solved colour of every position, blended bilinearly in OKLab and mapped into sRGB. */
export function tileColours(corners: Corners): Oklab[] {
  const [tl, tr, bl, br] = corners;
  return Array.from({ length: SIZE }, (_, pos) => {
    const { row, col } = rowCol(pos);
    const u = col / (N - 1);
    const v = row / (N - 1);
    return toGamut(mixOklab(mixOklab(tl, tr, u), mixOklab(bl, br, u), v));
  });
}

/** The smallest difference between any two horizontally or vertically adjacent tiles. */
export function minNeighbourDeltaE(colours: readonly Oklab[]): number {
  let min = Infinity;
  colours.forEach((colour, pos) => {
    const { row, col } = rowCol(pos);
    if (col < N - 1) min = Math.min(min, deltaE(colour, colours[pos + 1]!));
    if (row < N - 1) min = Math.min(min, deltaE(colour, colours[pos + N]!));
  });
  return min;
}

/** Corner indices (TL, TR, BL, BR) in order around the square. */
const AROUND = [0, 1, 3, 2] as const;

/**
 * Four contrasting corners: hues about 90° apart, with one diagonal light and the other dark.
 *
 * The hues run in order around the square (random start and direction). Diagonal lightness
 * cancels out along the middle row and column, so those tiles are told apart by hue alone;
 * other hue arrangements can cancel there too and leave identical neighbours.
 */
export function randomCorners(rng: Rng): Corners {
  const base = rng() * 360;
  const start = randInt(rng, 4);
  const direction = rng() < 0.5 ? 1 : 3;
  const lightFirst = rng() < 0.5;
  const corners: Oklab[] = [];
  for (let step = 0; step < 4; step++) {
    const corner = AROUND[(start + step * direction) % 4]!;
    const h = (base + step * 90 + randRange(rng, -HUE_JITTER, HUE_JITTER) + 360) % 360;
    // TL and BR share a diagonal, as do TR and BL.
    const onFirstDiagonal = corner === 0 || corner === 3;
    const [lo, hi] = onFirstDiagonal === lightFirst ? LIGHT_L : DARK_L;
    const L = randRange(rng, lo, hi);
    const C = Math.min(randRange(rng, ...CHROMA_RANGE), maxChroma(L, h));
    corners[corner] = toGamut(oklchToOklab({ L, C, h }));
  }
  return corners as unknown as Corners;
}

export interface Palette {
  corners: Corners;
  /** Solved colour of each position, indexed by tile id. */
  colours: Oklab[];
}

/**
 * Random corners whose solved grid has every pair of neighbouring tiles distinguishable.
 * Falls back to the best attempt if none pass.
 */
export function generatePalette(rng: Rng): Palette {
  let best: Palette | undefined;
  let bestScore = -Infinity;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const corners = randomCorners(rng);
    const colours = tileColours(corners);
    const score = minNeighbourDeltaE(colours);
    if (score >= MIN_NEIGHBOUR_DELTA_E) return { corners, colours };
    if (score > bestScore) {
      best = { corners, colours };
      bestScore = score;
    }
  }
  return best!;
}
