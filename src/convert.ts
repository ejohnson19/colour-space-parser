/**
 * Conversions between rgb, hsl and oklch. lab and lch aren't wired in yet —
 * they'd need the CIE XYZ/D50 matrices rather than the OKLab ones used here,
 * which is a separate piece of work.
 *
 * oklch can express colours outside the sRGB gamut (that's most of the
 * point of it), so the rgb side of these conversions clamps to 0..255.
 * Round-tripping an out-of-gamut oklch value through rgb and back will not
 * reproduce the original — that's a property of the gamut, not a bug here.
 */

import type { RgbColor, HslColor, OklchColor } from './color.js';

type Convertible = RgbColor | HslColor | OklchColor;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- rgb <-> hsl -----------------------------------------------------------

export function rgbToHsl(c: RgbColor): HslColor {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { space: 'hsl', h, s: s * 100, l: l * 100, alpha: c.alpha };
}

export function hslToRgb(c: HslColor): RgbColor {
  const s = c.s / 100;
  const l = c.l / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((c.h / 60) % 2) - 1));
  const m = l - chroma / 2;
  let r: number, g: number, b: number;
  if (c.h < 60) {
    [r, g, b] = [chroma, x, 0];
  } else if (c.h < 120) {
    [r, g, b] = [x, chroma, 0];
  } else if (c.h < 180) {
    [r, g, b] = [0, chroma, x];
  } else if (c.h < 240) {
    [r, g, b] = [0, x, chroma];
  } else if (c.h < 300) {
    [r, g, b] = [x, 0, chroma];
  } else {
    [r, g, b] = [chroma, 0, x];
  }
  return {
    space: 'rgb',
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    alpha: c.alpha,
  };
}

// --- rgb <-> oklch -----------------------------------------------------------
// Matrices are Björn Ottosson's published OKLab constants:
// https://bottosson.github.io/posts/oklab/

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

function rgbToOklab(c: RgbColor): { l: number; a: number; b: number } {
  const r = srgbToLinear(c.r / 255);
  const g = srgbToLinear(c.g / 255);
  const b = srgbToLinear(c.b / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToRgb(l: number, a: number, b: number, alpha: number): RgbColor {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;

  const r = 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g = -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const bLin = -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed;

  const toByte = (v: number) => Math.round(clamp(linearToSrgb(v), 0, 1) * 255);

  return { space: 'rgb', r: toByte(r), g: toByte(g), b: toByte(bLin), alpha };
}

export function rgbToOklch(c: RgbColor): OklchColor {
  const { l, a, b } = rgbToOklab(c);
  const chroma = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { space: 'oklch', l, c: chroma, h, alpha: c.alpha };
}

export function oklchToRgb(c: OklchColor): RgbColor {
  const hRad = (c.h * Math.PI) / 180;
  const a = c.c * Math.cos(hRad);
  const b = c.c * Math.sin(hRad);
  return oklabToRgb(c.l, a, b, c.alpha);
}

// --- hsl <-> oklch (via rgb) -------------------------------------------------

export function hslToOklch(c: HslColor): OklchColor {
  return rgbToOklch(hslToRgb(c));
}

export function oklchToHsl(c: OklchColor): HslColor {
  return rgbToHsl(oklchToRgb(c));
}

// --- generic dispatch, mirroring formatColor's per-space switch ------------

export function toRgb(c: Convertible): RgbColor {
  switch (c.space) {
    case 'rgb':
      return c;
    case 'hsl':
      return hslToRgb(c);
    case 'oklch':
      return oklchToRgb(c);
  }
}

export function toHsl(c: Convertible): HslColor {
  switch (c.space) {
    case 'rgb':
      return rgbToHsl(c);
    case 'hsl':
      return c;
    case 'oklch':
      return oklchToHsl(c);
  }
}

export function toOklch(c: Convertible): OklchColor {
  switch (c.space) {
    case 'rgb':
      return rgbToOklch(c);
    case 'hsl':
      return hslToOklch(c);
    case 'oklch':
      return c;
  }
}
