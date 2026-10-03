/**
 * Fallback Engine: Clipboard Copy and Automatic Download Fallback.
 *
 * Provides resilient image export:
 * 1. Attempts direct copy to system clipboard via navigator.clipboard.write.
 * 2. Catches document focus loss, transient user activation expiration,
 *    and permission denials, gracefully triggering instant PNG file download.
 *
 * The outcome is returned, not announced. Whether a card reached the clipboard
 * or the downloads folder is something the caller has to show, and the caller is
 * the only one that knows how; this module used to also raise a toast of its
 * own, which meant a failed clipboard write put two messages on screen at once
 * and one of them was the wrong one.
 */

export type ExportAction = 'copy' | 'download';

export interface ExportResult {
  success: boolean;
  /** How the blob actually left the page, which is not always what was asked for. */
  method: 'clipboard' | 'download';
  filename: string;
  /** Why it did not work, when `success` is false. */
  error?: string;
}

/**
 * Downloads a binary Blob directly as a PNG file via a hidden anchor tag.
 */
export function downloadBlobAsPng(blob: Blob, filename: string = 'post-to-card.png'): void {
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
 * Carries out the requested action, falling back to a download when the
 * clipboard refuses for any reason (document unfocused, user gesture expired,
 * permission denied).
 *
 * Both failures are reported rather than thrown: falling back is the expected
 * path, not an error, and a caller that cannot tell the two apart will either
 * claim a copy that never happened or hide a download that did.
 */
export async function exportBlobWithFallback(
  blob: Blob,
  action: ExportAction = 'copy',
  customFilename?: string
): Promise<ExportResult> {
  const filename = customFilename || `post-to-card-${Date.now()}.png`;

  if (action === 'download') {
    try {
      downloadBlobAsPng(blob, filename);
      return { success: true, method: 'download', filename };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, method: 'download', filename, error: errorMsg };
    }
  }

  // Attempt clipboard write first
  try {
    await copyBlobToClipboard(blob);
    return { success: true, method: 'clipboard', filename };
  } catch (clipboardErr) {
    console.warn(
      '[Post-to-Card] Clipboard write failed; triggering graceful fallback to download:',
      clipboardErr
    );
    try {
      downloadBlobAsPng(blob, filename);
      return { success: true, method: 'download', filename };
    } catch (downloadErr) {
      const errorMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      return { success: false, method: 'download', filename, error: errorMsg };
    }
  }
}