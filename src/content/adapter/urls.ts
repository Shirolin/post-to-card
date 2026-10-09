/**
 * URL resolution and asset upscaling utilities for Twitter/X media.
 * Rewrites low-res profile pictures and photo thumbnails to ultra high-resolution
 * variants, and extracts video poster frames.
 */

/**
 * Upgrades a Twitter profile image URL to 400x400 high resolution.
 * Replaces suffixes like _normal, _bigger, _mini, _200x200 with _400x400.
 */
export function upgradeAvatarUrl(url: string): string {
  if (!url) return '';
  return url.replace(/_(?:normal|bigger|mini|200x200)(\.[a-zA-Z0-9]+)$/, '_400x400$1');
}

/**
 * Upgrades a Twitter photo URL to its highest available resolution.
 *
 * `name=orig` is the current high-resolution variant (capped at 4096px by X);
 * `name=large` only reaches 2048px. WebP sources are additionally rewritten to
 * JPEG, which is what the community uses to actually obtain original quality.
 *
 * Note that `orig` is not infallible: there are reports of it 404ing where
 * `large` still resolves. Callers that can tolerate a request per candidate
 * should use `getPhotoUrlCandidates` and probe them in order.
 *
 * Covers tweet media (`/media/`) and external link-card previews (`/card_img/`).
 */
export function upgradePhotoUrl(url: string): string {
  return getPhotoUrlCandidates(url)[0] || url;
}

/**
 * Returns progressively lower-resolution variants of a photo URL, best first.
 * The export path uses this to fall back when the original is unavailable.
 */
export function getPhotoUrlCandidates(url: string): string[] {
  if (!url) return [];

  // Legacy colon suffix (e.g. photo.jpg:small -> photo.jpg:orig)
  if (url.match(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/)) {
    return [url.replace(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/, ':orig')];
  }

  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes('twimg.com') &&
      (parsed.pathname.includes('/media/') || parsed.pathname.includes('/card_img/'))
    ) {
      const build = (name: string): string => {
        const next = new URL(parsed.toString());
        // JPEG source is what original quality is fetched in. WebP is recompressed
        // by X and a source that names no format may well be WebP, so the format
        // is stated for both cases rather than only rewritten when named.
        if (next.searchParams.get('format') !== 'jpg') {
          next.searchParams.set('format', 'jpg');
        }
        next.searchParams.set('name', name);
        return next.toString();
      };
      return [build('orig'), build('large'), build('medium')];
    }
  } catch {
    // If not a valid standard URL, return original
  }

  return [url];
}

/**
 * The ordered list of URLs to try for one card picture, best resolution first.
 *
 * The card mounts `preferredUrl`, which is the highest variant we believe
 * exists. `orig` is not infallible (see `upgradePhotoUrl`), and a 404 shows as a
 * broken image with nothing to recover, so this is the chain a caller walks on
 * error. It starts with the mounted URL, continues through the variants derived
 * from `originalUrl`, and ends with `originalUrl` itself -- the exact URL the
 * page rendered, which is the one variant X is certain to still have.
 *
 * Duplicates are dropped so an already-tried URL is never retried, and a source
 * with no derivable variants yields just `[preferredUrl, originalUrl]`.
 */
export function getPhotoFallbackChain(originalUrl: string, preferredUrl: string): string[] {
  const chain: string[] = [];
  const push = (url: string | undefined) => {
    if (url && !chain.includes(url)) chain.push(url);
  };

  push(preferredUrl);
  for (const candidate of getPhotoUrlCandidates(originalUrl)) {
    push(candidate);
  }
  push(originalUrl);

  return chain;
}

/**
 * Extracts the video poster frame URL from a <video> element or video container.
 */
export function extractVideoPosterUrl(videoElementOrContainer: Element | null | undefined): string | null {
  if (!videoElementOrContainer) return null;

  const tagName = (videoElementOrContainer.tagName || '').toUpperCase();
  if (tagName === 'VIDEO') {
    const poster = videoElementOrContainer.getAttribute('poster');
    return poster || null;
  }

  const video = videoElementOrContainer.querySelector('video');
  if (video) {
    const poster = video.getAttribute('poster');
    if (poster) return poster;
  }

  const previewImg = videoElementOrContainer.querySelector(
    'img[src*="video_preview"], img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"], img[src*="/media/"]'
  );
  if (previewImg) {
    const src = previewImg.getAttribute('src');
    if (src) return src;
  }

  return null;
}
