/**
 * Export Engine: High-Resolution Rendering and Canvas CORS Protection.
 * 
 * Interacts with background service worker to convert twimg remote assets
 * into Base64 Data URLs before rasterization, preventing Canvas CORS contamination
 * (SecurityError on toBlob/toDataURL). Invokes modern-screenshot domToBlob at Retina
 * (scale: 2 or 3) resolution.
 */

import { domToBlob } from 'modern-screenshot';

export const FALLBACK_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23333333"/></svg>';

/**
 * The retina factor an export uses unless a caller passes its own.
 *
 * Named because the preview quotes the resulting pixel size to the user. The
 * number used to be written out in three places, and a readout quoting a
 * different figure than the exporter actually applied would be worse than having
 * no readout at all.
 */
export const DEFAULT_EXPORT_SCALE = 2;

/**
 * The largest canvas edge Chrome will actually allocate.
 *
 * A canvas above this fails rather than shrinking: `domToBlob` hands back
 * nothing, and the export reports a failure the user cannot act on. A long
 * thread multiplied by the retina scale reaches it -- the card is a fixed 640px
 * wide, so it is the height that grows -- which is why the scale is reduced to
 * fit rather than passed through unchecked.
 */
const MAX_CANVAS_EDGE = 16384;

export interface RenderOptions {
  scale?: number;
  backgroundColor?: string | null;
  filter?: (node: Node) => boolean;
}

/**
 * Requests the Background Service Worker to fetch and convert a remote image URL
 * into a Base64 Data URL, bypassing web-page CORS restrictions via MV3 host_permissions.
 */
export async function fetchImageAsBase64(
  url: string,
  fallbackToPlaceholder: boolean = false
): Promise<string> {
  if (!url) {
    return '';
  }

  // Already a Data URL or Blob URL, no proxying required
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Check if Chrome extension messaging is available
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    typeof chrome.runtime.sendMessage !== 'function'
  ) {
    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGE_BASE64',
      url,
    });

    if (response && response.success && typeof response.dataUrl === 'string') {
      return response.dataUrl;
    }

    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  } catch (err) {
    console.warn('[Post-to-Card] Failed to fetch image via background proxy:', err);
    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  }
}

/**
 * Traverses an element's subtree and temporarily substitutes remote image src attributes
 * with Base64 Data URLs so the HTML5 canvas remains origin-clean during modern-screenshot export.
 * Returns a restoration function to revert the DOM once snapshotting completes.
 */
export async function replaceCardImagesWithBase64(cardElement: HTMLElement): Promise<() => void> {
  const images = Array.from(cardElement.querySelectorAll('img'));
  const originalSources: Array<{ img: HTMLImageElement; originalSrc: string }> = [];
  const pending: Array<{ img: HTMLImageElement; src: string }> = [];

  for (const img of images) {
    const currentSrc = img.src || img.getAttribute('src') || '';
    if (currentSrc && !currentSrc.startsWith('data:') && !currentSrc.startsWith('blob:')) {
      originalSources.push({ img, originalSrc: currentSrc });
      pending.push({ img, src: currentSrc });
    }
  }

  // One round trip per distinct URL, not per image. A thread card repeats the
  // same avatar on every post, so the same address was being asked for once per
  // post; the in-flight promise is shared instead.
  const byUrl = new Map<string, Promise<string>>();
  const resolveSrc = (src: string): Promise<string> => {
    let inflight = byUrl.get(src);
    if (!inflight) {
      inflight = fetchImageAsBase64(src, true);
      byUrl.set(src, inflight);
    }
    return inflight;
  };

  // Bounded rather than one `Promise.all` over every image: each fetch is a
  // message to the service worker, and a media-heavy card can carry a dozen.
  // Four at a time keeps the round trips overlapping without opening all of
  // them at once.
  const CONCURRENCY = 4;
  let next = 0;
  const fill = async (): Promise<void> => {
    while (next < pending.length) {
      const item = pending[next++];
      item.img.src = await resolveSrc(item.src);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => fill())
  );

  // Wait for the swapped images to finish decoding. Only the ones this call
  // touched are waited on: an image already carrying a data URL was never
  // rewritten and has nothing to settle.
  await Promise.all(
    pending.map(async ({ img }) => {
      if (img.complete) return;
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // Continue if single image decoding fails
        }
      }
    })
  );

  return () => {
    for (const item of originalSources) {
      item.img.src = item.originalSrc;
    }
  };
}

/**
 * Mounts a copy of the card beside the content it lives in, outside any zoomed
 * ancestor, and returns it with a disposer.
 *
 * The preview scales the card with `zoom` to fit a narrow window. The
 * rasterizer lays the card out at that scaled size, so the PNG came out shrunk
 * and its footer wrapped ("Post to / Card"). Clearing `zoom` on the live
 * ancestors was not dependable: the new size was not yet visible to layout
 * when the capture read it. A copy keeps the live preview untouched and is
 * captured at the card's own width. It stays in the same root, so the card's
 * stylesheet still applies.
 */
function mountUnzoomedCopy(card: HTMLElement): { copy: HTMLElement; dispose: () => void } {
  const root = card.getRootNode();
  const host: Node = root instanceof ShadowRoot ? root : document.body;
  // The copy itself carries no positioning: the rasterizer serializes its inline
  // style, so an offset there would push the picture out of its own frame. The
  // off-screen placement lives on a wrapper the rasterizer never sees.
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText = 'position:fixed;left:-100000px;top:0;';
  const copy = card.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  wrapper.appendChild(copy);
  host.appendChild(wrapper);
  return { copy, dispose: () => wrapper.remove() };
}

/**
 * Renders the target card DOM node to a high-resolution PNG Blob.
 * Ensures the canvas remains 100% origin-clean without SecurityError.
 *
 * Two rewrites keep the canvas origin-clean and they do different jobs. The src
 * attributes on the live card are replaced first, which is what covers the
 * pictures the card is made of. The `fetchFn` below then covers anything the
 * rasterizer discovers on its own -- an image it meets inside the clone it
 * builds, such as a background it has to resolve -- which the first pass never
 * saw. A third implementation used to rewrite the TweetData model instead of
 * either; nothing reached it, because the card is rasterized from the DOM.
 */
/**
 * Reduces `scale` until the card's rasterized box fits in a canvas.
 *
 * Returns the requested scale untouched when the card has not been laid out
 * (a zero measurement, as in a headless render) -- guessing a factor there would
 * shrink exports that were never at risk.
 */
function clampScaleToCanvas(card: HTMLElement, scale: number): number {
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  if (!width || !height) return scale;

  const longestEdge = Math.max(width, height);
  const fitted = MAX_CANVAS_EDGE / longestEdge;
  if (scale <= fitted) return scale;

  // Floor rather than round, so the result is never a hair over the limit.
  const reduced = Math.max(1, Math.floor(fitted * 100) / 100);
  console.warn(
    `[Post-to-Card] Card measures ${width}x${height}; scale ${scale} would exceed the ` +
    `canvas limit, so the export uses ${reduced} instead.`
  );
  return reduced;
}

export async function renderCardToBlob(
  cardElement: HTMLElement,
  options: RenderOptions = {}
): Promise<Blob> {
  const restoreImages = await replaceCardImagesWithBase64(cardElement);
  const { copy, dispose } = mountUnzoomedCopy(cardElement);
  await Promise.all(
    Array.from(copy.querySelectorAll('img')).map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => {}) : undefined
    )
  );

  try {
    const requestedScale = options.scale ?? DEFAULT_EXPORT_SCALE;
    const scale = clampScaleToCanvas(copy, requestedScale);
    const backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : null;

    const filter = (node: Node): boolean => {
      if (node instanceof HTMLElement) {
        // `data-html2canvas-ignore` is the attribute the card actually emits
        // (the html2canvas convention). `data-export-ignore` is kept as an
        // alias so either spelling works.
        if (
          node.getAttribute('data-html2canvas-ignore') === 'true' ||
          node.getAttribute('data-export-ignore') === 'true' ||
          node.dataset?.exportIgnore === 'true'
        ) {
          return false;
        }
      }
      if (options.filter) {
        return options.filter(node);
      }
      return true;
    };

    const blob = await domToBlob(copy, {
      scale,
      type: 'image/png',
      backgroundColor,
      features: {
        copyScrollbar: false,
        removeAbnormalAttributes: true,
        removeControlCharacter: true,
      },
      filter,
      fetchFn: async (url: string) => {
        const dataUrl = await fetchImageAsBase64(url, true);
        return dataUrl.startsWith('data:') ? dataUrl : false;
      },
    });

    if (!blob) {
      throw new Error('Screenshot engine produced an empty blob.');
    }

    return blob;
  } finally {
    dispose();
    restoreImages();
  }
}

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
  const { action = 'copy', scale = DEFAULT_EXPORT_SCALE, filename, render } = options;

  const blob = await renderCardToBlob(cardElement, { scale, ...render });
  return exportBlobWithFallback(blob, action, filename);
}
