/**
 * Content-script side of the GraphQL channel.
 *
 * Receives responses forwarded by the MAIN-world hook, keeps the most recent
 * payload per operation, and answers requests for the tweet currently on
 * screen. A miss is not an error: the caller falls back to the DOM adapter.
 *
 * Besides the whole-conversation operations it also feeds the reply-linkage
 * index from the list-view operations, which is the only proof of a thread a
 * feed can offer (see `replyLinks.ts`).
 */

import type { ThreadData } from '../../types/tweet.ts';
import { parseTweetDetailResponse, parseReplyLinkage, type ParsedGraphQL } from './parse.ts';
import { rememberReplyLinks } from './replyLinks.ts';
import { DETAIL_OPERATIONS, LINKAGE_OPERATIONS } from './operations.ts';

const MESSAGE_SOURCE = 'post-to-card-graphql';
const MESSAGE_TYPE = 'post-to-card:graphql-payload';

/** Only the newest payload per operation is worth keeping. */
const cache = new Map<string, { body: string; queryId: string; observedAt: number }>();

let installCount = 0;

/** Id of the tweet the status page is currently showing, if any. */
function currentTweetIdFromUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  const match = /\/status\/(\d+)/.exec(window.location.pathname || '');
  return match ? match[1] : undefined;
}

function handleMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) return;
  if (typeof event.data !== 'string') return;

  let payload: {
    source?: string;
    type?: string;
    operationName?: string;
    queryId?: string;
    body?: string;
    status?: number;
  };
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  if (payload?.source !== MESSAGE_SOURCE || payload?.type !== MESSAGE_TYPE) return;
  if (!payload.operationName || !payload.body || payload.status !== 200) return;

  cache.set(payload.operationName, {
    body: payload.body,
    queryId: payload.queryId || '',
    observedAt: Date.now(),
  });

  // A list-view payload is not a conversation, so nothing is built from it. What
  // it does carry is which post each of its posts answers, and that is the fact
  // a click in a feed has to consult.
  if (LINKAGE_OPERATIONS[payload.operationName] === true) {
    rememberReplyLinks(parseReplyLinkage(payload.body));
  }
}

/**
 * Starts listening for intercepted responses. Safe to call more than once.
 */
export function initGraphQLBridge(): void {
  if (installCount > 0) return;
  installCount++;
  window.addEventListener('message', handleMessage);
}

export interface GraphQLLookup {
  thread: ThreadData | null;
  /** Which operation answered, for diagnostics. */
  operationName?: string;
  /** The rotated queryId observed at capture time, for drift monitoring. */
  queryId?: string;
  parseError?: string;
}

/**
 * Attempts to satisfy the request from a captured GraphQL payload.
 *
 * A payload that is missing, unparseable, or yields no tweets returns null so
 * the caller can fall back rather than render an empty card. X swallows failed
 * GraphQL calls silently, so treating "no tweets" as success is exactly how a
 * rotated endpoint would go unnoticed.
 */
export function lookupFromGraphQL(targetTweetId?: string): GraphQLLookup {
  const id = targetTweetId || currentTweetIdFromUrl();
  const operations = id ? Object.keys(DETAIL_OPERATIONS) : ['TweetDetail'];

  for (const operationName of operations) {
    const entry = cache.get(operationName);
    if (!entry) continue;

    const parsed: ParsedGraphQL = parseTweetDetailResponse(
      entry.body,
      operationName,
      entry.queryId,
      id
    );
    if (parsed.thread) {
      return { thread: parsed.thread, operationName, queryId: entry.queryId };
    }
  }

  return { thread: null };
}

/**
 * Folds the page's translation into a GraphQL result.
 *
 * X translates client-side, so the translated body and its "translated from"
 * notice exist only in the rendered DOM; the GraphQL payload carries the
 * original body. When GraphQL answers, copy the visible body over the target
 * tweet so the card does not silently revert to the original language.
 */
export function applyDomTranslation(graphqlThread: ThreadData, domThread: ThreadData): void {
  const domTarget = domThread.tweets[domThread.targetTweetIndex ?? 0];
  if (!domTarget?.translatedFrom) return;

  const target =
    graphqlThread.tweets.find((tweet) => tweet.id === domTarget.id) ??
    graphqlThread.tweets[graphqlThread.targetTweetIndex ?? 0];
  if (!target) return;

  target.text = domTarget.text;
  target.richTokens = domTarget.richTokens;
  target.translatedFrom = domTarget.translatedFrom;
}
