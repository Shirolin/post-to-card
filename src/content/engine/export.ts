/**
 * Export Engine: High-Resolution Rendering and Canvas CORS Protection.
 * 
 * Interacts with background service worker to convert twimg remote assets
 * into Base64 Data URLs before rasterization, preventing Canvas CORS contamination
 * (SecurityError on toBlob/toDataURL). Invokes modern-screenshot domToBlob at Retina
 * (scale: 2 or 3) resolution.
 */

import { domToBlob } from 'modern-screenshot';
import type { ExtensionResponse } from '../../types/messages.ts';
import { DEFAULT_AVATAR_SRC } from '../ui/imageFallback.ts';
import { fitScaleToCanvas, type ScaleFit } from './scale.ts';

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

/** One `<img>` URL the proxy could not turn into a data URL. */
export interface ImageLoadFailure {
  /** The original remote address, never the placeholder that replaced it. */
  url: string;
  /** How many `<img>` elements in the card point at it. */
  occurrences: number;
}

export interface RenderReport {
  requestedScale: number;
  /** What the rasterizer actually used; below `requestedScale` when clamped. */
  appliedScale: number;
  scaleReduced: boolean;
  /** Zero when the card has not been laid out, as in a headless render. */
  cardWidth: number;
  cardHeight: number;
  imageFailures: ImageLoadFailure[];
  failedImageCount: number;
}

export interface RenderOptions {
  scale?: number;
  backgroundColor?: string | null;
  filter?: (node: Node) => boolean;
  /**
   * Called once, after the card is measured and before it is rasterized.
   *
   * A callback rather than a return field because `renderCardToBlob`'s return
   * type is a public contract with tests and callers that only want the blob,
   * and because the details are needed on both the success and the failure
   * path -- an export that throws after clamping still changed the scale.
   * Throwing from it is swallowed: reporting must not be able to break an
   * export.
   */
  report?: (report: RenderReport) => void;
}

/**
 * One image's journey through the proxy, with the outcome kept separate from
 * the bytes.
 *
 * The exporter has to know *whether* a picture was fetched, and the canvas has
 * to be given *something* either way. Returning only the string conflated the
 * two: a failed fetch became a grey square, and the only way to notice later
 * was to compare the picture against the placeholder -- which is wrong as soon
 * as a tweet legitimately contains that grey square, and couples the report to
 * an implementation constant.
 */
export type ImageFetchResult =
  | { ok: true; src: string }
  | { ok: false; src: string };

/**
 * How many times one picture is asked for before it is given up on.
 *
 * The proxy is a message to the MV3 service worker, and that channel fails for
 * reasons that have nothing to do with the picture: the worker is evicted while
 * the fetches are still in flight, the extension is reloading, the port closes.
 * Every picture on the card shares the one worker, so a single eviction takes
 * the whole card grey at once -- which is what "5 张配图未能加载" on an otherwise
 * successful export was. The first ask is also what starts the worker, so a
 * second one usually finds it awake and answers.
 */
const IMAGE_FETCH_ATTEMPTS = 3;

/**
 * Waits before re-asking, growing with the attempt number.
 *
 * A worker that has just been torn down needs a moment before it is reachable
 * again; an immediate retry lands in the same closed port. Kept in the
 * hundreds of milliseconds because the user is watching this export finish.
 */
const IMAGE_FETCH_BACKOFF_MS = 200;

/** Waits before re-asking the worker. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Requests the Background Service Worker to fetch and convert a remote image URL
 * into a Base64 Data URL, bypassing web-page CORS restrictions via MV3 host_permissions.
 *
 * A failure is re-asked only when a second ask could plausibly land differently:
 * a message that reached no worker, or an answer the proxy itself marked
 * retryable. An answer it did not mark -- a 404, a forbidden origin -- is final,
 * because re-asking a picture that is not there adds a round trip to every
 * genuinely missing one and delays the export the user is waiting on.
 */
export async function resolveImageForExport(url: string): Promise<ImageFetchResult> {
  if (!url) {
    return { ok: true, src: '' };
  }

  // Already a Data URL or Blob URL, no proxying required
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return { ok: true, src: url };
  }

  // Check if Chrome extension messaging is available
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    typeof chrome.runtime.sendMessage !== 'function'
  ) {
    return { ok: false, src: FALLBACK_PLACEHOLDER_DATA_URL };
  }

  for (let attempt = 1; ; attempt++) {
    // A response the proxy sent is a verdict on the picture, and only the proxy
    // saw enough to know whether the network might change its mind. Everything
    // else -- a throw, or the `undefined` Chrome hands back when no listener
    // answered -- is a lost message that reached no network at all.
    let retryable = true;
    let failure: unknown = 'no response';

    try {
      const response: ExtensionResponse | undefined = await chrome.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url,
      });

      if (response && response.success) {
        if (typeof response.dataUrl === 'string') {
          return { ok: true, src: response.dataUrl };
        }
        // A success carrying no data URL learned nothing about the picture, so
        // it is a malformed answer rather than a verdict and stays retryable,
        // like a message that never arrived.
        failure = 'success response without a data URL';
      } else if (response) {
        retryable = response.retryable;
        failure = response.error;
      }
    } catch (err) {
      // A closed port or an unreachable worker arrives here.
      failure = err;
    }

    if (!retryable || attempt >= IMAGE_FETCH_ATTEMPTS) {
      console.warn(
        `[Post-to-Card] The background proxy could not deliver ${url} after ` +
        `${attempt} ${attempt === 1 ? 'attempt' : 'attempts'}:`,
        failure
      );
      return { ok: false, src: FALLBACK_PLACEHOLDER_DATA_URL };
    }

    await delay(IMAGE_FETCH_BACKOFF_MS * attempt);
  }
}

/**
 * The string-only shape the rest of the engine and its tests already use.
 *
 * `fallbackToPlaceholder: false` keeps the original address on failure, which
 * is what the rasterizer's `fetchFn` needs in order to be told `false` and try
 * the URL itself. The failure is still reported by `resolveImageForExport`
 * where that matters.
 */
export async function fetchImageAsBase64(
  url: string,
  fallbackToPlaceholder: boolean = false
): Promise<string> {
  const result = await resolveImageForExport(url);
  if (result.ok) return result.src;
  return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
}

export interface CardImagePreparation {
  /** Always safe to call, and safe to call after a partial preparation. */
  restore: () => void;
  /** One entry per distinct URL the proxy could not fetch. */
  failures: ImageLoadFailure[];
  /** `occurrences` summed: the number of visible pictures that will be grey. */
  failedImageCount: number;
}

/**
 * What a picture is left showing in the export once the proxy could not
 * deliver it.
 *
 * A media picture gets the neutral placeholder: the rasterizer has to draw
 * something in its box, and a missing picture is information the reader wants.
 * An avatar has a designed state of its own -- the silhouette the card renders
 * for an author with no picture -- and a dark grey square is not it.
 */
function failedImageSrc(img: HTMLImageElement): string {
  const className = img.getAttribute('class') || '';
  return /\bauthor-avatar-img\b|\bquote-avatar\b/.test(className)
    ? DEFAULT_AVATAR_SRC
    : FALLBACK_PLACEHOLDER_DATA_URL;
}

/**
 * Traverses an element's subtree and temporarily substitutes remote image src
 * attributes with Base64 Data URLs so the HTML5 canvas remains origin-clean
 * during modern-screenshot export, reporting which ones could not be fetched.
 *
 * Both facts are needed, so both come back. The card is restored by the caller
 * in a `finally`; a preparation that fails part-way restores what it already
 * changed before rethrowing, so a thrown error never leaves data URLs on the
 * live card.
 */
export async function prepareCardImages(cardElement: HTMLElement): Promise<CardImagePreparation> {
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

  const restore = () => {
    for (const item of originalSources) {
      // One detached node must not strand the rest of the card on data URLs.
      try {
        item.img.src = item.originalSrc;
      } catch {
        // Nothing to restore on a node that can no longer take a src.
      }
    }
  };

  // One round trip per distinct URL, not per image. A thread card repeats the
  // same avatar on every post, so the same address was being asked for once per
  // post; the in-flight promise is shared instead.
  const byUrl = new Map<string, Promise<ImageFetchResult>>();
  const resolveSrc = (src: string): Promise<ImageFetchResult> => {
    let inflight = byUrl.get(src);
    if (!inflight) {
      inflight = resolveImageForExport(src);
      byUrl.set(src, inflight);
    }
    return inflight;
  };

  // Counted per `<img>`, not per URL: two pictures of the same avatar that both
  // failed are two grey squares on the card.
  const occurrencesByUrl = new Map<string, number>();
  for (const item of pending) {
    occurrencesByUrl.set(item.src, (occurrencesByUrl.get(item.src) ?? 0) + 1);
  }
  const failedUrls = new Set<string>();

  // Bounded rather than one `Promise.all` over every image: each fetch is a
  // message to the service worker, and a media-heavy card can carry a dozen.
  // Four at a time keeps the round trips overlapping without opening all of
  // them at once.
  const CONCURRENCY = 4;
  let next = 0;
  const fill = async (): Promise<void> => {
    while (next < pending.length) {
      const item = pending[next++];
      const result = await resolveSrc(item.src);
      if (!result.ok) failedUrls.add(item.src);
      item.img.src = result.ok ? result.src : failedImageSrc(item.img);
    }
  };

  try {
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
  } catch (err) {
    restore();
    throw err;
  }

  const failures: ImageLoadFailure[] = Array.from(failedUrls, (url) => ({
    url,
    occurrences: occurrencesByUrl.get(url) ?? 1,
  }));

  return {
    restore,
    failures,
    failedImageCount: failures.reduce((sum, failure) => sum + failure.occurrences, 0),
  };
}

/**
 * The original string-returning shape, kept for callers that only need the
 * restoration handle (the engine's own tests among them).
 */
export async function replaceCardImagesWithBase64(cardElement: HTMLElement): Promise<() => void> {
  const preparation = await prepareCardImages(cardElement);
  return preparation.restore;
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

/** The 8 bytes every PNG starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Whether the blob actually begins with a PNG.
 *
 * The rasterizer can return a truthy, `image/png`-typed Blob with no picture in
 * it, in two shapes: empty at scale 1, and a 54-byte header written over an
 * empty source at every other scale. Both fail this check; a real PNG, however
 * small, passes it.
 */
async function looksLikePng(blob: Blob): Promise<boolean> {
  if (blob.size < PNG_SIGNATURE.length) return false;
  const head = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  return PNG_SIGNATURE.every((byte, index) => head[index] === byte);
}

/**
 * Measures the card and applies the canvas limit, logging when it bites.
 *
 * The arithmetic lives in `scale.ts` because the preview quotes the same
 * figure; this wrapper exists only to read the element and to warn, and the
 * warning stays here rather than in the pure function so the preview does not
 * log it on every render.
 */
function measureAndFit(card: HTMLElement, requested: number): ScaleFit {
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const fit = fitScaleToCanvas({ width, height }, requested);
  if (fit.impossible) {
    console.warn(
      `[Post-to-Card] Card measures ${width}x${height}; that is taller than the ` +
      `canvas edge limit, so no scale can export it.`
    );
  } else if (fit.reduced) {
    console.warn(
      `[Post-to-Card] Card measures ${width}x${height}; scale ${requested} would exceed the ` +
      `canvas limit, so the export uses ${fit.applied} instead.`
    );
  }
  return fit;
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
export async function renderCardToBlob(
  cardElement: HTMLElement,
  options: RenderOptions = {}
): Promise<Blob> {
  // Prepared before the `try` that owns the restoration, and restored in the
  // same `finally` as the copy's disposal: mounting the copy can throw (a
  // detached card, a hostile document), and that used to leave the live card
  // holding data URLs until the next export.
  const preparation = await prepareCardImages(cardElement);
  let dispose: (() => void) | null = null;

  try {
    const mounted = mountUnzoomedCopy(cardElement);
    const copy = mounted.copy;
    dispose = mounted.dispose;

    await Promise.all(
      Array.from(copy.querySelectorAll('img')).map((img) =>
        typeof img.decode === 'function' ? img.decode().catch(() => {}) : undefined
      )
    );

    const requestedScale = options.scale ?? DEFAULT_EXPORT_SCALE;
    const fit = measureAndFit(copy, requestedScale);
    const scale = fit.applied;
    const backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : null;

    // A card over the edge limit cannot be rasterized at any scale, and the
    // browser's own failure for it is a zero-byte blob. Refusing here says why,
    // and stops the UI from retrying a click that can never succeed.
    if (fit.impossible) {
      throw new ExportRenderError(
        'too-tall',
        'The card is taller than the largest canvas, so it cannot be exported at any scale.'
      );
    }

    if (options.report) {
      try {
        options.report({
          requestedScale,
          appliedScale: scale,
          scaleReduced: fit.reduced,
          cardWidth: copy.offsetWidth,
          cardHeight: copy.offsetHeight,
          imageFailures: preparation.failures,
          failedImageCount: preparation.failedImageCount,
        });
      } catch {
        // Reporting is a courtesy; it may not break the export.
      }
    }

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
      throw new ExportRenderError('rasterizer', 'Screenshot engine produced an empty blob.');
    }

    // An unallocatable canvas comes back as a Blob that is truthy but holds no
    // picture, so the check above lets it through. `size === 0` is not the
    // test: that is only what `toDataURL`'s `data:,` fallback decodes to at
    // scale 1. At every other scale `domToBlob` runs the blob through
    // `changePngDpi`, which rebuilds it from a 54-byte header written over an
    // empty source -- 54 bytes, `image/png`, and no PNG signature. Asking
    // whether the bytes are a PNG covers both shapes, and does not guess from
    // the length.
    if (!(await looksLikePng(blob))) {
      throw new ExportRenderError(
        'empty-blob',
        'Screenshot engine produced an empty image; the card is probably too tall for a canvas.'
      );
    }

    return blob;
  } finally {
    dispose?.();
    preparation.restore();
  }
}

export type ExportRenderErrorCode = 'empty-blob' | 'rasterizer' | 'too-tall';

/**
 * Distinguishes "the rasterizer did not give us a picture" from every other
 * failure, so the UI can say something actionable instead of printing the
 * engine's English sentence into a Chinese status line.
 */
export class ExportRenderError extends Error {
  // Assigned in the body rather than as a constructor parameter property:
  // Node's strip-only TypeScript loader does not support those.
  readonly code: ExportRenderErrorCode;

  constructor(code: ExportRenderErrorCode, message: string) {
    super(message);
    this.name = 'ExportRenderError';
    this.code = code;
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

  // Everything below is optional and was added so the UI can tell a clean
  // export from one that "succeeded" with grey squares or a reduced scale.
  // Absent on results produced by callers that only pass a blob.

  /** Distinct URLs the proxy failed to fetch, and how many `<img>` each covers. */
  degradedImages?: ImageLoadFailure[];
  /** Summed occurrences: the number of pictures that render as placeholders. */
  degradedImageCount?: number;
  requestedScale?: number;
  appliedScale?: number;
  /** True when the canvas limit forced `appliedScale` below `requestedScale`. */
  scaleReduced?: boolean;

  /** Present only when a copy was refused and the blob went to a download. */
  clipboardFailure?: ClipboardFailureReason;
  /** The underlying clipboard error, for logs and details. */
  clipboardError?: string;
}

export type ClipboardFailureReason =
  | 'unsupported'
  | 'permission'
  | 'unfocused-or-gesture'
  | 'other';

export interface ClipboardFailure {
  reason: ClipboardFailureReason;
  message: string;
}

/** Thrown when the environment has no image-capable clipboard at all. */
export class ClipboardUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipboardUnsupportedError';
  }
}

const UNFOCUSED_OR_GESTURE_PATTERNS = [
  'not focused',
  'document is not focused',
  'user gesture',
  'handling a user gesture',
  'transient activation',
  'user activation',
];
const PERMISSION_PATTERNS = ['permission denied', 'permissions policy', 'denied by the user'];

/**
 * Names why a clipboard write was refused, without guessing.
 *
 * The browser reports focus loss and an expired gesture with the same
 * `NotAllowedError`, so those two are one bucket; only a message that says
 * "permission" is called a permission problem. Everything else -- including a
 * bare `NotAllowedError`, which can come from any of the cases above -- stays
 * `other`, because a wrong specific claim is worse than a vague true one.
 * Never throws: it runs inside a catch handler.
 */
export function classifyClipboardFailure(err: unknown): ClipboardFailure {
  // Every property read is guarded: this runs inside a catch handler, and a
  // hostile getter throwing here would replace the original failure with a
  // second, unrelated one.
  let message = '';
  let name = '';
  try {
    if (err instanceof Error) {
      message = err.message;
      name = err.name;
    } else {
      message = String(err ?? '');
    }
  } catch {
    message = '';
  }

  const haystack = `${name} ${message}`.toLowerCase();

  if (err instanceof ClipboardUnsupportedError) {
    return { reason: 'unsupported', message };
  }
  if (UNFOCUSED_OR_GESTURE_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return { reason: 'unfocused-or-gesture', message };
  }
  if (PERMISSION_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return { reason: 'permission', message };
  }
  return { reason: 'other', message };
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
    throw new ClipboardUnsupportedError('Clipboard API is not supported in this environment.');
  }

  if (typeof ClipboardItem === 'undefined') {
    throw new ClipboardUnsupportedError('ClipboardItem is not supported in this environment.');
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
    // The reason travels with the result, but it does not change the verdict:
    // the blob left the page, which is what `success` has always meant here.
    const failure = classifyClipboardFailure(clipboardErr);
    try {
      downloadBlobAsPng(blob, filename);
      return {
        success: true,
        method: 'download',
        filename,
        clipboardFailure: failure.reason,
        clipboardError: failure.message,
      };
    } catch (downloadErr) {
      const errorMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      return {
        success: false,
        method: 'download',
        filename,
        error: errorMsg,
        clipboardFailure: failure.reason,
        clipboardError: failure.message,
      };
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

  let report: RenderReport | null = null;
  const blob = await renderCardToBlob(cardElement, {
    scale,
    ...render,
    // After the spread, so a caller-supplied `render` cannot silently drop the
    // reporting this function is responsible for.
    report: (next) => {
      report = next;
    },
  });
  const result = await exportBlobWithFallback(blob, action, filename);

  if (!report) return result;
  const captured: RenderReport = report;
  return {
    ...result,
    degradedImages: captured.imageFailures,
    degradedImageCount: captured.failedImageCount,
    requestedScale: captured.requestedScale,
    appliedScale: captured.appliedScale,
    scaleReduced: captured.scaleReduced,
  };
}
