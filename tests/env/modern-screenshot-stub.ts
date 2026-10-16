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

/** Makes the next rasterization reject, the way a browser failure would. */
export function failNextRasterization(message: string): void {
  failure = message;
}

export function resetRasterizer(): void {
  rasterizerCalls.length = 0;
  failure = null;
}

export async function domToBlob(target: unknown, options: Record<string, any> = {}): Promise<Blob> {
  rasterizerCalls.push({ target, options });

  if (failure) {
    const message = failure;
    failure = null;
    throw new Error(message);
  }

  return new Blob([new Uint8Array(8)], { type: options.type || 'image/png' });
}
