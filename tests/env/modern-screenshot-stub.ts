/**
 * Stand-in for `modern-screenshot`, aliased in `tests/env/render.ts`.
 *
 * The real rasterizer needs a canvas and an image-decode pipeline, neither of
 * which exists in Node, so the export engine could not be reached at all with
 * the real one — and the tests that claimed to cover it called a hand-written
 * copy of the rasterizer instead, which is why a broken export filter went
 * unnoticed. Aliasing the module puts the real engine back on the hook:
 * `renderCardToBlob` runs unmodified and whatever it hands the rasterizer is
 * what these record.
 *
 * Reach this through `loadModule` in a test, not through a relative import —
 * the SSR module graph holds the instance the production code sees.
 */
export interface RasterizerCall {
  /** The node the engine asked to have rasterized. */
  target: unknown;
  options: Record<string, any>;
}

export const rasterizerCalls: RasterizerCall[] = [];

let failure: string | null = null;
let nextSize: number | null = null;

/** Makes the next rasterization reject, the way a browser failure would. */
export function failNextRasterization(message: string): void {
  failure = message;
}

/** The first 8 bytes of a PNG; a blob without them holds no picture. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Makes the next rasterization return a Blob with no picture in it.
 *
 * Two shapes, because the real engine produces two. At scale 1 the `data:,`
 * fallback decodes to zero bytes. At every other scale `domToBlob` rebuilds the
 * blob through `changePngDpi`, which lays a 54-byte header over an empty source
 * -- still `image/png`, still truthy, still no PNG signature. The default is
 * the 54-byte one, because that is the shape the shipped scale (2) produces.
 */
export function failNextRasterizationWithEmptyBlob(size = 54): void {
  nextSize = size;
  nextBlob = 'empty';
}

/** Overrides the next successful Blob's size, in bytes. */
export function setNextBlobSize(size: number): void {
  nextSize = size;
}

/** The next blob is a plausible PNG, not the empty shape. */
let nextBlob: 'png' | 'empty' = 'png';

export function resetRasterizer(): void {
  rasterizerCalls.length = 0;
  failure = null;
  nextSize = null;
  nextBlob = 'png';
}

export async function domToBlob(target: unknown, options: Record<string, any> = {}): Promise<Blob> {
  rasterizerCalls.push({ target, options });

  // Before the failure injection, which is what a real rasterizer does: its
  // first statement is the guard that hands the DOM back. A stub that failed
  // first made "the export threw" and "the rasterizer was reached" different
  // observations, so a test had to ask the call log which one had happened.
  if (!options.scale) return new Blob([], { type: options.type || 'image/png' });

  if (failure) {
    const message = failure;
    failure = null;
    throw new Error(message);
  }

  // Read only by a rasterizing call: a measurement that arrives between the
  // injection and the export must not spend it, and the engine's own readout
  // does exactly that on every mounted card.
  const size = nextSize ?? 8;
  const shape = nextBlob;
  nextSize = null;
  nextBlob = 'png';

  const bytes = new Uint8Array(size);
  if (shape === 'png' && size >= PNG_SIGNATURE.length) {
    // A real PNG starts with these; the engine checks for them, so a stub that
    // filled the blob with zeroes would look like the empty-canvas shape.
    bytes.set(PNG_SIGNATURE, 0);
  }
  return new Blob([bytes], { type: options.type || 'image/png' });
}
