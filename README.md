# colour-space-parser

Colour strings show up everywhere — CSS, design tool exports, SVGs, config
files — and they're written in half a dozen loosely related notations that
all look similar and aren't. `rgb(255 0 0)`, `#ff0000`, `hsl(0 100% 50%)` and
`oklch(0.63 0.26 29)` describe roughly the same red, but a naive regex that
"mostly works" will happily accept `rgb(999 -5 3.14159abc)` and hand you
garbage numbers. This library does the boring part properly: parse a colour
string into a typed value, reject anything malformed or out of range with a
specific error, and print it back out in a canonical form.

It covers six notations for now: hex (`#rgb`, `#rgba`, `#rrggbb`,
`#rrggbbaa`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, `oklch()`, `lab()` and
`lch()`. Both the legacy comma syntax and the modern space syntax (with `/`
for alpha) are accepted on parse; the printer always emits the modern form.

## Usage

```ts
import { parseColor, formatColor, toHex, ColorSyntaxError } from './src/index.js';

const c = parseColor('rgb(255, 99, 71)');
// { space: 'rgb', r: 255, g: 99, b: 71, alpha: 1 }

formatColor(c);
// "rgb(255 99 71)"

toHex(c);
// "#ff6347"

parseColor('oklch(70% 0.15 30deg / 50%)');
// { space: 'oklch', l: 0.7, c: 0.15, h: 30, alpha: 0.5 }

formatColor(parseColor('hsl(210deg 80% 45%)'), { alphaAsPercent: true });
// "hsl(210 80% 45%)"

parseColor('lab(29.2345% 39.3825 20.0664)');
// { space: 'lab', l: 29.2345, a: 39.3825, b: 20.0664, alpha: 1 }

parseColor('lch(52.2% 72.2 50)');
// { space: 'lch', l: 52.2, c: 72.2, h: 50, alpha: 1 }

try {
  parseColor('rgb(300 0 0)');
} catch (err) {
  if (err instanceof ColorSyntaxError) {
    console.error(err.message); // red value "300" is out of range [0, 255] in "rgb(300 0 0)"
  }
}
```

## Design

- Parsing and printing are separate, symmetric operations — `parseColor`
  never formats and `formatColor` never validates. Round-tripping a value
  through both should be lossless up to rounding.
- Every rejection throws `ColorSyntaxError` with a message that names the
  offending token and the original input, not just "invalid colour".
- Numbers, percentages, and (for hue) `deg`/`grad`/`rad`/`turn` units are all
  accepted where CSS allows them; nothing is inferred or defaulted beyond
  what the spec says (alpha defaults to `1` when omitted).

## Status

First working slice. See the source in `src/color.ts` for the full set of
supported syntax — it's short enough to read end to end.

## Build

```
npm install
npm run build
```

## License

MIT, see [LICENSE](LICENSE).
