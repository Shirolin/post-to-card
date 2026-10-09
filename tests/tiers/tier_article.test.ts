/**
 * Tier Article: Long-form posts (X articles).
 *
 * A tweet carrying an article renders the article as a nested `<article>`, and
 * three parts of the extractor read any nested article as a quoted post. Each
 * failed silently on a real post, so each gets a test that fails without its
 * fix:
 *
 *   art.1  the article is not a quote — the card keeps its own stats and cover
 *          instead of losing both to the quote filter
 *   art.2  the article's cover is the read view's own picture, not the media of
 *          a post embedded in the prose
 *   art.3  the article's prose is not adopted as quote content
 *   art.4  the title, permalink and cover are extracted from the real markers
 *   art.5  a genuine quote tweet still resolves (the fix must not disable the
 *          quote path it was narrowing)
 *   art.6  the GraphQL channel parses the article, trims X's padded title, and
 *          drops the self-referential `/i/article/` link from the body
 *
 * Shapes come from a logged-in session on 2026-10-09; see
 * `docs/observed-dom-2026-10-09.md`.
 */

import assert from 'node:assert/strict';
import { createDomElement } from '../env/browser.ts';
import { extractTweetData } from '../../src/content/adapter/extractor.ts';
import { parseTweetDetailResponse } from '../../src/content/graphql/parse.ts';
import { ARTICLE_TWEET_HTML } from '../fixtures/article-tweet.ts';
import { TWEET_DETAIL_ARTICLE_JSON } from '../fixtures/graphql.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';

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

test('art.1: an article is the tweet\'s own content, so its stats are kept', () => {
  // Without the fix, `isInsideNestedArticle` counted the read view as a nested
  // article, so `isInsideQuoteTweet` returned true for the action bar and
  // `extractTweetStats` dropped every metric.
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  assert.ok(tweet, 'expected a tweet');
  assert.ok(tweet!.stats, 'a long-form post keeps its own stats');
  assert.equal(tweet!.stats!.likes, '153');
  assert.equal(tweet!.stats!.reposts, '14');
  assert.equal(tweet!.stats!.views, '15947');
});

test('art.2: the cover comes from the read view, not from the prose', () => {
  // The prose embeds another post carrying its own `tweetPhoto` (a video
  // thumbnail). Picking the wrong one shows a stranger's frame as the cover.
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  const cover = tweet?.article?.cover;
  assert.ok(cover, 'expected a cover');
  assert.match(cover!.originalUrl || '', /HUIxgCnWEAEUKgI/, 'the cover is the read view picture');
  assert.doesNotMatch(cover!.originalUrl || '', /amplify_video_thumb/, 'not the embedded post video');
  assert.match(cover!.url, /name=orig/, 'the cover is served at full size');
});

test('art.3: the article is not extracted as a quote', () => {
  // `findQuoteContainer`'s bare `querySelector('article')` matched the read
  // view, so the entire article was rendered as a quoted post.
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  assert.equal(tweet?.quotePost, undefined, 'an article is not a quoted post');
});

test('art.4: the title is read from the article marker and the cover is not doubled', () => {
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  assert.equal(tweet?.article?.title, 'Anime Harry Potter');
  // The rendered DOM carries no article id — its `/article/` links are keyed by
  // the tweet id — so the DOM channel must report none rather than the wrong one.
  assert.equal(tweet?.article?.restId, undefined, 'the DOM channel does not guess an article id');
  // The cover is the article's, so it must not also arrive as tweet media and
  // render a second time.
  assert.equal(tweet?.media, undefined, 'the cover does not double as tweet media');
});

test('art.5: a genuine quote still resolves', () => {
  // The article fix narrows the quote search rather than disabling it: a real
  // `quoteTweet` must still be found.
  const tweet = extractTweetData(createDomElement(QUOTE_TWEET_HTML));
  assert.ok(tweet?.quotePost, 'a quoted post must still be extracted');
});

test('art.6: GraphQL parses the article and drops its self-referential link', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_ARTICLE_JSON, 'TweetDetail', 'q_art');
  assert.ok(parsed.thread, 'expected a thread');
  const tweet = parsed.thread!.tweets[0];

  assert.equal(tweet.article?.title, 'Anime Harry Potter', 'X pads the title with trailing space');
  assert.equal(tweet.article?.restId, '2108301504562262016');
  assert.match(tweet.article?.previewText || '', /^This is a writeup for those that wanted/,
    'the article opening is carried as the lead');
  assert.match(tweet.article?.cover?.url || '', /name=orig/, 'the cover is served at full size');
  assert.equal(tweet.article?.cover?.aspectRatio, 2.498, 'cover ratio comes from original_info');

  // The body's trailing `t.co` expands to `/i/article/<id>`. X does not render
  // it, so the card must not print it either.
  const tokenText = (tweet.richTokens || []).map((token) => token.value).join('');
  assert.doesNotMatch(tokenText, /i\/article/, 'the article permalink must not be printed');
  assert.match(tokenText, /promised write up/, 'the author\'s own body survives');
});

export async function runTierArticle(): Promise<{
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
