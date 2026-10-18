/**
 * Continuous same-author thread detection and assembly for Twitter/X.
 * Scans forward and backward along the DOM timeline to reconstruct continuous threads
 * with strict multi-signal validation (route context, thread markers, self-reply detection,
 * snowflake ID ordering, and temporal consistency) to eliminate misjudgments on profile
 * timelines and feeds.
 */

import type { TweetData, ThreadData } from '../../types/tweet.ts';
import { extractTweetData, extractTweetId } from './extractor.ts';
import { getReplyingToHandle } from './social.ts';
import { lookupReplyLink } from '../graphql/bridge.ts';

// Re-exported so existing importers keep a single entry point for this signal.
export { getReplyingToHandle };

/**
 * Locates tweet articles, strongest signal first.
 *
 * `data-testid` is X's own anchor and the primary choice. The fallbacks matter
 * because the DOM was observed to carry no data-testid attributes at all on
 * logged-out pages, where the primary and the testid-dependent structural
 * fallback both match nothing. The final entry is the only path that works
 * there, since a bare `article` inside `main` is still rendered.
 */
export const TWEET_ARTICLE_SELECTORS: readonly string[] = [
  'article[data-testid="tweet"]',
  'article[role="article"]',
  '[data-testid="cellInnerDiv"] article',
  // Logged-out fallback: verified against a real public tweet page, where the
  // only surviving marker is the bare tag inside the main column.
  'main article',
];

/**
 * The list above, joined, for callers that need one selector to hand to
 * `querySelectorAll`.
 *
 * Kept as a separate export because the joined form is a *list*: interpolating
 * it into a longer selector parses as `a or (b c)` rather than `(a c) or (b c)`,
 * which silently matches the wrong elements. Callers that need to append a
 * descendant must map over `TWEET_ARTICLE_SELECTORS` instead — see
 * `withDescendant` below, which is the only supported way to do it.
 */
export const TWEET_ARTICLE_SELECTOR = TWEET_ARTICLE_SELECTORS.join(', ');

/**
 * Appends `descendant` to *every* alternative of a selector list.
 *
 * `(a, b) + ' c'` is `a or (b c)`; this is `a c or b c`. The distinction is not
 * academic: it is what put the trigger button on the tweet root, below the media,
 * instead of in the action row.
 */
export function withDescendant(selectorList: readonly string[], descendant: string): string {
  return selectorList.map((part) => `${part.trim()} ${descendant}`).join(', ');
}

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
  isDetailPage: boolean
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
  // Adjacent tweets MUST have positive thread proof (the payload's own answer, a
  // thread marker, a verified self-reply, or "show this thread").
  // Never merge unconnected same-author tweets simply because they share a timeline!

  // X's own answer, when this page has delivered the payload that carries it: the
  // later post names the earlier one as the post it answers. That is the condition
  // X itself threads by, and the only proof a list view can offer, because the DOM
  // renders a thread's sections as plainly adjacent posts with no marker of their
  // own (docs/detection-audit.md). A payload that names someone else is not a veto:
  // it falls through to the signals below, so no view that merges today stops.
  const earlier = isForward ? tweetA : tweetB;
  const later = isForward ? tweetB : tweetA;
  if (earlier.id && later.id && lookupReplyLink(later.id)?.inReplyToId === earlier.id) {
    return true;
  }

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
  if (isDetailPage) {
    return true;
  }

  // In profile or feed without any thread markers, DO NOT merge!
  return false;
}

/**
 * Resolves the ancestor conversation chain for a reply.
 * When a user triggers card generation on a reply, pulling in its ancestor posts
 * (e.g. root tweet and direct parent replies) provides crucial conversation context
 * across both status detail views and timeline feeds.
 */
/**
 * Memoizes `extractTweetData` for the length of one resolution.
 *
 * Every walk below -- the predecessor scan, the ancestor chain's three signals,
 * the parent's own predecessors, the successor scan -- is a loop over the same
 * `allArticles` array, and each one asks about articles an earlier one already
 * read. `extractTweetData` is not cheap: it is a chain of sub-extractors that
 * includes two walks of the post's own text. The same article was being
 * extracted several times per resolution.
 *
 * The scope is a single call on purpose. `TweetData` is a snapshot of the DOM as
 * it was when it was read, so a cache that outlived the resolution would hand
 * back stale posts to the next one -- and the observer can fire again while the
 * page is still mutating.
 */
function createTweetReader(): (article: Element) => TweetData | null {
  const cache = new Map<Element, TweetData | null>();
  return (article) => {
    if (cache.has(article)) return cache.get(article) ?? null;
    const tweet = extractTweetData(article);
    cache.set(article, tweet);
    return tweet;
  };
}

function resolveAncestorChain(
  headArt: Element,
  headTweet: TweetData,
  headIndex: number,
  allArticles: Element[],
  readTweet: (article: Element) => TweetData | null,
  isDetailPage: boolean = true
): TweetData[] {
  const ancestors: TweetData[] = [];
  const visitedIndices = new Set<number>();

  let currChildArt = headArt;
  let currChildTweet = headTweet;
  let currChildIndex = headIndex;

  for (let depth = 0; depth < 10 && currChildIndex > 0; depth++) {
    let matchedParentIndex = -1;

    // Signal A: Exact snowflake ID link from captured GraphQL reply linkage
    const inReplyToId = lookupReplyLink(currChildTweet.id)?.inReplyToId;
    if (inReplyToId) {
      for (let p = currChildIndex - 1; p >= 0; p--) {
        const pArt = allArticles[p];
        if (isAdOrSponsored(pArt)) continue;
        const pId = extractTweetId(pArt);
        if (pId === inReplyToId) {
          matchedParentIndex = p;
          break;
        }
      }
    }

    // Signal B: Native visual thread connector with the immediate preceding post
    if (matchedParentIndex === -1 && currChildIndex > 0) {
      const prevIndex = currChildIndex - 1;
      const prevArt = allArticles[prevIndex];
      if (!isAdOrSponsored(prevArt)) {
        const hasConnector =
          hasNativeThreadConnector(currChildArt, 'up') ||
          hasNativeThreadConnector(prevArt, 'down');
        if (hasConnector) {
          const prevTweet = readTweet(prevArt);
          if (prevTweet && isTemporallyConnected(prevTweet, currChildTweet, true)) {
            matchedParentIndex = prevIndex;
          }
        }
      }
    }

    // Signal C: Reply handle matching an earlier post
    if (matchedParentIndex === -1) {
      const replyHandle = getReplyingToHandle(currChildArt);
      if (replyHandle) {
        const targetHandle = replyHandle.toLowerCase().replace(/^@/, '');
        // On detail pages, we can search backwards across all previous posts in the conversation.
        // On feeds/timelines, to avoid accidentally matching unrelated posts from the same handle earlier in the feed,
        // we restrict Signal C strictly to the immediate predecessor (p === currChildIndex - 1).
        const minP = isDetailPage ? 0 : currChildIndex - 1;
        for (let p = currChildIndex - 1; p >= minP; p--) {
          const pArt = allArticles[p];
          if (isAdOrSponsored(pArt)) continue;
          const pTweet = readTweet(pArt);
          if (
            pTweet &&
            pTweet.author.handle.toLowerCase().replace(/^@/, '') === targetHandle &&
            isTemporallyConnected(pTweet, currChildTweet, true)
          ) {
            matchedParentIndex = p;
            break;
          }
        }
      }
    }

    // Signal D: Direct top-level reply defaulting to detail page root post (allArticles[0])
    // Only valid on status detail pages where allArticles[0] is guaranteed to be the conversation root post!
    if (isDetailPage && matchedParentIndex === -1 && currChildIndex > 0) {
      const rootArt = allArticles[0];
      if (!isAdOrSponsored(rootArt) && !visitedIndices.has(0)) {
        const rootTweet = readTweet(rootArt);
        const replyHandle = getReplyingToHandle(currChildArt);
        const rootHandle = rootTweet?.author.handle.toLowerCase().replace(/^@/, '');
        const targetHandle = replyHandle?.toLowerCase().replace(/^@/, '');
        if (
          rootTweet &&
          (!targetHandle || targetHandle === rootHandle) &&
          isTemporallyConnected(rootTweet, currChildTweet, true)
        ) {
          matchedParentIndex = 0;
        }
      }
    }

    if (matchedParentIndex === -1 || visitedIndices.has(matchedParentIndex)) {
      break;
    }

    visitedIndices.add(matchedParentIndex);
    const parentArt = allArticles[matchedParentIndex];
    const parentTweet = readTweet(parentArt);
    if (!parentTweet) {
      break;
    }

    // If the matched parent has immediately preceding same-author thread tweets,
    // collect them in order so the parent thread is not cut off.
    const parentThreadPredecessors: TweetData[] = [];
    let curPArt = parentArt;
    let curPTweet = parentTweet;
    for (let p = matchedParentIndex - 1; p >= 0; p--) {
      const prevPArt = allArticles[p];
      const prevPTweet = readTweet(prevPArt);
      if (!prevPTweet) break;
      if (!isThreadConnectedPair(curPArt, prevPArt, curPTweet, prevPTweet, false, isDetailPage)) {
        break;
      }
      visitedIndices.add(p);
      parentThreadPredecessors.unshift(prevPTweet);
      curPArt = prevPArt;
      curPTweet = prevPTweet;
    }

    ancestors.unshift(...parentThreadPredecessors, parentTweet);

    if (matchedParentIndex === 0 || (parentThreadPredecessors.length > 0 && visitedIndices.has(0))) {
      break;
    }

    currChildArt = parentArt;
    currChildTweet = parentTweet;
    currChildIndex = matchedParentIndex;
  }

  return ancestors;
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
  const readTweet = createTweetReader();
  const targetTweet = readTweet(targetArticle);
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
    const prevTweet = readTweet(prevArt);
    if (!prevTweet) break;

    if (!isThreadConnectedPair(currentArt, prevArt, currentTweet, prevTweet, false, isDetailPage)) {
      break;
    }

    predecessors.unshift(prevTweet);
    currentArt = prevArt;
    currentTweet = prevTweet;
  }

  // When the target (or its same-author sequence) is a reply,
  // pull in its ancestor conversation context (e.g. root post, replied post) so that
  // the card shows the full conversation rather than an isolated reply.
  const headIndex = targetIndex - predecessors.length;
  if (headIndex > 0) {
    const headArt = allArticles[headIndex];
    const headTweet = predecessors.length > 0 ? predecessors[0] : targetTweet;
    const ancestorChain = resolveAncestorChain(headArt, headTweet, headIndex, allArticles, readTweet, isDetailPage);
    if (ancestorChain.length > 0) {
      predecessors.unshift(...ancestorChain);
    }
  }

  // 2. Trace forwards (successors)
  const successors: TweetData[] = [];
  currentArt = targetArticle;
  currentTweet = targetTweet;
  for (let i = targetIndex + 1; i < allArticles.length; i++) {
    const nextArt = allArticles[i];
    const nextTweet = readTweet(nextArt);
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
