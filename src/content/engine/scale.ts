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

/**
 * The scale a single post is exported at when the picture stays inside X's
 * display cap, and the cap itself.
 *
 * X scales a picture down to 2048px on its longest side when it shows it. A
 * 640px card at 3x is 1920 and stays under that; at 4x it is past it and X
 * throws the extra pixels away. So 3 is the most a single post can use, and the
 * edge is the line a taller card measures against.
 */
export const SINGLE_POST_EXPORT_SCALE = 3;
export const X_DISPLAY_MAX_EDGE = 2048;

export interface MeasuredBox {
  width: number;
  height: number;
}

/** False for the frame before the card has been laid out, and for nonsense. */
function isUsableBox(box: Pick<MeasuredBox, 'width' | 'height'>): boolean {
  return (
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
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
  if (!isUsableBox(measured)) {
    return { requested, applied: requested, reduced: false, impossible: false };
  }
  const width = measured.width;
  const height = measured.height;
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

/**
 * The scale this card is exported at when nobody passes one -- the exporter's
 * own default, so the file and the readout cannot disagree.
 *
 * `SINGLE_POST_EXPORT_SCALE` unless the picture, doubled, would pass the edge X
 * shows. A single post is 1920 tall at 3x and keeps its pixels; a thread is past
 * 2048 even at 2x, so 3x would only cost the user a longer export for a picture
 * the service scales back down on the way in.
 *
 * The 2x floor is held even when the preference is off. It is deliberately the
 * one number this rule shares with the export that shipped before it: a thread
 * should not change size because the rule around it got better.
 *
 * The canvas limit is not also applied here. `fitScaleToCanvas` does that in
 * both callers, and doing it twice is how the two figures drifted apart once
 * already.
 *
 * `preferHighResolution` is the user's preference, not a quality claim: it gives a
 * picture past the display ceiling more pixels rather than fewer, which is what
 * you want when the file is going somewhere X is not.
 */
export function defaultExportScale(
  box: Pick<MeasuredBox, 'width' | 'height'>,
  options: { preferHighResolution?: boolean } = {}
): number {
  if (!isUsableBox(box)) return SINGLE_POST_EXPORT_SCALE;
  if (options.preferHighResolution) return SINGLE_POST_EXPORT_SCALE;
  return Math.max(box.width, box.height) * SINGLE_POST_EXPORT_SCALE > X_DISPLAY_MAX_EDGE
    ? THREAD_EXPORT_SCALE
    : SINGLE_POST_EXPORT_SCALE;
}

/** What a picture past X's display cap is exported at, and what shipped before. */
export const THREAD_EXPORT_SCALE = 2;

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

/**
 * The whole readout, from the card's own size and nothing else.
 *
 * This is the panel's figure and the exporter's scale in one call, so a preview
 * cannot quote a size, or a scale, the file will not have. It applies the three
 * rules in the order an export does: X's display cap, then the user's
 * preference, then the canvas edge.
 */
export function exportSizeReadout(
  box: MeasuredBox,
  options: { requestedScale?: number; preferHighResolution?: boolean } = {}
): ExportSizeReadout | null {
  const requested = options.requestedScale ?? defaultExportScale(box, options);
  return exportSizeFor(box.width, box.height, requested);
}
