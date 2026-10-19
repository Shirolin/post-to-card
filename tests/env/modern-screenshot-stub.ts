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

/**
 * Makes the next rasterization return a zero-byte Blob.
 *
 * This is the shape the real engine produces when the canvas could not be
 * allocated: `toBlob` yields null, the `toDataURL` fallback returns `data:,`,
 * and decoding that gives a Blob with a size of zero -- truthy, so it slipped
 * past the old `!blob` check and was announced as a successful copy.
 */
export function failNextRasterizationWithEmptyBlob(): void {
  nextSize = 0;
}

/** Overrides the next successful Blob's size, in bytes. */
export function setNextBlobSize(size: number): void {
  nextSize = size;
}

export function resetRasterizer(): void {
  rasterizerCalls.length = 0;
  failure = null;
  nextSize = null;
}

export async function domToBlob(target: unknown, options: Record<string, any> = {}): Promise<Blob> {
  rasterizerCalls.push({ target, options });

  if (failure) {
    const message = failure;
    failure = null;
    throw new Error(message);
  }

  const size = nextSize ?? 8;
  nextSize = null;
  return new Blob([new Uint8Array(size)], { type: options.type || 'image/png' });
}
