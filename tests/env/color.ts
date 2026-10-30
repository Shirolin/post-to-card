/**
 * Colour maths the theme checks share.
 *
 * Five tier1 checks had each written their own copy of the sRGB transfer
 * function and WCAG relative luminance, and two of those copies took a hex
 * string while the others took channels -- the same formula with three
 * signatures. One copy here, so a check that reads a colour and a check that
 * argues about its contrast cannot disagree about what the number means.
 *
 * The gamma break (0.03928 vs 0.04045) and the coefficients are WCAG 2.x's;
 * `linear` is the exact sRGB transfer function, used by the OKLab path.
 */

/** Relative luminance of one channel, 0–255, under the WCAG definition. */
function wcagChannel(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of sRGB channels, 0–255. */
export function luminanceRgb(rgb: readonly number[]): number {
  return 0.2126 * wcagChannel(rgb[0]) + 0.7152 * wcagChannel(rgb[1]) + 0.0722 * wcagChannel(rgb[2]);
}

/** Relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  return luminanceRgb(channels(hex));
}

/** WCAG contrast ratio between two colours, either form. */
export function contrast(a: string | readonly number[], b: string | readonly number[]): number {
  const [hi, lo] = [asRgb(a), asRgb(b)].map(luminanceRgb).sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rrggbb` -> channels, 0–255. */
export function channels(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function asRgb(colour: string | readonly number[]): readonly number[] {
  return typeof colour === 'string' ? channels(colour) : colour;
}

/**
 * sRGB channels, 0–255, into OKLab.
 *
 * Used to model what `oklch(from … calc(l + 0.1) …)` paints. The conversion
 * does not clip: channels outside the gamut are handed back to the caller,
 * which is where a browser's gamut mapping and this model part company.
 */
export function toOklab(rgb: readonly number[]): [number, number, number] {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** OKLab back to sRGB channels, 0–255, clipped per channel. */
export function fromOklab(L: number, a: number, b: number): number[] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const encode = (v: number): number => {
    const c = Math.max(0, Math.min(1, v));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return [
    encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}
