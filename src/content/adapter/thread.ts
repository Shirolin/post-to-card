/**
 * Continuous same-author thread detection and assembly for Twitter/X.
 * Scans forward and backward along the DOM timeline to reconstruct continuous threads
 * with strict multi-signal validation (route context, DOM connector lines, self-reply detection,
 * and temporal consistency) to eliminate misjudgments on profile timelines and feeds.
 */

import type { TweetData, ThreadData } from '../../types/tweet';
import { extractTweetData } from './extractor';

/**
 * Detects whether a tweet article element is an advertisement or sponsored post.
 */
export function isAdOrSponsored(article: Element): boolean {
  if (!article) return false;

  // 1. Placement tracking container
  if (article.querySelector('[data-testid="placementTracking"]')) {
    return true;
  }

  // 2. data-testid-placement attribute
  if (article.getAttribute('data-testid-placement') === 'ad') {
    return true;
  }

  // 3. Promoted or sponsored text without valid tweet timestamp link
  const rawText = article.textContent || '';
  if (/\b(?:Promoted|赞助)\b/i.test(rawText)) {
    const hasStatusLink = article.querySelector('a[href*="/status/"]');
    if (!hasStatusLink || article.querySelector('[data-testid="placementTracking"]')) {
      return true;
    }
  }

  return false;
}

/**
 * Detects whether the current page is a Tweet Status Detail Page (/status/123...).
 */
export function isStatusDetailPage(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  return /\/status\/\d+/i.test(window.location.pathname || '');
}

/**
 * Extracts the handle of the user that this tweet is explicitly replying to, if any.
 * Matches patterns like "Replying to @handle", "回复 @handle", "返信先: @handle".
 */
export function getReplyingToHandle(article: Element): string | null {
  if (!article) return null;

  const rawText = article.textContent || '';
  if (!/(?:replying to|回复|返信先)/i.test(rawText)) {
    return null;
  }

  const links = Array.from(article.querySelectorAll('a[href^="/"]:not([href*="/status/"])'));
  for (const link of links) {
    const text = link.textContent?.trim() || '';
    if (text.startsWith('@')) {
      const parentText = link.parentElement?.textContent || '';
      if (/(?:replying to|回复|返信先)/i.test(parentText)) {
        return text.toLowerCase();
      }
    }
  }

  return null;
}

/**
 * Checks if a tweet article possesses explicit native Twitter thread connector lines.
 * Twitter places a 2px-wide vertical bar in/near the avatar column when connected in a thread.
 */
export function hasNativeThreadConnector(article: Element, _direction: 'down' | 'up' = 'down'): boolean {
  if (!article) return false;

  // 1. Explicit classes in fixtures or Twitter
  if (
    article.classList?.contains('thread-root') ||
    article.classList?.contains('thread-middle') ||
    article.classList?.contains('thread-end') ||
    article.querySelector('.thread-connector-line, [data-testid="thread-connector"]')
  ) {
    return true;
  }

  // 2. Avatar column line detection
  const avatarEl = article.querySelector('div[data-testid="Tweet-User-Avatar"]');
  if (avatarEl && avatarEl.parentElement) {
    const parent = avatarEl.parentElement;
    const elements = Array.from(parent.querySelectorAll('div'));
    for (const el of elements) {
      if (el === avatarEl || avatarEl.contains(el)) continue;
      const styleAttr = el.getAttribute('style') || '';
      const className = el.className || '';
      if (
        /width:\s*2px/i.test(styleAttr) ||
        /border-(?:left|right):\s*2px/i.test(styleAttr) ||
        /\br-11mg6pl\b|\br-14lw9vd\b|\br-16y2uox\b/.test(className)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if article contains a "Show this thread" link.
 */
export function hasShowThisThread(article: Element): boolean {
  if (!article) return false;
  const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
  return links.some(l => /(?:show this thread|显示此推文串|このスレッドを表示|afficher ce fil|thread anzeigen|mostrar este hilo)/i.test(l.textContent || ''));
}

/**
 * Checks whether two tweets are temporally and sequence-wise consistent with a thread.
 */
export function isTemporallyConnected(tweetA: TweetData, tweetB: TweetData, isForward: boolean = true): boolean {
  // If both have timestamps, verify difference is under 48 hours and not drastically reversed
  if (tweetA.timestamp && tweetB.timestamp) {
    const tA = new Date(tweetA.timestamp).getTime();
    const tB = new Date(tweetB.timestamp).getTime();
    if (!isNaN(tA) && !isNaN(tB)) {
      const diff = Math.abs(tB - tA);
      // More than 48 hours apart cannot be considered a continuous thread
      if (diff > 48 * 60 * 60 * 1000) {
        return false;
      }
      // If moving forward, tweetB shouldn't be hours earlier than tweetA
      if (isForward && (tA - tB > 5 * 60 * 1000)) {
        return false;
      }
      // If moving backward, tweetB shouldn't be hours later than tweetA
      if (!isForward && (tB - tA > 5 * 60 * 1000)) {
        return false;
      }
    }
  }

  // If both IDs are numeric snowflakes, verify forward monotonicity
  if (/^\d+$/.test(tweetA.id) && /^\d+$/.test(tweetB.id)) {
    try {
      const idA = BigInt(tweetA.id);
      const idB = BigInt(tweetB.id);
      if (isForward && idB < idA) {
        return false;
      }
      if (!isForward && idB > idA) {
        return false;
      }
    } catch {
      // ignore
    }
  }

  return true;
}

/**
 * Checks if two adjacent tweets form a genuine thread connection.
 */
export function isThreadConnectedPair(
  artA: Element,
  artB: Element,
  tweetA: TweetData,
  tweetB: TweetData,
  isForward: boolean,
  _isDetailPage: boolean
): boolean {
  // 1. Author must be identical
  if (tweetA.author.handle.toLowerCase() !== tweetB.author.handle.toLowerCase()) {
    return false;
  }

  // 2. Target cannot be ad/sponsored
  if (isAdOrSponsored(artB)) {
    return false;
  }

  // 3. If artB is explicitly replying to someone else, reject
  const replyTarget = getReplyingToHandle(artB);
  if (replyTarget && replyTarget !== tweetA.author.handle.toLowerCase()) {
    return false;
  }

  // 4. Temporal continuity check
  if (!isTemporallyConnected(tweetA, tweetB, isForward)) {
    return false;
  }

  // 5. Positive proof of thread connection REQUIRED:
  // Whether in detail page or profile feed, adjacent tweets MUST have positive thread proof
  // (DOM connector line, verified self-reply, or "show this thread").
  // Never merge unconnected same-author tweets simply because they share a timeline!
  const hasConnectorA = hasNativeThreadConnector(artA, isForward ? 'down' : 'up');
  const hasConnectorB = hasNativeThreadConnector(artB, isForward ? 'up' : 'down');
  const isSelfReply = replyTarget === tweetA.author.handle.toLowerCase();
  const hasShowThread = hasShowThisThread(artA) || hasShowThisThread(artB);

  if (hasConnectorA || hasConnectorB || isSelfReply || hasShowThread) {
    return true;
  }

  // In profile or feed without any thread markers, DO NOT merge!
  return false;
}

/**
 * Traverses the DOM timeline starting from the target tweet article to extract
 * all consecutive tweets authored by the same user that form a verified thread.
 * Halts traversal on ads, third-party replies, temporal disconnections, or missing thread markers.
 */
export function extractContinuousThread(
  targetArticle: Element,
  rootContainer?: ParentNode | null
): ThreadData {
  const targetTweet = extractTweetData(targetArticle);
  if (!targetTweet) {
    return {
      author: { name: '', handle: '', avatarUrl: '' },
      tweets: [],
      isSingle: true,
      targetTweetIndex: 0,
    };
  }

  const isDetailPage = isStatusDetailPage();

  // Find appropriate root container for finding sibling tweets
  let container: ParentNode | null = rootContainer || null;
  if (!container) {
    if (typeof targetArticle.closest === 'function') {
      container = targetArticle.closest('#conversation-container, #timeline, [data-testid="primaryColumn"], main');
    }
    if (!container) {
      container = targetArticle.ownerDocument || (typeof document !== 'undefined' ? document : null);
    }
  }

  let allArticles: Element[] = [];
  if (container && typeof container.querySelectorAll === 'function') {
    allArticles = Array.from(container.querySelectorAll('article[data-testid="tweet"]'));
  }
  if (allArticles.length === 0 && typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  }

  const targetIndex = allArticles.indexOf(targetArticle);
  if (targetIndex === -1) {
    targetTweet.isThreadPart = false;
    return {
      author: targetTweet.author,
      tweets: [targetTweet],
      isSingle: true,
      targetTweetIndex: 0,
    };
  }

  // 1. Trace backwards (predecessors)
  const predecessors: TweetData[] = [];
  let currentArt = targetArticle;
  let currentTweet = targetTweet;
  for (let i = targetIndex - 1; i >= 0; i--) {
    const prevArt = allArticles[i];
    const prevTweet = extractTweetData(prevArt);
    if (!prevTweet) break;

    if (!isThreadConnectedPair(currentArt, prevArt, currentTweet, prevTweet, false, isDetailPage)) {
      break;
    }

    predecessors.unshift(prevTweet);
    currentArt = prevArt;
    currentTweet = prevTweet;
  }

  // 2. Trace forwards (successors)
  const successors: TweetData[] = [];
  currentArt = targetArticle;
  currentTweet = targetTweet;
  for (let i = targetIndex + 1; i < allArticles.length; i++) {
    const nextArt = allArticles[i];
    const nextTweet = extractTweetData(nextArt);
    if (!nextTweet) break;

    if (!isThreadConnectedPair(currentArt, nextArt, currentTweet, nextTweet, true, isDetailPage)) {
      break;
    }

    successors.push(nextTweet);
    currentArt = nextArt;
    currentTweet = nextTweet;
  }

  const fullChain = [...predecessors, targetTweet, ...successors];
  const targetTweetIndex = predecessors.length;

  if (fullChain.length <= 1) {
    fullChain[0].isThreadPart = false;
    fullChain[0].threadIndex = undefined;
    fullChain[0].threadTotal = undefined;
    return {
      author: targetTweet.author,
      tweets: fullChain,
      isSingle: true,
      targetTweetIndex: 0,
    };
  }

  // Thread metadata configuration
  for (let idx = 0; idx < fullChain.length; idx++) {
    fullChain[idx].isThreadPart = true;
    fullChain[idx].threadIndex = idx;
    fullChain[idx].threadTotal = fullChain.length;
  }

  return {
    author: targetTweet.author,
    tweets: fullChain,
    isSingle: false,
    targetTweetIndex,
  };
}
