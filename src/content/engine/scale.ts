/**
 * Canvas-edge arithmetic, kept free of the DOM so both the exporter and the
 * preview's size readout can share it.
 *
 * The readout used to quote `640 * 2 x height * 2` while the exporter quietly
 * reduced the scale to stay under the canvas limit, so a very tall card was
 * announced at a size the file never had. Two copies of this arithmetic would
 * drift the same way again; one function, called from both places, cannot.
 */

/**
 * The largest canvas edge Chrome will actually allocate.
 *
 * Measured rather than assumed: on Chrome 152 a 640x65535 canvas draws and
 * encodes, and 640x65536 comes back empty. The first value used here was 16384,
 * which is a different number -- the edge of a *square* canvas at the area cap
 * (sqrt(2^28)) -- and it shrank exports that would have succeeded. The card is a
 * fixed 640px wide, so it is the height that grows, and the height is what this
 * bound applies to.
 */
export const MAX_CANVAS_EDGE = 65535;

/**
 * How many times taller than wide a picture can be before a feed makes it
 * unreadable.
 *
 * A canvas edge says whether a file can be *made*; this says whether it can be
 * *read*. Feeds cap how tall an image is shown before cropping it, and they
 * show it at column width, so a 640px-wide card scaled into a ~500px column
 * lands its 16px body text at ~12px -- legible -- while a 4:1 sheet drops it
 * under 8px. Four is a quiet line: two posts in a thread measure about 1.4 and
 * five about 3.4, so only a genuinely long run trips it.
 */
export const LONG_CARD_RATIO = 4;

/**
 * True when the picture is tall enough that a feed will shrink its text.
 *
 * Takes the readout's own numbers rather than the card's, because the picture
 * is what a reader sees: a mat that pads the card square can pull a tall card
 * back under the line, and warning about the card instead would contradict the
 * size printed next to it.
 */
export function isLongCard(readout: Pick<ExportSizeReadout, 'width' | 'height'>): boolean {
  if (!Number.isFinite(readout.width) || !Number.isFinite(readout.height) || readout.width <= 0) {
    return false;
  }
  return readout.height > readout.width * LONG_CARD_RATIO;
}

export interface MeasuredBox {
  width: number;
  height: number;
}

export interface ScaleFit {
  /** What the caller asked for. */
  requested: number;
  /** What the exporter will actually use. */
  applied: number;
  /** True when `applied` is below `requested`. */
  reduced: boolean;
  /**
   * True when even 1x is over the edge, i.e. the card cannot be exported at all.
   *
   * Separate from `reduced` because the two need different words: "we shrank it
   * and here is the size" versus "this card is beyond what a canvas can hold".
   * Quoting a size for the second case promises a file the exporter will never
   * produce -- it reports an empty blob instead.
   */
  impossible: boolean;
}

/**
 * Reduces `requested` until the box fits in a canvas of `maxEdge` a side.
 *
 * A zero measurement means the card has not been laid out (a headless render, or
 * the first frame before the observer runs). Guessing a factor there would
 * shrink exports that were never at risk, and would make the readout disagree
 * with the renderer, so the requested scale is returned untouched.
 *
 * The reduction stops at 1. A box taller than the edge limit cannot be exported
 * at any scale this could return -- at 1x it is already taller than the canvas
 * the rasterizer would need -- so going below 1 would only produce a picture
 * smaller than the card. That case is a failure either way, and `impossible`
 * says so; the exporter reports the resulting empty blob rather than pretending
 * it worked.
 */
export function fitScaleToCanvas(
  measured: MeasuredBox,
  requested: number,
  maxEdge: number = MAX_CANVAS_EDGE
): ScaleFit {
  const width = measured.width;
  const height = measured.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { requested, applied: requested, reduced: false, impossible: false };
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    return { requested, applied: requested, reduced: false, impossible: false };
  }

  const longestEdge = Math.max(width, height);
  const fitted = maxEdge / longestEdge;
  // Below 1x there is no scale left to give: the card is taller than any canvas
  // the rasterizer can allocate, at every size this function may return.
  const impossible = fitted < 1;
  if (requested <= fitted) {
    return { requested, applied: requested, reduced: false, impossible };
  }

  // Floor rather than round, so the result is never a hair over the limit.
  const applied = Math.max(1, Math.floor(fitted * 100) / 100);
  return { requested, applied, reduced: applied < requested, impossible };
}

/** What the panel quotes beside the export buttons. */
export interface ExportSizeReadout {
  width: number;
  height: number;
  scale: number;
  reduced: boolean;
  /** True when no scale can export this card; `width`/`height` are then moot. */
  impossible: boolean;
}

/**
 * The size the file will actually be, or null before the card is measured.
 *
 * Lives here rather than in the panel because it is the same arithmetic the
 * exporter runs, and the two must not be able to drift: the panel used to
 * multiply by the requested scale regardless of what the engine did.
 *
 * The rounding matches the rasterizer's, not the nearest integer: it sizes the
 * canvas with `Math.floor(width * scale)`, so a readout that rounded would
 * name a pixel count the file does not have -- at applied scales like 1.63 the
 * two disagree for tens of thousands of heights.
 */
export function exportSizeFor(
  cardWidth: number,
  cardHeight: number,
  requested: number,
  maxEdge: number = MAX_CANVAS_EDGE
): ExportSizeReadout | null {
  if (!Number.isFinite(cardWidth) || !Number.isFinite(cardHeight) || cardHeight <= 0) {
    return null;
  }
  const fit = fitScaleToCanvas({ width: cardWidth, height: cardHeight }, requested, maxEdge);
  return {
    // Floor, like the rasterizer's `createCanvas`, so the readout names the
    // pixel count the PNG actually has.
    width: Math.floor(cardWidth * fit.applied),
    height: Math.floor(cardHeight * fit.applied),
    scale: fit.applied,
    reduced: fit.reduced,
    impossible: fit.impossible,
  };
}
