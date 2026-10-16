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
 *   art.4  the title is read from the article marker and the cover is not doubled
 *   art.5  a genuine quote tweet still resolves (the fix must not disable the
 *          quote path it was narrowing)
 *   art.5b a quote inside the prose is not adopted as this tweet's quote
 *   art.6  the GraphQL channel parses the article, trims X's padded title, and
 *          drops the self-referential `/i/article/` link from both fields
 *   art.7  the DOM channel drops the same link, from both fields
 *   art.9  a tweet merely sharing someone else's article keeps the link
 *   art.10 a body that is only its own article link ends up empty in both fields
 *   art.11 the DOM lead is the article's first paragraph, not the whole prose
 *
 * Shapes come from a logged-in session on 2026-10-09; see
 * `docs/observed-dom-2026-10-09.md`.
 */

import assert from 'node:assert/strict';
import { createDomElement } from '../env/browser.ts';
import { createSuite } from '../env/harness.ts';
import { extractTweetData } from '../../src/content/adapter/extractor.ts';
import { parseTweetDetailResponse } from '../../src/content/graphql/parse.ts';
import { ARTICLE_TWEET_HTML } from '../fixtures/article-tweet.ts';
import { TWEET_DETAIL_ARTICLE_JSON } from '../fixtures/graphql.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';

const { test, run } = createSuite();

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

test('art.5b: a quote embedded in the article prose is not adopted', () => {
  // The prose can embed a post that itself quotes someone, and that inner quote
  // carries the same `quoteTweet` testid. A document-order search finds it and
  // the card ends up showing a stranger's quote as this tweet's.
  const html = `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><span>Author</span></div>
        <div><a href="/author"><span>@author</span></a></div>
      </div>
      <div data-testid="tweetText" lang="en"><span>my post about the article</span></div>
      <article data-testid="twitterArticleReadView">
        <div data-testid="twitter-article-title">T</div>
        <div data-testid="twitterArticleRichTextView">
          <div data-testid="longformRichTextComponent">
            <div data-testid="simpleTweet">
              <div data-testid="User-Name"><div><span>Other</span></div><div><a href="/other"><span>@other</span></a></div></div>
              <div data-testid="tweetText" lang="en"><span>embedded body</span></div>
              <div data-testid="quoteTweet">
                <div data-testid="User-Name"><div><span>Third</span></div><div><a href="/third"><span>@third</span></a></div></div>
                <div data-testid="tweetText" lang="en"><span>a stranger quote</span></div>
              </div>
            </div>
          </div>
        </div>
      </article>
      <div role="group"><div data-testid="like"><span>7</span></div></div>
    </article>`;
  const tweet = extractTweetData(createDomElement(html));
  assert.equal(tweet?.quotePost, undefined, 'a quote inside the prose is not this tweet\'s quote');
});

test('art.7: the article permalink is dropped from the DOM body, in both fields', () => {
  // X does not render the post's own article link — the article block replaces
  // it — so the DOM channel must drop it from `text` and from the tokens alike.
  // Stripping only one would let a body that is nothing but the link reappear
  // through the other.
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  assert.doesNotMatch(tweet?.text || '', /i\/article/, 'the plain text must not carry the link');
  const tokenText = (tweet?.richTokens || []).map((token) => token.value).join('');
  assert.doesNotMatch(tokenText, /i\/article/, 'the token list must not carry the link either');
  assert.match(tweet?.text || '', /promised write up/, 'the author\'s own body survives');
});

test('art.6: GraphQL parses the article and drops its self-referential link', () => {
  const parsed = parseTweetDetailResponse(TWEET_DETAIL_ARTICLE_JSON, 'TweetDetail', 'q_art');
  assert.ok(parsed.thread, 'expected a thread');
  const tweet = parsed.thread!.tweets[0];

  assert.equal(tweet.article?.title, 'Anime Harry Potter', 'X pads the title with trailing space');
  assert.match(tweet.article?.openingLine || '', /^This is a writeup for those that wanted/,
    'the article opening is carried as the lead');
  // X's `preview_text` carries several paragraphs; the card takes the opening
  // one, the same slice the DOM channel can read, so the two channels do not
  // print different amounts for the same article.
  assert.doesNotMatch(tweet.article?.openingLine || '', /The core concept/,
    'the lead is the opening paragraph, not the whole preview text');
  assert.match(tweet.article?.cover?.url || '', /name=orig/, 'the cover is served at full size');
  assert.equal(tweet.article?.cover?.aspectRatio, 2.498, 'cover ratio comes from original_info');

  // The body's trailing `t.co` expands to `/i/article/<id>`. X does not render
  // it, so the card must not print it either — from `text` or from the tokens.
  assert.doesNotMatch(tweet.text, /i\/article/, 'the plain text must not carry the link');
  assert.doesNotMatch(tweet.text, /t\.co/, 'nor the unexpanded form');
  assert.match(tweet.text, /promised write up/, 'the author\'s own body survives');
  const tokenText = (tweet.richTokens || []).map((token) => token.value).join('');
  assert.doesNotMatch(tokenText, /i\/article/, 'the article permalink must not be printed');
  assert.match(tokenText, /promised write up/, 'the author\'s own body survives');
});

test('art.9: a tweet merely sharing someone else\'s article keeps the link', () => {
  // The strip must key on the post actually carrying an article. A tweet that
  // merely ends with a link to an article the author is sharing has no article
  // of its own, and that link is the author's own text — dropping it would
  // silently delete what the post is about.
  const html = `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><span>Author</span></div>
        <div><a href="/author"><span>@author</span></a></div>
      </div>
      <div data-testid="tweetText" lang="en">
        <span>great read </span>
        <a href="https://t.co/xyz"><span>x.com/i/article/999</span></a>
      </div>
      <div role="group"><div data-testid="like"><span>3</span></div></div>
    </article>`;
  const tweet = extractTweetData(createDomElement(html));
  assert.equal(tweet?.article, undefined, 'no article of its own');
  assert.match(tweet?.text || '', /i\/article\/999/, 'the shared link is the author\'s own text and stays');
  const tokenText = (tweet?.richTokens || []).map((token) => token.value).join('');
  assert.match(tokenText, /i\/article\/999/, 'and it stays in the tokens too');
});

test('art.10: a body that is only its own article link ends up empty, in both channels', () => {
  // A body that is nothing but its own article link, re-checked through the
  // shared strip after it was re-keyed on "has an article": the tokens are
  // emptied, so `text` (the fallback) must be empty too.
  const html = `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><span>Author</span></div>
        <div><a href="/author"><span>@author</span></a></div>
      </div>
      <div data-testid="tweetText" lang="en">
        <a href="https://t.co/abc"><span>x.com/i/article/123456</span></a>
      </div>
      <article data-testid="twitterArticleReadView">
        <div data-testid="twitter-article-title">Only a link</div>
        <div data-testid="twitterArticleRichTextView"><div data-testid="longformRichTextComponent"><p>x</p></div></div>
      </article>
      <div role="group"><div data-testid="like"><span>1</span></div></div>
    </article>`;
  const tweet = extractTweetData(createDomElement(html));
  assert.ok(tweet?.article, 'the post carries an article');
  assert.equal(tweet?.text, '', 'the body was only the link, so it is empty');
  assert.equal(tweet?.richTokens, undefined, 'and it has no tokens');
});

test('art.11: the DOM lead is the article\'s first paragraph, not the whole prose', () => {
  // `proseEl.querySelector('p, div')` matched `longformRichTextComponent`, the
  // prose container itself, which is a `div` that precedes every paragraph in
  // document order. The "opening line" therefore came back as the entire
  // article -- embedded post and all -- and the card prints it as its lead on a
  // body-less long-form post, which is the case the lead exists for. The shim
  // used to hide this by returning every `p` before every `div`; see
  // `tests/env/browser.ts`.
  const tweet = extractTweetData(createDomElement(ARTICLE_TWEET_HTML));
  assert.match(tweet?.article?.openingLine || '', /^This is a writeup for those that wanted/,
    'the lead is the article opening');
  assert.doesNotMatch(tweet?.article?.openingLine || '', /love potion/,
    'the post embedded in the prose is not part of the lead');
  assert.doesNotMatch(tweet?.article?.openingLine || '', /Ref2Video/,
    'the rest of the article is not part of the lead');
});

export function runTierArticle() {
  return run();
}
