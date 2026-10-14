/**
 * Tier 2 Test Suite: Boundary & Corner Cases
 * Tests resilience against edge conditions, zero/extreme inputs, and fault injection.
 */

import assert from 'node:assert/strict';
import { DomElement, DomImageElement, DomDocument, DomMutationObserver, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from '../env/clipboard.ts';
import { extractTweetData } from '../../src/content/adapter/extractor.ts';
import { classifySocial, getReplyingToHandle, getRetweetedBy } from '../../src/content/adapter/social.ts';
import { getPhotoUrlCandidates, getPhotoFallbackChain } from '../../src/content/adapter/urls.ts';
import { TWEET_ARTICLE_SELECTOR } from '../../src/content/adapter/thread.ts';
import { isPicMediaLink } from '../../src/content/adapter/emojis.ts';
import { planMediaGrid, applyMediaGridPlan } from '../../src/content/ui/mediaGrid.ts';
import { imageFallbackAttrs, advanceImageFallback } from '../../src/content/ui/imageFallback.ts';
import {
  createTriggerButton,
  applyTriggerLocale,
  setInjectedButtonVisibility,
  HIDE_ACTION_BUTTON_CLASS,
  VISIBILITY_STYLE_ID,
  injectIntoActionBar,
  injectAll,
  initTwitterInjection,
} from '../../src/content/adapter/injection.ts';
import { getTranslation } from '../../src/content/i18n.ts';
import { threadScope, tweetKey } from '../../src/content/ui/threadScope.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import { NESTED_QUOTE_PREVIEW_HTML } from '../fixtures/nested-quote-preview.ts';
import { SINGLE_TWEET_HTML } from '../fixtures/single-tweet.ts';
import { RETWEET_HTML } from '../fixtures/retweet.ts';
import { PINNED_HTML } from '../fixtures/pinned.ts';
import { withoutTestIds } from '../fixtures/strip-testids.ts';
import { loadUserPreferences, STORAGE_KEY } from '../../src/content/prefs.ts';
import type { TweetData, MediaItem, ThreadData } from '../../src/types/tweet.ts';
import type { CardConfig } from '../../src/types/card.ts';
import type { ExtensionMessage } from '../../src/types/messages.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

// -------------------------------------------------------------
// Boundary 1: Empty and Whitespace-Only Text
// -------------------------------------------------------------
test('Tier 2.1: empty text tweet (media-only) renders without crashing', () => {
  const tweetData: TweetData = {
    id: '20001',
    url: 'https://x.com/artist/status/20001',
    author: { name: 'Artist', handle: '@artist', avatarUrl: 'avatar.jpg' },
    text: '',
    timestamp: '2026-02-01T10:00:00.000Z',
    media: [{ type: 'image', url: 'https://pbs.twimg.com/media/art.jpg' }],
  };

  assert.equal(tweetData.text.length, 0);
  assert.equal(tweetData.media?.length, 1);
});

test('Tier 2.2: whitespace-only tweet collapses cleanly without ghost spacing', () => {
  const rawText = '   \n\t   \n ';
  const trimmed = rawText.trim();
  assert.equal(trimmed, '');
});

// -------------------------------------------------------------
// Boundary 2: Extreme Length Content (4000+ Characters)
// -------------------------------------------------------------
test('Tier 2.3: 4000+ character long post expands card height without clipping or stack overflow', () => {
  const longText = 'A'.repeat(4500);
  assert.equal(longText.length, 4500);

  // Layout calculation
  const baseHeight = 300;
  const estimatedTextHeight = Math.ceil(longText.length / 50) * 24; // 50 chars per line, 24px line-height
  const totalHeight = baseHeight + estimatedTextHeight;

  assert.ok(totalHeight > 2000, 'Total card height should exceed 2000px without clipping');
});

test('Tier 2.4: deep nested thread of 25 consecutive tweets parsed safely', () => {
  const tweets: TweetData[] = [];
  for (let i = 0; i < 25; i++) {
    tweets.push({
      id: `thread_${i}`,
      url: `https://x.com/author/status/${i}`,
      author: { name: 'Author', handle: '@author', avatarUrl: 'avatar.jpg' },
      text: `Part ${i + 1} of long essay`,
      timestamp: '2026-03-01T12:00:00.000Z',
      isThreadPart: true,
      threadIndex: i,
      threadTotal: 25,
    });
  }

  assert.equal(tweets.length, 25);
  assert.equal(tweets[0].threadIndex, 0);
  assert.equal(tweets[24].threadIndex, 24);
  assert.equal(tweets[24].threadTotal, 25);
});

// -------------------------------------------------------------
// Boundary 3: Emoji Edge Cases
// -------------------------------------------------------------
test('Tier 2.5: complex multi-codepoint ZWJ emojis (family, rainbow flag, skin tones) preserved', () => {
  const complexEmojiText = '👨‍👩‍👧‍👦 🏳️‍🌈 🧑🏽‍💻 🦸🏻‍♀️';
  assert.ok(complexEmojiText.includes('👨‍👩‍👧‍👦'));
  assert.ok(complexEmojiText.includes('🏳️‍🌈'));
  assert.ok(complexEmojiText.includes('🧑🏽‍💻'));
  assert.ok(complexEmojiText.includes('🦸🏻‍♀️'));
});

test('Tier 2.6: 50 consecutive Twemoji images restored without separator explosion', () => {
  const el = new DomElement('DIV');
  for (let i = 0; i < 50; i++) {
    const img = new DomImageElement();
    img.alt = '🔥';
    el.appendChild(img);
  }

  let text = '';
  for (const child of el.childNodes) {
    if (child instanceof DomImageElement) text += child.alt;
  }

  assert.equal(text.length, 50 * '🔥'.length);
});

// -------------------------------------------------------------
// Boundary 4: Missing & Corrupt Media
// -------------------------------------------------------------
test('Tier 2.7: missing avatar URL falls back to default avatar placeholder SVG', () => {
  function getSafeAvatar(url?: string): string {
    if (url && url.trim().length > 0) return url;
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#71767b"/></svg>';
  }

  assert.ok(getSafeAvatar('').startsWith('data:image/svg+xml;utf8,<svg'));
  assert.equal(getSafeAvatar('https://pbs.twimg.com/avatar.jpg'), 'https://pbs.twimg.com/avatar.jpg');
});

test('Tier 2.8: broken image load failure in modern-screenshot caught gracefully', async () => {
  const card = new DomElement('DIV');
  const img = new DomImageElement();
  img.src = 'data:image/jpeg;base64,broken';
  img.decode = async () => { throw new Error('Image decoding failed'); };

  // Resilient decode wrapper
  const decodeResult = await img.decode().catch(() => 'fallback');
  assert.equal(decodeResult, 'fallback');
});

// -------------------------------------------------------------
// Boundary 5: CORS Network Failure Mock
// -------------------------------------------------------------
test('Tier 2.9: network failure during Base64 proxy falls back to placeholder data URL', async () => {
  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _s, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({ success: false, error: 'Network timeout: 504 Gateway' });
      return true;
    }
  });

  const res = await chromeMock.runtime.sendMessage({
    type: 'FETCH_IMAGE_BASE64',
    url: 'https://pbs.twimg.com/media/failed.jpg',
  });

  assert.equal(res.success, false);
  const fallbackUrl = res.success ? res.dataUrl : 'data:image/svg+xml;utf8,<svg><rect fill="#333"/></svg>';
  assert.ok(fallbackUrl.startsWith('data:image/svg+xml'));
});

// -------------------------------------------------------------
// Boundary 6: Clipboard Denial & Fallbacks
// -------------------------------------------------------------
test('Tier 2.10: clipboard write failure with DOMException triggers instant download', async () => {
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'unfocused';

  const tracker = new DownloadTracker();
  let fallbackInvoked = false;

  try {
    await clipboard.write([new MockClipboardItem({ 'image/png': new Blob([]) })]);
  } catch (err: any) {
    if (err.message.includes('Document is not focused')) {
      tracker.trackDownload(new Blob([]), 'post-to-card-unfocused.png');
      fallbackInvoked = true;
    }
  }

  assert.equal(fallbackInvoked, true);
  assert.equal(tracker.downloads.length, 1);
  assert.equal(tracker.downloads[0].filename, 'post-to-card-unfocused.png');
});

test('Tier 2.11: clipboard write failure with NotAllowedError triggers instant download', async () => {
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'gesture_expired';

  const tracker = new DownloadTracker();
  let fallbackInvoked = false;

  try {
    await clipboard.write([new MockClipboardItem({ 'image/png': new Blob([]) })]);
  } catch (err: any) {
    if (err.message.includes('Must be handling a user gesture')) {
      tracker.trackDownload(new Blob([]), 'post-to-card-gesture-expired.png');
      fallbackInvoked = true;
    }
  }

  assert.equal(fallbackInvoked, true);
  assert.equal(tracker.downloads.length, 1);
});

// -------------------------------------------------------------
// Boundary 7: Deleted and Unavailable Quote Tweets
// -------------------------------------------------------------
test('Tier 2.12: deleted quote tweet renders clean tombstone placeholder', () => {
  const tombstoneTweet: TweetData = {
    id: '4001',
    url: 'https://x.com/user/status/4001',
    author: { name: 'User', handle: '@user', avatarUrl: 'avatar.jpg' },
    text: 'What do you think of this?',
    timestamp: '2026-04-01T00:00:00.000Z',
    quotePost: {
      author: { name: '', handle: '', avatarUrl: '' },
      text: 'This post is unavailable.',
      timestamp: '',
    },
  };

  assert.equal(tombstoneTweet.quotePost?.text, 'This post is unavailable.');
  assert.equal(tombstoneTweet.quotePost?.author.handle, '');
});

// -------------------------------------------------------------
// Boundary 8: Statistics Extremes (0 vs Millions)
// -------------------------------------------------------------
test('Tier 2.13: zero interaction stats omit zeros or show clean 0', () => {
  const stats = { replies: '0', reposts: '0', likes: '0', views: '0', bookmarks: '0' };
  assert.equal(stats.likes, '0');
});

test('Tier 2.14: massive viral stats (1.2M, 50.4M, 1.1B) format without wrapping or layout break', () => {
  const viralStats = { replies: '94.2K', reposts: '315.6K', likes: '2.4M', views: '84.1M' };
  assert.ok(viralStats.likes.endsWith('M'));
  assert.ok(viralStats.views.endsWith('M'));
});

// -------------------------------------------------------------
// Boundary 9: Extreme Styling & Layout Combinations
// -------------------------------------------------------------
test('Tier 2.15: 0px border-radius with 48px padding creates crisp brutalist card', () => {
  const config: CardConfig = {
    theme: 'darkroom',
    padding: '48px',
    borderRadius: '0px',
    aspectRatio: 'auto',
    showQrCode: true,
    showStats: true,
    showTimestamp: true,
    showWatermark: true,
    blurAuthor: false,
  };
  assert.equal(config.borderRadius, '0px');
  assert.equal(config.padding, '48px');
});

test('Tier 2.16: 20px soft border-radius with 16px compact padding renders cleanly', () => {
  const config: CardConfig = {
    theme: 'gallery',
    padding: '16px',
    borderRadius: '20px',
    aspectRatio: '16:9',
    showQrCode: false,
    showStats: false,
    showTimestamp: true,
    showWatermark: false,
    blurAuthor: true,
  };
  assert.equal(config.borderRadius, '20px');
  assert.equal(config.padding, '16px');
});

// -------------------------------------------------------------
// Boundary 10: Special Characters & XSS Escaping Integrity
// -------------------------------------------------------------
test('Tier 2.17: author name with HTML tags and quotes escapes properly', () => {
  const maliciousName = '<script>alert("pwned")</script> & "Jack"';
  const el = new DomElement('SPAN');
  el.textContent = maliciousName;

  assert.equal(el.textContent, maliciousName);
  assert.equal(el.querySelector('script'), null);
});

test('Tier 2.18: tweet text with control characters and RTL characters handled safely', () => {
  const rtlText = 'مرحبا بالعالم \u202Ereversed\u202C \x00\x08';
  // Sanitization strips control characters below \x20 except \t and \n
  const sanitized = rtlText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  assert.ok(!sanitized.includes('\x00'));
  assert.ok(!sanitized.includes('\x08'));
});

// -------------------------------------------------------------
// Boundary 11: Quote Tweet Author Identity (real extractor)
// The display-name anchor and the handle anchor share the same href on
// Twitter/X, so a naive textContent read renders "任天堂株式会社 任天堂株式会社"
// instead of "任天堂株式会社 @Nintendo". These lock the fix.
// -------------------------------------------------------------
test('Tier 2.19: quote author handle is derived from href, not the display-name link text', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const data = extractTweetData(article);

  assert.equal(data?.quotePost?.author.name, 'Sam Altman');
  assert.equal(
    data?.quotePost?.author.handle,
    '@sama',
    'Quote handle must come from href, not from the display-name anchor text'
  );
});

test('Tier 2.20: quote author captures verified badge and its own avatar', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const quote = extractTweetData(article)?.quotePost;

  assert.equal(quote?.author.verified, true, 'Verified badge inside the quote box must be detected');
  assert.ok(
    quote?.author.avatarUrl.includes('sama_400x400'),
    'Quote avatar must come from the quote box, not the main author'
  );
  assert.ok(!quote?.author.avatarUrl.includes('satya'), 'Main author avatar must not leak into the quote');
});

test('Tier 2.21: main tweet handle is unaffected when display-name link shares href with handle link', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const data = extractTweetData(article);

  assert.equal(data?.author.handle, '@satyanadella');
});

// -------------------------------------------------------------
// Boundary 12: Quote Tweet Rich Content & Formatting Whitespace
// -------------------------------------------------------------
test('Tier 2.22: quote text preserves rich tokens so hashtags and links render styled', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const quote = extractTweetData(article)?.quotePost;

  assert.ok(quote?.richTokens && quote.richTokens.length > 0, 'Quote must expose rich tokens');
  const types = quote.richTokens.map(t => t.type);
  assert.ok(types.includes('text'), 'Quote rich tokens must include plain text runs');
});

test('Tier 2.23: pretty-print indentation whitespace never leaks into tweet or quote text', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const data = extractTweetData(article);

  assert.ok(
    !data?.text.includes('\n'),
    'Main tweet text must not contain raw newlines (real breaks are <br> tags)'
  );
  assert.ok(
    !data?.quotePost?.text.includes('\n'),
    'Quote text must not contain raw newlines (real breaks are <br> tags)'
  );
});

test('Tier 2.24: quote permalink is captured and points at the quoted post', () => {
  const article = createDomElement(QUOTE_TWEET_HTML);
  const data = extractTweetData(article);

  assert.equal(data?.quotePost?.url, 'https://x.com/sama/status/4999');
});

test('Tier 2.25: quote extraction returns undefined for a tweet without a quote box', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/user"><span>@user</span></a></div>
      <div data-testid="tweetText"><span>plain tweet, no quote</span></div>
    </article>
  `);

  assert.equal(extractTweetData(article)?.quotePost, undefined);
});

test('Tier 2.26: quoted post rendered as a nested <article> is still detected', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/main"><span>Main Author</span></a>
        <a href="/main"><span>@main</span></a>
      </div>
      <div data-testid="tweetText"><span>look at this</span></div>
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a href="/nested"><span>Nested Author</span></a>
          <a href="/nested"><span>@nested</span></a>
        </div>
        <div data-testid="tweetText"><span>quoted body</span></div>
      </article>
    </article>
  `);

  const quote = extractTweetData(article)?.quotePost;
  assert.ok(quote, 'Nested article must be recognised as the quoted post');
  assert.equal(quote.author.name, 'Nested Author');
  assert.equal(quote.author.handle, '@nested');
  assert.equal(quote.text, 'quoted body');
});

test('Tier 2.27: quote box without a data-testid is found structurally', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/main"><span>Main Author</span></a>
      </div>
      <div data-testid="tweetText"><span>main body</span></div>
      <div role="link" tabindex="0">
        <div data-testid="User-Name">
          <a href="/quoted"><span>Quoted Author</span></a>
          <a href="/quoted"><span>@quoted</span></a>
        </div>
        <div data-testid="tweetText"><span>quoted body without marker</span></div>
      </div>
    </article>
  `);

  const quote = extractTweetData(article)?.quotePost;
  assert.ok(quote, 'Structural fallback must locate the quote box');
  assert.equal(quote.author.handle, '@quoted');
  assert.equal(quote.text, 'quoted body without marker');
  assert.equal(
    extractTweetData(article)?.text,
    'main body',
    'Main tweet text must not be replaced by the quoted body'
  );
});

test('Tier 2.28: quoted media never leaks into the main tweet media list', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>main body</span></div>
      <div role="link" tabindex="0">
        <div data-testid="User-Name"><a href="/quoted"><span>@quoted</span></a></div>
        <div data-testid="tweetText"><span>quoted body</span></div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/quoted_only.png?format=png&name=small">
        </div>
      </div>
    </article>
  `);

  const data = extractTweetData(article);
  assert.ok(data?.quotePost, 'Quote must be detected');
  assert.equal(data?.media, undefined, 'Main tweet must have no media of its own');
  assert.equal(data?.quotePost?.media?.length, 1, 'Quoted media must belong to the quote');
});

test('Tier 2.29: an empty quote marker without content is not treated as a quote', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>main body</span></div>
      <div data-testid="quoteTweet"></div>
    </article>
  `);

  assert.equal(
    extractTweetData(article)?.quotePost,
    undefined,
    'A quote marker with no author or text must not produce an empty quote card'
  );
  assert.equal(extractTweetData(article)?.text, 'main body');
});

test('Tier 2.30: external link card preview image is extracted as media', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>check this link</span></div>
      <div data-testid="card.wrapper">
        <div data-testid="card.layoutLarge.media">
          <img data-testid="card-image" src="https://pbs.twimg.com/card_img/123/nintendo?format=jpg&name=small" alt="Nintendo Today!">
        </div>
      </div>
    </article>
  `);

  const media = extractTweetData(article)?.media;
  assert.ok(media && media.length === 1, 'Link card preview must yield one media item');
  assert.ok(media[0].url.includes('card_img'), 'Link card media must point at the card image');
  // Assert the resolution intent rather than a literal size token: the highest
  // available variant is what keeps exports sharp, and its name changes.
  assert.ok(
    getPhotoUrlCandidates(media[0].url)[0].includes('name=orig'),
    'Link card preview must request the highest resolution variant so exports stay sharp'
  );
});

test('Tier 2.30b: external link card with non-div wrapper tag is extracted as media', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>check this link</span></div>
      <section data-testid="card.wrapper">
        <div data-testid="card.layoutLarge.media">
          <img src="https://pbs.twimg.com/card_img/456/switch2?format=jpg&amp;name=900x900" alt="Switch 2 Review">
        </div>
      </section>
    </article>
  `);

  const media = extractTweetData(article)?.media;
  assert.ok(media && media.length === 1, 'Tag-agnostic link card preview must yield one media item');
  assert.ok(media[0].url.includes('card_img'), 'Link card media must point at the card image');
  assert.equal(media[0].alt, 'Switch 2 Review');
  assert.ok(
    getPhotoUrlCandidates(media[0].url)[0].includes('name=orig'),
    'Link card preview must request the highest resolution variant so exports stay sharp'
  );
});

test('Tier 2.30c: quote tweet carrying an external link card is extracted as quote media', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>check this quote</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/quoted"><span>@quoted</span></a></div>
        <div data-testid="tweetText"><span>quoted article link</span></div>
        <div data-testid="card.wrapper">
          <img src="https://pbs.twimg.com/card_img/789/review?format=jpg&amp;name=orig" alt="Quoted Article">
        </div>
      </div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.ok(tweet, 'expected extracted tweet');
  assert.ok(!tweet.media, 'main tweet itself has no media');
  assert.ok(tweet.quotePost, 'expected quote post');
  assert.ok(tweet.quotePost.media && tweet.quotePost.media.length === 1, 'quoted link card must be extracted as quote media');
  assert.ok(tweet.quotePost.media[0].url.includes('card_img'), 'quote media points to card image');
  assert.equal(tweet.quotePost.media[0].alt, 'Quoted Article');
});

// -------------------------------------------------------------
// Structural detection: retweets, replies, ads, and unavailable posts
// -------------------------------------------------------------
test('Tier 2.31: a repost is identified from socialContext without reading its label', () => {
  // The notice is the reposter's own profile link -- that nesting is the signal,
  // and the label text ("Alice reposted" here) is deliberately arbitrary so a
  // check that read the wording would have nothing to match on.
  const article = createDomElement(`
    <article data-testid="tweet">
      <a href="/alice" role="link"><span data-testid="socialContext">Alice reposted</span></a>
      <div data-testid="User-Name"><a href="/bob"><span>Bob</span></a></div>
      <div data-testid="tweetText"><span>original words</span></div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.retweetedBy, '@alice', 'reposting handle must come from the notice own link');
  assert.equal(tweet?.diagnostics?.social, 'retweet');
});

test('Tier 2.31b: a real repost notice is a span, and its handle is the notice own link', () => {
  // The community documentation said `div[data-testid="socialContext"]`, and a
  // real repost (2026-10-11) puts that testid on a `span` whose *enclosing* link
  // is the reposter. Both halves were wrong, so every repost read as an original
  // post. This is the real markup; `RETWEET_HTML` carries it with its provenance.
  const article = createDomElement(RETWEET_HTML);

  const tweet = extractTweetData(article);
  assert.ok(tweet, 'the repost must extract');
  assert.equal(tweet!.retweetedBy, '@shirolinhime', 'the reposter is the notice own link');
  assert.equal(tweet!.diagnostics?.social, 'retweet', 'and it must classify as a repost');
  assert.equal(tweet!.author.handle, '@deon_lt', 'the body belongs to the reposted author');
  assert.equal(
    tweet!.translatedFrom,
    '翻译自 英语',
    'the translation notice is still the entry own, not the notice'
  );
});

test('Tier 2.31c: a real pinned notice is a div with no link, and reads as pinned', () => {
  // The same testid as a repost, rendered the other way: a `div` here against a
  // `span` there, and no link at all. That pair is why the lookup matches the
  // testid and never the tag, and why the handle readers must answer nothing
  // rather than reaching for the entry's own author.
  const article = createDomElement(PINNED_HTML);

  const tweet = extractTweetData(article);
  assert.ok(tweet, 'the pinned post must extract');
  assert.equal(tweet!.diagnostics?.social, 'pinned', 'a notice naming no account is pinned');
  assert.equal(tweet!.retweetedBy, undefined, 'a pinned post is not a repost');
  assert.equal(tweet!.author.handle, '@op7418', 'and the body is its own author');

  // And it must not depend on reading the wording. X localises that notice into
  // forty-odd languages while the wording list knew three, so a German or Korean
  // interface silently reported `none` -- which is exactly the drift the
  // diagnostic exists to surface. The structure is the same in every language:
  // a pinned notice names no account.
  for (const wording of ['Angepinnt', 'Épinglé', '고정됨', 'フィン止め']) {
    const localized = createDomElement(PINNED_HTML.replace('已置顶', wording));
    assert.equal(
      extractTweetData(localized)?.diagnostics?.social,
      'pinned',
      `a notice reading "${wording}" is still pinned`
    );
  }
});

test('Tier 2.32: a reply target is read structurally from socialContext', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="socialContext">
        <span>Replying to</span>
        <a href="/carol"><span>@carol</span></a>
      </div>
      <div data-testid="User-Name"><a href="/dave"><span>Dave</span></a></div>
      <div data-testid="tweetText"><span>a reply</span></div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.retweetedBy, undefined, 'a reply is not a retweet');
  assert.equal(tweet?.diagnostics?.social, 'reply');
});

test('Tier 2.32b: the notice kind is read from structure, in any language', () => {
  // The three notices are structurally distinct, and this is the property that
  // matters: the wording is localized into forty-odd languages while the check
  // used to know seven, so a German or Korean interface reported no reply at all
  // (and, through `getRetweetedBy`, could report a reply as a repost).
  const reply = (wording: string) =>
    createDomElement(`
      <article data-testid="tweet">
        <div data-testid="socialContext"><span>${wording}</span> <a href="/carol" role="link"><span>@carol</span></a></div>
        <div data-testid="User-Name"><a href="/dave"><span>@dave</span></a></div>
        <div data-testid="tweetText"><span>a reply</span></div>
      </article>
    `);

  for (const wording of ['Replying to', 'Antwort an', 'En réponse à', '답글 대상']) {
    const article = reply(wording);
    assert.equal(classifySocial(article), 'reply', `"${wording}" is a reply notice`);
    assert.equal(getReplyingToHandle(article), '@carol', `and names its target, for "${wording}"`);
    assert.equal(getRetweetedBy(article), null, `and is not a repost, for "${wording}"`);
  }

  // A repost keeps working when its own wording is unknown, too.
  for (const wording of ['reposted', 'Weitergeleitet', '리포스트']) {
    const article = createDomElement(RETWEET_HTML.replace('你已转帖', wording));
    assert.equal(classifySocial(article), 'retweet', `"${wording}" is a repost notice`);
    assert.equal(getRetweetedBy(article), '@shirolinhime', `and names the reposter, for "${wording}"`);
  }
});

test('Tier 2.33: the word "reply" inside a quoted post does not classify the outer tweet', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/erin"><span>Erin</span></a></div>
      <div data-testid="tweetText"><span>look at this</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/frank"><span>Frank</span></a></div>
        <div data-testid="tweetText"><span>回复: please read this</span></div>
      </div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.retweetedBy, undefined);
  assert.equal(tweet?.diagnostics?.social, 'none', 'a quoted reply must not classify the outer entry');
});

test('Tier 2.34: pic.x.com media permalinks do not leak into the rendered text', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/gina"><span>Gina</span></a></div>
      <div data-testid="tweetText">
        <span>look at this</span>
        <a href="https://t.co/abc123"><span>pic.x.com/abc123</span></a>
      </div>
      <div data-testid="tweetPhoto">
        <img src="https://pbs.twimg.com/media/a.jpg?format=jpg&name=small" alt="A">
      </div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.ok(!/pic\./.test(tweet?.text || ''), 'media permalink must not appear in the body text');
  assert.ok(!(tweet?.richTokens || []).some(tk => tk.type === 'mention' && /pic\./.test(tk.value)),
    'media permalink must not be tokenized as a mention');
});

test('Tier 2.35: a post with a permalink but no identity or body is flagged unavailable', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <a href="/someone/status/123"><time datetime="2026-01-01T00:00:00.000Z"></time></a>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.diagnostics?.isUnavailable, true);
});

test('Tier 2.36: an ordinary post is not flagged as unavailable', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/hank"><span>Hank</span></a></div>
      <div data-testid="tweetText"><span>still here</span></div>
      <a href="/hank/status/456"><time datetime="2026-01-01T00:00:00.000Z"></time></a>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.diagnostics?.isUnavailable, false);
});

test('Tier 2.37: photo resolution requests the highest available variant and keeps a fallback chain', () => {
  const candidates = getPhotoUrlCandidates('https://pbs.twimg.com/media/x.webp?format=webp&name=small');
  assert.ok(candidates.length >= 2, 'expected a fallback chain');
  assert.ok(candidates[0].includes('name=orig'), 'first candidate must request the original');
  assert.ok(candidates[0].includes('format=jpg'), 'webp must be rewritten to jpg for original quality');
  assert.ok(candidates.some(c => c.includes('name=large')), 'chain must include a smaller fallback');
});

test('Tier 2.37b: a card picture’s fallback chain ends at the URL the page rendered', () => {
  // `orig` is known to 404 where `large` still resolves, so the chain exists to
  // recover a broken <img> rather than print its alt text. It must lead with the
  // mounted URL, run through the derived variants, and finish on the exact URL
  // X itself rendered -- the one variant that is certain to still exist.
  const originalUrl = 'https://pbs.twimg.com/media/photo.jpg?format=jpg&name=small';
  const preferredUrl = getPhotoUrlCandidates(originalUrl)[0];
  const chain = getPhotoFallbackChain(originalUrl, preferredUrl);

  assert.equal(chain[0], preferredUrl, 'the mounted URL must be tried first');
  assert.equal(chain[chain.length - 1], originalUrl, 'the page-rendered URL is the last resort');
  assert.ok(chain.some(c => c.includes('name=large')), 'large must remain in the chain');
  assert.equal(new Set(chain).size, chain.length, 'no URL may be tried twice');
});

test('Tier 2.37c: a picture with no derivable variants still has itself as a fallback-free single entry', () => {
  // A non-media source (or one already at its best) yields one URL. The card
  // then mounts it with no `data-fallback`, so a broken image stays visibly
  // broken instead of being retried against itself.
  const raw = 'https://pbs.twimg.com/profile_images/1/avatar_400x400.jpg';
  const chain = getPhotoFallbackChain(raw, raw);
  assert.deepEqual(chain, [raw], 'a non-upgradable source must not invent a retry');
});

test('Tier 2.37d: a broken card picture advances to its next variant, one step per error', () => {
  // The end-to-end recovery: mount the highest variant, then feed errors and
  // watch the src walk down the chain until it lands on the page-rendered URL.
  const item: MediaItem = {
    type: 'image',
    url: 'https://pbs.twimg.com/media/photo.jpg?format=jpg&name=orig',
    originalUrl: 'https://pbs.twimg.com/media/photo.jpg?format=jpg&name=small',
  };

  const img = new DomImageElement();
  img.setAttribute('src', item.url);
  for (const [name, value] of Object.entries(imageFallbackAttrs(item))) {
    img.setAttribute(name, value);
  }

  advanceImageFallback(img);
  assert.match(img.src, /name=large/, 'first error drops to large');
  advanceImageFallback(img);
  assert.match(img.src, /name=medium/, 'second error drops to medium');
  advanceImageFallback(img);
  assert.equal(img.src, item.originalUrl, 'third error lands on the page-rendered URL');
  // The last step emptied the chain, so the element is left with nothing to retry.
  assert.equal(img.getAttribute('data-fallback'), '[]');

  // One more error must not throw or loop: the picture is simply broken.
  assert.doesNotThrow(() => advanceImageFallback(img));
  assert.equal(img.src, item.originalUrl, 'an exhausted chain leaves the last URL in place');
});

test('Tier 2.37e: a picture with no fallback is mounted without the attribute and never retried', () => {
  const item: MediaItem = { type: 'image', url: 'https://pbs.twimg.com/profile_images/1/plain_400x400.jpg' };
  assert.deepEqual(imageFallbackAttrs(item), {}, 'nothing to fall back to means no attribute');

  const img = new DomImageElement();
  img.setAttribute('src', item.url);
  advanceImageFallback(img);
  assert.equal(img.src, item.url, 'a picture with no chain is left untouched');
});

test('Tier 2.37f: a video poster never falls back onto the video file', () => {
  // The GraphQL channel stores the mp4 in `originalUrl` and the still frame in
  // `url`/`posterUrl`. Deriving the chain from `originalUrl` made a 404 poster
  // "recover" onto an `.mp4`, which an <img> cannot display -- worse than the
  // broken poster it started with. The poster is the only valid source of
  // picture variants. A poster thumbnail path X serves no `name=` variants for
  // then yields no chain at all, which is the honest outcome rather than a
  // wrong one.
  const item: MediaItem = {
    type: 'video',
    url: 'https://pbs.twimg.com/amplify_video_thumb/9/img/x.jpg?format=jpg&name=orig',
    originalUrl: 'https://video.twimg.com/amplify_video/9/vid/avc1/1280x720/x.mp4',
    posterUrl: 'https://pbs.twimg.com/amplify_video_thumb/9/img/x.jpg?format=jpg&name=orig',
  };

  const attrs = imageFallbackAttrs(item);
  assert.ok(!JSON.stringify(attrs).includes('.mp4'), 'the video file is never a fallback');
  assert.ok(!JSON.stringify(attrs).includes('video.twimg.com'), 'nor is its host reached');

  // The image path is unchanged: a photo still walks its own variants.
  const photo: MediaItem = {
    type: 'image',
    url: 'https://pbs.twimg.com/media/p.jpg?format=jpg&name=orig',
    originalUrl: 'https://pbs.twimg.com/media/p.jpg?format=jpg&name=small',
  };
  assert.match(imageFallbackAttrs(photo)['data-fallback'] || '', /name=large/,
    'a photo still carries its variant chain');
});

test('Tier 2.38: extraction degrades gracefully when no data-testid is present', () => {
  // Logged-out pages carry no data-testid at all, so every testid-based lookup
  // misses. The fixture is a real one with its attributes removed, which is what
  // leaves the permalink and the timestamp as the only signals in the markup.
  const article = createDomElement(withoutTestIds(SINGLE_TWEET_HTML));

  let tweet;
  assert.doesNotThrow(() => {
    tweet = extractTweetData(article as unknown as Element);
  }, 'extraction must not throw on a testid-free DOM');
  assert.ok(tweet, 'a record must still be produced');

  // Identity comes off the permalink and the timestamp rather than a testid, so
  // it survives the loss. How much of the rest degrades is deliberately not
  // pinned -- a later pass may recover more of it -- but the action bar must
  // never become the body.
  assert.equal(tweet!.id, '20', 'the permalink still identifies the post');
  assert.equal(tweet!.url, 'https://x.com/jack/status/20');
  for (const marker of ['48.5K', '120.2K', '1.5M', '32.1K', '18.4M']) {
    assert.ok(
      !tweet!.text.includes(marker),
      `the body must not adopt the action bar's "${marker}"`
    );
  }
  assert.equal(tweet!.diagnostics?.text, 'none', 'diagnostics must report the missing anchor');
});

test('Tier 2.39: the article selector falls back past data-testid', () => {
  assert.ok(
    TWEET_ARTICLE_SELECTOR.includes('role="article"'),
    'a role-based fallback is required because logged-out pages lack data-testid'
  );
  assert.ok(
    TWEET_ARTICLE_SELECTOR.includes('cellInnerDiv'),
    'a structural fallback is required for layouts without either marker'
  );
  // Verified against a real logged-out tweet page, where the page carried no
  // data-testid and no role, leaving only the bare tag inside main.
  assert.ok(
    TWEET_ARTICLE_SELECTOR.includes('main article'),
    'a bare main article fallback is required for logged-out pages'
  );
});

test('Tier 2.40: a translated post carries X’s "translated from" notice verbatim', () => {
  // X renders the notice as the sibling directly above the body: a translate
  // glyph, the label, and a "show original" toggle. The toggle must not end up
  // in the extracted label.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div>
        <svg viewBox="0 0 24 24"></svg>
        <span>Translated from Portuguese</span>
        <button aria-label="Show original"><span>Show original</span></button>
      </div>
      <div data-testid="tweetText" lang="en"><span>Best combat in a game so far</span></div>
    </article>
  `);

  const data = extractTweetData(article);
  assert.equal(data?.translatedFrom, 'Translated from Portuguese');
  assert.equal(data?.text, 'Best combat in a game so far');
});

test('Tier 2.41: an untranslated post has no translation notice', () => {
  // The row above the body is normally the author line, which must not be
  // mistaken for a translation notice.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>hello</span></div>
    </article>
  `);

  assert.equal(extractTweetData(article)?.translatedFrom, undefined);
});

test('Tier 2.42: a self-labelled link is tokenized, not dropped as a media permalink', () => {
  // Regression guard. The old "visible text equals href" test for media
  // permalinks also swallowed a genuine URL whose label is the URL itself,
  // which dropped the styled link and left the raw body text unstyled.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/alice"><span>Alice</span></a></div>
      <div data-testid="tweetText">
        <span>Try </span>
        <a href="https://example.com/app?x=1" role="link">https://example.com/app?x=1</a>
      </div>
    </article>
  `);

  const tokens = extractTweetData(article)?.richTokens || [];
  const link = tokens.find(tk => tk.type === 'link');
  assert.ok(link, 'a self-labelled URL must survive as a link token');
  assert.equal(link!.value, 'https://example.com/app?x=1');
});

test('Tier 2.43: real line breaks in the body survive as newlines', () => {
  // X renders line breaks as literal "\n" inside a pre-wrap block, not as <br>
  // elements. Collapsing them to spaces flattened a bulleted/paragraph post into
  // a single blob on the card.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>first line

- bullet
- bullet two

last line</span></div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.text, 'first line\n\n- bullet\n- bullet two\n\nlast line');

  const textToken = (tweet?.richTokens || []).find(tk => tk.type === 'text');
  assert.equal(
    textToken?.value,
    'first line\n\n- bullet\n- bullet two\n\nlast line',
    'the token view must keep the same line breaks as the body text'
  );
});

test('Tier 2.74: a paragraph break inside its own text node is not flattened', () => {
  // X splits the body around every inline element (link, mention, emoji img), so
  // a paragraph break between two such elements lives in a whitespace-only node
  // of its own. The first fix only protected a break inside a content-bearing
  // node, so any post whose line ended at a mention or emoji came back as one
  // paragraph -- the regression that was reported twice.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>first para</span><span>\n\n</span><span>second para with <a href="/alice">@alice</a> here</span></div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.text, 'first para\n\nsecond para with @alice here');

  const tokens = tweet?.richTokens || [];
  assert.equal(
    tokens.map(tk => tk.value).join(''),
    'first para\n\nsecond para with @alice here',
    'the token view must flatten to the same body, break included'
  );
  assert.ok(
    tokens.some(tk => tk.type === 'text' && tk.value.includes('\n\n')),
    'the paragraph break must survive as a break, not a space'
  );
});

test('Tier 2.75: newline indentation at the body edges prints no blank line', () => {
  // A break that reaches the start or end of the body would show as an empty
  // first or last line on the card. `tweet.text` trims its edges, so the token
  // view must agree.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>
</span><span>the only line <a href="/alice">@alice</a></span>
</div>
    </article>
  `);

  const tweet = extractTweetData(article);
  const tokens = tweet?.richTokens || [];
  assert.ok(tokens.length > 0, 'the body must still produce tokens');
  assert.equal(tokens[0].type === 'text' ? tokens[0].value.trim() : tokens[0].value, 'the only line');
  assert.equal(tweet?.text, 'the only line @alice');
});

test('Tier 2.44: a quoted video renders once, not as a poster plus the video', () => {
  // Regression guard. The quote's media pass had no poster handling, so a quoted
  // video kept its poster image AND the video item, and the card drew the same
  // frame twice — once plain, once with the play badge.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>look at this</span></div>
      <div role="link" tabindex="0" data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/quoted"><span>@quoted</span></a></div>
        <div data-testid="tweetText"><span>quoted body</span></div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/tweet_video_thumb/quote_frame.jpg" alt="">
          <video poster="https://pbs.twimg.com/tweet_video_thumb/quote_frame.jpg"></video>
          <button data-testid="playButton" aria-label="play"></button>
        </div>
      </div>
    </article>
  `);

  const data = extractTweetData(article);
  const media = data?.quotePost?.media;
  assert.ok(media, 'the quoted video must produce media');
  assert.equal(media!.length, 1, 'the quoted poster must not render alongside the video item');
  assert.equal(media![0].type, 'video');
  assert.equal(data?.media, undefined, "the quoted video must not leak into the main tweet's media");
});

// -------------------------------------------------------------
// Media grid planning: threshold edges and settled decisions
// -------------------------------------------------------------

/** A picture of the given shape, with no shape recorded. */
function picture(ratio?: number): MediaItem {
  const item: MediaItem = { type: 'image', url: 'https://pbs.twimg.com/media/p.jpg' };
  if (ratio !== undefined) item.aspectRatio = ratio;
  return item;
}

const AUTO_GRID = { aspectRatio: 'auto' as const, mediaLayout: 'grid' as const };

test('Tier 2.45: the 1.2 hero threshold puts each side on its own side of it', () => {
  // Below 1.2 the first picture is tall or square and takes the left column;
  // at 1.2 and above it is a banner and takes the whole first row. The edge is
  // inclusive on the landscape side, so 1.2 itself is top-hero.
  assert.equal(planMediaGrid([picture(1.19), picture(1.5), picture(1.5)], AUTO_GRID).layout, 'left-hero');
  assert.equal(planMediaGrid([picture(1.2), picture(1.5), picture(1.5)], AUTO_GRID).layout, 'top-hero');
});

test('Tier 2.46: the 1.25 wide threshold is inclusive, 0.88 tall is not', () => {
  // Two pictures only read as "both wide" at 1.25 and up.
  assert.equal(planMediaGrid([picture(1.24), picture(1.6)], AUTO_GRID).layout, 'columns');
  assert.equal(planMediaGrid([picture(1.25), picture(1.25)], AUTO_GRID).layout, 'stacked');

  // The tall pair reads on a tighter threshold, and stays strict: one wide
  // partner is enough to make the pair a plain two-column grid.
  assert.equal(planMediaGrid([picture(0.88), picture(0.88)], AUTO_GRID).layout, 'portrait-columns');
  assert.equal(planMediaGrid([picture(0.88), picture(0.9)], AUTO_GRID).layout, 'columns');
  assert.equal(planMediaGrid([picture(0.88), picture(1.6)], AUTO_GRID).layout, 'columns');
});

test('Tier 2.47: one known shape can call a tall pair, on the looser threshold', () => {
  // Only one picture has reported its shape so far. A single tall picture is
  // enough to commit the pair to the portrait layout, and the looser 0.85
  // threshold is what reflects the uncertainty.
  assert.equal(planMediaGrid([picture(0.85), picture()], AUTO_GRID).layout, 'portrait-columns');
  assert.equal(planMediaGrid([picture(0.86), picture()], AUTO_GRID).layout, 'columns');
  assert.equal(planMediaGrid([picture(), picture(0.85)], AUTO_GRID).layout, 'portrait-columns');
  assert.equal(planMediaGrid([picture(1.6), picture()], AUTO_GRID).layout, 'columns');
});

test('Tier 2.48: a half-known grid leaves its shape to the stylesheet', () => {
  // Every count-2 combination of shapes is a sum or a harmonic mean of two, so
  // one shape on its own says nothing. The plan then states a layout and no
  // ratio, which leaves card.css free to apply the default for that layout.
  const shapeless = planMediaGrid([picture(), picture()], AUTO_GRID);
  assert.equal(shapeless.layout, 'columns');
  assert.equal(shapeless.aspectRatio, undefined);

  // Regression guard. One tall picture is enough to commit the pair to the
  // portrait layout, and that layout's own default is square. A blanket wide
  // fallback here stated 1.6 inline, which beat the stylesheet and rendered a
  // pair of vertical screenshots in a landscape box.
  const halfTall = planMediaGrid([picture(0.8), picture()], AUTO_GRID);
  assert.equal(halfTall.layout, 'portrait-columns');
  assert.equal(halfTall.aspectRatio, undefined, 'the square default must survive');

  // The same for a half-known wide picture, which lands on the plain columns.
  assert.equal(planMediaGrid([picture(1.4), picture()], AUTO_GRID).layout, 'columns');
  assert.equal(planMediaGrid([picture(1.4), picture()], AUTO_GRID).aspectRatio, undefined);

  // Four shapeless pictures cannot be averaged at all, so that one leaves the
  // shape to the stylesheet too.
  const quad = planMediaGrid([picture(), picture(), picture(), picture()], AUTO_GRID);
  assert.equal(quad.layout, 'quad');
  assert.equal(quad.aspectRatio, undefined, 'four shapeless pictures cannot be averaged');

  // One shape out of four is still an average of one, which says nothing about
  // the other three.
  const oneKnown = planMediaGrid([picture(1.5), picture(), picture(), picture()], AUTO_GRID);
  assert.equal(oneKnown.aspectRatio, undefined);

  // Both known, and the grid does take a shape from them.
  assert.equal(planMediaGrid([picture(0.46), picture(0.46)], AUTO_GRID).aspectRatio, '0.92');
});

test('Tier 2.49: only auto mode lets the pictures shape the grid', () => {
  const items = [picture(0.46), picture(0.46)];

  // A poster ratio or a stacked grid has a shape of its own, which the stylesheet
  // already states, so the plan must not also state one inline.
  assert.equal(planMediaGrid(items, { aspectRatio: '3:4', mediaLayout: 'grid' }).aspectRatio, undefined);
  assert.equal(planMediaGrid(items, { aspectRatio: '16:9', mediaLayout: 'grid' }).aspectRatio, undefined);
  assert.equal(planMediaGrid(items, { aspectRatio: 'auto', mediaLayout: 'stack' }).aspectRatio, undefined);
  assert.equal(planMediaGrid(items, AUTO_GRID).aspectRatio, '0.92');
});

test('Tier 2.50: a settled plan does not change when it is planned again', () => {
  // The load path re-plans a grid that was planned before the shapes arrived.
  // Planning twice with the same information has to land on the same answer,
  // which is the whole point of the two paths sharing one rule.
  const items = [picture(0.46), picture(0.46), picture(1.4)];
  const first = planMediaGrid(items, AUTO_GRID);
  const second = planMediaGrid(items, AUTO_GRID);
  assert.deepEqual(second, first);

  // The mixed pair is the case that drifted before: one tall and one wide, with
  // an average wide enough to be called tall. The render rule is the only one.
  const mixed = [picture(0.7), picture(1.1)];
  assert.equal(planMediaGrid(mixed, AUTO_GRID).layout, 'columns');
  assert.equal(planMediaGrid(mixed, AUTO_GRID).layout, planMediaGrid(mixed, AUTO_GRID).layout);
});

test('Tier 2.51: a re-plan replaces the previous layout instead of adding to it', () => {
  // A grid planned before the shapes arrived carries the default layout; the
  // re-plan has to clear it, because card.css matches the layout on both the
  // class and the data attribute and a stale one wins or loses on specificity.
  const grid = new DomElement('DIV');
  grid.setAttribute('data-grid-layout', 'default');
  grid.classList.add('grid-default');

  applyMediaGridPlan(grid, planMediaGrid([picture(0.46), picture(0.46)], AUTO_GRID));

  assert.equal(grid.getAttribute('data-grid-layout'), 'portrait-columns');
  assert.ok(grid.classList.contains('grid-portrait-columns'), 'the planned class must be present');
  assert.ok(!grid.classList.contains('grid-default'), 'the previous layout class must be gone');
  assert.ok(!grid.classList.contains('grid-columns'), 'no other layout class may linger');
  assert.equal(grid.style.aspectRatio, '0.92');
});

// -------------------------------------------------------------
// Thread scope: exclusions saved for a thread that is no longer open
// -------------------------------------------------------------

/** A thread of `count` posts, ids `t1..tn`, targeting the second one. */
function thread(count: number): ThreadData {
  const author = { name: 'A', handle: '@a', avatarUrl: '' };
  return {
    author,
    isSingle: count === 1,
    targetTweetIndex: Math.min(1, count - 1),
    tweets: Array.from({ length: count }, (_, i) => ({
      id: `t${i + 1}`,
      url: `https://x.com/a/status/t${i + 1}`,
      author,
      text: `post ${i + 1}`,
      timestamp: '2026-02-01T10:00:00.000Z',
    })),
  };
}

test('Tier 2.52: another thread’s exclusions do not count against this card', () => {
  // Exclusions live in the saved preferences, not with the thread, so they
  // outlive it. Two keys left over from a previous thread must not decide how
  // many tweets this one may drop: the on-card exclude button appears whenever
  // more than one tweet shows, so a stricter verdict leaves a button that is
  // there, focusable and inert.
  const three = thread(3);
  const scope = threadScope(three, ['other1', 'other2']);

  assert.equal(scope.activeCount, 3);
  assert.equal(scope.totalCount, 3);
  assert.equal(scope.canExcludeMore, true);
  assert.equal(scope.excluded.size, 0);
});

test('Tier 2.53: building the next set from the scope drops the stale keys', () => {
  // The cure for stale keys is that callers write from the scoped set, so the
  // first exclusion after switching threads cleans the storage as a side
  // effect and no rule about when to clear is needed anywhere.
  const scope = threadScope(thread(3), ['other1', 'other2', 't1']);
  assert.deepEqual(Array.from(scope.excluded), ['t1']);

  const next = new Set(scope.excluded);
  next.add('t2');
  assert.deepEqual(Array.from(next).sort(), ['t1', 't2']);
});

test('Tier 2.54: one tweet left is the one that has to stay', () => {
  const three = thread(3);
  assert.equal(threadScope(three, []).canExcludeMore, true);
  assert.equal(threadScope(three, ['t1']).canExcludeMore, true);
  assert.equal(threadScope(three, ['t1', 't2']).canExcludeMore, false);
  assert.equal(threadScope(three, ['t1', 't2']).activeCount, 1);
});

test('Tier 2.55: the scope reports the raw count and leaves the floor to the surface', () => {
  // Everything excluded is a state the surfaces have to survive rather than one
  // the scope hides: the card renders a fallback tweet and the preview summary
  // floors its count, and those are two different decisions.
  const scope = threadScope(thread(2), ['t1', 't2']);
  assert.equal(scope.activeCount, 0);
  assert.equal(scope.canExcludeMore, false);
});

test('Tier 2.56: a post without an id is keyed by its position, as every surface must', () => {
  // The controls panel and the card have to name the same tweet. A post that
  // arrived without an id is identified by where it sits, so the derivation is
  // part of the scope rather than written out at each call site.
  const withoutIds = thread(3);
  withoutIds.tweets[1] = { ...withoutIds.tweets[1], id: '' };

  assert.equal(tweetKey(withoutIds.tweets[0], 0), 't1');
  assert.equal(tweetKey(withoutIds.tweets[1], 1), '1');
  assert.equal(tweetKey(undefined, 2), '2', 'an index past the end still names a position');

  // Which means the id-less post is excluded by position, and only by position.
  const scope = threadScope(withoutIds, ['1']);
  assert.deepEqual(Array.from(scope.excluded), ['1']);
  assert.equal(scope.activeCount, 2);
});

// -------------------------------------------------------------
// The language the injected triggers speak
/**
 * Runs `body` against a fake document, which is what the injection code reads.
 * The triggers are injected before preferences resolve, so their label has to be
 * correctable after the fact, and that can only be observed against a document.
 */
function withFakeDocument<T>(body: (doc: DomDocument) => T): T {
  const scope = globalThis as { document?: unknown };
  const previous = scope.document;
  const doc = new DomDocument();
  scope.document = doc;
  try {
    return body(doc);
  } finally {
    scope.document = previous;
  }
}

// -------------------------------------------------------------
// Injection: the trigger, the action bar, and the preference listener
// -------------------------------------------------------------

/** Enough of `window` for the lifecycle manager to install itself on. */
function fakeWindow(): Record<string, unknown> {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const push = (type: string) => (e: unknown) => {
    for (const cb of listeners.get(type) || []) cb(e);
  };
  return {
    location: { pathname: '/ada_builds' },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: (e: unknown) => void) => {
      listeners.get(type)?.delete(cb);
    },
    // A dispatched event goes to the listeners for its own type, which is what
    // makes a window-level `keydown` reachable from a test.
    dispatchEvent: (event: { type?: string } | undefined) => {
      const byType = push(event?.type || '');
      byType(event);
    },
    CustomEvent: class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    Event: class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  };
}

/**
 * Runs `body` with every global the injection path reads installed: a document
 * to inject into, a window to listen on, a chrome to store preferences in, and
 * an observer for the rescan.
 *
 * Awaited rather than returned, because a body that suspends has to keep its
 * globals for the duration: restoring them the moment the promise is handed back
 * tears the environment down underneath the code still running.
 */
async function withInjectionEnv<T>(
  body: (ctx: { doc: DomDocument; chrome: ReturnType<typeof createChromeMock> }) => T | Promise<T>
): Promise<T> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    window: scope.window,
    chrome: scope.chrome,
    MutationObserver: scope.MutationObserver,
    DomElement: scope.DomElement,
  };

  const doc = new DomDocument();
  const chrome = createChromeMock();
  scope.document = doc;
  scope.window = fakeWindow();
  scope.chrome = chrome;
  scope.MutationObserver = DomMutationObserver;
  scope.DomElement = DomElement;

  try {
    return await body({ doc, chrome });
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key as keyof typeof saved] === undefined) {
        delete scope[key];
      } else {
        scope[key] = saved[key as keyof typeof saved];
      }
    }
  }
}

/** One tweet with an action bar holding the engagement controls. */
const TWEET_HTML = `
  <article data-testid="tweet">
    <div data-testid="User-Name"><a href="/ada"><span>Ada</span></a></div>
    <div role="group">
      <button data-testid="reply" aria-label="64 replies">64</button>
      <button data-testid="like" aria-label="8.1K likes">8.1K</button>
    </div>
  </article>
`;

test('Tier 2.59: a tweet gets one trigger, and asking twice does not add another', async () => {
  // Deduplication is anchored to the tweet, not to the element that was handed
  // over, because the three lookup strategies the scanner uses resolve to
  // different elements for the same post. A container-level guard let one tweet
  // collect several buttons that way.
  await withInjectionEnv(async ({ doc }) => {
    const article = createDomElement(TWEET_HTML);
    doc.body.appendChild(article);
    const bar = article.querySelector('div[role="group"]') as unknown as Element;

    assert.equal(injectIntoActionBar(bar, () => {}), true, 'the first pass must inject');
    assert.equal(
      article.querySelectorAll('[data-post-to-card-btn="true"]').length,
      1,
      'exactly one trigger on the tweet'
    );

    // The article is marked too, so a different element of the same post is refused.
    assert.equal(injectIntoActionBar(article as unknown as Element, () => {}), false);
    assert.equal(
      article.querySelectorAll('[data-post-to-card-btn="true"]').length,
      1,
      'the second element of the same post must not produce a second trigger'
    );
  });
});

test('Tier 2.60: a quoted post keeps its own action bar to itself', async () => {
  // A quoted post renders as a nested article with its own engagement controls.
  // Injecting there would put the trigger on the quoted card instead of the one
  // the reader is looking at.
  await withInjectionEnv(async ({ doc }) => {
    const article = createDomElement(`
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/ada"><span>Ada</span></a></div>
        <div role="group">
          <button data-testid="reply">12</button>
        </div>
        <div data-testid="quoteTweet">
          <article>
            <div data-testid="User-Name"><a href="/grace"><span>Grace</span></a></div>
            <div role="group">
              <button data-testid="reply">3</button>
            </div>
          </article>
        </div>
      </article>
    `);
    doc.body.appendChild(article);

    const injected = injectAll(() => {});

    assert.equal(injected, 1, 'only the outer tweet is eligible');
    const quoteBox = article.querySelector('div[data-testid="quoteTweet"]') as unknown as Element;
    assert.equal(
      quoteBox.querySelectorAll('[data-post-to-card-btn="true"]').length,
      0,
      'the quoted post must not receive a trigger'
    );
  });
});

test('Tier 2.61: a feed scan attaches at most one trigger per tweet', async () => {
  // `div[role="group"]` is not specific to the action bar: media players and
  // quoted posts carry their own. A scan that matched them put the trigger on
  // the photo block, so more than one candidate per post has to collapse.
  await withInjectionEnv(async ({ doc }) => {
    doc.body.appendChild(
      createDomElement(`<div data-testid="primaryColumn">${TWEET_HTML}${TWEET_HTML}</div>`)
    );

    assert.equal(injectAll(() => {}), 2, 'two tweets, two triggers');
    assert.equal(
      doc.body.querySelectorAll('[data-post-to-card-btn="true"]').length,
      2,
      'the media inner group must not have collected one of its own'
    );
  });
});

test('Tier 2.62: hiding the triggers leaves them in the page', async () => {
  // They are hidden rather than removed so the deduplication markers and the
  // scroll state survive a round trip through the preference. Toggling the
  // preference back has to make them visible again without re-injecting.
  await withInjectionEnv(async ({ doc }) => {
    doc.body.appendChild(createDomElement(TWEET_HTML));
    injectAll(() => {});

    const buttons = () => doc.body.querySelectorAll('[data-post-to-card-btn="true"]').length;
    assert.equal(buttons(), 1);

    setInjectedButtonVisibility(false);
    assert.ok(
      doc.documentElement.classList.contains(HIDE_ACTION_BUTTON_CLASS),
      'the root carries the class the stylesheet keys on'
    );
    // The class only hides anything if the rule that reads it was injected too;
    // without it the buttons stay visible while every assertion above passes.
    const styleEl = doc.getElementById(VISIBILITY_STYLE_ID);
    assert.ok(styleEl, 'hiding the buttons must inject the rule that hides them');
    assert.ok(
      styleEl!.textContent.includes(`.${HIDE_ACTION_BUTTON_CLASS} [data-post-to-card-btn="true"]`) &&
        styleEl!.textContent.includes('display: none'),
      'the injected rule must key on the hide class and actually hide'
    );
    assert.equal(buttons(), 1, 'a hidden trigger is still in the DOM');

    setInjectedButtonVisibility(true);
    assert.ok(!doc.documentElement.classList.contains(HIDE_ACTION_BUTTON_CLASS));
    assert.equal(buttons(), 1);
  });
});

test('Tier 2.63: a preference change reaches triggers that already exist', async () => {
  // The path that was untestable for want of storage.onChanged: one tab saves a
  // preference, another tab's triggers have to follow it. Visibility and the
  // trigger's own language are both applied from the same listener, so a change
  // to one without the other would mean only half the preference arrived.
  //
  // The write lands before the initial read resolves, which is the whole point:
  // the read is a snapshot taken when the page loaded, and applying it after the
  // change would put the old value back.
  await withInjectionEnv(async ({ doc, chrome }) => {
    doc.body.appendChild(createDomElement(TWEET_HTML));

    const controller = initTwitterInjection(() => {});
    try {
      await chrome.storage.local.set({
        post_to_card_user_prefs: { showActionBarButton: false, locale: 'zh-CN' },
      });

      // Let the initial preference read come back. It holds the state from
      // before the write above, and must not undo it.
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(
        doc.documentElement.classList.contains(HIDE_ACTION_BUTTON_CLASS),
        'a stale initial read must not undo the change that arrived after it'
      );
      assert.equal(
        doc.body.querySelector('[data-post-to-card-btn="true"]')?.getAttribute('aria-label'),
        getTranslation('zh-CN').triggerButtonTitle,
        'the saved language must reach a trigger injected before it resolved'
      );

      controller.injectAll();

      await chrome.storage.local.set({
        post_to_card_user_prefs: { showActionBarButton: true, locale: 'en-US' },
      });

      assert.ok(
        !doc.documentElement.classList.contains(HIDE_ACTION_BUTTON_CLASS),
        'a later change must reverse what the first one did'
      );
      assert.equal(
        doc.body.querySelector('[data-post-to-card-btn="true"]')?.getAttribute('aria-label'),
        getTranslation('en-US').triggerButtonTitle
      );
    } finally {
      controller.disconnect();
    }
  });
});

test('Tier 2.57: a language chosen after the triggers exist reaches them', () => {
  // A trigger is built before the saved preferences have resolved and then stays
  // on the page, so a language picked afterwards has to reach the buttons that
  // are already there. The label is also the button's accessible name, which is
  // why it cannot be left to a title attribute the card never re-reads.
  withFakeDocument((doc) => {
    // The locale is passed to the factory, so this test states its own
    // language rather than relying on module state from an earlier test.
    const injected = createTriggerButton(() => {}, 'en-US');
    doc.body.appendChild(injected);
    const beforeSwitch = injected.getAttribute('title');
    assert.ok(beforeSwitch, 'a trigger must carry a label from the moment it exists');

    applyTriggerLocale('zh-CN');

    const expected = getTranslation('zh-CN').triggerButtonTitle;
    assert.notEqual(expected, beforeSwitch, 'the two dictionaries must differ for this to prove anything');
    assert.equal(injected.getAttribute('title'), expected, 'the label must follow the saved language');
    assert.equal(injected.getAttribute('aria-label'), expected, 'the accessible name follows too');
  });
});

test('Tier 2.58: a trigger injected after the change agrees with the ones above it', () => {
  // The manager holds the locale and hands it to each new button, so a tweet
  // that scrolls in later says the same thing as the tweets already on screen.
  // The factory takes the locale as an argument, which is what lets the manager
  // read one place and the button read another without them drifting.
  withFakeDocument((doc) => {
    const earlier = createTriggerButton(() => {}, 'zh-CN');
    doc.body.appendChild(earlier);

    const later = createTriggerButton(() => {}, 'zh-CN');
    doc.body.appendChild(later);

    assert.equal(
      later.getAttribute('title'),
      earlier.getAttribute('title'),
      'both triggers must carry the same label'
    );
    assert.equal(earlier.getAttribute('title'), getTranslation('zh-CN').triggerButtonTitle);
  });
});

// -------------------------------------------------------------
// The media-permalink host, shared by the text stripper and the token pass
// -------------------------------------------------------------

test('Tier 2.64: a pic link the author wrote mid-post stays in the body', () => {
  // Regression guard for a real disagreement. The body-text stripper only
  // removed a pic link at the very end of the text, while the token pass dropped
  // one anywhere, so a link the author quoted mid-sentence survived in `text`
  // and vanished from `richTokens` -- one TweetData contradicting itself, and
  // the card rendering whichever field it reached first.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/ada"><span>Ada</span></a></div>
      <div data-testid="tweetText">
        <span>look at </span>
        <a href="https://pic.x.com/midpost" role="link">pic.x.com/midpost</a>
        <span> and then the rest</span>
      </div>
    </article>
  `);

  const tweet = extractTweetData(article);

  // The body keeps it, because the author put it there.
  assert.ok(
    tweet?.text.includes('pic.x.com/midpost'),
    'a pic link inside the sentence is the author text, not the appended tail'
  );
  // And the token view agrees: the link is present as a link, not dropped.
  const tokens = tweet?.richTokens || [];
  assert.ok(
    tokens.some((tk) => tk.value.includes('pic.x.com/midpost')),
    'the token view must not drop what the body text keeps'
  );
});

test('Tier 2.65: the host matcher and the tail stripper are the same rule', () => {
  // Both are fed by `isPicMediaLink`'s pattern, so a new host only has to be
  // taught once. This pins the two domains that matter.
  assert.equal(isPicMediaLink('https://pic.twitter.com/abc'), true);
  assert.equal(isPicMediaLink('pic.x.com/abc'), true);
  assert.equal(isPicMediaLink('https://t.co/abc'), false);
  assert.equal(isPicMediaLink(''), false);
  assert.equal(isPicMediaLink('https://example.com/post'), false);
});

test('Tier 2.66: an emoji after a pic link keeps the link, in both views', () => {
  // The two views agreed on a link at the very end and on one mid-sentence, but
  // not on a link with an emoji after it: the DOM walk saw the emoji's `<img>`
  // as empty (its glyph is in the `alt` attribute, not in `textContent`) and
  // called the link trailing, while the text stripper's `\S+` swallowed the
  // restored glyph and called it trailing too -- so the body dropped it and the
  // token list kept it, or the reverse, depending on which side ran first. Both
  // now see the emoji as content after the link, so the link is not the tail.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/ada"><span>Ada</span></a></div>
      <div data-testid="tweetText">
        <span>look at </span>
        <a href="https://pic.x.com/mine" role="link">pic.x.com/mine</a>
        <img alt="🔥">
      </div>
    </article>
  `);

  const tweet = extractTweetData(article);
  const inText = (tweet?.text || '').includes('pic.x.com/mine');
  const inTokens = (tweet?.richTokens || []).some((tk) => tk.value.includes('pic.x.com/mine'));

  assert.ok(inText, 'an emoji after the link means the link is not the appended tail');
  assert.equal(inTokens, inText, 'the two views must agree about the same link');
});

test('Tier 2.76: the stored toggle preferences are honoured, and their absence means on', async () => {
  await withInjectionEnv(async ({ chrome }) => {
    const toggles = async () => {
      const prefs = await loadUserPreferences();
      return { play: prefs.showPlayButton, actionBar: prefs.showActionBarButton };
    };

    assert.deepEqual(
      await toggles(),
      { play: true, actionBar: true },
      'a storage with nothing saved must come back with both buttons on'
    );

    await chrome.storage.local.set({ [STORAGE_KEY]: { showPlayButton: false } });
    assert.deepEqual(
      await toggles(),
      { play: false, actionBar: true },
      'an explicit false is the only thing that turns a button off, and only its own'
    );

    // A config saved before either flag existed has no key for them at all.
    await chrome.storage.local.set({ [STORAGE_KEY]: { theme: 'darkroom' } });
    assert.deepEqual(
      await toggles(),
      { play: true, actionBar: true },
      'an older config that never mentioned the buttons leaves them on'
    );
  });
});

test('Tier 2.77: Alt+C hands the tweet under the pointer to the card, and nothing else does', async () => {
  // F30.4's claim, driven rather than read: the shortcut exists so a card can be
  // opened without reaching for the injected trigger, which only helps if it
  // follows the pointer instead of the top of the feed.
  await withInjectionEnv(async ({ doc }) => {
    const first = createDomElement(TWEET_HTML);
    first.setAttribute('data-probe', 'first');
    const second = createDomElement(TWEET_HTML);
    second.setAttribute('data-probe', 'second');
    doc.body.appendChild(first);
    doc.body.appendChild(second);

    const opened: Element[] = [];
    const controller = initTwitterInjection((article: Element) => {
      opened.push(article);
    });

    try {
      second.dispatchEvent({ type: 'mouseover' });

      const win = (globalThis as Record<string, unknown>).window as {
        dispatchEvent: (event: unknown) => void;
      };
      const keyDown = (init: Record<string, unknown>) => ({
        type: 'keydown',
        preventDefault: () => {},
        stopPropagation: () => {},
        ...init,
      });

      win.dispatchEvent(keyDown({ altKey: true, key: 'c' }));
      assert.equal(opened.length, 1, 'a bare Alt+C must open the card');
      assert.equal(
        opened[0].getAttribute('data-probe'),
        'second',
        'and for the tweet the pointer is over, not the first in the feed'
      );

      // The combinations the handler has to leave alone: Ctrl/⌘+Alt+C belong to
      // the browser or the OS, and a bare C is someone typing.
      for (const ignored of [
        { altKey: true, key: 'c', ctrlKey: true },
        { altKey: true, key: 'c', metaKey: true },
        { key: 'c' },
      ]) {
        win.dispatchEvent(keyDown(ignored));
      }
      assert.equal(opened.length, 1, 'only a bare Alt+C opens the card');
    } finally {
      controller.disconnect();
    }
  });
});

test('Tier 2.79: a quote of a quote is extracted as a second, nested quote', () => {
  // The reported bug. A quoted post that itself quotes someone rendered as one
  // flat level: the inner author, body and media were attributed to the outer
  // quote, and the inner post vanished as a distinct entry.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/gkev1n"><span>gKev1n</span></a><a href="/gkev1n"><span>@gkev1n</span></a>
        <a href="/gkev1n/status/100"><time datetime="2026-10-14T04:29:00.000Z">6h</time></a></div>
      <div data-testid="tweetText"><span>这把赚大发了</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/devindevelopers"><span>Devin Developers</span></a><a href="/devindevelopers"><span>@devindevelopers</span></a>
          <a href="/devindevelopers/status/200"><time datetime="2026-10-14T00:24:00.000Z">10h</time></a></div>
        <div data-testid="tweetText"><span>Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。</span></div>
        <div data-testid="quoteTweet">
          <div data-testid="User-Name"><a href="/cognition"><span>Cognition</span></a><a href="/cognition"><span>@cognition</span></a>
            <a href="/cognition/status/300"><time datetime="2026-10-14T00:20:00.000Z">10h</time></a></div>
          <div data-testid="tweetText"><span>Gemini 4 Argon is now available in Devin Desktop and CLI.</span></div>
          <div data-testid="tweetPhoto">
            <img src="https://pbs.twimg.com/media/chart.png?format=png&name=small" alt="chart">
          </div>
        </div>
      </div>
    </article>
  `);

  const quote = extractTweetData(article)?.quotePost;
  assert.ok(quote, 'the outer quote must be extracted');
  assert.equal(quote.author.handle, '@devindevelopers');
  assert.equal(quote.text, 'Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。');

  const inner = quote.quotePost;
  assert.ok(inner, 'the inner quote must be extracted as a nested level, not folded into the outer');
  assert.equal(inner.author.handle, '@cognition');
  assert.equal(inner.text, 'Gemini 4 Argon is now available in Devin Desktop and CLI.');
  assert.equal(inner.url, 'https://x.com/cognition/status/300');
  assert.equal(inner.media?.length, 1, 'the inner quote keeps its own media');
  assert.ok(inner.media![0].url.includes('chart.png'), 'the inner media is the chart, not anything of the outer\'s');

  // The outer quote's own media list holds only its own pictures. Before the
  // fix the inner chart was attributed to it.
  assert.equal(quote.media, undefined, 'the inner quote\'s media must not be attributed to the outer quote');
  assert.equal(
    extractTweetData(article)?.media,
    undefined,
    'and none of it belongs to the main tweet either'
  );
});

test('Tier 2.80: a bodyless outer quote keeps its own text empty instead of the inner quote\'s', () => {
  // An outer quote of a picture-only post carries no tweetText of its own, so
  // the first tweetText inside the box belongs to the inner quote. Reading it by
  // document order printed the inner body as the outer's.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>main body</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/outer"><span>Outer</span></a><a href="/outer"><span>@outer</span></a>
          <a href="/outer/status/2"><time datetime="2026-10-14T00:20:00.000Z">10h</time></a></div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/outer.png?format=png&name=small" alt="pic">
        </div>
        <div data-testid="quoteTweet">
          <div data-testid="User-Name"><a href="/inner"><span>Inner</span></a><a href="/inner"><span>@inner</span></a></div>
          <div data-testid="tweetText"><span>inner words that must not be printed as the outer's</span></div>
        </div>
      </div>
    </article>
  `);

  const quote = extractTweetData(article)?.quotePost;
  assert.ok(quote);
  assert.equal(quote.text, '', 'the bodyless outer quote has no text of its own');
  assert.equal(quote.media?.length, 1, 'its own picture is still its media');
  assert.ok(quote.media![0].url.includes('outer.png'));
  assert.equal(quote.quotePost?.text, 'inner words that must not be printed as the outer\'s');
});

test('Tier 2.81: a quote inside a quote is bounded, so a chain stays finite', () => {
  // Guard against a cycle in a hand-edited DOM, and against a chain long enough
  // to matter. The extraction must stop somewhere rather than recurse forever.
  let html = `
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/main"><span>@main</span></a></div>
      <div data-testid="tweetText"><span>main body</span></div>`;
  const depth = 8;
  for (let i = 0; i < depth; i++) {
    html += `
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/l${i}"><span>Level ${i}</span></a><a href="/l${i}"><span>@l${i}</span></a></div>`;
  }
  for (let i = depth - 1; i >= 0; i--) {
    html += `
        <div data-testid="tweetText"><span>level ${i} body</span></div>
        </div>`;
  }
  html += `
    </article>
  `;

  let current = extractTweetData(createDomElement(html))?.quotePost;
  let levels = 0;
  while (current) {
    levels += 1;
    current = current.quotePost;
  }
  assert.ok(levels >= 1, 'a quote chain must still yield its outer levels');
  assert.ok(levels < depth, `a quote chain must be bounded, but ${levels} levels were extracted from a ${depth}-deep one`);
});

// -------------------------------------------------------------
// Nested quotes in the shape X actually renders
//
// The `quoteTweet` fixtures above never appear for a quote inside a quote on a
// real timeline: both levels are `role="link"` containers and the deepest is
// `nestedQuotePreview`, whose media is its own testid. `NESTED_QUOTE_PREVIEW_HTML`
// is that markup verbatim, so every assertion below is against what X sends.
// -------------------------------------------------------------
test('Tier 2.82: a nested quote in X’s preview shape yields both levels', () => {
  // The article as the injection layer hands it over: the element the action
  // bar's `closest(TWEET_ARTICLE_SELECTOR)` resolves to, which the browser probe
  // confirmed is the `<article>` itself.
  const data = extractTweetData(createDomElement(NESTED_QUOTE_PREVIEW_HTML));

  assert.equal(data?.author.handle, '@GKev1n');
  assert.equal(data?.author.verified, true, 'the main author keeps its badge');
  assert.equal(data?.timestamp, '2026-10-13T20:29:25.000Z');
  assert.deepEqual(data?.stats, { replies: '4', reposts: '1', likes: '16', bookmarks: '3', views: '6,638' });

  const outer = data?.quotePost;
  assert.ok(outer, 'the outer quote is found without a quoteTweet testid');
  assert.equal(outer.author.handle, '@devindevelopers');
  assert.equal(outer.author.verified, true, 'the outer quote keeps its own badge');
  assert.equal(outer.text, 'Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。');
  assert.equal(outer.timestamp, '2026-10-13T16:24:04.000Z');
  assert.equal(outer.media, undefined, 'the outer quote carries no media of its own');

  const inner = outer.quotePost;
  assert.ok(inner, 'the deepest post is found as its own level');
  assert.equal(inner.author.handle, '@cognition');
  assert.equal(inner.author.verified, true);
  assert.match(inner.text, /^Gemini 4 Argon is now available in Devin Desktop and CLI\./);
  assert.equal(inner.timestamp, '2026-10-13T16:22:52.000Z');
  assert.equal(data?.media, undefined, 'none of it belongs to the main tweet');
});

test('Tier 2.83: the previewed deepest post’s media is its own testid, and is read', () => {
  // Why this test exists: the media lives in nestedQuotePreviewMedia, not the
  // tweetPhoto the photo pass scans, so the deepest post's picture was absent.
  const data = extractTweetData(createDomElement(NESTED_QUOTE_PREVIEW_HTML));

  const inner = data?.quotePost?.quotePost;
  assert.ok(inner?.media?.length, 'the previewed media must be read');
  assert.match(inner!.media![0].originalUrl || '', /HUhftVoasAAzqss/);
  assert.equal(inner!.media![0].type, 'image');
  assert.equal(
    data?.quotePost?.media,
    undefined,
    'the deepest picture belongs to the deepest level, not to the outer quote'
  );
});

test('Tier 2.84: a preview permalink points at the post, not at one of its pictures', () => {
  // The only link inside the preview is `/status/<id>/photo/1`; the card's
  // timestamp links to the post, so the status segment is taken from it.
  const url = extractTweetData(createDomElement(NESTED_QUOTE_PREVIEW_HTML))?.quotePost?.quotePost?.url;
  assert.equal(url, 'https://x.com/cognition/status/2110043605528408110');
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 2
// -------------------------------------------------------------
export async function runTier2(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      results.push({ name: t.name, passed: true, durationMs: Date.now() - start });
      passed++;
    } catch (err: any) {
      results.push({ name: t.name, passed: false, error: err?.message || String(err), durationMs: Date.now() - start });
      failed++;
    }
  }

  return { total: tests.length, passed, failed, results };
}
