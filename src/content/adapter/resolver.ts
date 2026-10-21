/**
 * Unified Thread Data Resolver.
 *
 * Deep module that resolves structured ThreadData for card rendering across
 * multiple channels: authoritative captured GraphQL responses, live client-side
 * translations, and continuous DOM timeline fallback scraping.
 */

import type { ThreadData, TweetData, QuoteTweetData } from '../../types/tweet.ts';
import { extractContinuousThread, TWEET_ARTICLE_SELECTOR } from './thread.ts';
import { extractTweetData, extractTweetId } from './extractor.ts';
import { lookupFromGraphQL, applyDomTranslation, initGraphQLBridge } from '../graphql/bridge.ts';

export type ResolutionTarget = Element | string;

export interface ResolveThreadOptions {
  /** Optional explicit tweet ID override. */
  tweetId?: string;
}

/**
 * Backfills quote levels GraphQL did not carry with what the DOM rendered.
 *
 * X's `TweetDetail` payload nests one `quoted_status_result` but, for a quote
 * of a quote, the inner level carries no further `quoted_status_result` of its
 * own — the chain stops at depth 1 with no error. The rendered DOM does carry
 * it (`nestedQuotePreview` + `nestedQuotePreviewMedia`), so a GraphQL hit used
 * verbatim drops the deepest post and its picture from the card.
 *
 * GraphQL stays authoritative wherever it answered: author, body, timestamp
 * and URL are never overwritten. Only what it left absent is taken from the
 * DOM — a missing deeper level, missing media, or a missing permalink. Text is
 * deliberately not merged: the DOM copy may be a truncated preview while
 * GraphQL holds the full body.
 */
function backfillNestedQuote(
  graphqlQuote: QuoteTweetData | undefined,
  domQuote: QuoteTweetData | undefined
): QuoteTweetData | undefined {
  if (!graphqlQuote) return domQuote;
  if (!domQuote) return graphqlQuote;
  const nested = backfillNestedQuote(graphqlQuote.quotePost, domQuote.quotePost);
  const media = graphqlQuote.media && graphqlQuote.media.length > 0 ? graphqlQuote.media : domQuote.media;
  return {
    ...graphqlQuote,
    media,
    url: graphqlQuote.url ?? domQuote.url,
    timestamp: graphqlQuote.timestamp || domQuote.timestamp,
    quotePost: nested ?? graphqlQuote.quotePost ?? domQuote.quotePost,
  };
}

/**
 * Resolves thread data given an article element, tweet ID, or status URL.
 *
 * 1. Checks GraphQL cache (authoritative for conversation tree, entity structure, media ratios).
 * 2. If GraphQL hits:
 *    - Applies client-side translation if present on the target element.
 *    - Backfills nested-quote levels the payload truncated but the DOM rendered.
 *    - Tags diagnostics with source: 'graphql', queryId, operationName.
 *    - Short-circuits without doing expensive continuous DOM timeline traversal.
 * 3. If GraphQL misses or is unavailable:
 *    - Falls back to DOM timeline assembly via `extractContinuousThread`.
 *    - Tags diagnostics with source: 'dom'.
 *    - Tags diagnostics with graphqlMiss: the reason the channel did not
 *      answer, when it was asked. X swallows a failed request silently, so
 *      without this a channel that has stopped working is indistinguishable
 *      from one that never fired.
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
  const fromGraphQL = tweetId || target === undefined ? lookupFromGraphQL(tweetId) : undefined;

  if (fromGraphQL?.thread) {
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
    // A single-article extract is cheap; the traversal below is not.
    if (articleElement) {
      try {
        const domTweet = extractTweetData(articleElement);
        if (domTweet) {
          if (domTweet.translatedFrom) {
            const domWrapper: ThreadData = {
              author: domTweet.author,
              tweets: [domTweet],
              isSingle: true,
              targetTweetIndex: 0,
            };
            applyDomTranslation(thread, domWrapper);
          }
          // The payload truncates a quote-of-a-quote at depth 1 while the
          // DOM renders both levels; adopt the DOM's deeper levels so the
          // card does not lose the innermost post and its picture.
          const target =
            thread.tweets.find((tweet) => tweet.id === domTweet.id) ??
            thread.tweets[thread.targetTweetIndex ?? 0];
          if (target) {
            target.quotePost = backfillNestedQuote(target.quotePost, domTweet.quotePost);
          }
        }
      } catch {
        // Translation fold failures should never drop the authoritative GraphQL result
      }
    }

    return thread;
  }

  // 2. DOM fallback channel
  if (articleElement) {
    const domThread = extractContinuousThread(articleElement);
    for (const tweet of domThread.tweets) {
      tweet.diagnostics = {
        ...tweet.diagnostics,
        source: 'dom',
        // The GraphQL channel was asked and did not answer. Saying why is the
        // only way to tell a channel that has stopped working from one that
        // never fired: X swallows a failed request, so an empty response is
        // silent everywhere else.
        graphqlMiss: fromGraphQL?.failure?.reason,
      };
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
