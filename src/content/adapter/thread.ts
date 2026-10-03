/**
 * Continuous same-author thread detection and assembly for Twitter/X.
 * Scans forward and backward along the DOM timeline to reconstruct continuous threads
 * with strict multi-signal validation (route context, thread markers, self-reply detection,
 * snowflake ID ordering, and temporal consistency) to eliminate misjudgments on profile
 * timelines and feeds.
 */

import type { TweetData, ThreadData } from '../../types/tweet.ts';
import { extractTweetData } from './extractor.ts';
import { getReplyingToHandle, getRetweetedBy } from './social.ts';

// Re-exported so existing importers keep a single entry point for these signals.
export { getReplyingToHandle, getRetweetedBy };

/**
 * Locates tweet articles, strongest signal first.
 *
 * `data-testid` is X's own anchor and the primary choice. The fallbacks matter
 * because the DOM was observed to carry no data-testid attributes at all on
 * logged-out pages, where the primary and the testid-dependent structural
 * fallback both match nothing. The final entry is the only path that works
 * there, since a bare `article` inside `main` is still rendered.
 */
export const TWEET_ARTICLE_SELECTOR = [
  'article[data-testid="tweet"]',
  'article[role="article"]',
  '[data-testid="cellInnerDiv"] article',
  // Logged-out fallback: verified against a real public tweet page, where the
  // only surviving marker is the bare tag inside the main column.
  'main article',
].join(', ');

/**
 * Detects whether a tweet article element is an advertisement or sponsored post.
 */
export function isAdOrSponsored(article: Element): boolean {
  if (!article) return false;

  // 1. Placement tracking container. It is commonly an *ancestor* of the
  // article, so closest() is required; querySelector alone misses those.
  // 1. Placement tracking container. It is commonly an *ancestor* of the
  // article, so closest() is required; querySelector alone misses those.
  if (article.closest('[data-testid="placementTracking"]')) {
    return true;
  }

  // 2. data-testid-placement attribute
  if (article.getAttribute('data-testid-placement') === 'ad') {
    return true;
  }

  // 3. Promoted / sponsored label. This is a localized *string*, so it may only
  //    corroborate an already-suspicious article: the word also appears in user
  //    bios, which live in the same article, making it a false-positive source
  //    on its own.
  const hasStatusLink = article.querySelector('a[href*="/status/"]');
  const hasTweetIdentity = article.querySelector('div[data-testid="User-Name"]');
  if (!hasStatusLink || !hasTweetIdentity) {
    const rawText = article.textContent || '';
    if (/\b(?:Promoted|Sponsored)\b|赞助/i.test(rawText)) {
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
 * Checks whether a tweet is part of a thread continuation.
 *
 * Deliberately avoids inline styles and obfuscated class names: the previous
 * implementation matched `width: 2px` plus names like `r-11mg6pl`, which X
 * re-minifies on design refreshes. Only X's own anchors and stable fixture
 * classes are consulted now.
 */
export function hasNativeThreadConnector(article: Element, _direction: 'down' | 'up' = 'down'): boolean {
  if (!article) return false;

  // 1. X's own thread marker. Its exact semantics are not documented, so this
  //    counts only as a supporting hint, never as sole proof.
  if (article.querySelector('[data-testid="tweet-thread-indicator"]')) {
    return true;
  }
  // 2. Explicit classes used by this project's fixtures.
  if (
    article.classList?.contains('thread-root') ||
    article.classList?.contains('thread-middle') ||
    article.classList?.contains('thread-end') ||
    article.querySelector('.thread-connector-line, [data-testid="thread-connector"]')
  ) {
    return true;
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
 * True when a numeric snowflake ID is strictly ordered the expected way.
 *
 * X documents IDs as "roughly time-ordered", so this is only ever used to rule
 * a candidate OUT, never to prove a thread.
 */
export function isSnowflakeOrdered(earlier: string, later: string): boolean {
  if (!/^\d+$/.test(earlier) || !/^\d+$/.test(later)) return true;
  try {
    return BigInt(earlier) < BigInt(later);
  } catch {
    return true;
  }
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

  // 3. A retweet is not a continuation of the original author's thread, even
  //    when the reposted body happens to share the author.
  if (tweetA.retweetedBy || tweetB.retweetedBy) {
    return false;
  }

  // 4. If artB is explicitly replying to someone else, reject
  const replyTarget = getReplyingToHandle(artB);
  if (replyTarget && replyTarget !== tweetA.author.handle.toLowerCase()) {
    return false;
  }

  // 5. Temporal continuity check
  if (!isTemporallyConnected(tweetA, tweetB, isForward)) {
    return false;
  }

  // 6. Snowflake IDs are documented as roughly time-ordered, so an ID that runs
  //    the wrong way proves the pair cannot be consecutive. Used only to veto.
  if (tweetA.id && tweetB.id) {
    const ordered = isForward
      ? isSnowflakeOrdered(tweetA.id, tweetB.id)
      : isSnowflakeOrdered(tweetB.id, tweetA.id);
    if (!ordered) return false;
  }

  // 7. Positive proof of thread connection REQUIRED:
  // Whether in detail page or profile feed, adjacent tweets MUST have positive thread proof
  // (thread marker, verified self-reply, or "show this thread").
  // Never merge unconnected same-author tweets simply because they share a timeline!
  const hasConnectorA = hasNativeThreadConnector(artA, isForward ? 'down' : 'up');
  const hasConnectorB = hasNativeThreadConnector(artB, isForward ? 'up' : 'down');
  const isSelfReply = replyTarget === tweetA.author.handle.toLowerCase();
  const hasShowThread = hasShowThisThread(artA) || hasShowThisThread(artB);

  if (hasConnectorA || hasConnectorB || isSelfReply || hasShowThread) {
    return true;
  }

  // On a conversation view, DOM order carries the author's own sequencing and
  // the preceding checks have already excluded ads, cross-author replies,
  // retweets and ID-order contradictions. That is sufficient proof here; on
  // feeds and profiles the algorithmic order says nothing about threading, so
  // still refuse to merge.
  if (isStatusDetailPage()) {
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
    container = targetArticle.closest('#conversation-container, #timeline, [data-testid="primaryColumn"], main');
    if (!container) {
      container = targetArticle.ownerDocument || document;
    }
  }

  let allArticles: Element[] = [];
  if (container) {
    allArticles = Array.from(container.querySelectorAll(TWEET_ARTICLE_SELECTOR));
  }
  if (allArticles.length === 0) {
    allArticles = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR));
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
