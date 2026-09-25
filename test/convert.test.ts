import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rgbToHsl,
  hslToRgb,
  rgbToOklch,
  oklchToRgb,
  toRgb,
  toHsl,
  toOklch,
} from '../src/index.js';
import type { RgbColor } from '../src/index.js';

function closeTo(actual: number, expected: number, epsilon: number, message: string): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: got ${actual}, expected ~${expected}`);
}

const RED: RgbColor = { space: 'rgb', r: 255, g: 0, b: 0, alpha: 1 };
const GRAY: RgbColor = { space: 'rgb', r: 128, g: 128, b: 128, alpha: 0.5 };
const WHITE: RgbColor = { space: 'rgb', r: 255, g: 255, b: 255, alpha: 1 };
const BLACK: RgbColor = { space: 'rgb', r: 0, g: 0, b: 0, alpha: 1 };

test('rgb -> hsl -> rgb round trips exactly for primary colours', () => {
  for (const rgb of [RED, WHITE, BLACK, GRAY]) {
    const back = hslToRgb(rgbToHsl(rgb));
    assert.equal(back.r, rgb.r);
    assert.equal(back.g, rgb.g);
    assert.equal(back.b, rgb.b);
    assert.equal(back.alpha, rgb.alpha);
  }
});

test('rgbToHsl: a grey has zero saturation and preserves alpha', () => {
  const hsl = rgbToHsl(GRAY);
  assert.equal(hsl.s, 0);
  closeTo(hsl.l, 50, 0.25, 'lightness of #808080');
  assert.equal(hsl.alpha, 0.5);
});

test('rgbToHsl: pure red is hue 0, full saturation, half lightness', () => {
  const hsl = rgbToHsl(RED);
  assert.equal(hsl.h, 0);
  assert.equal(hsl.s, 100);
  assert.equal(hsl.l, 50);
});

test('rgb -> oklch -> rgb round trips within rounding for in-gamut colours', () => {
  for (const rgb of [RED, WHITE, BLACK, GRAY]) {
    const back = oklchToRgb(rgbToOklch(rgb));
    closeTo(back.r, rgb.r, 1, 'red channel');
    closeTo(back.g, rgb.g, 1, 'green channel');
    closeTo(back.b, rgb.b, 1, 'blue channel');
    assert.equal(back.alpha, rgb.alpha);
  }
});

test('rgbToOklch: black and white have zero chroma', () => {
  closeTo(rgbToOklch(BLACK).l, 0, 1e-6, 'black lightness');
  closeTo(rgbToOklch(WHITE).l, 1, 1e-6, 'white lightness');
  closeTo(rgbToOklch(BLACK).c, 0, 1e-6, 'black chroma');
  closeTo(rgbToOklch(WHITE).c, 0, 1e-6, 'white chroma');
});

test('toRgb/toHsl/toOklch are identities on their own space', () => {
  const hsl = rgbToHsl(RED);
  const oklch = rgbToOklch(RED);
  assert.equal(toRgb(RED), RED);
  assert.equal(toHsl(hsl), hsl);
  assert.equal(toOklch(oklch), oklch);
});

test('toRgb/toHsl/toOklch dispatch to the right pairwise conversion', () => {
  const hsl = rgbToHsl(RED);
  assert.deepEqual(toRgb(hsl), hslToRgb(hsl));
  assert.deepEqual(toOklch(hsl), rgbToOklch(hslToRgb(hsl)));

  const oklch = rgbToOklch(RED);
  assert.deepEqual(toRgb(oklch), oklchToRgb(oklch));
});
