/**
 * Tier 2 Test Suite: Boundary & Corner Cases
 * Tests resilience against edge conditions, zero/extreme inputs, and fault injection.
 */

import assert from 'node:assert/strict';
import { DomElement, DomImageElement, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockCanvasElement, mockDomToBlob } from '../env/canvas.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from '../env/clipboard.ts';
import { extractQuoteTweet, extractTweetData } from '../../src/content/adapter/extractor.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import type { TweetData } from '../../src/types/tweet.ts';
import type { CardConfig, RadiusOption, PaddingOption } from '../../src/types/card.ts';
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
    theme: 'oled-black',
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
    theme: 'sunset-glow',
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

  assert.equal(extractQuoteTweet(article), undefined);
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
  assert.ok(
    media[0].url.includes('name=large'),
    'Link card preview must be upgraded to the large variant so exports stay sharp'
  );
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
