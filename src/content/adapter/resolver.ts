/**
 * Unified Thread Data Resolver.
 *
 * Deep module that resolves structured ThreadData for card rendering across
 * multiple channels: authoritative captured GraphQL responses, live client-side
 * translations, and continuous DOM timeline fallback scraping.
 */

import type { ThreadData, TweetData } from '../../types/tweet.ts';
import { extractContinuousThread, TWEET_ARTICLE_SELECTOR } from './thread.ts';
import { extractTweetData, extractTweetId } from './extractor.ts';
import { lookupFromGraphQL, applyDomTranslation, initGraphQLBridge } from '../graphql/bridge.ts';

export type ResolutionTarget = Element | string;

export interface ResolveThreadOptions {
  /** Optional explicit tweet ID override. */
  tweetId?: string;
}

/**
 * Resolves thread data given an article element, tweet ID, or status URL.
 *
 * 1. Checks GraphQL cache (authoritative for conversation tree, entity structure, media ratios).
 * 2. If GraphQL hits:
 *    - Applies client-side translation if present on the target element.
 *    - Tags diagnostics with source: 'graphql', queryId, operationName.
 *    - Short-circuits without doing expensive continuous DOM timeline traversal.
 * 3. If GraphQL misses or is unavailable:
 *    - Falls back to DOM timeline assembly via `extractContinuousThread`.
 *    - Tags diagnostics with source: 'dom'.
 */
export function resolveThread(
  target?: ResolutionTarget | null,
  options: ResolveThreadOptions = {}
): ThreadData {
  // Ensure the GraphQL listener is active in browser environment
  initGraphQLBridge();

  let articleElement: Element | null = null;
  let tweetId = options.tweetId;

  if (target) {
    if (typeof target === 'string') {
      const match = /\/status\/(\d+)/.exec(target);
      tweetId = tweetId || (match ? match[1] : (target.trim().match(/^\d+$/) ? target.trim() : undefined));
    } else if (typeof target === 'object' && ('querySelector' in target || 'tagName' in target)) {
      articleElement = (target.closest ? target.closest(TWEET_ARTICLE_SELECTOR) : null) || target;
      tweetId = tweetId || (articleElement ? extractTweetId(articleElement) : undefined);
    }
  }

  // If an explicit target was provided (e.g. null, empty string) but yielded no ID or element,
  // return safe fallback immediately without querying ambient URL GraphQL cache.
  if (target !== undefined && !tweetId && !articleElement) {
    return createFallbackThread();
  }

  // 1. Authoritative GraphQL channel lookup
  // Only query GraphQL if we have an identified tweetId or target was omitted (status page ambient lookup).
  if (tweetId || target === undefined) {
    const fromGraphQL = lookupFromGraphQL(tweetId);

    if (fromGraphQL.thread) {
      const thread = fromGraphQL.thread;
      for (const tweet of thread.tweets) {
        tweet.diagnostics = {
          ...tweet.diagnostics,
          source: 'graphql',
          operationName: fromGraphQL.operationName,
          queryId: fromGraphQL.queryId,
        };
      }

      // Client-side translation only exists in the rendered DOM.
      // If an article element is present, fold in its translation
      // without doing expensive full-timeline thread traversal.
      if (articleElement) {
        try {
          const domTweet = extractTweetData(articleElement);
          if (domTweet && domTweet.translatedFrom) {
            const domWrapper: ThreadData = {
              author: domTweet.author,
              tweets: [domTweet],
              isSingle: true,
              targetTweetIndex: 0,
            };
            applyDomTranslation(thread, domWrapper);
          }
        } catch {
          // Translation fold failures should never drop the authoritative GraphQL result
        }
      }

      return thread;
    }
  }

  // 2. DOM fallback channel
  if (articleElement) {
    const domThread = extractContinuousThread(articleElement);
    for (const tweet of domThread.tweets) {
      tweet.diagnostics = { ...tweet.diagnostics, source: 'dom' };
    }
    return domThread;
  }

  // 3. String target with matching DOM article in current document
  if (tweetId && typeof document !== 'undefined' && document.querySelector) {
    const matched = document.querySelector(`article a[href*="/status/${tweetId}"]`)?.closest?.('article');
    if (matched) {
      return resolveThread(matched, { tweetId });
    }
  }

  // 4. Safe fallback for empty/unresolvable target
  return createFallbackThread(tweetId);
}

function createFallbackThread(tweetId?: string): ThreadData {
  const fallbackTweet: TweetData = {
    id: tweetId || '0',
    url: tweetId ? `https://x.com/i/status/${tweetId}` : '',
    author: { name: 'Unknown', handle: '@unknown', avatarUrl: '' },
    text: '',
    timestamp: new Date().toISOString(),
    diagnostics: { source: 'dom' },
  };

  return {
    author: fallbackTweet.author,
    tweets: [fallbackTweet],
    isSingle: true,
    targetTweetIndex: 0,
  };
}
