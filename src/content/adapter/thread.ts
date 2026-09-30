/**
 * Continuous same-author thread detection and assembly for Twitter/X.
 * Scans forward and backward along the DOM timeline to reconstruct continuous threads
 * belonging strictly to the same author handle, while filtering out ads and third-party replies.
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
 * Traverses the DOM timeline starting from the target tweet article to extract
 * all consecutive tweets authored by the same user.
 * Halts traversal whenever an ad, sponsored post, or third-party reply is encountered.
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
    };
  }

  const targetHandle = targetTweet.author.handle.toLowerCase();

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
    };
  }

  // 1. Trace backwards (predecessors)
  const predecessors: TweetData[] = [];
  for (let i = targetIndex - 1; i >= 0; i--) {
    const art = allArticles[i];
    if (isAdOrSponsored(art)) break;

    const tweet = extractTweetData(art);
    if (!tweet) break;

    if (tweet.author.handle.toLowerCase() !== targetHandle) {
      break; // Interrupted by third-party reply
    }

    predecessors.unshift(tweet);
  }

  // 2. Trace forwards (successors)
  const successors: TweetData[] = [];
  for (let i = targetIndex + 1; i < allArticles.length; i++) {
    const art = allArticles[i];
    if (isAdOrSponsored(art)) break;

    const tweet = extractTweetData(art);
    if (!tweet) break;

    if (tweet.author.handle.toLowerCase() !== targetHandle) {
      break; // Interrupted by third-party reply
    }

    successors.push(tweet);
  }

  const fullChain = [...predecessors, targetTweet, ...successors];

  if (fullChain.length <= 1) {
    fullChain[0].isThreadPart = false;
    fullChain[0].threadIndex = undefined;
    fullChain[0].threadTotal = undefined;
    return {
      author: targetTweet.author,
      tweets: fullChain,
      isSingle: true,
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
  };
}
