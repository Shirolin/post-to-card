import type { ExtensionResponse } from '../types/messages';

/**
 * Cache entry holding converted Base64 data and MIME type.
 */
export interface CachedImage {
  dataUrl: string;
  contentType: string;
}

const MAX_CACHE_ITEMS = 200;
const imageCache = new Map<string, CachedImage>();

/**
 * Clears the in-memory image proxy cache.
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Returns current number of cached images.
 */
export function getImageCacheSize(): number {
  return imageCache.size;
}

/**
 * Validates that the URL targets an authorized Twitter image domain via HTTP/HTTPS.
 * Prevents SSRF, local file access, or unallowed external domains.
 */
export function isAllowedHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === 'twimg.com' || host.endsWith('.twimg.com');
  } catch {
    return false;
  }
}

/**
 * Converts a Uint8Array into a Base64 string in chunks.
 * Prevents V8 stack overflow ("Maximum call stack size exceeded") on large images.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000; // 32KB chunking

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    const chars = new Array<string>(chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      chars[j] = String.fromCharCode(chunk[j]);
    }
    binary += chars.join('');
  }

  return btoa(binary);
}

/**
 * Fetches a remote image from twimg.com, encodes it to a Base64 data URL,
 * and caches the result in memory.
 */
export async function handleFetchImageBase64(
  url: string,
  timeoutMs = 15000
): Promise<ExtensionResponse> {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'Invalid URL: URL must be a non-empty string',
    };
  }

  if (!isAllowedHost(url)) {
    return {
      success: false,
      error: 'Forbidden origin: URL must belong to twimg.com via http/https',
    };
  }

  const cached = imageCache.get(url);
  if (cached) {
    // LRU refresh: delete and re-insert at end
    imageCache.delete(url);
    imageCache.set(url, cached);
    return {
      success: true,
      dataUrl: cached.dataUrl,
      contentType: cached.contentType,
    };
  }

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText || 'Fetch failed'}`,
      };
    }

    const rawContentType = response.headers.get('content-type');
    let contentType = 'image/jpeg';
    if (rawContentType) {
      const mime = rawContentType.split(';')[0].trim().toLowerCase();
      if (mime.startsWith('image/')) {
        contentType = mime;
      }
    } else if (url.includes('.png')) {
      contentType = 'image/png';
    } else if (url.includes('.webp')) {
      contentType = 'image/webp';
    } else if (url.includes('.gif')) {
      contentType = 'image/gif';
    } else if (url.includes('.svg')) {
      contentType = 'image/svg+xml';
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = uint8ArrayToBase64(bytes);
    const dataUrl = `data:${contentType};base64,${base64}`;

    const entry: CachedImage = { dataUrl, contentType };
    imageCache.set(url, entry);

    if (imageCache.size > MAX_CACHE_ITEMS) {
      const oldestKey = imageCache.keys().next().value;
      if (oldestKey !== undefined) {
        imageCache.delete(oldestKey);
      }
    }

    return {
      success: true,
      dataUrl,
      contentType,
    };
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        success: false,
        error: `Network timeout: request exceeded ${timeoutMs}ms`,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }
}
