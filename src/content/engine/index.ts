/**
 * Export Engine Barrel and High-Level Workflow Orchestrator.
 */

import type { Locale } from '../../types/card.ts';
import { renderCardToBlob, type RenderOptions } from './export.ts';
import { exportBlobWithFallback, type ExportAction, type ExportResult } from './fallback.ts';

export * from './export.ts';
export * from './fallback.ts';

/**
 * Orchestrates the end-to-end card export flow:
 * 1. Renders the card element to high-res PNG blob via modern-screenshot
 *    with automatic Base64 image substitution for origin-clean canvas.
 * 2. Copies to clipboard or downloads PNG, automatically falling back
 *    to download if clipboard permissions or focus are lost.
 */
export async function exportCardFlow(
  cardElement: HTMLElement,
  scale: number = 2,
  action: ExportAction = 'copy',
  customFilename?: string,
  options?: RenderOptions,
  locale?: Locale
): Promise<ExportResult> {
  const blob = await renderCardToBlob(cardElement, {
    scale,
    ...options,
  });

  const filename = customFilename || `post-to-card-${Date.now()}.png`;
  return exportBlobWithFallback(blob, action, filename, locale);
}
