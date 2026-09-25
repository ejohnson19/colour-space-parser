import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, formatColor, toHex, ColorSyntaxError } from '../src/index.js';
import type { RgbColor, HslColor } from '../src/index.js';

test('rgb: parse/format round trip, space syntax', () => {
  const c = parseColor('rgb(255 99 71)');
  assert.deepEqual(c, { space: 'rgb', r: 255, g: 99, b: 71, alpha: 1 });
  assert.equal(formatColor(c), 'rgb(255 99 71)');
});

test('rgb: legacy comma syntax parses to the same value', () => {
  const spaced = parseColor('rgb(255 99 71)');
  const comma = parseColor('rgb(255, 99, 71)');
  assert.deepEqual(spaced, comma);
});

test('rgb: alpha via slash and via comma agree', () => {
  const slash = parseColor('rgb(255 0 0 / 50%)');
  const comma = parseColor('rgba(255, 0, 0, 0.5)');
  assert.deepEqual(slash, comma);
  assert.equal(formatColor(slash), 'rgb(255 0 0 / 0.5)');
  assert.equal(formatColor(slash, { alphaAsPercent: true }), 'rgb(255 0 0 / 50%)');
});

test('rgb: percentage components are scaled against 255', () => {
  const c = parseColor('rgb(100% 0% 0%)');
  assert.deepEqual(c, { space: 'rgb', r: 255, g: 0, b: 0, alpha: 1 });
});

test('hex: 6-digit and 8-digit forms parse and round trip through toHex', () => {
  const opaque = parseColor('#ff6347') as RgbColor;
  assert.equal(toHex(opaque), '#ff6347');

  const withAlpha = parseColor('#ff634780') as RgbColor;
  assert.equal(withAlpha.alpha, 0x80 / 255);
  assert.equal(toHex(withAlpha), '#ff634780');
});

test('hex: 3-digit and 4-digit shorthand expand each nibble', () => {
  const c = parseColor('#f00');
  assert.deepEqual(c, { space: 'rgb', r: 255, g: 0, b: 0, alpha: 1 });

  const withAlpha = parseColor('#f00c');
  assert.deepEqual(withAlpha, { space: 'rgb', r: 255, g: 0, b: 0, alpha: 0xcc / 255 });
});

test('hsl: parse/format round trip', () => {
  const c = parseColor('hsl(210 80% 45%)');
  assert.deepEqual(c, { space: 'hsl', h: 210, s: 80, l: 45, alpha: 1 });
  assert.equal(formatColor(c), 'hsl(210 80% 45%)');
});

test('hsl: hue units all normalize to degrees', () => {
  const deg = parseColor('hsl(180deg 50% 50%)') as HslColor;
  const turn = parseColor('hsl(0.5turn 50% 50%)') as HslColor;
  const grad = parseColor('hsl(200grad 50% 50%)') as HslColor;
  const rad = parseColor('hsl(3.14159265rad 50% 50%)') as HslColor;
  for (const c of [deg, turn, grad, rad]) {
    assert.ok(Math.abs(c.h - 180) < 1e-3);
  }
});

test('hsl: negative hue wraps into [0, 360)', () => {
  const c = parseColor('hsl(-30 50% 50%)') as HslColor;
  assert.equal(c.h, 330);
});

test('oklch: parse/format round trip', () => {
  const c = parseColor('oklch(0.7 0.15 30)');
  assert.deepEqual(c, { space: 'oklch', l: 0.7, c: 0.15, h: 30, alpha: 1 });
  assert.equal(formatColor(c), 'oklch(0.7 0.15 30)');
});

test('lab: parse/format round trip', () => {
  const c = parseColor('lab(29.23 39.38 20.07)');
  assert.deepEqual(c, { space: 'lab', l: 29.23, a: 39.38, b: 20.07, alpha: 1 });
  assert.equal(formatColor(c), 'lab(29.23 39.38 20.07)');
});

test('lab: a/b percentages scale against the +/-125 reference range and are not clamped', () => {
  const c = parseColor('lab(50% 100% -200)');
  assert.deepEqual(c, { space: 'lab', l: 50, a: 125, b: -200, alpha: 1 });
});

test('lch: parse/format round trip', () => {
  const c = parseColor('lch(52.2 72.2 50)');
  assert.deepEqual(c, { space: 'lch', l: 52.2, c: 72.2, h: 50, alpha: 1 });
  assert.equal(formatColor(c), 'lch(52.2 72.2 50)');
});

test('rejects empty input', () => {
  assert.throws(() => parseColor(''), ColorSyntaxError);
  assert.throws(() => parseColor('   '), ColorSyntaxError);
});

test('rejects unknown functions and malformed hex', () => {
  assert.throws(() => parseColor('cmyk(0 0 0 0)'), ColorSyntaxError);
  assert.throws(() => parseColor('#12345'), ColorSyntaxError);
  assert.throws(() => parseColor('not a colour'), ColorSyntaxError);
});

test('rejects out-of-range components', () => {
  assert.throws(() => parseColor('rgb(300 0 0)'), ColorSyntaxError);
  assert.throws(() => parseColor('hsl(0 150% 50%)'), ColorSyntaxError);
  assert.throws(() => parseColor('rgb(255 0 0 / 150%)'), ColorSyntaxError);
});

test('rejects the wrong number of components', () => {
  assert.throws(() => parseColor('rgb(255 0)'), ColorSyntaxError);
  assert.throws(() => parseColor('rgb(255 0 0 0 0)'), ColorSyntaxError);
});

test('ColorSyntaxError carries the original input', () => {
  try {
    parseColor('rgb(300 0 0)');
    assert.fail('expected parseColor to throw');
  } catch (err) {
    if (!(err instanceof ColorSyntaxError)) throw err;
    assert.equal(err.input, 'rgb(300 0 0)');
  }
});
