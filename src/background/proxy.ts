import type { ExtensionResponse } from '../types/messages.ts';

/**
 * Cache entry holding converted Base64 data and MIME type.
 */
export interface CachedImage {
  dataUrl: string;
  contentType: string;
}

/**
 * The cache as the export path uses it, behind three functions.
 *
 * The limits below are worth a property -- the worker is the only thing holding
 * these strings, and a count is not a bound for the content -- and a test cannot
 * fill a real 64MB budget without making the suite cost that much. So the store
 * is read through these, and `setImageCacheBudget` moves the ceiling for the
 * duration of a test. Production never calls the setter.
 */
let cacheBudgetChars = 64 * 1024 * 1024;
const imageCache = new Map<string, CachedImage>();
let cachedChars = 0;

/** Moves the byte ceiling. For tests; production uses the shipped 64MB. */
export function setImageCacheBudget(chars: number): void {
  cacheBudgetChars = chars;
  forgetOldest(cacheBudgetChars);
}

/** The base64 characters held, which is the number the budget is about. */
export function getImageCacheChars(): number {
  return cachedChars;
}

/**
 * Drops oldest-first until the cache is inside `budget` characters and, when
 * `maxItems` is given, holds no more than that many entries.
 *
 * The two ceilings are separate arguments rather than one call with a `budget`
 * of 0: a character budget is what is being respected, and 0 is a real budget
 * that empties the cache. Making room for the count bound once used 0 as the
 * budget and drained every entry on the way to a single insertion.
 */
function forgetOldest(
  budget = Number.POSITIVE_INFINITY,
  maxItems = Number.POSITIVE_INFINITY
): void {
  // A hit re-inserts its entry at the end, so the map's order is least-recently
  // used first.
  while ((cachedChars > budget || imageCache.size > maxItems) && imageCache.size > 0) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey === undefined) break;
    const evicted = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    cachedChars -= evicted ? evicted.dataUrl.length : 0;
  }
}

/** Remembers one picture, unless remembering it is what would make it a problem. */
function remember(url: string, entry: CachedImage): void {
  // A picture bigger than the whole budget is handed to the caller that asked
  // for it and not remembered at all: the next export of that card is cheaper
  // than evicting everything the smaller pictures were being kept for.
  if (entry.dataUrl.length > cacheBudgetChars) return;

  // A hit re-inserts the entry it was asked for; a miss takes a new place. Only
  // a miss has to make room, and the order of these two lines is that
  // difference: making room first turned every hit at a full cache into a new
  // entry and emptied the cache one eviction at a time.
  const previous = imageCache.get(url);
  const isHit = previous !== undefined;
  if (previous) {
    imageCache.delete(url);
    cachedChars -= previous.dataUrl.length;
  }
  if (!isHit && imageCache.size >= MAX_CACHE_ITEMS) forgetOldest(undefined, MAX_CACHE_ITEMS - 1);

  imageCache.set(url, entry);
  cachedChars += entry.dataUrl.length;
  forgetOldest(cacheBudgetChars);
}

/**
 * The count bound on the in-memory cache.
 *
 * There are two limits and they answer different questions. This one stops a
 * feed of small avatars from growing a map with no upper end; the byte budget
 * (see `setImageCacheBudget`) is what actually bounds the worker, because a
 * count is the wrong unit for this content -- one `name=orig` photo is a few
 * megabytes once it is base64, so 200 of them is hundreds of megabytes for a
 * cache that usually holds avatars and a handful of pictures.
 *
 * Base64 is what has to be held, so bytes are counted after encoding: that is
 * the string the worker keeps and posts back over the message channel.
 */
const MAX_CACHE_ITEMS = 200;

/** The proxy's timeout, and the hard ceiling that keeps an export from hanging. */
const PROXY_TIMEOUT_MS = 15000;
/**
 * How long an export will wait on one picture, across every retry it makes.
 *
 * The timeout above is per request; a worker that answers with a stream that
 * never ends, or that is asked three times, would otherwise hold the canvas for
 * a minute with the panel on "Copying...". Past this the picture is drawn as the
 * placeholder and the export finishes -- a grey square the user can see and
 * retry beats a button that never comes back.
 */
export const IMAGE_PROXY_BUDGET_MS = 25000;

/**
 * Clears the in-memory image proxy cache.
 */
export function clearImageCache(): void {
  imageCache.clear();
  cachedChars = 0;
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
  timeoutMs = PROXY_TIMEOUT_MS
): Promise<ExtensionResponse> {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'Invalid URL: URL must be a non-empty string',
      // The same request would fail the same way.
      retryable: false,
    };
  }

  if (!isAllowedHost(url)) {
    return {
      success: false,
      error: 'Forbidden origin: URL must belong to twimg.com via http/https',
      retryable: false,
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
        // A 404 or a 403 is X answering about the picture itself. A 5xx is the
        // edge having a bad moment and is worth one more ask.
        //
        // A 429 is not, even though it looks transient: the caller's whole retry
        // budget is a few hundred milliseconds, and a rate-limit window does not
        // open that fast. Marking it retryable would only spend the budget on
        // asks that are certain to be refused again.
        retryable: response.status >= 500,
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

    // The bytes are read under the same deadline as the request: `fetch`
    // settles when the headers arrive, so a body that keeps trickling would
    // otherwise be read past the timeout with nothing left to abort it.
    const arrayBuffer = await response.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
    const dataUrl = `data:${contentType};base64,${base64}`;

    remember(url, { dataUrl, contentType });

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
        // Not retryable, because a retry spends the same full budget again: a
        // request that could not get a byte in 15s would cost the export 30 more
        // seconds to learn the same thing, which reads as a hang. The failures
        // below fail fast, so re-asking them is cheap.
        retryable: false,
      };
    }

    // DNS, TLS, a connection reset: the request never got an answer about the
    // picture, so it is the other half of what a second ask can fix.
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      retryable: true,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }
}
