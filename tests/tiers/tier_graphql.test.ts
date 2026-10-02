/**
 * GraphQL parsing tier.
 *
 * Pins the mapping from X's response shape onto this project's data model, and
 * pins the contract that an empty or unusable payload is reported as a miss so
 * the caller falls back to the DOM channel. X swallows failed GraphQL calls, so
 * a silently-empty result is the failure mode that matters most.
 */

import assert from 'node:assert/strict';
import { parseTweetDetailResponse } from '../../src/content/graphql/parse.ts';
import {
  TWEET_DETAIL_THREAD_JSON,
  TWEET_DETAIL_QUOTE_JSON,
  TWEET_DETAIL_RETWEET_JSON,
  TWEET_DETAIL_TOMBSTONE_JSON,
  TWEET_DETAIL_CURSOR_ONLY_JSON,
  TWEET_DETAIL_VISIBILITY_JSON,
} from '../fixtures/graphql.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

test('gql.1: a conversation yields every tweet and marks the thread', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1');
  assert.ok(parsed.thread, 'expected a thread');
  assert.equal(parsed.thread.tweets.length, 3, 'thread module entries must be merged with loose tweets');
  assert.equal(parsed.thread.isSingle, false);
  assert.equal(parsed.thread.author.handle, '@ada_builds');
});

test('gql.2: long-form body wins over the truncated legacy text', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1');
  const third = parsed.thread?.tweets.find((t) => t.id === '1003');
  assert.equal(third?.text, 'Third post, long form body.',
    'note_tweet carries the complete body and must take precedence');
});

test('gql.3: media requests the original resolution and records the aspect ratio', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1');
  const media = parsed.thread?.tweets.find((t) => t.id === '1003')?.media;
  assert.ok(media && media.length === 1, 'expected one media item');
  assert.equal(media![0].type, 'image');
  assert.match(media![0].url, /name=orig/, 'must request the highest available resolution');
  assert.match(media![0].url, /format=jpg/);
  assert.equal(media![0].aspectRatio, 1.6, 'aspect ratio must come from original_info');
  assert.equal(media![0].alt, 'a chart');
});

test('gql.4: the target tweet index is located by id', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1', '1001');
  const target = parsed.thread?.tweets[parsed.thread.targetTweetIndex];
  assert.equal(target?.id, '1001', 'target index must point at the requested tweet');
});

test('gql.5: a quoted post is extracted as structured data', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_QUOTE_JSON, 'TweetDetail', 'q1');
  const quote = parsed.thread?.tweets[0].quotePost;
  assert.ok(quote, 'expected a quote');
  assert.equal(quote!.author.handle, '@grace');
  assert.equal(quote!.text, 'The most damaging phrase...');
  assert.match(quote!.url || '', /status\/1999/);
});

test('gql.6: a retweet attributes the body to the original author', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_RETWEET_JSON, 'TweetDetail', 'q1');
  const tweet = parsed.thread?.tweets[0];
  assert.ok(tweet, 'expected a tweet');
  assert.equal(tweet!.author.handle, '@bob', 'the body belongs to the original author');
  assert.equal(tweet!.retweetedBy, '@alice', 'the reposting account must be recorded');
  assert.equal(tweet!.text, 'original words', 'the "RT @bob:" wrapper must not leak');
  assert.equal(tweet!.id, '2999', 'identity must follow the original post');
});

test('gql.7: a retweet reads media from the nested original, not the outer object', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_RETWEET_JSON, 'TweetDetail', 'q1');
  const media = parsed.thread?.tweets[0].media;
  assert.ok(media && media.length === 1, 'expected the nested original media');
  assert.equal(media![0].type, 'gif', 'animated_gif must map to gif');
  assert.match(media![0].originalUrl || '', /gif\.mp4/, 'the mp4 variant must be captured');
  assert.equal(media![0].duration, '0:04', 'duration must be derived from duration_millis');
});

test('gql.8: a tombstone yields no thread rather than an empty card', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_TOMBSTONE_JSON, 'TweetDetail', 'q1');
  assert.equal(parsed.thread, null, 'a deleted post must not produce a card');
  assert.ok(parsed.parseError, 'the reason must be reported so the DOM channel takes over');
});

test('gql.9: paging cursors are not treated as tweets', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_CURSOR_ONLY_JSON, 'TweetDetail', 'q1');
  assert.equal(parsed.thread, null);
});

test('gql.10: a visibility-restricted tweet is unwrapped to its real payload', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_VISIBILITY_JSON, 'TweetDetail', 'q1');
  assert.ok(parsed.thread, 'expected the restricted tweet to be unwrapped');
  assert.equal(parsed.thread!.tweets[0].id, '5001');
  assert.equal(parsed.thread!.tweets[0].author.handle, '@hidden');
});

test('gql.11: malformed and empty bodies are reported as misses, never as success', () => {
  for (const body of ['', 'not json', '{}', '{"data":{}}', 'null']) {
    const parsed = parseTweetDetailResponse(body, 'TweetDetail', 'q1');
    assert.equal(parsed.thread, null, `body ${JSON.stringify(body)} must not yield a thread`);
  }
});

test('gql.12: stats and view count are carried across', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1');
  const stats = parsed.thread?.tweets.find((t) => t.id === '1003')?.stats;
  assert.ok(stats, 'expected stats');
  assert.equal(stats!.replies, '31');
  assert.equal(stats!.reposts, '1100');
  assert.equal(stats!.likes, '9400');
  assert.equal(stats!.bookmarks, '203');
  assert.equal(stats!.views, '377000');
});

test('gql.13: the observed queryId is echoed for drift monitoring', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'zoF7_t363wZyzylk-BLfZQ');
  assert.equal(parsed.queryId, 'zoF7_t363wZyzylk-BLfZQ',
    'the current id is recorded only so a rotation shows up in diagnostics');
  assert.equal(parsed.operationName, 'TweetDetail');
});

export async function runTierGraphQL(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      results.push({ name: t.name, passed: true, durationMs: Date.now() - start });
      passed++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      results.push({ name: t.name, passed: false, error: errorMsg, durationMs: Date.now() - start });
      failed++;
    }
  }

  return { total: tests.length, passed, failed, results };
}
