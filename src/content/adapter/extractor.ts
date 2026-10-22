/**
 * Twitter/X DOM Extractor.
 * Extracts structured TweetData from Twitter/X article elements:
 * author metadata, native Unicode text, rich tokens (@mentions, #hashtags, $cashtags, URLs),
 * multi-image grids (1-4 images), video poster frames, nested quote tweets, and engagement stats.
 */

import type { TweetData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData, ArticleData } from '../../types/tweet.ts';
import { QUOTE_LEVELS, unavailableQuote } from '../../types/tweet.ts';
import { restoreUnicodeEmojis, cleanTweetText, normalizeTweetWhitespace, isPicMediaLink, stripTrailingArticleLink, stripTrailingArticleToken } from './emojis.ts';
import { upgradeAvatarUrl, upgradePhotoUrl, extractVideoPosterUrl } from './urls.ts';
import { classifySocial, getRetweetedBy } from './social.ts';
import {
  ARTICLE_BODY,
  ARTICLE_READ_VIEW,
  resolveOwnership,
  ownerOf,
  type TweetOwnership,
} from './ownership.ts';

export type RichTokenType = 'text' | 'mention' | 'hashtag' | 'cashtag' | 'link' | 'emoji';

export interface RichToken {
  type: RichTokenType;
  value: string;
  href?: string;
}

/**
 * A node's children as an indexable list.
 *
 * `childNodes` is optional on the DOM shim and may be absent on a bare object,
 * and several walks here need it by index. One cast, one place to change.
 */
function childNodesOf(node: Node): ArrayLike<Node> {
  return (node as { childNodes?: ArrayLike<Node> }).childNodes || [];
}

/**
 * X's "Show more" affordance. A long post is truncated in the DOM and carries
 * this control beside (or inside) its body; the complete text is not in the
 * markup at all, only in the GraphQL `note_tweet` field.
 *
 * The label under it is X's localized UI wording ("显示更多", "Show more"), not
 * the author's words, so this subtree is kept out of the body. Whether X nests
 * it in `tweetText` or places it as a sibling has changed between layouts, so
 * the rule is applied by identity rather than by position.
 */
const SHOW_MORE_TESTID = 'tweet-text-show-more-link';
const SHOW_MORE_MARKER = `[data-testid="${SHOW_MORE_TESTID}"]`;

function isShowMoreMarker(el: Element): boolean {
  return el.getAttribute('data-testid') === SHOW_MORE_TESTID;
}

/** The article's reading surface inside a tweet, or null when there is none. */
function findArticleReadView(article: Element): Element | null {
  if (!article) return null;
  return article.querySelector(ARTICLE_READ_VIEW);
}


/**
 * Extracts author display name from User-Name container,
 * preserving Twemojis and excluding handle / timestamp.
 */
function extractDisplayName(userNameEl: Element): string {
  const handleLink = userNameEl.querySelector('a[href^="/"]:not([href*="/status/"])');
  const children = childNodesOf(userNameEl);

  if (handleLink) {
    let nameParts = '';
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === handleLink || child.contains(handleLink)) {
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
 * Extracts AuthorInfo (name, handle, high-res avatar, verified badge)
 * from an explicit container. Used for both the main tweet and the nested
 * quote box, so quote authors get identical treatment to the main author.
 */
function extractAuthorFrom(userNameEl: Element | null, scope: Element): AuthorInfo {
  const avatarImg = scope.querySelector('div[data-testid="Tweet-User-Avatar"] img') ||
    scope.querySelector('img[src*="profile_images"]');

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
  //    The first non-status anchor is the display-name link on current Twitter/X,
  //    so it must never be trusted as the handle text; derive it from href instead.
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
    scope.querySelector('svg[data-testid="icon-verified"]');
  const verified = Boolean(verifiedSvg);

  return {
    name,
    handle,
    avatarUrl,
    verified,
  };
}

/**
 * Extracts AuthorInfo (name, handle, high-res avatar, verified badge).
 */
function extractAuthorInfo(article: Element): AuthorInfo {
  return extractAuthorFrom(article.querySelector('div[data-testid="User-Name"]'), article);
}

/**
 * Extracts rich tokens (@mentions, #hashtags, $cashtags, URLs, emojis, text)
 * from tweetText element.
 */
function extractRichTokens(tweetTextEl: Element | null | undefined): RichToken[] {
  if (!tweetTextEl) return [];

  const tokens: RichToken[] = [];
  const children = childNodesOf(tweetTextEl);

  /**
   * True when a node would put anything visible on the card.
   *
   * Text is the obvious case, but an emoji renders as `<img alt="🔥">` whose
   * `textContent` is empty -- the glyph lives in the attribute. Treating that as
   * whitespace made a pic link followed by an emoji look like the last thing in
   * the body, so the token pass dropped a link the body-text stripper kept.
   */
  function siblingHasContent(node: Node): boolean {
    if ((node.textContent || '').trim() !== '') return true;
    const el = node as Element;
    if (typeof el.getAttribute === 'function' && (el.getAttribute('alt') || '').trim() !== '') {
      return true;
    }
    return false;
  }

  /**
   * True when nothing but whitespace follows `node` in the body.
   *
   * X appends the media permalink at the very end of the text, and a pic link
   * the author wrote mid-sentence is their own text. Position is what separates
   * them, and this walks up through wrappers to answer it: X nests the anchor
   * inside a `<span>` in some layouts, so comparing only the direct children of
   * the body missed it and left the token pass keeping a link the text stripper
   * had already removed.
   */
  function isTrailingNode(node: Node): boolean {
    let current: Node | null = node;
    while (current && current !== tweetTextEl) {
      const parent: Node | null = current.parentNode;
      if (!parent) return false;
      const siblings = childNodesOf(parent);
      let seen = false;
      for (let i = 0; i < siblings.length; i++) {
        if (siblings[i] === current) {
          seen = true;
          continue;
        }
        // Only what follows `current` counts; `seen` gates the check.
        if (seen && siblingHasContent(siblings[i])) return false;
      }
      current = parent;
    }
    return current === tweetTextEl;
  }

  function processNode(node: Node | null | undefined) {
    if (!node) return;

    // Node.TEXT_NODE === 3
    if (node.nodeType === 3) {
      // X's real line breaks live in the text as "\n" (the body renders as
      // pre-wrap), while indentation between elements must stay a single space.
      const val = normalizeTweetWhitespace(node.nodeValue || '');
      if (val) {
        tokens.push({ type: 'text', value: val });
      }
      return;
    }

    if (node.nodeType === 1) {
      const el = node as Element;

      // X's "Show more" control is chrome, not the author's words. Dropping it
      // here as well as in the text pass keeps the two views of the body in
      // agreement even when X nests the control inside `tweetText`.
      if (isShowMoreMarker(el)) return;

      const tagName = (el.tagName || '').toUpperCase();

      if (tagName === 'IMG') {
        const alt = el.getAttribute('alt');
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
        const href = el.getAttribute('href') || '';
        const title = el.getAttribute('title') || '';
        const text = restoreUnicodeEmojis(node);

        // Drop the media permalink X appends, and only that one: the host has to
        // match and the anchor has to be the last thing in the body. The host
        // rule lives in `isPicMediaLink` so this pass and the body-text stripper
        // cannot disagree about it; the position rule is why they used to
        // disagree, and it is now the same in both.
        //
        // The article permalink is not handled here: whether it is an appended
        // tail depends on whether this post carries an article, which this pass
        // cannot see. `extractTweetData` strips it from both fields afterwards,
        // only for a post that has one.
        if ((isPicMediaLink(href) || isPicMediaLink(text)) && isTrailingNode(el)) {
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

  return trimTokenEdges(tokens);
}

/**
 * Drops whitespace-only text tokens from the two ends of the body.
 *
 * The top-level children of X's body carry newline indentation around the
 * content, and a break that survives at an edge would print a blank first or
 * last line on the card. `tweet.text` trims its edges as well, so both views of
 * the same post agree. Interior whitespace is untouched: it is the body's own
 * paragraph structure.
 */
function trimTokenEdges(tokens: RichToken[]): RichToken[] {
  const isEdgeFiller = (token: RichToken) => token.type === 'text' && token.value.trim() === '';
  let start = 0;
  let end = tokens.length;
  while (start < end && isEdgeFiller(tokens[start])) start++;
  while (end > start && isEdgeFiller(tokens[end - 1])) end--;
  return start === 0 && end === tokens.length ? tokens : tokens.slice(start, end);
}

/**
 * Detects if a video container represents an animated GIF.
 *
 * X renders the GIF badge as a bare text node "GIF" with no aria-label, and no
 * data-testid exists for it (there is no `gifBadge` in the DOM). Because "GIF"
 * is a technical abbreviation it does not vary with the interface language,
 * which makes it more dependable than the localized labels used elsewhere.
 */
function isGifMedia(container: Element): boolean {
  if (!container) return false;
  const aria = container.getAttribute('aria-label') || '';
  if (aria.toUpperCase().includes('GIF')) return true;

  for (const el of Array.from(container.querySelectorAll('span, div'))) {
    if (el.textContent?.trim() === 'GIF') return true;
  }
  return false;
}

/**
 * Extracts video duration string (e.g. '0:42', '1:23', '12:05') from video controls.
 */
function extractVideoDuration(container: Element): string | undefined {
  if (!container) return undefined;

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
function extractVideoMedia(
  container: Element,
  ownership: TweetOwnership,
  excludeQuoted = false
): MediaItem | null {
  if (!container) return null;

  // A main-tweet scan must not adopt a video that belongs to a nested quote, nor
  // one embedded in the prose of a long-form post's article.
  const firstMatch = <E extends Element>(selector: string): E | undefined =>
    Array.from(container.querySelectorAll<E>(selector)).find((el) => {
      if (!excludeQuoted) return true;
      const owner = ownerOf(el, ownership);
      return owner.post === 'tweet' && !owner.inArticleBody;
    });

  // 1. Locate the video container. Verified against a live GIF post: the
  //    data-testid variants are no longer rendered, so only the bare <video>
  //    matched and targetContainer degraded to the whole article. The play
  //    button is the stable marker, so the container is derived from it rather
  //    than the other way round — a `:has()` ancestor selector would resolve to
  //    the outermost match and reintroduce that same problem. The aria-label
  //    match stays exact, since a `*=` substring match also catches external
  //    link cards such as YouTube previews.
  const playButton = firstMatch<Element>('button[data-testid="playButton"]');
  const mediaWrapper = playButton
    ? playButton.closest('div[data-testid="tweetPhoto"], div[style*="overflow"], div')
    : null;

  const selfMatchesVideo =
    container.matches?.('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"], video')
      ? container
      : null;

  const videoContainer = selfMatchesVideo || firstMatch<Element>(
    'div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"], video'
  ) || mediaWrapper;
  const videoEl = (firstMatch<HTMLVideoElement>('video') || (videoContainer?.tagName === 'VIDEO' ? videoContainer : null)) as HTMLVideoElement | null;

  // Check if any thumbnail specifically belongs to video
  const videoThumbImg = firstMatch<Element>(
    'img[src*="video_thumb"], img[src*="ext_tw_video_thumb"], img[src*="tweet_video_thumb"], img[src*="amplify_video_thumb"], img[src*="video_preview"]'
  );

  const targetContainer = videoContainer || container;
  const isGif = isGifMedia(targetContainer);
  const hasVideo = Boolean(videoContainer || videoEl || videoThumbImg || isGif);
  if (!hasVideo) return null;

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
    const p = videoEl.getAttribute('poster');
    if (p && String(p).trim().length > 0) {
      posterUrl = String(p).trim();
    }
  }

  // Strategy B: Any video thumbnail or preview img
  if (!posterUrl && videoThumbImg) {
    const src = videoThumbImg.getAttribute('src') || '';
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

  // Strategy D: Any preview img inside the video's own container.
  // Scoped to that container and away from tweetPhoto, otherwise a photo
  // sitting beside the video gets adopted as its poster frame and the tweet
  // ends up rendering the same image twice.
  if (!posterUrl && videoContainer) {
    const targetSlot = (targetContainer.closest ? targetContainer.closest('div[data-testid="tweetPhoto"]') : null) ||
      (targetContainer.getAttribute?.('data-testid') === 'tweetPhoto' ? targetContainer : null);
    const imgs = Array.from(videoContainer.querySelectorAll('img')).filter(img => {
      if (ownerOf(img, ownership).post === 'quote') return false;
      const photoWrapper = img.closest('div[data-testid="tweetPhoto"]');
      if (photoWrapper && photoWrapper !== targetSlot) return false;
      return true;
    });
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
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
      const style = el.getAttribute('style') || '';
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

  // Strategy G: Open Graph image. Scoped to the media container so it can only
  // ever supply this video's own poster; a document-level og:image reflects
  // whatever page the user happens to be on, not this tweet.
  if (!posterUrl && targetContainer) {
    const ogImg = targetContainer.querySelector('meta[property="og:image"]');
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

const VIDEO_THUMB_REGEX = /(?:amplify|ext_tw|tweet)_video_thumb|video_preview/;

function pushUniqueMediaItem(items: MediaItem[], candidate: MediaItem): void {
  const candidateKey = candidate.originalUrl || candidate.url;
  const duplicateIndex = items.findIndex((item) => (item.originalUrl || item.url) === candidateKey);
  if (duplicateIndex >= 0) {
    if (items[duplicateIndex].type === 'image' && candidate.type !== 'image') {
      items[duplicateIndex] = candidate;
    }
  } else if (items.length < 4) {
    items.push(candidate);
  }
}

/**
 * True when an image is a video's poster frame rather than a photo the author
 * attached. Counting one as a photo renders the same asset twice — once through
 * the photo pass and again as the video item — so both video and GIF posts must
 * exclude it.
 */
function isMediaPosterLayer(img: Element): boolean {
  // 1. X names video thumbnails distinctly from user photos (which live under
  //    /media/), so the source is the most direct signal. A GIF's poster is
  //    visible (no opacity:0), which is why the structural checks alone missed
  //    it and the same frame rendered twice.
  const src = img.getAttribute('src') || '';
  if (VIDEO_THUMB_REGEX.test(src)) return true;

  // 2. A <video> in the same tweetPhoto wrapper means this img is its poster.
  //    `closest('… video')` cannot express this: closest only matches
  //    ancestors, and an <img>'s ancestors are never a <video>, so the check
  //    silently never fired and regular video posters were collected as
  //    photos. The wrapper is located first, then queried for the video.
  const photoWrapper = img.closest('div[data-testid="tweetPhoto"]');
  if (photoWrapper && photoWrapper.querySelector('video')) {
    return true;
  }
  if (img.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]')) return true;

  // 3. A hidden poster layer layered behind the video.
  const style = img.getAttribute('style') || '';
  if (/opacity:\s*0(?:[;\s]|$)/i.test(style)) return true;

  return false;
}

/**
 * True when a media slot (e.g. tweetPhoto or player wrapper) exhibits video/GIF traits.
 */
function isVideoOrGifSlot(slot: Element): boolean {
  if (slot.querySelector('video, button[data-testid="playButton"], div[data-testid="previewInterstitial"]')) {
    return true;
  }
  if (isGifMedia(slot)) {
    return true;
  }
  const imgs = Array.from(slot.querySelectorAll('img'));
  return imgs.some((img) => VIDEO_THUMB_REGEX.test(img.getAttribute('src') || ''));
}

/**
 * Photos plus the video/GIF items for one container.
 *
 * A tweet can mix photos and videos/GIFs, or contain up to 4 distinct animated GIFs.
 * Scans each tweetPhoto slot individually so that multiple video/GIF items are preserved
 * without collapsing into a single item, and standalone players are incorporated without
 * duplicating the poster frames.
 */
function collectPhotoAndVideoMedia(
  container: Element,
  ownership: TweetOwnership,
  acceptPhoto: (img: Element) => boolean,
  excludeQuotedVideo = false
): MediaItem[] {
  const items: MediaItem[] = [];

  // A slot that belongs to the quoted post, or to the article's reading
  // surface, is not this tweet's media. The reading surface is excluded whole:
  // the article's cover is extracted separately as `article.cover`, so leaving
  // it here would render the same picture twice.
  const isExcluded = (el: Element) => {
    if (!excludeQuotedVideo) return false;
    const owner = ownerOf(el, ownership);
    return owner.post === 'quote' || owner.inArticle || owner.inArticleBody;
  };

  // 1. Scan primary media slots (tweetPhoto wrappers).
  // A tweet can contain multiple photos, GIFs, or a mix of both.
  const photoSlots = Array.from(container.querySelectorAll('div[data-testid="tweetPhoto"]')).filter(
    (slot) => !isExcluded(slot)
  );

  for (const slot of photoSlots.slice(0, 4)) {
    if (isVideoOrGifSlot(slot)) {
      const videoItem = extractVideoMedia(slot, ownership, excludeQuotedVideo);
      if (videoItem) {
        pushUniqueMediaItem(items, videoItem);
        continue;
      }
    }

    // Standard photo item inside slot
    const imgs = Array.from(slot.querySelectorAll('img')).filter(acceptPhoto);
    for (const img of imgs) {
      const rawSrc = img.getAttribute('src') || '';
      if (!rawSrc) continue;

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
      break;
    }
  }

  // 2. Scan standalone video elements outside tweetPhoto slots
  if (items.length < 4) {
    const standaloneVideoSlots = Array.from(
      container.querySelectorAll('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"]')
    ).filter((slot) => {
      if (slot.closest('div[data-testid="tweetPhoto"]')) return false;
      if (isExcluded(slot)) return false;
      return true;
    });

    for (const slot of standaloneVideoSlots) {
      if (items.length >= 4) break;
      const videoItem = extractVideoMedia(slot, ownership, excludeQuotedVideo);
      if (videoItem) {
        pushUniqueMediaItem(items, videoItem);
      }
    }
  }

  // 3. Fallback: whole-container scan for unnested video elements or legacy shapes
  if (items.length < 4) {
    const videoMedia = extractVideoMedia(container, ownership, excludeQuotedVideo);
    if (videoMedia) {
      pushUniqueMediaItem(items, videoMedia);
    }
  }

  return items.slice(0, 4);
}

/**
 * Extracts up to 4 high-res photos plus any video/GIF poster frame for the main
 * tweet. Excludes media belonging to nested quote tweets.
 *
 * A long-form post's article is excluded wholesale: its cover is extracted
 * separately as `article.cover` and mounted by the article layout, so leaving it
 * here would render the same picture twice. Its prose is excluded for the
 * stronger reason that its embedded posts are not this tweet's media.
 */
function extractTweetMedia(article: Element, ownership: TweetOwnership): MediaItem[] | undefined {
  const items = collectPhotoAndVideoMedia(
    article,
    ownership,
    (img) => {
      const owner = ownerOf(img, ownership);
      return owner.post === 'tweet' && !owner.inArticle && !owner.inArticleBody && !isMediaPosterLayer(img);
    },
    true
  );

  // External site link card (e.g. "来自 nintendo.com") only when nothing else.
  if (items.length === 0) {
    const cardMedia = extractLinkCardMedia(article, ownership);
    if (cardMedia) items.push(cardMedia);
  }

  return items.length > 0 ? items : undefined;
}

/**
 * The quoted post's own media, as X marks it in the preview shape.
 *
 * `nestedQuotePreview` is the container and `nestedQuotePreviewMedia` the media
 * link inside it. The wrapper has no `tweetPhoto`, so the photo pass — which
 * scans `div[data-testid="tweetPhoto"]` — finds nothing, and the media silently
 * disappeared. Neither testid appeared in any earlier snapshot, because every
 * one of those was captured from a quote that was the outermost level. Measured
 * 2026-10-14 against a real timeline entry.
 */
const NESTED_QUOTE_PREVIEW_MEDIA = '[data-testid="nestedQuotePreviewMedia"]';

/**
 * Extracts the preview image of an external link card (e.g. "来自 nintendo.com").
 * Twitter/X renders these inside `div[data-testid="card.wrapper"]`, which the
 * photo/video strategies do not recognise, so the media silently disappeared.
 */
function extractLinkCardMedia(
  container: Element,
  ownership: TweetOwnership,
  excludeQuoted = true
): MediaItem | undefined {
  const card = container.querySelector('[data-testid="card.wrapper"], [data-testid="card.layoutLarge.media"]');
  if (!card) return undefined;

  if (excludeQuoted) {
    // Scanned from the tweet itself: a link card in the quoted post is not
    // this tweet's.
    if (ownerOf(card, ownership).post === 'quote') return undefined;
  } else {
    // Scanned from inside a quoted post: a link card in *its* quoted post is
    // not this level's. That is the quote nested one level further in, which
    // the ownership already resolved.
    const nestedQuote = ownership.nestedQuoteBox;
    if (nestedQuote && nestedQuote !== card && nestedQuote.contains(card)) return undefined;
  }

  // Prefer the dedicated card image testid, then any non-avatar image.
  const img = card.querySelector('img[data-testid="card-image"], img[src*="card_img"]') ||
    Array.from(card.querySelectorAll('img')).find(candidate => {
      const src = candidate.getAttribute('src') || '';
      return src && !src.includes('profile_images') && !src.includes('/emoji/');
    });
  if (!img) return undefined;

  const src = (img.getAttribute('src') || '').replace(/&amp;/g, '&').trim();
  if (!src || src.includes('profile_images') || src.includes('/emoji/')) return undefined;

  const imgEl = img as unknown as { naturalWidth?: number; naturalHeight?: number };
  const w = imgEl.naturalWidth || Number.parseFloat(img.getAttribute('width') || '0') || 0;
  const h = imgEl.naturalHeight || Number.parseFloat(img.getAttribute('height') || '0') || 0;

  return {
    type: 'image',
    url: upgradePhotoUrl(src),
    originalUrl: src,
    alt: img.getAttribute('alt') || undefined,
    aspectRatio: (w > 0 && h > 0) ? Number((w / h).toFixed(3)) : undefined,
  };
}

/**
 * A picture element as the article's cover, or undefined.
 *
 * The cover arrives in two shapes — the read view's `tweetPhoto` and the
 * preview card's own picture — but what makes it usable is the same rule, so
 * it is stated once here.
 */
function coverFromImage(img: Element | null): MediaItem | undefined {
  if (!img) return undefined;
  const src = img.getAttribute('src') || '';
  if (!src || src.includes('profile_images') || src.includes('/emoji/')) return undefined;

  const imgEl = img as unknown as { naturalWidth?: number; naturalHeight?: number };
  const w = imgEl.naturalWidth || Number.parseFloat(img.getAttribute('width') || '0') || 0;
  const h = imgEl.naturalHeight || Number.parseFloat(img.getAttribute('height') || '0') || 0;

  return {
    type: 'image',
    url: upgradePhotoUrl(src),
    originalUrl: src,
    alt: img.getAttribute('alt') || undefined,
    aspectRatio: (w > 0 && h > 0) ? Number((w / h).toFixed(3)) : undefined,
  };
}

const ARTICLE_PREVIEW_COVER = '[data-testid="article-cover-image"]';

/**
 * The article preview card a list view renders, or undefined.
 *
 * A status page renders the article's reading surface inline; a list view
 * (profile, home) renders a preview card instead — a cover, then the title and
 * X's excerpt — and that card carries neither `twitterArticleReadView` nor
 * `twitter-article-title`. Reading only the read view found no article there:
 * the card lost its title and cover, and kept the `/i/article/` tail X appends
 * to the post's body.
 *
 * The cover wrapper is the card's only article marker; the title and excerpt
 * follow the cover in that order inside one box. Measured 2026-10-22 (see
 * `docs/observed-dom-2026-10-22-article-preview.md`). Nothing here reads the
 * badge's wording ("文章" / "Article"), which is localized.
 *
 * `openingLine` is deliberately not filled: X's excerpt is clamped to a few
 * lines with an ellipsis, not the article's opening line, and the post's own
 * body is the lead whenever it says anything.
 */
function extractArticlePreview(article: Element, ownership: TweetOwnership): ArticleData | undefined {
  const coverBox = Array.from(article.querySelectorAll(ARTICLE_PREVIEW_COVER)).find(
    (el) => ownerOf(el, ownership).post === 'tweet'
  );
  if (!coverBox) return undefined;

  const textBox = coverBox.nextElementSibling;
  const title = (textBox?.children?.[0]?.textContent || '').trim();

  // A preview with no title says nothing about the article; the card would
  // gain a cover it cannot name.
  if (!title) return undefined;

  return { title, cover: coverFromImage(coverBox.querySelector('img')) };
}

/**
 * Extracts the attached article of a long-form post, or undefined.
 *
 * The reading view is the anchor: a tweet either has one or does not, and the
 * title lives under its own testid. The cover is deliberately taken from the
 * read view's own `tweetPhoto` rather than from the prose, because the prose
 * embeds other posts whose pictures would otherwise be adopted as the cover.
 * List views have no read view; there the preview card answers instead.
 *
 * Nothing here reads interface wording. X's `alt` text on the cover is
 * localized ("图像" in a Chinese session), so a marker built on it would break
 * on the first non-English interface; the testids do not.
 */
function extractArticle(article: Element, ownership: TweetOwnership): ArticleData | undefined {
  const readView = findArticleReadView(article);
  if (!readView) return extractArticlePreview(article, ownership);

  const titleEl = readView.querySelector('[data-testid="twitter-article-title"]');
  const title = (titleEl?.textContent || '').trim();

  // A read view with no title is not a usable article: the card would gain a
  // cover stripped of the one line that identifies it.
  if (!title) return undefined;

  // No article id is reported. The only article links in the rendered DOM are
  // `/handle/article/<tweetId>/media/<mediaId>`, whose number is the tweet's id
  // and not the article's; reporting it would be wrong data rather than missing
  // data, and nothing on the card reads an article id anyway.

  // The article's own opening line. X renders it inside the prose region as the
  // first paragraph, so it is read from there rather than invented; it is only
  // used as the card's lead when the post itself says nothing.
  //
  // Queried as `p` alone, never `p, div`: a selector list matches the first
  // node in document order, and the prose container (`longformRichTextComponent`)
  // is itself a `div` that comes before every paragraph — so `p, div` returned
  // the whole article as its own opening line.
  const proseEl = readView.querySelector(ARTICLE_BODY);
  const firstPara = proseEl?.querySelector('p');
  const openingLine = firstPara ? cleanTweetText(firstPara).trim() : '';

  // The cover is the read view's own picture, not one from the prose.
  const coverImg = Array.from(readView.querySelectorAll('div[data-testid="tweetPhoto"] img')).find(
    (img) => !ownerOf(img, ownership).inArticleBody
  );

  return { title, cover: coverFromImage(coverImg || null), openingLine: openingLine || undefined };
}

/**
 * Detects an unavailable/deleted post placeholder by structure rather than by
 * its notice text: a permalink is present but both the identity and body
 * containers are missing. X treats unavailable posts as absent data rather
 * than a special text state, and this survives copy changes and localization.
 */
function isUnavailableMarker(container: Element): boolean {
  const hasPermalink = !!container.querySelector('a[href*="/status/"]');
  const hasIdentity = !!container.querySelector('div[data-testid="User-Name"]');
  const hasBody = !!container.querySelector('div[data-testid="tweetText"]');
  if (hasPermalink && !hasIdentity && !hasBody) return true;
  // Some variants carry no permalink at all but still render no identity.
  return !hasIdentity && !hasBody && !!container.textContent?.trim();
}

/**
 * True when `el` lives inside `scope` but not inside a nested quote *within*
 * `scope`.
 *
 * This is what keeps one quote level's own fields its own. X renders a quoted
 * post's own identity, body, media and permalink in the same box as the quote it
 * carries, so every `querySelector` on the box would otherwise answer about the
 * deeper post — and the measured shapes prove it matters: a bodyless outer quote
 * (quoting a picture-only post) takes the inner quote's words as its own, and
 * the inner quote's picture lands in the outer's media list.
 *
 * `nestedInScope` is the quote box nested inside `scope`, resolved once by the
 * caller: these predicates run once per candidate element, and re-resolving the
 * container on every call repeats the same walk for every `User-Name`,
 * `tweetText`, link and `time` in the box.
 */
function isOwnedBy(
  el: Element | null | undefined,
  scope: Element,
  nestedInScope: Element | null
): boolean {
  if (!el) return false;
  if (el === scope) return false;
  if (!scope.contains(el)) return false;
  if (!nestedInScope) return true;
  return !(nestedInScope === el || nestedInScope.contains(el));
}

/** True when `el` sits in the quote nested inside the box being read, not in the box itself. */
function isInsideQuoteOf(
  el: Element,
  nestedInScope: Element | null
): boolean {
  if (!nestedInScope) return false;
  return nestedInScope === el || nestedInScope.contains(el);
}

/**
 * The post's own permalink from an href, or undefined.
 *
 * X links the quoted post by its status URL; the preview shape may carry only a
 * link to one of its media (`…/status/<id>/photo/1`), which is a picture inside
 * the post rather than the post. The status segment is therefore taken and the
 * rest of the path dropped, so the card links to the post every time. A href
 * with no status segment yields nothing: without it there is no permalink, and
 * inventing one from a profile link would point at the account instead.
 *
 * The link's own host is kept: rewriting it would point the card at a host the
 * author never linked.
 */
function statusPermalink(href: string): string | undefined {
  if (!href) return undefined;
  const absolute = /^https?:\/\/[^/]+(\/.*)$/.exec(href);
  const host = absolute ? href.slice(0, href.length - absolute[1].length) : 'https://x.com';
  const path = absolute ? absolute[1] : href;
  const status = /\/status\/(\d+)/.exec(path);
  if (!status) return undefined;
  return `${host}${path.slice(0, status.index + status[0].length)}`;
}

/**
 * Extracts one Quote Tweet level (author, text, media, timestamp) and the quote
 * it carries, when it carries one.
 *
 * The nesting is read by the same finder the top level uses, seeded with the box
 * being read: that is what makes the levels distinct rather than one box
 * reported twice. The ownership of the scope is resolved once here and passed
 * down, so the level below resolves its own rather than re-walking the markup
 * for every candidate it reads.
 */
function extractQuoteTweet(
  ownership: TweetOwnership,
  depth: number = 1
): QuoteTweetData | undefined {
  const quoteBox = ownership.quoteBox;

  if (!quoteBox) return undefined;

  // The quote nested inside this box, resolved once: every ownership check
  // below asks about the same container, so resolving it per candidate would
  // repeat the identical walk for each `User-Name`, `tweetText`, link, `time`
  // and image in the box.
  const nestedInScope = ownership.nestedQuoteBox;

  // Handle deleted or unavailable quote post tombstone. Detected structurally
  // (a permalink with neither identity nor body) rather than by matching the
  // notice text, which exists in many languages and drifts with X's copy.
  if (isUnavailableMarker(quoteBox)) {
    // The same shape the GraphQL channel builds for a tombstone, from one
    // constructor: the point of answering this state at all is that the two
    // channels must not disagree about the same post.
    return unavailableQuote();
  }

  // Author (scoped to the quote box so the main author never leaks in)
  const quoteUser = Array.from(quoteBox.querySelectorAll('div[data-testid="User-Name"]')).find(
    (candidate) => isOwnedBy(candidate, quoteBox, nestedInScope)
  );
  const quoteAuthor = extractAuthorFrom(quoteUser ?? null, quoteBox);

  // Text. The bodyless outer quote is the case the ownership rule is for: the
  // first tweetText in the box belongs to the inner quote, and reading it here
  // printed a stranger's words as this quote's own.
  const textEl = Array.from(quoteBox.querySelectorAll('div[data-testid="tweetText"]')).find(
    (candidate) => isOwnedBy(candidate, quoteBox, nestedInScope)
  );
  const text = textEl ? cleanTweetText(textEl, isShowMoreMarker) : '';
  const quoteRichTokens = textEl ? extractRichTokens(textEl) : [];

  // Permalink to the quoted post. A previewed quote may carry only a link to
  // the post's media (`…/photo/1`) rather than to the post itself, so the
  // status segment is taken from the href and the rest of the path dropped:
  // the URL the card links to is the post, not one picture inside it.
  const quoteStatusLink = Array.from(quoteBox.querySelectorAll('a[href*="/status/"]')).find(
    (candidate) => isOwnedBy(candidate, quoteBox, nestedInScope)
  );
  const quoteUrl = statusPermalink(quoteStatusLink?.getAttribute('href') || '');

  // Timestamp
  const timeEl = Array.from(quoteBox.querySelectorAll('time')).find(
    (candidate) => isOwnedBy(candidate, quoteBox, nestedInScope)
  );
  const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

  // Media: photos plus any video/GIF, with the video's own poster frame merged
  // away exactly as for the main tweet. Without this the quoted poster rendered
  // twice: once as a photo and again as the video item with its play badge.
  //
  // The nested quote's own media is filtered out here, so this level's list
  // holds only what the quoted post itself attached. The deeper quote is only
  // read while the card would print it.
  const nested = depth < QUOTE_LEVELS && nestedInScope
    ? extractQuoteTweet(resolveOwnership(quoteBox), depth + 1)
    : undefined;
  const media = collectPhotoAndVideoMedia(
    quoteBox,
    ownership,
    (img) => !isMediaPosterLayer(img) && !isInsideQuoteOf(img, nestedInScope)
  );

  // X's preview shape marks a quoted post's own media with its own testid
  // instead of the `tweetPhoto` wrapper the photo pass scans, so a quote read
  // from that shape had no media at all. The picture is a 120px thumbnail X
  // clips beside the clamped body — it is the asset X itself renders, so it is
  // what gets mounted.
  const previewMedia = Array.from(quoteBox.querySelectorAll(`${NESTED_QUOTE_PREVIEW_MEDIA} img`));
  for (const img of previewMedia) {
    if (isInsideQuoteOf(img, nestedInScope)) continue;
    const src = (img.getAttribute('src') || '').replace(/&amp;/g, '&').trim();
    if (!src || src.includes('profile_images') || src.includes('/emoji/')) continue;
    media.push({
      type: 'image',
      url: upgradePhotoUrl(src),
      originalUrl: src,
      alt: img.getAttribute('alt') || undefined,
    });
  }

  // Quoted post may itself only carry an external link card.
  if (media.length === 0) {
    const quoteCardMedia = extractLinkCardMedia(quoteBox, ownership, false);
    if (quoteCardMedia) media.push(quoteCardMedia);
  }

  type CompatibleToken = NonNullable<TweetData['richTokens']>[number];

  // A marker that yielded no identity and no body is not a usable quote: X
  // leaves empty shells in some layouts, and rendering one produces a blank box.
  if (!text && !quoteAuthor.name && !quoteAuthor.handle && media.length === 0) {
    return undefined;
  }

  return {
    author: quoteAuthor,
    text,
    richTokens: quoteRichTokens.length > 0 ? (quoteRichTokens as unknown as CompatibleToken[]) : undefined,
    timestamp,
    url: quoteUrl,
    media: media.length > 0 ? media : undefined,
    quotePost: nested,
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
function extractTweetStats(article: Element, ownership: TweetOwnership): TweetStats | undefined {
  // The article's prose embeds other posts, and those carry an action bar of
  // their own. Document order puts the embedded one first, so a plain
  // `querySelector` reported a stranger's counts as this tweet's.
  const actionBars = Array.from(article.querySelectorAll('div[role="group"]'));
  const actionBar = actionBars.find((bar) => {
    const owner = ownerOf(bar, ownership);
    return owner.post === 'tweet' && !owner.inArticleBody;
  });
  if (!actionBar) return undefined;

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
 * The main post's own status link, never one belonging to a quoted post.
 *
 * Every level of a quote chain carries a `/status/` link, and a quoted post's
 * link can come first in document order — in the preview shape the deepest
 * level's is the only one in the whole box. Matching by the `quoteTweet` testid
 * alone is what left that shape reading a stranger's URL as the main tweet's;
 * the testid is absent from it entirely. So the boundary is the resolved quote
 * container, the same one the media and stats passes already draw.
 */
function findTweetStatusLink(article: Element, ownership: TweetOwnership): Element | null {
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (ownerOf(link, ownership).post === 'quote') continue;
    return link;
  }
  return null;
}

/**
 * Extracts tweet ID from status link or current URL.
 */
export function extractTweetId(article: Element): string {
  const statusLink = findTweetStatusLink(article, resolveOwnership(article));
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
function extractTweetUrl(article: Element): string {
  const statusLink = findTweetStatusLink(article, resolveOwnership(article));
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
function extractTimestamp(article: Element, ownership: TweetOwnership): string {
  const timeEls = Array.from(article.querySelectorAll('time'));
  const validTime = timeEls.find(t => ownerOf(t, ownership).post === 'tweet');
  if (validTime) {
    return validTime.getAttribute('datetime') || validTime.textContent?.trim() || '';
  }
  return '';
}

/**
 * Text of X's "translated from <language>" notice, or undefined when the post is
 * shown in its original language.
 *
 * X renders the notice as a row directly above the body: a translate glyph, the
 * label, and a "show original" toggle button. The row has no data-testid and the
 * label is localized by X, so it is identified structurally — the sibling
 * immediately before the body that carries a button. The toggle itself is
 * dropped because a static card cannot be clicked.
 */
function extractTranslationNotice(tweetTextEl: Element | null | undefined): string | undefined {
  if (!tweetTextEl) return undefined;

  const notice = tweetTextEl.previousElementSibling;
  if (!notice) return undefined;

  // The toggle is what separates this row from any other sibling; a post body is
  // never preceded by an unrelated button.
  if (!notice.querySelector('button')) return undefined;

  const rawLabel = Array.from(notice.querySelectorAll('span'))
    .find(span => !span.closest('button'))
    ?.textContent?.trim();

  return rawLabel ? rawLabel.replace(/\s+/g, ' ') : undefined;
}

/**
 * The "Show more" marker that belongs to this tweet, or null.
 *
 * A quoted post can carry a truncated body of its own, and that marker is not
 * this tweet's — the media and stats passes already draw the same quote
 * boundary. A marker inside an article's reading surface is excluded too: that
 * prose is not printed, so a cut in it says nothing about the card. Every
 * marker is considered, not just the first: a tweet's own can sit after a
 * quote's in document order, and stopping at the first would miss it.
 */
function findTruncationMarker(article: Element, ownership: TweetOwnership): Element | null {
  const markers = article.querySelectorAll(SHOW_MORE_MARKER);
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const owner = ownerOf(marker, ownership);
    if (owner.post === 'quote') continue;
    if (owner.inArticle) continue;
    return marker;
  }
  return null;
}

/**
 * Extracts complete, production-grade TweetData model from a tweet article DOM element.
 */
export function extractTweetData(article: Element): TweetData | null {
  if (!article) return null;

  // Who owns what in this tweet, resolved once. Every pass below asks the same
  // question — is this element the tweet's own, the quoted post's, or the
  // article's — and the answer does not change between one element and the
  // next, so it is asked once here rather than walked again per candidate.
  const ownership = resolveOwnership(article);

  const id = extractTweetId(article);
  const url = extractTweetUrl(article);
  const author = extractAuthorInfo(article);

  const tweetTextEl = article.querySelector('div[data-testid="tweetText"]');
  const validTextEl =
    tweetTextEl && ownerOf(tweetTextEl, ownership).post === 'tweet' ? tweetTextEl : null;
  const articleData = extractArticle(article, ownership);

  // A post carrying an article ends with a link to it that X does not render.
  // Whether that link is an appended tail depends on the article being present,
  // so the strip is applied here — to `text` and the tokens alike, since `text`
  // is what the card falls back to when the token list is empty — and only for a
  // post that has one. A tweet merely ending with a link to someone else's
  // article keeps it: that is the author's own text.
  let text = validTextEl ? cleanTweetText(validTextEl, isShowMoreMarker) : '';
  let richTokens = validTextEl ? extractRichTokens(validTextEl) : [];
  if (articleData) {
    text = stripTrailingArticleLink(text);
    richTokens = stripTrailingArticleToken(richTokens) || [];
  }

  const timestamp = extractTimestamp(article, ownership);
  const stats = extractTweetStats(article, ownership);
  const media = extractTweetMedia(article, ownership);
  const quotePost = extractQuoteTweet(ownership);
  const retweetedBy = getRetweetedBy(article);
  const translatedFrom = validTextEl ? extractTranslationNotice(validTextEl) : undefined;
  // X showed a preview with its "Show more" control; the rest of the body is not
  // in the DOM. The card states the cut rather than inventing an ending.
  const truncated = Boolean(findTruncationMarker(article, ownership));

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
    article: articleData,
    retweetedBy: retweetedBy || undefined,
    translatedFrom,
    truncated: truncated || undefined,
    isThreadPart: false,
    // Diagnostic only. A rise in `none` is the early signal that X changed its
    // DOM, ahead of user reports: there is one text path (`tweetText`) and one
    // media path, so a record either found its anchor or did not.
    diagnostics: {
      text: validTextEl ? 'testid' : 'none',
      media: media && media.length > 0 ? 'testid' : 'none',
      isUnavailable: isUnavailableMarker(article),
      social: classifySocial(article),
    },
  };
}
