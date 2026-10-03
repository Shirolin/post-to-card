/**
 * Twitter/X DOM Extractor.
 * Extracts structured TweetData from Twitter/X article elements:
 * author metadata, native Unicode text, rich tokens (@mentions, #hashtags, $cashtags, URLs),
 * multi-image grids (1-4 images), video poster frames, nested quote tweets, and engagement stats.
 */

import type { TweetData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData } from '../../types/tweet.ts';
import { restoreUnicodeEmojis, cleanTweetText, normalizeTweetWhitespace } from './emojis.ts';
import { upgradeAvatarUrl, upgradePhotoUrl, extractVideoPosterUrl } from './urls.ts';
import { classifySocial, getRetweetedBy } from './social.ts';

export type RichTokenType = 'text' | 'mention' | 'hashtag' | 'cashtag' | 'link' | 'emoji';

export interface RichToken {
  type: RichTokenType;
  value: string;
  href?: string;
}

/**
 * Returns true when `el` sits inside an <article> that is itself nested in
 * another <article> (how X sometimes renders a quoted post).
 */
function isInsideNestedArticle(el: Element): boolean {
  let curr: Element | null = el.parentElement;
  let seenArticle = false;
  while (curr) {
    if ((curr.tagName || '').toUpperCase() === 'ARTICLE') {
      if (seenArticle) return true;
      seenArticle = true;
    }
    curr = curr.parentElement;
  }
  return false;
}

/**
 * Locates the quoted-post container inside a tweet article.
 *
 * X has changed the marker for this box more than once, and a missed match is
 * silent: the quote is dropped AND its media leaks into the main tweet. So we
 * fall back through progressively weaker structural signals instead of trusting
 * a single data-testid.
 */
export function findQuoteContainer(article: Element): Element | null {
  if (!article || typeof article.querySelector !== 'function') return null;

  // 1. Canonical marker used by current X.
  const byTestId = article.querySelector('div[data-testid="quoteTweet"]');
  if (byTestId) return byTestId;

  // 2. Nested <article> — the quoted post rendered as its own article.
  //    Filter out `article` itself: some DOM shims make querySelector match the
  //    root, and the real DOM never matches the element you query from.
  const nestedArticles = Array.from(article.querySelectorAll('article')).filter(a => a !== article);
  if (nestedArticles.length > 0) return nestedArticles[0];

  // 3. Structural fallback: any descendant that owns a second User-Name plus a
  //    tweetText, while not containing the main post's User-Name.
  const mainUserName = article.querySelector('div[data-testid="User-Name"]');
  const allUserNames = Array.from(article.querySelectorAll('div[data-testid="User-Name"]'));
  for (const userName of allUserNames) {
    if (userName === mainUserName) continue;

    let node: Element | null = userName.parentElement;
    while (node && node !== article) {
      if (node.querySelector('div[data-testid="tweetText"]')) {
        if (!mainUserName || !node.contains(mainUserName)) return node;
        break;
      }
      node = node.parentElement;
    }
  }

  return null;
}

/**
 * Checks if a given DOM element is nested inside a Quote Tweet box.
 */
function isInsideQuoteTweet(el: Element): boolean {
  if (typeof el.closest === 'function' && el.closest('div[data-testid="quoteTweet"]')) {
    return true;
  }

  if (isInsideNestedArticle(el)) return true;

  // Structural fallback: compare against the resolved quote container of the
  // nearest article so media filtering stays in sync with quote extraction.
  const article = typeof el.closest === 'function' ? el.closest('article') : null;
  if (article) {
    const quote = findQuoteContainer(article);
    if (quote && quote !== el && quote.contains(el)) return true;
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
export function extractAuthorInfo(article: Element): AuthorInfo {
  return extractAuthorFrom(article.querySelector('div[data-testid="User-Name"]'), article);
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

        // Skip the trailing media permalink. X serves these from both
        // pic.twitter.com (legacy) and pic.x.com (current); missing the latter
        // let it fall through to the mention branch below and leak into the
        // rendered body text. Match the pic host in either the href or the
        // visible label — a bare "text equals href" test also swallowed genuine
        // self-labelled links (e.g. a URL whose label is the URL itself).
        const isMediaPermalink = /pic\.(?:twitter|x)\.com/.test(href) ||
          /pic\.(?:twitter|x)\.com/.test(text);
        if (isMediaPermalink) {
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
 *
 * X renders the GIF badge as a bare text node "GIF" with no aria-label, and no
 * data-testid exists for it (there is no `gifBadge` in the DOM). Because "GIF"
 * is a technical abbreviation it does not vary with the interface language,
 * which makes it more dependable than the localized labels used elsewhere.
 */
export function isGifMedia(container: Element): boolean {
  if (!container) return false;
  const aria = (typeof container.getAttribute === 'function' ? container.getAttribute('aria-label') : '') || '';
  if (aria.toUpperCase().includes('GIF')) return true;

  if (typeof container.querySelector === 'function') {
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
export function extractVideoMedia(container: Element, excludeQuoted = false): MediaItem | null {
  if (!container) return null;

  // A main-tweet scan must not adopt a video that belongs to a nested quote.
  const firstMatch = <E extends Element>(selector: string): E | undefined =>
    Array.from(container.querySelectorAll<E>(selector)).find(
      (el) => !excludeQuoted || !isInsideQuoteTweet(el)
    );

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
    ? (typeof playButton.closest === 'function'
        ? playButton.closest('div[data-testid="tweetPhoto"], div[style*="overflow"], div')
        : null)
    : null;

  const videoContainer = firstMatch<Element>(
    'div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"], video'
  ) || mediaWrapper;
  const videoEl = (firstMatch<HTMLVideoElement>('video') || (videoContainer?.tagName === 'VIDEO' ? videoContainer : null)) as HTMLVideoElement | null;

  // Check if any thumbnail specifically belongs to video
  const videoThumbImg = firstMatch<Element>(
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

  // Strategy D: Any preview img inside the video's own container.
  // Scoped to that container and away from tweetPhoto, otherwise a photo
  // sitting beside the video gets adopted as its poster frame and the tweet
  // ends up rendering the same image twice.
  if (!posterUrl && videoContainer) {
    const imgs = Array.from(videoContainer.querySelectorAll('img')).filter(img => {
      if (isInsideQuoteTweet(img)) return false;
      if (typeof img.closest === 'function' && img.closest('div[data-testid="tweetPhoto"]')) return false;
      return true;
    });
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

  // Strategy G: Open Graph image. Scoped to the media container so it can only
  // ever supply this video's own poster; a document-level og:image reflects
  // whatever page the user happens to be on, not this tweet.
  if (!posterUrl && targetContainer && typeof targetContainer.querySelector === 'function') {
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
  if (/(?:amplify|ext_tw|tweet)_video_thumb|video_preview/.test(src)) return true;

  if (typeof img.closest === 'function') {
    // 2. A <video> in the same tweetPhoto wrapper means this img is its poster.
    //    `closest('… video')` cannot express this: closest only matches
    //    ancestors, and an <img>'s ancestors are never a <video>, so the check
    //    silently never fired and regular video posters were collected as
    //    photos. The wrapper is located first, then queried for the video.
    const photoWrapper = img.closest('div[data-testid="tweetPhoto"]');
    if (photoWrapper && typeof photoWrapper.querySelector === 'function' && photoWrapper.querySelector('video')) {
      return true;
    }
    if (img.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]')) return true;
  }

  // 3. A hidden poster layer layered behind the video.
  const style = img.getAttribute('style') || '';
  if (/opacity:\s*0(?:[;\s]|$)/i.test(style)) return true;

  return false;
}

/**
 * Photos plus the video/GIF item for one container.
 *
 * A tweet can mix photos and a video, so the two sources are merged rather than
 * letting the video short-circuit the photo pass. The video's poster is also an
 * <img>, so the photo pass can collect the very same asset; listing it twice
 * renders the frame twice — once plain and once with the play badge — so an
 * exact match is dropped in favour of the video item, which carries the
 * duration. `acceptPhoto` lets the main tweet reject the quoted post's photos.
 */
function collectPhotoAndVideoMedia(
  container: Element,
  acceptPhoto: (img: Element) => boolean,
  excludeQuotedVideo = false
): MediaItem[] {
  const items: MediaItem[] = [];
  const photoEls = Array.from(container.querySelectorAll('div[data-testid="tweetPhoto"] img')).filter(acceptPhoto);

  for (const img of photoEls.slice(0, 4)) {
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
  }

  // The card renderer caps layouts at 4 items, so a combined set is trimmed whole.
  if (items.length < 4) {
    const videoMedia = extractVideoMedia(container, excludeQuotedVideo);
    if (videoMedia) {
      const posterKey = videoMedia.originalUrl || videoMedia.url;
      const duplicateIndex = items.findIndex(
        (item) => item.type === 'image' && (item.originalUrl || item.url) === posterKey
      );
      if (duplicateIndex >= 0) items.splice(duplicateIndex, 1);
      items.push(videoMedia);
    }
  }

  return items;
}

/**
 * Extracts up to 4 high-res photos plus any video/GIF poster frame for the main
 * tweet. Excludes media belonging to nested quote tweets.
 */
export function extractTweetMedia(article: Element): MediaItem[] | undefined {
  const items = collectPhotoAndVideoMedia(
    article,
    (img) => !isInsideQuoteTweet(img) && !isMediaPosterLayer(img),
    true
  );

  // External site link card (e.g. "来自 nintendo.com") only when nothing else.
  if (items.length === 0) {
    const cardMedia = extractLinkCardMedia(article);
    if (cardMedia) items.push(cardMedia);
  }

  return items.length > 0 ? items : undefined;
}

/**
 * Extracts the preview image of an external link card (e.g. "来自 nintendo.com").
 * Twitter/X renders these inside `div[data-testid="card.wrapper"]`, which the
 * photo/video strategies do not recognise, so the media silently disappeared.
 */
function extractLinkCardMedia(article: Element): MediaItem | undefined {
  const card = article.querySelector('div[data-testid="card.wrapper"], div[data-testid="card.layoutLarge.media"]');
  if (!card || isInsideQuoteTweet(card)) return undefined;

  // Prefer the dedicated card image testid, then any non-avatar image.
  const img = card.querySelector('img[data-testid="card-image"], img[src*="card_img"]') ||
    Array.from(card.querySelectorAll('img')).find(candidate => {
      const src = candidate.getAttribute('src') || '';
      return src && !src.includes('profile_images') && !src.includes('/emoji/');
    });
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
 * Extracts nested Quote Tweet data (author, text, media, timestamp).
 */
export function extractQuoteTweet(article: Element): QuoteTweetData | undefined {
  const quoteBox = findQuoteContainer(article);

  if (!quoteBox) return undefined;

  // Handle deleted or unavailable quote post tombstone. Detected structurally
  // (a permalink with neither identity nor body) rather than by matching the
  // notice text, which exists in many languages and drifts with X's copy.
  if (isUnavailableMarker(quoteBox)) {
    return {
      author: { name: '', handle: '', avatarUrl: '' },
      text: '',
      timestamp: '',
      isUnavailable: true,
    };
  }

  // Author (scoped to the quote box so the main author never leaks in)
  const quoteUser = quoteBox.querySelector('div[data-testid="User-Name"]');
  const quoteAuthor = extractAuthorFrom(quoteUser, quoteBox);

  // Text
  const textEl = quoteBox.querySelector('div[data-testid="tweetText"]');
  const text = textEl ? cleanTweetText(textEl) : '';
  const quoteRichTokens = textEl ? extractRichTokens(textEl) : [];

  // Permalink to the quoted post
  const quoteStatusLink = quoteBox.querySelector('a[href*="/status/"]');
  const quoteHref = quoteStatusLink?.getAttribute('href') || '';
  const quoteUrl = quoteHref
    ? (quoteHref.startsWith('http') ? quoteHref : `https://x.com${quoteHref}`)
    : undefined;

  // Timestamp
  const timeEl = quoteBox.querySelector('time');
  const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

  // Media: photos plus any video/GIF, with the video's own poster frame merged
  // away exactly as for the main tweet. Without this the quoted poster rendered
  // twice: once as a photo and again as the video item with its play badge.
  const media = collectPhotoAndVideoMedia(quoteBox, (img) => !isMediaPosterLayer(img));

  // Quoted post may itself only carry an external link card.
  if (media.length === 0) {
    const quoteCardMedia = extractLinkCardMedia(quoteBox);
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
 * Text of X's "translated from <language>" notice, or undefined when the post is
 * shown in its original language.
 *
 * X renders the notice as a row directly above the body: a translate glyph, the
 * label, and a "show original" toggle button. The row has no data-testid and the
 * label is localized by X, so it is identified structurally — the sibling
 * immediately before the body that carries a button. The toggle itself is
 * dropped because a static card cannot be clicked.
 */
export function extractTranslationNotice(tweetTextEl: Element | null | undefined): string | undefined {
  if (!tweetTextEl) return undefined;

  const notice = tweetTextEl.previousElementSibling;
  if (!notice || typeof notice.querySelector !== 'function') return undefined;

  // The toggle is what separates this row from any other sibling; a post body is
  // never preceded by an unrelated button.
  if (!notice.querySelector('button')) return undefined;

  const label = Array.from(notice.querySelectorAll('span'))
    .find(span => !(typeof span.closest === 'function' && span.closest('button')))
    ?.textContent?.trim();

  return label || undefined;
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
  const retweetedBy = getRetweetedBy(article);
  const translatedFrom = validTextEl ? extractTranslationNotice(validTextEl) : undefined;

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
    retweetedBy: retweetedBy || undefined,
    translatedFrom,
    isThreadPart: false,
    // Diagnostic only. A rising count of fallback/none values is the early
    // signal that X changed its DOM, ahead of user reports.
    diagnostics: {
      text: validTextEl ? 'testid' : (text ? 'fallback' : 'none'),
      media: media && media.length > 0 ? 'testid' : 'none',
      isUnavailable: isUnavailableMarker(article),
      social: classifySocial(article),
    },
  };
}
