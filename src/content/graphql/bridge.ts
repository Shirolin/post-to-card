/**
 * Content-script side of the GraphQL channel.
 *
 * Receives responses forwarded by the MAIN-world hook, keeps the most recent
 * whole-conversation body per operation, and answers requests for the tweet
 * currently on screen. A miss is not an error: the caller falls back to the DOM
 * adapter.
 *
 * Every captured payload also feeds the reply-linkage index, which is the only
 * proof of a thread a list view can offer (the index lives in this file). That
 * read happens before the body is dropped, so only conversation bodies are
 * retained.
 */

import type { ThreadData } from '../../types/tweet.ts';
import {
  parseTweetDetailResponse,
  parseReplyLinkage,
  type GraphQLParseFailure,
  type ParsedGraphQL,
} from './parse.ts';
import { DETAIL_OPERATIONS } from './operations.ts';

export interface ReplyLink {
  /** `legacy.in_reply_to_status_id_str`: the post this one answers, if any. */
  inReplyToId?: string;
}

const MESSAGE_SOURCE = 'post-to-card-graphql';
const MESSAGE_TYPE = 'post-to-card:graphql-payload';

/**
 * Only the newest payload per operation is worth keeping.
 *
 * The entry carries the reply linkage read from `body`. Every captured payload
 * is parsed for one anyway (see `handleMessage`), and the detail parse needs the
 * same map, so keeping the one that was already built saves parsing the same
 * body twice.
 */
const cache = new Map<
  string,
  { body: string; queryId: string; observedAt: number; replyLinks: Map<string, ReplyLink> }
>();

const MAX_REPLY_LINKS = 4000;
const replyLinks = new Map<string, ReplyLink>();

/** Records what a payload said. A re-seen id moves to the newest position. */
function rememberReplyLinks(parsed: Map<string, ReplyLink>): void {
  for (const [id, link] of parsed) {
    replyLinks.delete(id);
    replyLinks.set(id, link);
  }

  while (replyLinks.size > MAX_REPLY_LINKS) {
    const oldest = replyLinks.keys().next();
    if (oldest.done) break;
    replyLinks.delete(oldest.value);
  }
}

/** What X's payload said about this post, or undefined when it was never seen. */
export function lookupReplyLink(tweetId?: string): ReplyLink | undefined {
  return tweetId ? replyLinks.get(tweetId) : undefined;
}

let installCount = 0;

/** Id of the tweet the status page is currently showing, if any. */
function currentTweetIdFromUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  const match = /\/status\/(\d+)/.exec(window.location.pathname || '');
  return match ? match[1] : undefined;
}

function handleMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) return;
  // The hook posts the payload object, so it arrives as plain data through the
  // structured clone. Anything of another shape on `window`'s message channel
  // belongs to the page, not to us.
  if (typeof event.data !== 'object' || event.data === null) return;

  const payload = event.data as {
    source?: string;
    type?: string;
    operationName?: string;
    queryId?: string;
    body?: string;
    status?: number;
  };

  if (payload.source !== MESSAGE_SOURCE || payload.type !== MESSAGE_TYPE) return;
  if (!payload.operationName || !payload.body || payload.status !== 200) return;

  // Which post each post answers is the one fact that proves a thread in a list
  // view, and every payload states it, so this read is not gated on the list.
  const replyLinks = parseReplyLinkage(payload.body);
  rememberReplyLinks(replyLinks);

  // Only a conversation body is retained; everything else is read above and
  // dropped. The linkage read above is kept with it rather than thrown away,
  // because the detail parse wants exactly this map for exactly this body.
  if (DETAIL_OPERATIONS[payload.operationName] === true) {
    cache.set(payload.operationName, {
      body: payload.body,
      queryId: payload.queryId || '',
      observedAt: Date.now(),
      replyLinks,
    });
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
  /**
   * Why the channel did not answer, when it did not.
   *
   * Kept rather than dropped because the caller is the only place that can say
   * "the GraphQL channel was tried and did not answer, and here is why". X
   * swallows a failed request silently, so an empty response is indistinguishable
   * from a rotated endpoint unless somebody says so — and the one record of it
   * is this.
   */
  failure?: GraphQLParseFailure;
}

/**
 * Attempts to satisfy the request from a captured GraphQL payload.
 *
 * A payload that is missing, unparseable, or yields no tweets returns null so
 * the caller can fall back rather than render an empty card. X swallows failed
 * GraphQL calls silently, so treating "no tweets" as success is exactly how a
 * rotated endpoint would go unnoticed.
 *
 * The reason each attempt failed is carried out rather than dropped, so a
 * caller that falls back can report what the channel said on its way out.
 */
export function lookupFromGraphQL(targetTweetId?: string): GraphQLLookup {
  const id = targetTweetId || currentTweetIdFromUrl();
  const operations = id ? Object.keys(DETAIL_OPERATIONS) : ['TweetDetail'];

  // The first failure is the one worth reporting: the operations are tried in
  // a fixed order, so the first is the most specific one, and a later attempt
  // that fails the same way adds nothing.
  let firstFailure: GraphQLParseFailure | undefined;
  let sawPayload = false;

  for (const operationName of operations) {
    const entry = cache.get(operationName);
    if (!entry) continue;
    sawPayload = true;

    const parsed: ParsedGraphQL = parseTweetDetailResponse(
      entry.body,
      operationName,
      entry.queryId,
      id,
      entry.replyLinks
    );
    if (parsed.thread) {
      return { thread: parsed.thread, operationName, queryId: entry.queryId };
    }
    if (parsed.failure && !firstFailure) {
      firstFailure = parsed.failure;
    }
  }

  // No payload at all is a different answer from a payload that would not
  // parse: the first means the channel never saw the request, the second
  // means it saw it and could not use it. A timeline click never asks for a
  // detail payload, so the first is the common case there and the second is
  // the one worth noticing.
  if (!sawPayload) {
    return { thread: null, failure: { reason: 'no-payload' } };
  }

  return { thread: null, failure: firstFailure };
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
