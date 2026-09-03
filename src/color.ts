/**
 * Colour model, parser and pretty printer for a subset of CSS colour
 * notation: hex, rgb(), hsl() and oklch(). The parser is deliberately
 * strict — it rejects anything it can't fully account for rather than
 * guessing, because a colour that's silently wrong is worse than one
 * that's loudly rejected.
 */

export type Alpha = number; // 0..1

export interface RgbColor {
  readonly space: 'rgb';
  readonly r: number; // 0..255
  readonly g: number; // 0..255
  readonly b: number; // 0..255
  readonly alpha: Alpha;
}

export interface HslColor {
  readonly space: 'hsl';
  readonly h: number; // 0..360 (degrees)
  readonly s: number; // 0..100 (percent)
  readonly l: number; // 0..100 (percent)
  readonly alpha: Alpha;
}

export interface OklchColor {
  readonly space: 'oklch';
  readonly l: number; // 0..1
  readonly c: number; // 0..0.5 (practical upper bound, not a hard limit)
  readonly h: number; // 0..360 (degrees)
  readonly alpha: Alpha;
}

export type Color = RgbColor | HslColor | OklchColor;

export class ColorSyntaxError extends Error {
  constructor(message: string, readonly input: string) {
    super(message);
    this.name = 'ColorSyntaxError';
  }
}

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const FUNC_RE = /^([a-z]+)\(\s*([^)]*)\s*\)$/i;

export function parseColor(input: string): Color {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ColorSyntaxError('empty input', input);
  }
  if (trimmed.startsWith('#')) {
    return parseHex(trimmed, input);
  }
  const match = FUNC_RE.exec(trimmed);
  if (!match) {
    throw new ColorSyntaxError(`unrecognized colour syntax: "${input}"`, input);
  }
  const fn = match[1].toLowerCase();
  const body = match[2];
  switch (fn) {
    case 'rgb':
    case 'rgba':
      return parseRgb(body, input);
    case 'hsl':
    case 'hsla':
      return parseHsl(body, input);
    case 'oklch':
      return parseOklch(body, input);
    default:
      throw new ColorSyntaxError(`unknown colour function "${fn}" in "${input}"`, input);
  }
}

function parseHex(text: string, original: string): RgbColor {
  const m = HEX_RE.exec(text);
  if (!m) {
    throw new ColorSyntaxError(`invalid hex colour: "${original}"`, original);
  }
  const digits = m[1];
  const expand = (c: string) => parseInt(c + c, 16);
  let r: number, g: number, b: number, a = 1;
  switch (digits.length) {
    case 3:
      r = expand(digits[0]);
      g = expand(digits[1]);
      b = expand(digits[2]);
      break;
    case 4:
      r = expand(digits[0]);
      g = expand(digits[1]);
      b = expand(digits[2]);
      a = expand(digits[3]) / 255;
      break;
    case 6:
      r = parseInt(digits.slice(0, 2), 16);
      g = parseInt(digits.slice(2, 4), 16);
      b = parseInt(digits.slice(4, 6), 16);
      break;
    case 8:
      r = parseInt(digits.slice(0, 2), 16);
      g = parseInt(digits.slice(2, 4), 16);
      b = parseInt(digits.slice(4, 6), 16);
      a = parseInt(digits.slice(6, 8), 16) / 255;
      break;
    default:
      throw new ColorSyntaxError(
        `hex colour must have 3, 4, 6 or 8 digits, got ${digits.length}: "${original}"`,
        original,
      );
  }
  return { space: 'rgb', r, g, b, alpha: a };
}

/** Splits a function body into its three components plus an optional alpha. */
function splitArgs(body: string, original: string): { parts: string[]; alpha: string | null } {
  let alphaText: string | null = null;
  let main = body;
  const slashIndex = body.indexOf('/');
  if (slashIndex >= 0) {
    main = body.slice(0, slashIndex);
    alphaText = body.slice(slashIndex + 1).trim();
  }
  const hasComma = main.includes(',');
  let parts = (hasComma ? main.split(',') : main.trim().split(/\s+/))
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (hasComma && alphaText === null && parts.length === 4) {
    alphaText = parts.pop() as string;
  }
  if (parts.length !== 3) {
    throw new ColorSyntaxError(`expected 3 components, got ${parts.length}: "${original}"`, original);
  }
  return { parts, alpha: alphaText };
}

function parseComponent(token: string, min: number, max: number, original: string, label: string): number {
  const percentMatch = /^(-?[\d.]+)%$/.exec(token);
  let value: number;
  if (percentMatch) {
    value = (parseFloat(percentMatch[1]) / 100) * max;
  } else {
    const numMatch = /^(-?[\d.]+)$/.exec(token);
    if (!numMatch) {
      throw new ColorSyntaxError(`invalid ${label} value "${token}" in "${original}"`, original);
    }
    value = parseFloat(numMatch[1]);
  }
  if (Number.isNaN(value) || value < min || value > max) {
    throw new ColorSyntaxError(
      `${label} value "${token}" is out of range [${min}, ${max}] in "${original}"`,
      original,
    );
  }
  return value;
}

function parseHue(token: string, original: string): number {
  const m = /^(-?[\d.]+)(deg|grad|rad|turn)?$/.exec(token);
  if (!m) {
    throw new ColorSyntaxError(`invalid hue "${token}" in "${original}"`, original);
  }
  let value = parseFloat(m[1]);
  switch (m[2]) {
    case 'grad':
      value *= 0.9;
      break;
    case 'rad':
      value *= 180 / Math.PI;
      break;
    case 'turn':
      value *= 360;
      break;
  }
  return ((value % 360) + 360) % 360;
}

function parseAlpha(token: string | null, original: string): number {
  if (token === null) return 1;
  const pct = /^([\d.]+)%$/.exec(token);
  const value = pct ? parseFloat(pct[1]) / 100 : parseFloat(token);
  if (Number.isNaN(value) || value < 0 || value > 1) {
    throw new ColorSyntaxError(`alpha "${token}" is out of range [0, 1] in "${original}"`, original);
  }
  return value;
}

function parseRgb(body: string, original: string): RgbColor {
  const { parts, alpha } = splitArgs(body, original);
  const r = parseComponent(parts[0], 0, 255, original, 'red');
  const g = parseComponent(parts[1], 0, 255, original, 'green');
  const b = parseComponent(parts[2], 0, 255, original, 'blue');
  return { space: 'rgb', r, g, b, alpha: parseAlpha(alpha, original) };
}

function parseHsl(body: string, original: string): HslColor {
  const { parts, alpha } = splitArgs(body, original);
  const h = parseHue(parts[0], original);
  const s = parseComponent(parts[1], 0, 100, original, 'saturation');
  const l = parseComponent(parts[2], 0, 100, original, 'lightness');
  return { space: 'hsl', h, s, l, alpha: parseAlpha(alpha, original) };
}

function parseOklch(body: string, original: string): OklchColor {
  const { parts, alpha } = splitArgs(body, original);
  const l = parseComponent(parts[0], 0, 1, original, 'lightness');
  const c = parseComponent(parts[1], 0, 0.5, original, 'chroma');
  const h = parseHue(parts[2], original);
  return { space: 'oklch', l, c, h, alpha: parseAlpha(alpha, original) };
}

export interface FormatOptions {
  /** Print alpha as a percentage ("50%") instead of a fraction ("0.5"). */
  readonly alphaAsPercent?: boolean;
}

export function formatColor(color: Color, options: FormatOptions = {}): string {
  switch (color.space) {
    case 'rgb':
      return formatRgb(color, options);
    case 'hsl':
      return formatHsl(color, options);
    case 'oklch':
      return formatOklch(color, options);
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatAlphaSuffix(alpha: number, options: FormatOptions): string {
  if (alpha >= 1) return '';
  const text = options.alphaAsPercent ? `${round(alpha * 100, 0)}%` : String(round(alpha, 3));
  return ` / ${text}`;
}

function formatRgb(c: RgbColor, options: FormatOptions): string {
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  return `rgb(${r} ${g} ${b}${formatAlphaSuffix(c.alpha, options)})`;
}

function formatHsl(c: HslColor, options: FormatOptions): string {
  return `hsl(${round(c.h, 1)} ${round(c.s, 1)}% ${round(c.l, 1)}%${formatAlphaSuffix(c.alpha, options)})`;
}

function formatOklch(c: OklchColor, options: FormatOptions): string {
  return `oklch(${round(c.l, 4)} ${round(c.c, 4)} ${round(c.h, 1)}${formatAlphaSuffix(c.alpha, options)})`;
}

/** Renders an RGB colour as a hex string, dropping the alpha channel if opaque. */
export function toHex(c: RgbColor): string {
  const byte = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  const base = `#${byte(c.r)}${byte(c.g)}${byte(c.b)}`;
  return c.alpha >= 1 ? base : `${base}${byte(c.alpha * 255)}`;
}
