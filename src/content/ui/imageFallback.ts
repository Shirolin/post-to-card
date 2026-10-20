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
 *
 * An avatar recovers through the same mechanism with a one-entry chain, because
 * what it falls back *to* differs rather than how it walks: see
 * `avatarFallbackAttrs`.
 */

import type { AuthorInfo, MediaItem } from '../../types/tweet.ts';
import { getPhotoFallbackChain } from '../adapter/urls.ts';

/** The attribute holding the not-yet-tried URLs, as a JSON array. */
const FALLBACK_ATTR = 'data-fallback';

/**
 * The silhouette the card shows for an author whose picture is not available.
 *
 * It is the terminal of the avatar fallback chain and also what an author with
 * no `avatarUrl` at all is rendered with, so both reach the same state.
 */
export const DEFAULT_AVATAR_SRC =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2371767b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';

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
 * The extra attributes an avatar <img> needs to be able to recover.
 *
 * An avatar gets one step rather than a chain. The card mounts the author's
 * picture at `_400x400`, which is an upgrade of whatever the page rendered, and
 * unlike a photo there is no variant of it observed going missing on its own --
 * every size X derives from an avatar has been seen to resolve or 404 together.
 * So the recovery is not "try a smaller copy of the same person", it is "this
 * picture is not coming".
 *
 * That is why the chain ends on the silhouette instead of on nothing. A media
 * picture is left broken on purpose, because a missing picture is information.
 * An avatar is not: the card already renders this same silhouette for an author
 * with no avatar at all, so an author whose picture will not load lands in the
 * state the card has for exactly that, rather than on a broken-image glyph.
 */
export function avatarFallbackAttrs(author: AuthorInfo): Record<string, string> {
  return author.avatarUrl ? { [FALLBACK_ATTR]: JSON.stringify([DEFAULT_AVATAR_SRC]) } : {};
}

/**
 * Advances a failed picture to the next URL in its chain.
 *
 * What the chain ends on is the caller's to decide. A media chain ends on the
 * page-rendered URL, so an exhausted picture is left broken on purpose: one that
 * is genuinely gone should still read as missing rather than being papered over
 * with something that looks like a successful load. An avatar chain ends on the
 * silhouette, which is the state the card already has for a missing picture.
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
