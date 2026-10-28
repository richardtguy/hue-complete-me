// Colour maths: sRGB <-> linear sRGB <-> OKLab <-> OKLCH.
// OKLab matrices from Björn Ottosson, https://bottosson.github.io/posts/oklab/

/** sRGB with gamma, channels nominally in [0, 1]. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/** OKLab in polar form. Hue `h` is in degrees. */
export interface Oklch {
  L: number;
  C: number;
  h: number;
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function linearRgbToOklab({ r, g, b }: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function srgbToOklab({ r, g, b }: Rgb): Oklab {
  return linearRgbToOklab({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) });
}

/** Converts to sRGB without any gamut handling; channels may fall outside [0, 1]. */
export function oklabToSrgb(lab: Oklab): Rgb {
  const { r, g, b } = oklabToLinearRgb(lab);
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function oklchToOklab({ L, C, h }: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export function mixOklab(from: Oklab, to: Oklab, t: number): Oklab {
  return {
    L: from.L + (to.L - from.L) * t,
    a: from.a + (to.a - from.a) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/** Euclidean distance in OKLab, a good approximation of perceived difference. */
export function deltaE(x: Oklab, y: Oklab): number {
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

const GAMUT_EPSILON = 1e-6;

export function isInGamut(lab: Oklab): boolean {
  const { r, g, b } = oklabToLinearRgb(lab);
  return [r, g, b].every((c) => c >= -GAMUT_EPSILON && c <= 1 + GAMUT_EPSILON);
}

/**
 * Maps a colour into the sRGB gamut by reducing chroma at constant lightness and hue
 * (binary search), so out-of-gamut colours keep their hue instead of shifting when clipped.
 */
export function toGamut(lab: Oklab): Oklab {
  const L = Math.min(1, Math.max(0, lab.L));
  const clamped = { ...lab, L };
  if (isInGamut(clamped)) return clamped;
  const { C, h } = oklabToOklch(clamped);
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(oklchToOklab({ L, C: mid, h }))) lo = mid;
    else hi = mid;
  }
  return oklchToOklab({ L, C: lo, h });
}

/** Largest in-gamut chroma for a given lightness and hue. */
export function maxChroma(L: number, h: number): number {
  return oklabToOklch(toGamut(oklchToOklab({ L, C: 0.5, h }))).C;
}

/**
 * Whether marks drawn on this colour should be dark rather than light. OKLab lightness 0.68
 * is roughly where black and white text have equal contrast.
 */
export function needsDarkInk(lab: Oklab): boolean {
  return lab.L > 0.68;
}

/** CSS hex string, e.g. `#3a7bd5`. Assumes an in-gamut colour; channels are clamped. */
export function toCss(lab: Oklab): string {
  const { r, g, b } = oklabToSrgb(lab);
  const hex = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
