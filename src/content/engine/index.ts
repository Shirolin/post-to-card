/**
 * Export Engine: one interface from a rendered card to a blob on the clipboard
 * or in the downloads folder.
 *
 * Two steps, and the caller only ever sees the outcome of the second:
 *   1. `renderCardToBlob` rasterizes the live card at retina scale with every
 *      remote image swapped for a data URL, so the canvas stays origin-clean.
 *   2. `exportBlobWithFallback` puts the blob where it was asked to go, and
 *      reports which of the two places it actually ended up in.
 *
 * The result is a value rather than a side effect. It used to be dropped on the
 * floor by the content script, which left the modal free to announce "copied"
 * for a card that the clipboard had refused and the browser had downloaded.
 */

import { renderCardToBlob, type RenderOptions } from './export.ts';
import { exportBlobWithFallback, type ExportAction, type ExportResult } from './fallback.ts';

export * from './export.ts';
export * from './fallback.ts';

export interface ExportCardOptions {
  /** Where the card should go. Defaults to the clipboard. */
  action?: ExportAction;
  /** Retina factor. The card is laid out at a fixed 640px, so this is the only
   *  thing that decides the exported pixel size. */
  scale?: number;
  /** Overrides the generated name. */
  filename?: string;
  /** Passed through to the rasterizer for the rare case that needs it. */
  render?: RenderOptions;
}

/** The result of an export. What happened, not what was asked for. */
export type ExportOutcome = ExportResult;

/**
 * Renders a card and hands the result to the clipboard or the downloads folder.
 *
 * Resolves rather than throws when the export did not work: a clipboard refusal
 * that ends in a download is a success, and both failures come back as
 * `success: false` with the reason attached. It throws only when the rasterizer
 * itself fails, which is a defect rather than an outcome.
 */
export async function exportCard(
  cardElement: HTMLElement,
  options: ExportCardOptions = {}
): Promise<ExportOutcome> {
  const { action = 'copy', scale = 2, filename, render } = options;

  const blob = await renderCardToBlob(cardElement, { scale, ...render });
  return exportBlobWithFallback(blob, action, filename);
}