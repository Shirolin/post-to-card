/**
 * Twitter/X DOM Extractor.
 * Extracts structured TweetData from Twitter/X article elements:
 * author metadata, native Unicode text, rich tokens (@mentions, #hashtags, $cashtags, URLs),
 * multi-image grids (1-4 images), video poster frames, nested quote tweets, and engagement stats.
 */

import type { TweetData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData } from '../../types/tweet';
import { restoreUnicodeEmojis, cleanTweetText } from './emojis';
import { upgradeAvatarUrl, upgradePhotoUrl, extractVideoPosterUrl } from './urls';

export type RichTokenType = 'text' | 'mention' | 'hashtag' | 'cashtag' | 'link' | 'emoji';

export interface RichToken {
  type: RichTokenType;
  value: string;
  href?: string;
}

/**
 * Checks if a given DOM element is nested inside a Quote Tweet box.
 */
function isInsideQuoteTweet(el: Element): boolean {
  if (typeof el.closest === 'function') {
    return Boolean(
      el.closest('div[data-testid="quoteTweet"]') ||
      el.closest('.quote-box')
    );
  }

  let curr: Node | null = el.parentNode;
  while (curr) {
    const parentEl = curr as Element;
    if (
      (typeof parentEl.getAttribute === 'function' && parentEl.getAttribute('data-testid') === 'quoteTweet') ||
      (parentEl.className && String(parentEl.className).includes('quote-box'))
    ) {
      return true;
    }
    curr = curr.parentNode;
  }
  return false;
}

/**
 * Extracts author display name from User-Name container,
 * preserving Twemojis and excluding handle / timestamp.
 */
function extractDisplayName(userNameEl: Element): string {
  const handleLink = userNameEl.querySelector('a[href^="/"]:not([href*="/status/"])');
  const children = (userNameEl as { childNodes?: ArrayLike<Node> }).childNodes || [];

  if (handleLink) {
    let nameParts = '';
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === handleLink || (typeof child.contains === 'function' && child.contains(handleLink))) {
        break;
      }
      nameParts += restoreUnicodeEmojis(child);
    }
    const trimmed = nameParts.trim();
    if (trimmed) return trimmed;
  }

  // Fallback: take first child element before @ handle
  const firstChild = children[0];
  if (firstChild && firstChild !== handleLink) {
    const text = restoreUnicodeEmojis(firstChild).trim();
    if (text) {
      const atIdx = text.indexOf('@');
      return atIdx !== -1 ? text.slice(0, atIdx).trim() : text;
    }
  }

  const allText = restoreUnicodeEmojis(userNameEl).trim();
  const atIdx = allText.indexOf('@');
  return atIdx !== -1 ? allText.slice(0, atIdx).trim() : allText;
}

/**
 * Extracts AuthorInfo (name, handle, high-res avatar, verified badge).
 */
export function extractAuthorInfo(article: Element): AuthorInfo {
  const userNameEl = article.querySelector('div[data-testid="User-Name"]');
  const avatarImg = article.querySelector('div[data-testid="Tweet-User-Avatar"] img') ||
    article.querySelector('img[src*="profile_images"]');

  const avatarUrl = avatarImg
    ? upgradeAvatarUrl(avatarImg.getAttribute('src') || '')
    : '';

  if (!userNameEl) {
    return {
      name: '',
      handle: '',
      avatarUrl,
      verified: false,
    };
  }

  // 1. Display Name
  const name = extractDisplayName(userNameEl);

  // 2. Handle (@username)
  let handle = '';
  const handleLink = userNameEl.querySelector('a[href^="/"]:not([href*="/status/"])');
  if (handleLink) {
    const linkText = handleLink.textContent?.trim() || '';
    if (linkText.startsWith('@')) {
      handle = linkText;
    } else {
      const href = handleLink.getAttribute('href') || '';
      const clean = href.replace(/^\/+/, '').split('/')[0];
      if (clean) handle = `@${clean}`;
    }
  }
  if (!handle) {
    const rawText = userNameEl.textContent || '';
    const match = rawText.match(/@([a-zA-Z0-9_]+)/);
    if (match) handle = `@${match[1]}`;
  }

  // 3. Verified Badge
  const verifiedSvg = userNameEl.querySelector('svg[data-testid="icon-verified"], svg[aria-label*="Verified"]') ||
    article.querySelector('svg[data-testid="icon-verified"]');
  const verified = Boolean(verifiedSvg);

  return {
    name,
    handle,
    avatarUrl,
    verified,
  };
}

/**
 * Extracts rich tokens (@mentions, #hashtags, $cashtags, URLs, emojis, text)
 * from tweetText element.
 */
export function extractRichTokens(tweetTextEl: Element | null | undefined): RichToken[] {
  if (!tweetTextEl) return [];

  const tokens: RichToken[] = [];
  const children = (tweetTextEl as { childNodes?: ArrayLike<Node> }).childNodes || [];

  function processNode(node: Node | null | undefined) {
    if (!node) return;

    // Node.TEXT_NODE === 3
    if (node.nodeType === 3) {
      const val = node.nodeValue || '';
      if (val) {
        tokens.push({ type: 'text', value: val });
      }
      return;
    }

    if (node.nodeType === 1) {
      const el = node as Element;
      const tagName = (el.tagName || '').toUpperCase();

      if (tagName === 'IMG') {
        const alt = typeof el.getAttribute === 'function'
          ? el.getAttribute('alt')
          : (node as { alt?: string }).alt;
        if (alt) {
          tokens.push({ type: 'emoji', value: alt });
        }
        return;
      }

      if (tagName === 'BR') {
        tokens.push({ type: 'text', value: '\n' });
        return;
      }

      if (tagName === 'A') {
        const href = typeof el.getAttribute === 'function'
          ? (el.getAttribute('href') || '')
          : ((node as { href?: string }).href || '');
        const title = typeof el.getAttribute === 'function'
          ? (el.getAttribute('title') || '')
          : ((node as { title?: string }).title || '');
        const text = restoreUnicodeEmojis(node);

        // Skip trailing pic.twitter.com media link
        if (href.includes('pic.twitter.com') || text.includes('pic.twitter.com')) {
          return;
        }

        // Mention
        if (text.startsWith('@') || (href.startsWith('/') && !href.includes('/hashtag/') && !href.includes('/search'))) {
          tokens.push({
            type: 'mention',
            value: text,
            href: href || undefined,
          });
          return;
        }

        // Hashtag
        if (text.startsWith('#') || href.includes('/hashtag/')) {
          tokens.push({
            type: 'hashtag',
            value: text,
            href: href || undefined,
          });
          return;
        }

        // Cashtag ($NVDA, $BTC)
        if (text.startsWith('$') || href.includes('/search?q=%24') || href.includes('/search?q=$')) {
          tokens.push({
            type: 'cashtag',
            value: text,
            href: href || undefined,
          });
          return;
        }

        // Web Link / t.co redirect
        tokens.push({
          type: 'link',
          value: text,
          href: title || href || undefined,
        });
        return;
      }

      // Container elements like <span> or <div>
      const subChildren = node.childNodes || [];
      if (subChildren.length > 0) {
        for (let i = 0; i < subChildren.length; i++) {
          processNode(subChildren[i]);
        }
      } else {
        const val = restoreUnicodeEmojis(node);
        if (val) {
          tokens.push({ type: 'text', value: val });
        }
      }
    }
  }

  for (let i = 0; i < children.length; i++) {
    processNode(children[i]);
  }

  return tokens;
}

/**
 * Detects if a video container represents an animated GIF.
 */
export function isGifMedia(container: Element): boolean {
  if (!container) return false;
  const aria = (typeof container.getAttribute === 'function' ? container.getAttribute('aria-label') : '') || '';
  if (aria.toUpperCase().includes('GIF')) return true;

  if (typeof container.querySelector === 'function') {
    if (container.querySelector('[aria-label*="GIF"], [data-testid="gifBadge"]')) return true;
    const spans = container.querySelectorAll('span, div');
    for (const el of Array.from(spans)) {
      if (el.textContent?.trim() === 'GIF') return true;
    }
  }
  return false;
}

/**
 * Extracts video duration string (e.g. '0:42', '1:23', '12:05') from video controls.
 */
export function extractVideoDuration(container: Element): string | undefined {
  if (!container || typeof container.querySelectorAll !== 'function') return undefined;

  const candidateEls = container.querySelectorAll('time, span, div');
  for (const el of Array.from(candidateEls)) {
    const text = el.textContent?.trim() || '';
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
      return text;
    }
  }

  const ariaEls = container.querySelectorAll('[aria-label]');
  for (const el of Array.from(ariaEls)) {
    const label = el.getAttribute('aria-label') || '';
    const match = label.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Deeply searches an article or container for video elements and extracts
 * the poster frame URL or captures a frame via HTML5 Canvas.
 */
export function extractVideoMedia(container: Element): MediaItem | null {
  if (!container) return null;

  // 1. Locate video container, video tag, or player overlay
  const videoContainer = container.querySelector(
    'div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"], div[aria-label*="video" i], video'
  );
  const videoEl = (container.querySelector('video') || (videoContainer?.tagName === 'VIDEO' ? videoContainer : null)) as HTMLVideoElement | null;

  // Check if any thumbnail specifically belongs to video
  const videoThumbImg = container.querySelector(
    'img[src*="video_thumb"], img[src*="ext_tw_video_thumb"], img[src*="tweet_video_thumb"], img[src*="amplify_video_thumb"], img[src*="video_preview"]'
  );

  const hasVideo = Boolean(videoContainer || videoEl || videoThumbImg);
  if (!hasVideo) return null;

  const targetContainer = videoContainer || container;
  const isGif = isGifMedia(targetContainer);
  let duration = isGif ? undefined : extractVideoDuration(targetContainer);

  // If duration wasn't found in DOM text, check native video element duration
  if (!duration && videoEl && typeof videoEl.duration === 'number' && !isNaN(videoEl.duration) && videoEl.duration > 0) {
    const totalSec = Math.floor(videoEl.duration);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    duration = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  let posterUrl: string | null = null;
  let aspectRatio: number | undefined;

  // Strategy A: Video element poster attribute
  if (videoEl) {
    const p = typeof videoEl.getAttribute === 'function' ? videoEl.getAttribute('poster') : (videoEl as any).poster;
    if (p && String(p).trim().length > 0) {
      posterUrl = String(p).trim();
    }
  }

  // Strategy B: Any video thumbnail or preview img
  if (!posterUrl && videoThumbImg) {
    const src = (typeof videoThumbImg.getAttribute === 'function' ? videoThumbImg.getAttribute('src') : (videoThumbImg as any).src) || '';
    if (src && !src.includes('profile_images') && !src.includes('/emoji/')) {
      posterUrl = src;
      const imgEl = videoThumbImg as unknown as { naturalWidth?: number; naturalHeight?: number };
      const w = imgEl.naturalWidth || Number.parseFloat(videoThumbImg.getAttribute('width') || '0') || 0;
      const h = imgEl.naturalHeight || Number.parseFloat(videoThumbImg.getAttribute('height') || '0') || 0;
      if (w > 0 && h > 0) {
        aspectRatio = Number((w / h).toFixed(3));
      }
    }
  }

  // Strategy C: extractVideoPosterUrl helper
  if (!posterUrl && videoContainer) {
    const p = extractVideoPosterUrl(videoContainer);
    if (p && !p.includes('profile_images') && !p.includes('/emoji/')) {
      posterUrl = p;
    }
  }

  // Strategy D: Any preview img inside the target container or article (excluding quote tweets)
  if (!posterUrl) {
    const imgs = Array.from(targetContainer.querySelectorAll('img')).filter(img => !isInsideQuoteTweet(img));
    for (const img of imgs) {
      const src = (typeof img.getAttribute === 'function' ? img.getAttribute('src') : (img as any).src) || '';
      if (src && !src.includes('profile_images') && !src.includes('/emoji/')) {
        posterUrl = src;
        const imgEl = img as unknown as { naturalWidth?: number; naturalHeight?: number };
        const w = imgEl.naturalWidth || Number.parseFloat(img.getAttribute('width') || '0') || 0;
        const h = imgEl.naturalHeight || Number.parseFloat(img.getAttribute('height') || '0') || 0;
        if (w > 0 && h > 0) {
          aspectRatio = Number((w / h).toFixed(3));
        }
        break;
      }
    }
  }

  // Strategy E: Background-image in inline styles
  if (!posterUrl) {
    const candidateEls = [targetContainer, ...Array.from(targetContainer.querySelectorAll('div, span'))];
    for (const el of candidateEls) {
      const style = (typeof el.getAttribute === 'function' ? el.getAttribute('style') : (el as any).style?.cssText) || '';
      const match = style.match(/background(?:-image)?:\s*url\(['"]?(https?:\/\/[^'")]+)['"]?\)/i);
      if (match && !match[1].includes('profile_images') && !match[1].includes('/emoji/')) {
        posterUrl = match[1];
        break;
      }
    }
  }

  // Strategy F: Capture current live frame from HTML5 <video> using Canvas
  if (!posterUrl && videoEl && typeof document !== 'undefined') {
    const vid = videoEl as unknown as { videoWidth?: number; videoHeight?: number };
    if (vid.videoWidth && vid.videoHeight && vid.videoWidth > 0 && vid.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl as any, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          if (dataUrl && dataUrl.length > 200) {
            posterUrl = dataUrl;
            aspectRatio = Number((vid.videoWidth / vid.videoHeight).toFixed(3));
          }
        }
      } catch {
        // Ignore CORS errors on canvas draw
      }
    }
  }

  // Strategy G: Twitter Open Graph image meta
  if (!posterUrl && typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    const ogImg = document.querySelector('meta[property="og:image"]');
    const content = ogImg?.getAttribute('content');
    if (content && !content.includes('profile_images')) {
      posterUrl = content;
    }
  }

  // Infer aspect ratio if still missing
  if (!aspectRatio && videoEl) {
    const vid = videoEl as unknown as { videoWidth?: number; videoHeight?: number };
    if (vid.videoWidth && vid.videoHeight && vid.videoWidth > 0 && vid.videoHeight > 0) {
      aspectRatio = Number((vid.videoWidth / vid.videoHeight).toFixed(3));
    }
  }

  if (!posterUrl) return null;

  return {
    type: isGif ? 'gif' : 'video',
    url: posterUrl.startsWith('data:') ? posterUrl : upgradePhotoUrl(posterUrl),
    originalUrl: posterUrl,
    posterUrl: posterUrl,
    duration,
    aspectRatio,
  };
}

/**
 * Extracts 1-4 high-res photos and video poster frames for the main tweet.
 * Excludes media belonging to nested quote tweets.
 */
export function extractTweetMedia(article: Element): MediaItem[] | undefined {
  // 1. Check for Video / GIF first: if article contains a video, extract dedicated video media
  const videoMedia = extractVideoMedia(article);
  if (videoMedia) {
    return [videoMedia];
  }

  // 2. Photos
  const items: MediaItem[] = [];
  const photoEls = Array.from(article.querySelectorAll('div[data-testid="tweetPhoto"] img'));
  const validPhotos = photoEls.filter(img => !isInsideQuoteTweet(img));

  for (const img of validPhotos.slice(0, 4)) {
    const rawSrc = img.getAttribute('src') || '';
    if (rawSrc) {
      const imgEl = img as unknown as { naturalWidth?: number; naturalHeight?: number };
      const naturalWidth = imgEl.naturalWidth || Number.parseFloat(img.getAttribute('width') || '0') || 0;
      const naturalHeight = imgEl.naturalHeight || Number.parseFloat(img.getAttribute('height') || '0') || 0;
      const aspectRatio = (naturalWidth > 0 && naturalHeight > 0)
        ? Number((naturalWidth / naturalHeight).toFixed(3))
        : undefined;

      items.push({
        type: 'image',
        url: upgradePhotoUrl(rawSrc),
        originalUrl: rawSrc,
        alt: img.getAttribute('alt') || undefined,
        aspectRatio,
      });
    }
  }

  return items.length > 0 ? items : undefined;
}

/**
 * Extracts nested Quote Tweet data (author, text, media, timestamp).
 */
export function extractQuoteTweet(article: Element): QuoteTweetData | undefined {
  const quoteBox = article.querySelector('div[data-testid="quoteTweet"]') ||
    article.querySelector('.quote-box');

  if (!quoteBox) return undefined;

  // Handle deleted or unavailable quote post tombstone
  const boxText = quoteBox.textContent || '';
  if (boxText.includes('This post is unavailable') || boxText.includes('此推文不可用')) {
    return {
      author: { name: '', handle: '', avatarUrl: '' },
      text: 'This post is unavailable.',
      timestamp: '',
    };
  }

  // Author
  const quoteUser = quoteBox.querySelector('div[data-testid="User-Name"]');
  let quoteAuthor: AuthorInfo = { name: '', handle: '', avatarUrl: '' };
  if (quoteUser) {
    const name = extractDisplayName(quoteUser);
    const handleEl = quoteUser.querySelector('a[href^="/"]:not([href*="/status/"])');
    const handle = handleEl?.textContent?.trim() || '';
    const avatarEl = quoteBox.querySelector('img[src*="profile_images"]');
    const avatarUrl = avatarEl ? upgradeAvatarUrl(avatarEl.getAttribute('src') || '') : '';
    quoteAuthor = {
      name,
      handle,
      avatarUrl,
    };
  }

  // Text
  const textEl = quoteBox.querySelector('div[data-testid="tweetText"]');
  const text = textEl ? cleanTweetText(textEl) : '';

  // Timestamp
  const timeEl = quoteBox.querySelector('time');
  const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

  // Media
  // Media: check video first, then photos
  const media: MediaItem[] = [];
  const quoteVideo = extractVideoMedia(quoteBox);
  if (quoteVideo) {
    media.push(quoteVideo);
  } else {
    const photoEls = Array.from(quoteBox.querySelectorAll('div[data-testid="tweetPhoto"] img'));
    for (const img of photoEls.slice(0, 4)) {
      const src = img.getAttribute('src') || '';
      if (src) {
        const imgEl = img as unknown as { naturalWidth?: number; naturalHeight?: number };
        const naturalWidth = imgEl.naturalWidth || Number.parseFloat(img.getAttribute('width') || '0') || 0;
        const naturalHeight = imgEl.naturalHeight || Number.parseFloat(img.getAttribute('height') || '0') || 0;
        const aspectRatio = (naturalWidth > 0 && naturalHeight > 0)
          ? Number((naturalWidth / naturalHeight).toFixed(3))
          : undefined;

        media.push({
          type: 'image',
          url: upgradePhotoUrl(src),
          originalUrl: src,
          alt: img.getAttribute('alt') || undefined,
          aspectRatio,
        });
      }
    }
  }

  return {
    author: quoteAuthor,
    text,
    timestamp,
    media: media.length > 0 ? media : undefined,
  };
}

/**
 * Parses interaction metric counts from elements or aria-label attributes.
 */
function parseStatValue(el: Element | null): string | undefined {
  if (!el) return undefined;
  const span = el.querySelector('span');
  const text = span?.textContent?.trim();
  if (text && text.length > 0) return text;

  const aria = el.getAttribute('aria-label') || '';
  const match = aria.match(/([\d,.]+[KkMmBb]?)/);
  return match ? match[1] : undefined;
}

/**
 * Extracts interaction statistics (replies, reposts, likes, bookmarks, views).
 */
export function extractTweetStats(article: Element): TweetStats | undefined {
  const actionBar = article.querySelector('div[role="group"]');
  if (!actionBar || isInsideQuoteTweet(actionBar)) return undefined;

  const replies = parseStatValue(actionBar.querySelector('div[data-testid="reply"], button[data-testid="reply"]'));
  const reposts = parseStatValue(actionBar.querySelector('div[data-testid="retweet"], div[data-testid="unretweet"], button[data-testid="retweet"]'));
  const likes = parseStatValue(actionBar.querySelector('div[data-testid="like"], div[data-testid="unlike"], button[data-testid="like"]'));
  const bookmarks = parseStatValue(actionBar.querySelector('div[data-testid="bookmark"], div[data-testid="removeBookmark"], button[data-testid="bookmark"]'));
  const views = parseStatValue(actionBar.querySelector('div[data-testid="viewCount"], a[href*="/analytics"]'));

  if (!replies && !reposts && !likes && !bookmarks && !views) {
    return undefined;
  }

  const stats: TweetStats = {};
  if (replies) stats.replies = replies;
  if (reposts) stats.reposts = reposts;
  if (likes) stats.likes = likes;
  if (bookmarks) stats.bookmarks = bookmarks;
  if (views) stats.views = views;

  return stats;
}

/**
 * Extracts tweet ID from status link or current URL.
 */
export function extractTweetId(article: Element): string {
  const statusLink = article.querySelector('a[href*="/status/"]:not([data-testid="quoteTweet"] a)');
  if (statusLink) {
    const href = statusLink.getAttribute('href') || '';
    const match = href.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  if (typeof window !== 'undefined' && window.location?.pathname) {
    const match = window.location.pathname.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  return '';
}

/**
 * Extracts canonical permalink URL for the tweet.
 */
export function extractTweetUrl(article: Element): string {
  const statusLink = article.querySelector('a[href*="/status/"]:not([data-testid="quoteTweet"] a)');
  if (statusLink) {
    const href = statusLink.getAttribute('href') || '';
    if (href.startsWith('http')) return href;
    return `https://x.com${href}`;
  }

  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }

  return '';
}

/**
 * Extracts ISO 8601 UTC timestamp from <time> tag.
 */
export function extractTimestamp(article: Element): string {
  const timeEls = Array.from(article.querySelectorAll('time'));
  const validTime = timeEls.find(t => !isInsideQuoteTweet(t));
  if (validTime) {
    return validTime.getAttribute('datetime') || validTime.textContent?.trim() || '';
  }
  return '';
}

/**
 * Extracts complete, production-grade TweetData model from a tweet article DOM element.
 */
export function extractTweetData(article: Element): TweetData | null {
  if (!article) return null;

  const id = extractTweetId(article);
  const url = extractTweetUrl(article);
  const author = extractAuthorInfo(article);

  const tweetTextEl = article.querySelector('div[data-testid="tweetText"]');
  const validTextEl = tweetTextEl && !isInsideQuoteTweet(tweetTextEl) ? tweetTextEl : null;
  const text = validTextEl ? cleanTweetText(validTextEl) : '';
  const richTokens = validTextEl ? extractRichTokens(validTextEl) : [];

  const timestamp = extractTimestamp(article);
  const stats = extractTweetStats(article);
  const media = extractTweetMedia(article);
  const quotePost = extractQuoteTweet(article);

  type CompatibleToken = NonNullable<TweetData['richTokens']>[number];

  return {
    id,
    url,
    author,
    text,
    richTokens: richTokens.length > 0 ? (richTokens as unknown as CompatibleToken[]) : undefined,
    timestamp,
    stats,
    media,
    quotePost,
    isThreadPart: false,
  };
}
