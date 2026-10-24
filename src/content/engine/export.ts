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
import { IMAGE_PROXY_BUDGET_MS } from '../../background/proxy.ts';
import { DEFAULT_AVATAR_SRC, EXPORT_SWAP_ATTR } from '../ui/imageFallback.ts';
import {
  defaultExportScale,
  fitScaleToCanvas,
  type ScaleFit,
} from './scale.ts';

export const FALLBACK_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23333333"/></svg>';

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
  /** `preferHighResolution` from the user's preferences, possibly still loading. */
  preferHighResolution?: boolean | Promise<boolean>;
  /** Measure only: no rasterizing, and `CardRender.blob` is null. */
  geometryOnly?: boolean;
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
 * Gives one picture whatever is left of the card's fetch budget, and no more.
 *
 * A picture that runs out of budget is drawn as the placeholder, like one the
 * proxy refused: the export finishes with a grey square the user can see and
 * retry, instead of a copy that never returns.
 */
async function withinBudget(
  fetch: Promise<ImageFetchResult>,
  startedAt: number
): Promise<ImageFetchResult> {
  const remaining = IMAGE_PROXY_BUDGET_MS - (Date.now() - startedAt);
  if (remaining <= 0) return { ok: false, src: FALLBACK_PLACEHOLDER_DATA_URL };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const expired = new Promise<ImageFetchResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, src: FALLBACK_PLACEHOLDER_DATA_URL }), remaining);
  });
  try {
    return await Promise.race([fetch, expired]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
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
 * The attributes a card uses to mark preview-only furniture -- the exclude
 * button, a picture's waiting block, the blurred stand-in inside it.
 *
 * Two spellings because the card emits html2canvas's convention and keeps the
 * older name working; the rasterizer's filter accepts both.
 */
const IGNORE_ATTRS = ['data-html2canvas-ignore', 'data-export-ignore'] as const;

function marksIgnored(node: Element): boolean {
  return IGNORE_ATTRS.some((attr) => node.getAttribute(attr) === 'true');
}

/**
 * Whether `node` sits inside an ignored node, looking only as far up as `root`.
 *
 * The bound matters: the preview shell around the card is marked as ignored
 * furniture, so an unbounded `closest()` would report every picture in the card
 * as ignored.
 */
function insideIgnoredNode(node: Element, root: Element): boolean {
  for (let current: Element | null = node; current && current !== root; current = current.parentElement) {
    if (marksIgnored(current)) return true;
  }
  return false;
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
  // A node the rasterizer drops is not a picture on the card: preparing it would
  // spend a fetch on it and, when that fetch failed, count a grey square that
  // never reaches the PNG. That is exactly what the media placeholder's blurred
  // copy is -- a preview the export deliberately leaves out (`Card` mounts it
  // under `data-html2canvas-ignore`).
  //
  // The walk stops at the card: the preview shell *around* the card is marked
  // too (it is app furniture the rasterizer never receives), and `closest()`
  // would read that ancestor as if it marked the card's own pictures.
  const images = Array.from(cardElement.querySelectorAll('img')).filter(
    (img) => !insideIgnoredNode(img, cardElement)
  );
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
      // Cleared after the src is back, so the card's own handlers see the
      // picture as its own again from the moment the restore lands. That order
      // is safe because every stand-in load has already been dispatched: the
      // caller only gets this disposer once `prepareCardImages` has awaited each
      // swapped image's `decode()`. The one path where it is not guaranteed is a
      // preparation that threw mid-swap -- and there the card is being torn down
      // anyway.
      item.img.removeAttribute(EXPORT_SWAP_ATTR);
    }
  };

  // One round trip per distinct URL, not per image. A thread card repeats the
  // same avatar on every post, so the same address was being asked for once per
  // post; the in-flight promise is shared instead -- and the whole card shares
  // one deadline, so a worker that never answers costs the export a placeholder
  // rather than a button that never comes back.
  const startedAt = Date.now();
  const byUrl = new Map<string, Promise<ImageFetchResult>>();
  const resolveSrc = async (src: string): Promise<ImageFetchResult> => {
    let inflight = byUrl.get(src);
    if (!inflight) {
      inflight = withinBudget(resolveImageForExport(src), startedAt);
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
      // Marked before the write: the load this triggers is the stand-in
      // decoding, not the picture arriving, and the card must not take it for
      // an arrival (see `EXPORT_SWAP_ATTR`).
      item.img.setAttribute(EXPORT_SWAP_ATTR, 'true');
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
  const render = beginCardRender(cardElement, options);
  // Nothing may be left unhandled when the caller stops caring; the render still
  // runs to its end, which is what tears the copy down and restores the card.
  ignoreRejection(render);
  const blob = await (await render).blob;
  // A measurement was asked for, not a picture.
  if (!blob) {
    throw new ExportRenderError('rasterizer', 'The render was measured but never rasterized.');
  }
  return blob;
}

/**
 * What an export looks like the instant it is asked for.
 *
 * `blob` joins the object only when the picture exists -- it is the promise the
 * clipboard holds -- so the object itself resolves with the measurement. Both
 * settle the same tick, and the render is already under way by then: the
 * clipboard was claimed at the click, not here. That is why this splits in two.
 */
export interface CardRender extends RenderReport {
  /** The picture. Rejects only when the export failed; never when it degraded. */
  blob: Promise<Blob | null> | null;
}

/**
 * Prepares and starts a render, resolving once the card has been measured.
 *
 * Rendering is dominated by fetching and encoding the pictures, so everything
 * the canvas will need runs ahead: the rasterization has started when this
 * returns. With `geometryOnly` the DOM is rewritten and restored but no canvas
 * is built, which is what makes a size readout cheap enough to ask for on every
 * resize; those renders settle with `blob` null, as does one that gave up early.
 */
export async function beginCardRender(
  cardElement: HTMLElement,
  options: RenderOptions = {}
): Promise<CardRender> {
  const geometryOnly = options.geometryOnly === true;

  // Prepared before the rasterizing `try`: mounting the copy can throw (a
  // detached card, a hostile document), and that used to leave the live card
  // holding data URLs until the next export.
  let preparation: CardImagePreparation;
  try {
    preparation = await prepareCardImages(cardElement);
  } catch (err) {
    throw new ExportRenderError('rasterizer', describeError(err), err);
  }
  // The restoration lives inside the render, not in a `finally` around it: a
  // caller that hands the picture to the clipboard and returns would otherwise
  // put the remote sources back on the live card before the rasterizer drew it.
  const render = mountAndRender(cardElement, preparation, options, geometryOnly);
  return render.measured;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The scale an export passes to the rasterizer, decided from one measurement. */
async function scaleFor(
  copy: HTMLElement,
  options: RenderOptions
): Promise<{ requested: number; fit: ScaleFit }> {
  const requestedScale =
    options.scale ??
    defaultExportScale(
      { width: copy.offsetWidth, height: copy.offsetHeight },
      { preferHighResolution: await preferHighResolutionOf(options.preferHighResolution) }
    );
  return { requested: requestedScale, fit: measureAndFit(copy, requestedScale) };
}

/**
 * The preference, whether it arrived as a value or as a read in progress.
 *
 * A read that fails is a user who never turned the setting on, which is the
 * safe reading: the default keeps a lone post at the sharp scale and a thread at
 * the one X shows whole.
 */
async function preferHighResolutionOf(prefer: RenderOptions['preferHighResolution']): Promise<boolean> {
  try {
    return (await prefer) === true;
  } catch {
    return false;
  }
}

/**
 * The measurement, and the rasterization that starts the moment it is known.
 *
 * The object resolves with the picture already attached, so the clipboard can be
 * handed one promise instead of waiting seconds for a thread. A render that
 * fails resolves with the failure on that promise rather than rejecting twice.
 */
function mountAndRender(
  cardElement: HTMLElement,
  preparation: CardImagePreparation,
  options: RenderOptions,
  geometryOnly: boolean
): { measured: Promise<CardRender> } {
  let resolveObject: ((render: CardRender) => void) | null = null;
  let rejectObject: ((err: unknown) => void) | null = null;
  const resolved = (render: CardRender): void => {
    const done = resolveObject;
    resolveObject = null;
    rejectObject = null;
    done?.(render);
  };
  const rejected = (err: unknown): void => {
    const done = rejectObject;
    resolveObject = null;
    rejectObject = null;
    done?.(err);
  };
  let lastReport: RenderReport = {
    requestedScale: 0,
    appliedScale: 0,
    scaleReduced: false,
    cardWidth: 0,
    cardHeight: 0,
    imageFailures: [],
    failedImageCount: 0,
  };
  const measured = new Promise<CardRender>((resolve, reject) => {
    resolveObject = resolve;
    rejectObject = reject;
  });

  const run = (async (): Promise<Blob | null> => {
    let mounted: { copy: HTMLElement; dispose: () => void } | null = null;
    try {
      mounted = mountUnzoomedCopy(cardElement);
      const copy = mounted.copy;

      // Nodes the rasterizer would drop are dropped from the copy too. They are
      // preview-only overlays (the exclude button, a picture's waiting block and
      // its blurred stand-in), so removing them costs no layout, and it keeps
      // their sources out of the decode wait below and out of the copy the
      // rasterizer is handed.
      for (const ignored of Array.from(
        copy.querySelectorAll(IGNORE_ATTRS.map((attr) => `[${attr}="true"]`).join(', '))
      )) {
        ignored.remove();
      }

      await Promise.all(
        Array.from(copy.querySelectorAll('img')).map((img) =>
          typeof img.decode === 'function' ? img.decode().catch(() => {}) : undefined
        )
      );

      const { requested: scaleRequested, fit } = await scaleFor(copy, options);
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

      const report: RenderReport = {
        requestedScale: scaleRequested,
        appliedScale: scale,
        scaleReduced: fit.reduced,
        cardWidth: copy.offsetWidth,
        cardHeight: copy.offsetHeight,
        imageFailures: preparation.failures,
        failedImageCount: preparation.failedImageCount,
      };
      lastReport = report;
      if (options.report) {
        try {
          options.report(report);
        } catch {
          // Reporting is a courtesy; it may not break the export.
        }
      }

      if (geometryOnly) {
        resolved({ ...report, blob: null });
        return null;
      }

      const filter = (node: Node): boolean => {
        if (node instanceof HTMLElement) {
          // `data-html2canvas-ignore` is the attribute the card actually emits
          // (the html2canvas convention). `data-export-ignore` is kept as an
          // alias so either spelling works.
          if (marksIgnored(node)) return false;
        }
        if (options.filter) {
          return options.filter(node);
        }
        return true;
      };

      return await verifyRenderedBlob(
        await domToBlob(copy, {
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
            // The same rule the card's own pictures follow: a picture the proxy
            // could not deliver is drawn as the placeholder rather than left to
            // fail against the canvas. A blob URL is the rasterizer's to fetch,
            // and the proxy never sees one.
            const result = await resolveImageForExport(url);
            const src = result.ok ? result.src : FALLBACK_PLACEHOLDER_DATA_URL;
            return src.startsWith('data:') ? src : false;
          },
        })
      );
    } catch (err) {
      // Everything else -- the decode pass, a too-tall card, the rasterizer --
      // settles `measured` here, so a caller awaiting the measurement hears
      // about it instead of waiting for a promise nobody will resolve.
      rejected(err);
      throw err;
    } finally {
      // The copy leaves first: the rasterizer has one last look at it, and a
      // dispose that threw must not be the reason the live card keeps its data
      // URLs. The copy's own wrapper is `position: fixed` and off-screen, so a
      // copy that outlives this call cannot shift anything the user sees.
      try {
        mounted?.dispose();
      } finally {
        preparation.restore();
      }
    }
  })();

  // The picture joins the object as soon as it exists, so the clipboard holds one
  // promise whatever the render's timing. A failure rejects that promise -- once,
  // to the one caller that awaits it -- while the object itself resolves, so a
  // caller that only wanted the size hears nothing about a picture it never asked
  // for.
  const published = new Promise<Blob | null>((resolve, reject) => {
    run.then(
      (picture) => {
        resolved({ ...lastReport, blob: published });
        resolve(picture);
      },
      (err) => {
        resolve(null);
        rejected(err);
        reject(err);
      }
    );
  });
  ignoreRejection(published);

  return { measured };
}

/**
 * Rejects when the rasterizer handed back something without a picture in it.
 *
 * An unallocatable canvas comes back as a Blob that is truthy but holds no
 * picture: empty at scale 1, and at every other scale `domToBlob` runs the blob
 * through `changePngDpi`, which rebuilds it from a 54-byte header written over
 * an empty source -- 54 bytes, `image/png`, and no PNG signature. Asking whether
 * the bytes are a PNG covers both shapes, and does not guess from the length.
 */
async function verifyRenderedBlob(blob: Blob | null): Promise<Blob> {
  if (!blob) {
    throw new ExportRenderError('rasterizer', 'Screenshot engine produced an empty blob.');
  }
  if (!(await looksLikePng(blob))) {
    throw new ExportRenderError(
      'empty-blob',
      'Screenshot engine produced an empty image; the card is probably too tall for a canvas.'
    );
  }
  return blob;
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

  /** The failure behind this one, when it wrapped another. */
  readonly cause?: unknown;

  constructor(code: ExportRenderErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ExportRenderError';
    this.code = code;
    this.cause = cause;
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
  /** The card never produced a picture; the download is the file that failed. */
  | 'artwork'
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
 * Whether this environment can put an image on the clipboard at all.
 *
 * Checked before a render rather than after it: a browser without the API would
 * otherwise make the user wait for a picture it is only going to download.
 */
export function canUseImageClipboard(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.clipboard) &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

/**
 * A picture on its way to a clipboard: whatever came of the render, and the
 * write that took it (or did not).
 *
 * The failure travels as data rather than only as a rejection. A rejection is
 * consumed the moment it is awaited, so a caller that asks for the refusal first
 * would open an already-settled promise -- and the reason the picture never
 * existed would reach the panel as the browser's complaint instead of the
 * card's. `failure` holds it, typed, whatever the order the two settle in.
 */
export interface ClipboardWriteHandle {
  /** Settles when the clipboard has the picture, or rejects with the refusal. */
  written: Promise<void>;
  picture: Promise<
    | { blob: Blob; failure: null }
    | { blob: null; failure: unknown }
  >;
}

/**
 * Starts the clipboard write now, with a picture that does not exist yet.
 *
 * This is the whole reason an export is split in two. Chromium grants
 * `clipboard.write` on transient activation, and the activation is gone long
 * before a thread has finished rasterizing -- which is why long exports used to
 * end in a download. Calling this synchronously from the click spends the
 * activation on the call itself; the promise is filled in behind it, which is
 * what a promise-valued `ClipboardItem` is for.
 *
 * The item carries exactly one representation, because Chromium and Firefox
 * both ignore or reject a write holding more than one. `image/png` as the key is
 * not a guess: the keys must be stated before the data exists, and this engine
 * only ever produces PNG.
 *
 * Throws `ClipboardUnsupportedError` in this tick, before any item is built, so
 * a caller can decide to render for a download instead of for nothing.
 */
export function beginClipboardWrite(render: Promise<CardRender>): ClipboardWriteHandle {
  if (!canUseImageClipboard()) {
    throw new ClipboardUnsupportedError('Clipboard API is not supported in this environment.');
  }

  const picture = pictureOf(render);
  const item = new ClipboardItem({ 'image/png': conformForClipboard(picture) });
  const written = navigator.clipboard.write([item]);
  // A caller waits on both, but neither may go unobserved while it waits: an
  // unobserved rejection is the warning this path exists to keep out of the
  // console.
  ignoreRejection(written);
  return { written, picture };
}

/**
 * The picture, with a render's failure kept as a value.
 *
 * A rejected `ClipboardItem` field is the one way a copy can fail with nothing
 * to catch: the item is built at the click, the rejection may happen while the
 * clipboard is still holding it, and the caller only awaits `write()`. Conforming
 * to the promise arrives at a refusal, which falls back to a download like every
 * other one.
 */
function conformForClipboard(
  picture: ClipboardWriteHandle['picture']
): Promise<Blob> {
  // The picture's own failure is kept on `failure`, so the promise the clipboard
  // reads is a fresh rejection that only this closure hands out. Marking it
  // observed here is what keeps a card that never rendered from printing
  // "Unhandled promise rejection" while the panel reports it in words.
  const content = picture.then((settled) => {
    if (!settled.blob) throw settled.failure;
    return settled.blob;
  });
  ignoreRejection(content);
  return content;
}

/**
 * The render's picture as a value, never a rejection.
 *
 * The render's own failure is what the panel has to print -- "the screenshot
 * engine produced an empty image", not "the clipboard refused" -- so it travels
 * on `failure` rather than being consumed as a rejection the moment it is
 * awaited.
 */
function pictureOf(render: Promise<CardRender>): ClipboardWriteHandle['picture'] {
  const settled = render.then(
    (started) =>
      (started.blob ?? Promise.reject(new Error('no picture was rendered'))).then(
        (blob) => ({ blob, failure: null }),
        (failure: unknown) => ({ blob: null, failure })
      )
  );
  ignoreRejection(settled);
  return settled;
}

/** Marks a promise as observed, for one whose failure is handled elsewhere. */
export function ignoreRejection(promise: Promise<unknown>): void {
  promise.catch(() => {});
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
    return deliverDownload(blob, filename, null);
  }

  // Attempt clipboard write first
  try {
    // A direct copy, not `beginClipboardWrite`: this function is handed bytes
    // that already exist, so there is nothing to claim the clipboard ahead of.
    if (!canUseImageClipboard()) {
      throw new ClipboardUnsupportedError('Clipboard API is not supported in this environment.');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { success: true, method: 'clipboard', filename };
  } catch (clipboardErr) {
    console.warn(
      '[Post-to-Card] Clipboard write failed; triggering graceful fallback to download:',
      clipboardErr
    );
    // The reason travels with the result, but it does not change the verdict:
    // the blob left the page, which is what `success` has always meant here.
    return deliverDownload(blob, filename, classifyClipboardFailure(clipboardErr));
  }
}

/** Puts the blob in the downloads folder, carrying whatever refused it first. */
function deliverDownload(
  blob: Blob,
  filename: string,
  refusal: ClipboardFailure | null
): ExportResult {
  const carried = refusal
    ? { clipboardFailure: refusal.reason, clipboardError: refusal.message }
    : {};
  try {
    downloadBlobAsPng(blob, filename);
    return { success: true, method: 'download', filename, ...carried };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, method: 'download', filename, error: errorMsg, ...carried };
  }
}

export interface ExportCardOptions {
  /** Where the card should go. Defaults to the clipboard. */
  action?: ExportAction;
  /** Retina factor. Left unset, the card decides (see `defaultExportScale`). */
  scale?: number;
  /**
   * `preferHighResolution` from the user's preferences, possibly still loading.
   *
   * A promise, because the caller reads it from storage and storage answers in
   * a later task -- which is longer than the click that has to start the export.
   */
  preferHighResolution?: boolean | Promise<boolean>;
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
  const { action = 'copy', scale, preferHighResolution, filename, render } = options;
  const name = filename || `post-to-card-${Date.now()}.png`;

  let report: RenderReport | null = null;
  const renderOptions: RenderOptions = {
    ...(scale === undefined ? {} : { scale }),
    // Read where the picture is made, not here: see `RenderOptions.preferHighResolution`.
    ...(preferHighResolution === undefined ? {} : { preferHighResolution }),
    ...render,
    // After the spread, so a caller-supplied `render` cannot silently drop the
    // reporting this function is responsible for.
    report: (next) => {
      report = next;
    },
  };

  // Claim the clipboard inside this tick, before the seconds of rendering. A
  // browser without the API still asks for a copy and still gets one, through
  // the fallback below, which renders first and then says `unsupported`.
  let clip: ClipboardWriteHandle | null = null;
  if (action === 'copy' && canUseImageClipboard()) {
    const render = beginCardRender(cardElement, renderOptions);
    ignoreRejection(render);
    clip = beginClipboardWrite(render);
  }

  if (!clip) {
    const blob = await renderCardToBlob(cardElement, renderOptions);
    const result = await exportBlobWithFallback(blob, action, filename);
    return mergeReport(result, report);
  }

  // The two wait together, not one after the other: a clipboard that refuses
  // says so immediately, while the picture it refused is still seconds of
  // rendering away for a thread. A download cannot start without the bytes, but
  // waiting for the verdict before waiting for the bytes only made the panel sit
  // on "Copying..." in silence.
  const [refusal, picture] = await Promise.all([verdictOf(clip.written), clip.picture]);

  if (!picture.blob) {
    // A failed render is a defect, not a clipboard's opinion of one: this is the
    // one thing `exportCard` throws for. The render's own error is carried on
    // `failure`, so the panel prints the reason rather than the refusal it
    // happened to cause.
    throw picture.failure;
  }

  if (!refusal) {
    return mergeReport({ success: true, method: 'clipboard', filename: name }, report);
  }

  console.warn('[Post-to-Card] Clipboard write failed; falling back to a download:', refusal);
  return mergeReport(deliverDownload(picture.blob, name, classifyClipboardFailure(refusal)), report);
}

/** `null` when the clipboard took the picture; the refusal otherwise. */
function verdictOf(written: Promise<void>): Promise<unknown> {
  return written.then(
    () => null,
    (err: unknown) => err
  );
}

function mergeReport(result: ExportResult, report: RenderReport | null): ExportOutcome {
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
