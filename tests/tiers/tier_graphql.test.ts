/**
 * GraphQL parsing tier.
 *
 * Pins the mapping from X's response shape onto this project's data model, and
 * pins the contract that an empty or unusable payload is reported as a miss so
 * the caller falls back to the DOM channel. X swallows failed GraphQL calls, so
 * a silently-empty result is the failure mode that matters most.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseTweetDetailResponse, parseReplyLinkage } from '../../src/content/graphql/parse.ts';
import { applyDomTranslation } from '../../src/content/graphql/bridge.ts';
import type { ThreadData } from '../../src/types/tweet.ts';
import {
  TWEET_DETAIL_THREAD_JSON,
  TWEET_DETAIL_QUOTE_JSON,
  TWEET_DETAIL_RETWEET_JSON,
  TWEET_DETAIL_TOMBSTONE_JSON,
  TWEET_DETAIL_CURSOR_ONLY_JSON,
  TWEET_DETAIL_VISIBILITY_JSON,
  TWEET_DETAIL_NEW_USER_SHAPE_JSON,
  TWEET_DETAIL_ENTITIES_JSON,
  TWEET_DETAIL_MEDIA_PERMALINK_JSON,
  TWEET_DETAIL_MEDIA_WITH_LINK_JSON,
  HOME_TIMELINE_SELF_THREAD_JSON,
  TWEET_DETAIL_CARD_JSON,
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
  const thread = parsed.thread;
  assert.ok(thread, 'expected a thread');
  // `targetTweetIndex` is optional on the type, so the lookup needs a value; the
  // assertion right after is what proves the index was the right one, and a
  // wrong one fails it loudly rather than silently reading tweet 0.
  const target = thread.tweets[thread.targetTweetIndex ?? 0];
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

test('gql.14: a cached payload that does not contain the target tweet is a miss', () => {
  // Regression guard for the stale-cache bug. Opening tweet A's detail view
  // caches its TweetDetail response; after navigating back to the timeline,
  // clicking any other tweet B re-queried that same cached payload. Falling
  // back to index 0 rendered A's card for B. A payload that does not contain
  // the requested id must be reported as a miss so the DOM channel answers.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1', '9999');
  assert.equal(parsed.thread, null, 'a payload missing the target tweet must not produce a card');
  assert.ok(parsed.parseError, 'the miss must be reported so the caller falls back');
});

test('gql.15: the avatar is read from the newer user shape, not just legacy', () => {
  // Regression guard. X moved the user object's avatar to `avatar.image_url`
  // and dropped `legacy.profile_image_url_https`. Name and handle kept working
  // because they come from `core`, so the only visible symptom was the card
  // falling back to its placeholder avatar.
  //
  // The payload carries `_normal`, which is 48px, and the DOM channel upscales
  // it. This channel is the one content/index.ts prefers, so the assertion is
  // on the upscaled URL: reading the field and serving it at full size are two
  // separate mistakes, and only the first was caught before.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_NEW_USER_SHAPE_JSON, 'TweetDetail', 'q1');
  const author = parsed.thread?.tweets[0].author;
  assert.ok(author, 'expected an author');
  assert.equal(author!.name, 'Mark');
  assert.equal(author!.handle, '@mkdir700');
  assert.equal(
    author!.avatarUrl,
    'https://pbs.twimg.com/profile_images/7001/mark_400x400.jpg',
    'the avatar must come from avatar.image_url when legacy is absent, at full size'
  );
});

test('gql.16: the XHR hook forwards only the arguments the caller supplied', async () => {
  // Regression guard. Forwarding an explicit undefined for open()'s optional
  // `async` parameter coerces it to false, which turned every X request
  // synchronous and made the page throw when it set xhr.timeout, leaving the
  // timeline unable to load. Verified against a live page.
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/content/graphql/hook.ts'),
    'utf8'
  );
  assert.ok(
    /originalOpen\.apply\(\s*this,\s*\[method, url, \.\.\.rest\]/.test(source),
    'open() must be forwarded with apply so omitted arguments stay omitted'
  );
  assert.ok(
    !/originalOpen\.call\(\s*this,\s*method/.test(source),
    'open() must not be forwarded with call, which would pass explicit undefineds'
  );
  assert.ok(
    /init === undefined\s*\?\s*originalFetch\(input\)/.test(source),
    'fetch must also omit init rather than passing an explicit undefined'
  );
});

test('gql.17: entities become styled tokens and URLs show their display form', () => {
  // The DOM channel already colours links, mentions, hashtags and cashtags; the
  // GraphQL channel used to hand back a plain string, so the same post looked
  // different depending on which channel answered.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_ENTITIES_JSON, 'TweetDetail', 'q1');
  const tokens = parsed.thread?.tweets[0].richTokens;
  assert.ok(tokens, 'a body with entities must produce rich tokens');

  assert.deepEqual(tokens, [
    { type: 'text', value: 'See ' },
    { type: 'link', value: 'github.com/post-to-card', href: 'https://github.com/post-to-card' },
    { type: 'text', value: ' and ' },
    { type: 'hashtag', value: '#build' },
    { type: 'text', value: ' by ' },
    { type: 'mention', value: '@ada_builds' },
    { type: 'text', value: ' (' },
    { type: 'cashtag', value: '$NVDA' },
    { type: 'text', value: ')' },
  ]);
});

test('gql.18: a body without entities keeps the plain string path', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q1');
  const first = parsed.thread?.tweets.find((t) => t.id === '1001');
  assert.equal(first?.richTokens, undefined, 'no entities means no token array');
});

test('gql.19: a page translation wins over the GraphQL original body', () => {
  // X translates client-side, so the translated body and its notice live only in
  // the DOM while GraphQL carries the original body. Without this merge, opening
  // a card from the tweet detail page silently reverted to the original language.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_ENTITIES_JSON, 'TweetDetail', 'q1');
  const thread = parsed.thread!;
  const original = thread.tweets[0];

  const domThread: ThreadData = {
    author: original.author,
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [
      {
        id: '9001',
        url: original.url,
        author: original.author,
        timestamp: original.timestamp,
        text: '看看 github.com/post-to-card 和 #build，来自 @ada_builds',
        richTokens: [
          { type: 'text', value: '看看 ' },
          { type: 'link', value: 'github.com/post-to-card' },
        ],
        translatedFrom: '翻译自 英语',
      },
    ],
  };

  applyDomTranslation(thread, domThread);

  assert.equal(thread.tweets[0].text, domThread.tweets[0].text, 'the visible translation must win');
  assert.equal(thread.tweets[0].translatedFrom, '翻译自 英语');
  assert.deepEqual(thread.tweets[0].richTokens, domThread.tweets[0].richTokens);
});

test('gql.20: an untranslated page leaves the GraphQL body untouched', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_ENTITIES_JSON, 'TweetDetail', 'q1');
  const thread = parsed.thread!;
  const originalText = thread.tweets[0].text;

  const domThread: ThreadData = {
    author: thread.author,
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [
      {
        id: '9001',
        url: thread.tweets[0].url,
        author: thread.author,
        timestamp: thread.tweets[0].timestamp,
        text: 'a different DOM reading',
      },
    ],
  };

  applyDomTranslation(thread, domThread);

  assert.equal(thread.tweets[0].text, originalText, 'GraphQL stays authoritative without a translation');
  assert.equal(thread.tweets[0].translatedFrom, undefined);
});

test('gql.21: the media permalink X appends to full_text is dropped', () => {
  // X appends the media permalink's `t.co` URL to `legacy.full_text` and states
  // where the author's text really ends with `display_text_range`. The URL is
  // not in `entities.urls`, so the range is the only signal; without it the card
  // prints a bare `https://t.co/...` after the author's words. The DOM channel
  // already drops its `pic.twitter.com` form.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_MEDIA_PERMALINK_JSON, 'TweetDetail', 'q1');
  const tweet = parsed.thread?.tweets[0];
  assert.ok(tweet, 'expected a tweet');
  assert.equal(tweet!.text, '怪不得1600N的力能踩断尊界的踏板......',
    'the text must stop at the display range');
  assert.doesNotMatch(tweet!.text, /t\.co/, 'the appended permalink must not be printed');
  assert.ok(tweet!.media && tweet!.media.length === 1, 'the media is still carried');
  assert.equal(tweet!.richTokens, undefined, 'the trimmed tail leaves no tokens behind');
});

test('gql.22: an author link inside the range survives the tail strip', () => {
  // The strip is per `display_text_range`, not "drop the last URL". The author's
  // own `t.co` sits inside the range and must stay -- in the token list as well
  // as the plain text -- while the media permalink after the range is dropped.
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_MEDIA_WITH_LINK_JSON, 'TweetDetail', 'q1');
  const tweet = parsed.thread?.tweets[0];
  assert.ok(tweet, 'expected a tweet');
  assert.doesNotMatch(tweet!.text, /MEDIAPERM/, 'the appended permalink is dropped');
  assert.ok(tweet!.media && tweet!.media.length === 1, 'the media is carried');

  const link = (tweet!.richTokens || []).find((token) => token.type === 'link');
  assert.ok(link, 'the author link must remain as a token');
  assert.equal(link!.value, 'example.com/post', 'and keep its display form');
  assert.equal(link!.href, 'https://example.com/post');
});

test('gql.23: a list-view payload yields the reply linkage X threads by', () => {
  // A timeline page is not a conversation, so nothing here builds a card. What
  // it carries is which post each of its posts answers, and that is the only
  // proof of a thread a feed can offer.
  const links = parseReplyLinkage(HOME_TIMELINE_SELF_THREAD_JSON);

  assert.equal(links.get('9001')?.inReplyToId, undefined, 'the first post answers nothing');
  assert.equal(links.get('9002')?.inReplyToId, '9001', 'the second answers the first');
  assert.equal(links.get('9004')?.inReplyToId, '9002', 'the third answers the second');
  assert.equal(links.size, 3, 'every post in the page is indexed');
});

test('gql.24: the linkage is read by shape, not by path', () => {
  // The same fields sit in a TweetDetail conversation under a different root,
  // including inside a thread module. All three must be found either way, since
  // the walk looks for `legacy`, not for a route to it.
  const links = parseReplyLinkage(TWEET_DETAIL_THREAD_JSON);

  assert.equal(links.size, 3, 'a conversation indexes its posts too');
  assert.ok(links.has('1001') && links.has('1002') && links.has('1003'));
});

test('gql.25: an unusable payload yields no linkage instead of throwing', () => {
  // A body this parser cannot read must leave the DOM channel exactly where it
  // was, so an empty index is the answer, never an error.
  for (const body of ['', 'not json', '{}', 'null', '[]']) {
    assert.equal(parseReplyLinkage(body).size, 0, `body ${JSON.stringify(body)} must yield nothing`);
  }
});

test('gql.26: a user object is not indexed as a post', () => {
  // X ships a `legacy` on user objects too, and on a real payload it carries an
  // id, so "any object with a legacy and an id" would index every author and
  // spend the linkage budget on entries that can never prove a thread. A post's
  // own `legacy` is the one that carries the body.
  const body = JSON.stringify({
    data: {
      user_results: {
        result: { rest_id: '44196397', legacy: { id_str: '44196397', screen_name: 'elonmusk' } },
      },
      tweet_results: {
        result: { rest_id: '9002', legacy: { id_str: '9002', full_text: 'a post', in_reply_to_status_id_str: '9001' } },
      },
    },
  });
  const links = parseReplyLinkage(body);

  assert.equal(links.size, 1, 'only the post is indexed');
  assert.equal(links.get('9002')?.inReplyToId, '9001');
  assert.equal(links.has('44196397'), false, 'the author object is not a post');
});

test('gql.27: multi-author conversation payload isolates ancestor branch for target reply', () => {
  const multiAuthorPayload = JSON.stringify({
    data: {
      threaded_conversation_with_injections_v2: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              {
                entryType: 'TimelineTimelineItem',
                entryId: 'tweet-7001',
                sortIndex: '10',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: 'Tweet',
                        rest_id: '7001',
                        core: {
                          user_results: {
                            result: {
                              legacy: { screen_name: 'bob', name: 'Bob' },
                              profile_image_url_https: 'https://pbs.twimg.com/bob.jpg',
                            },
                          },
                        },
                        legacy: {
                          id_str: '7001',
                          full_text: 'Root meme',
                        },
                      },
                    },
                  },
                },
              },
              {
                entryType: 'TimelineTimelineItem',
                entryId: 'tweet-7002',
                sortIndex: '9',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: 'Tweet',
                        rest_id: '7002',
                        core: {
                          user_results: {
                            result: {
                              legacy: { screen_name: 'alice', name: 'Alice' },
                              profile_image_url_https: 'https://pbs.twimg.com/alice.jpg',
                            },
                          },
                        },
                        legacy: {
                          id_str: '7002',
                          full_text: 'Haha from alice',
                          in_reply_to_status_id_str: '7001',
                        },
                      },
                    },
                  },
                },
              },
              {
                entryType: 'TimelineTimelineItem',
                entryId: 'tweet-7003',
                sortIndex: '8',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: 'Tweet',
                        rest_id: '7003',
                        core: {
                          user_results: {
                            result: {
                              legacy: { screen_name: 'lauren', name: 'Lauren' },
                              profile_image_url_https: 'https://pbs.twimg.com/lauren.jpg',
                            },
                          },
                        },
                        legacy: {
                          id_str: '7003',
                          full_text: 'Lauren comment',
                          in_reply_to_status_id_str: '7001',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  });

  const parsed = parseTweetDetailResponse(multiAuthorPayload, 'TweetDetail', 'q_multi', '7003');
  assert.ok(parsed.thread, 'expected parsed thread');
  assert.equal(parsed.thread.isSingle, false);
  assert.equal(parsed.thread.tweets.length, 2, 'unrelated Alice reply must be excluded');
  assert.equal(parsed.thread.tweets[0].id, '7001');
  assert.equal(parsed.thread.tweets[0].author.handle, '@bob');
  assert.equal(parsed.thread.tweets[1].id, '7003');
  assert.equal(parsed.thread.tweets[1].author.handle, '@lauren');
  assert.equal(parsed.thread.targetTweetIndex, 1);
  assert.equal(parsed.thread.author.handle, '@lauren');
});

test('gql.28: external link card (summary_large_image) preview image is extracted as media', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_CARD_JSON, 'TweetDetail', 'q1');
  assert.ok(parsed.thread, 'expected parsed thread');
  const tweet = parsed.thread.tweets[0];
  assert.ok(tweet, 'expected tweet');
  assert.equal(tweet.author.handle, '@digitalfoundry');
  assert.ok(tweet.media && tweet.media.length === 1, 'card preview image must be extracted as 1 media item');

  const media = tweet.media![0];
  assert.equal(media.type, 'image');
  assert.match(media.url, /name=orig/, 'must request highest available resolution');
  assert.equal(media.aspectRatio, 1.778, 'aspect ratio must be computed from card image dimensions');
  assert.equal(media.alt, "Review: Dragon's Dogma 2 On Switch 2");
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
