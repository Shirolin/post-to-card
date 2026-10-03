/**
 * Fallback Engine: Clipboard Copy and Automatic Download Fallback.
 * 
 * Provides resilient image export:
 * 1. Attempts direct copy to system clipboard via navigator.clipboard.write.
 * 2. Catches document focus loss, transient user activation expiration,
 *    and permission denials, gracefully triggering instant PNG file download.
 * 3. Provides clean UI toast notifications for user feedback.
 */

import type { Locale } from '../../types/card.ts';
import { getTranslation, sanitizeLocale } from '../i18n.ts';

export type ExportAction = 'copy' | 'download';

export interface ExportResult {
  success: boolean;
  method: 'clipboard' | 'download';
  filename: string;
  error?: string;
}

export interface ToastOptions {
  message: string;
  isError?: boolean;
  durationMs?: number;
}

/**
 * Downloads a binary Blob directly as a PNG file via a hidden anchor tag.
 */
export function downloadBlobAsPng(blob: Blob, filename: string = 'post-to-card.png'): void {
  // Support testing environment download trackers if attached
  const globalScope = globalThis as unknown as {
    currentDownloadTracker?: { trackDownload: (blob: Blob, filename: string) => void };
  };
  if (globalScope && globalScope.currentDownloadTracker) {
    globalScope.currentDownloadTracker.trackDownload(blob, filename);
  }

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return;
  }

  const url = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
    ? URL.createObjectURL(blob)
    : '';

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  if (document.body) {
    document.body.appendChild(anchor);
  }

  if (typeof anchor.click === 'function') {
    anchor.click();
  }

  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, 2000);
}

/**
 * Copies a PNG Blob to the system clipboard via navigator.clipboard.write.
 */
export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function'
  ) {
    throw new Error('Clipboard API is not supported in this environment.');
  }

  if (typeof ClipboardItem === 'undefined') {
    throw new Error('ClipboardItem is not supported in this environment.');
  }

  const item = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}

/**
 * Displays a non-intrusive floating toast notification for export status feedback.
 */
export function showToast(messageOrOptions: string | ToastOptions, isErrorFallback: boolean = false): void {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return;
  }

  const message = typeof messageOrOptions === 'string' ? messageOrOptions : messageOrOptions.message;
  const isError = typeof messageOrOptions === 'string' ? isErrorFallback : (messageOrOptions.isError ?? isErrorFallback);
  const durationMs = typeof messageOrOptions === 'string' ? 3000 : (messageOrOptions.durationMs ?? 3000);

  // Remove existing toast if present
  const existing = document.querySelector('.post-to-card-toast');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const toast = document.createElement('div');
  toast.className = `post-to-card-toast ${isError ? 'is-error' : ''}`;
  toast.textContent = message;

  toast.style.position = 'fixed';
  toast.style.bottom = '28px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '9999px';
  toast.style.background = isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(17, 24, 39, 0.92)';
  toast.style.color = '#ffffff';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '500';
  toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)';
  toast.style.zIndex = '2147483647';
  toast.style.pointerEvents = 'none';
  toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  toast.style.backdropFilter = 'blur(8px)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';

  // Mount into Shadow DOM if active, else document.body
  const container = document.querySelector('post-to-card-container');
  if (container && container.shadowRoot) {
    container.shadowRoot.appendChild(toast);
  } else if (document.body) {
    document.body.appendChild(toast);
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(6px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, durationMs);
}

/**
 * High-level export action coordinator:
 * Executes clipboard copy or file download. If clipboard copy fails for ANY reason
 * (e.g., document unfocused, user gesture expired, or permission denied),
 * it seamlessly and gracefully falls back to instant file download.
 */
export async function exportBlobWithFallback(
  blob: Blob,
  action: ExportAction = 'copy',
  customFilename?: string,
  locale?: Locale
): Promise<ExportResult> {
  const t = getTranslation(sanitizeLocale(locale));
  const filename = customFilename || `post-to-card-${Date.now()}.png`;

  if (action === 'download') {
    try {
      downloadBlobAsPng(blob, filename);
      showToast(t.downloadSuccess, false);
      return { success: true, method: 'download', filename };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(`${t.exportFailed}: ${errorMsg}`, true);
      return { success: false, method: 'download', filename, error: errorMsg };
    }
  }

  // Attempt clipboard write first
  try {
    await copyBlobToClipboard(blob);
    showToast(t.copiedSuccess, false);
    return { success: true, method: 'clipboard', filename };
  } catch (clipboardErr) {
    console.warn(
      '[Post-to-Card] Clipboard write failed; triggering graceful fallback to download:',
      clipboardErr
    );
    try {
      downloadBlobAsPng(blob, filename);
      showToast(t.clipboardFallbackNotice, false);
      return { success: true, method: 'download', filename };
    } catch (downloadErr) {
      const errorMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      showToast(`${t.exportFailed}: ${errorMsg}`, true);
      return { success: false, method: 'download', filename, error: errorMsg };
    }
  }
}
