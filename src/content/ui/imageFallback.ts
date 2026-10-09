/**
 * Recovering a card picture whose highest-resolution URL failed to load.
 *
 * The card mounts each photo at its best available variant, and X does not
 * always keep every variant: `orig` in particular has been observed 404ing while
 * `large` still resolves. A broken <img> then prints its alt text where the
 * picture belongs, which is what a reader sees as "sometimes an image is
 * missing". The recovery is a walk down the candidate chain `urls.ts` defines.
 *
 * The remaining URLs live on the element in `data-fallback` rather than in
 * component state. That is deliberate: the export engine rasterizes a *clone* of
 * the card, and an attribute survives the clone, so the exported PNG inherits
 * whatever source the preview settled on. A closure or a Preact state value
 * would not.
 */

import type { MediaItem } from '../../types/tweet.ts';
import { getPhotoFallbackChain } from '../adapter/urls.ts';

/** The attribute holding the not-yet-tried URLs, as a JSON array. */
const FALLBACK_ATTR = 'data-fallback';

/**
 * The extra attributes a media <img> needs to be able to recover.
 *
 * Returns an empty object when there is nothing to fall back to, so a source
 * with no derivable variants is mounted with no attribute at all rather than an
 * empty one.
 */
export function imageFallbackAttrs(item: MediaItem): Record<string, string> {
  // A video item's `originalUrl` is the video file, not the still frame the card
  // shows, so the chain is derived from the poster. Deriving it from the mp4
  // made the recovery itself broken: a poster that 404s was "recovered" onto an
  // `.mp4`, which an <img> cannot display.
  const isVideo = item.type === 'video' || item.type === 'gif';
  const source = isVideo ? (item.posterUrl || item.url) : (item.originalUrl || item.url);
  const chain = getPhotoFallbackChain(source, item.url);
  const remaining = chain.slice(1);
  return remaining.length > 0 ? { [FALLBACK_ATTR]: JSON.stringify(remaining) } : {};
}

/**
 * Advances a failed picture to the next URL in its chain.
 *
 * Once the chain is exhausted the image is left broken on purpose: a picture
 * that is genuinely gone should still read as missing rather than being papered
 * over with a placeholder that looks like a successful load.
 */
export function advanceImageFallback(img: HTMLImageElement): void {
  const raw = img.getAttribute(FALLBACK_ATTR);
  if (!raw) return;

  try {
    const remaining = JSON.parse(raw) as unknown;
    if (!Array.isArray(remaining) || remaining.length === 0) {
      img.removeAttribute(FALLBACK_ATTR);
      return;
    }
    const next = remaining.shift();
    if (typeof next !== 'string' || next.length === 0) {
      img.removeAttribute(FALLBACK_ATTR);
      return;
    }
    img.setAttribute(FALLBACK_ATTR, JSON.stringify(remaining));
    img.src = next;
  } catch {
    img.removeAttribute(FALLBACK_ATTR);
  }
}
