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

export const getHighResAvatarUrl = upgradeAvatarUrl;

/**
 * Upgrades a Twitter photo URL to large resolution.
 * Supports both query parameter format (?format=...&name=large) and legacy colon suffix (:large).
 */
export function upgradePhotoUrl(url: string): string {
  if (!url) return '';

  // Check legacy colon suffix (e.g. photo.jpg:small -> photo.jpg:large)
  if (url.match(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/)) {
    return url.replace(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/, ':large');
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('twimg.com') && parsed.pathname.includes('/media/')) {
      parsed.searchParams.set('name', 'large');
      return parsed.toString();
    }
  } catch {
    // If not a valid standard URL, return original
  }

  return url;
}

export const getHighResPhotoUrl = upgradePhotoUrl;

/**
 * Extracts the video poster frame URL from a <video> element or video container.
 */
export function extractVideoPosterUrl(videoElementOrContainer: Element | null | undefined): string | null {
  if (!videoElementOrContainer) return null;

  const tagName = (videoElementOrContainer.tagName || '').toUpperCase();
  if (tagName === 'VIDEO') {
    const poster = typeof videoElementOrContainer.getAttribute === 'function'
      ? videoElementOrContainer.getAttribute('poster')
      : (videoElementOrContainer as { poster?: string }).poster;
    return poster || null;
  }

  if (typeof videoElementOrContainer.querySelector === 'function') {
    const video = videoElementOrContainer.querySelector('video');
    if (video) {
      const poster = typeof video.getAttribute === 'function'
        ? video.getAttribute('poster')
        : (video as { poster?: string }).poster;
      if (poster) return poster;
    }

    const previewImg = videoElementOrContainer.querySelector(
      'img[src*="video_preview"], img[src*="amplify_video_thumb"], img[src*="/media/"]'
    );
    if (previewImg) {
      const src = typeof previewImg.getAttribute === 'function'
        ? previewImg.getAttribute('src')
        : (previewImg as { src?: string }).src;
      if (src) return src;
    }
  }

  return null;
}
