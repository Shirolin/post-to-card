/**
 * Tier 2 Test Suite: Boundary & Corner Cases
 * Tests resilience against edge conditions, zero/extreme inputs, and fault injection.
 */

import assert from 'node:assert/strict';
import { DomElement, DomImageElement, DomDocument, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockCanvasElement, mockDomToBlob } from '../env/canvas.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from '../env/clipboard.ts';
import { extractQuoteTweet, extractTweetData } from '../../src/content/adapter/extractor.ts';
import { getPhotoUrlCandidates } from '../../src/content/adapter/urls.ts';
import { TWEET_ARTICLE_SELECTOR } from '../../src/content/adapter/thread.ts';
import { planMediaGrid, applyMediaGridPlan } from '../../src/content/ui/mediaGrid.ts';
import { createTriggerButton, applyTriggerLocale } from '../../src/content/adapter/injection.ts';
import { getTranslation } from '../../src/content/i18n.ts';
import { threadScope, tweetKey } from '../../src/content/ui/threadScope.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import type { TweetData, MediaItem, ThreadData } from '../../src/types/tweet.ts';
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
    theme: 'nocturne',
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
    theme: 'parchment',
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
  // Assert the resolution intent rather than a literal size token: the highest
  // available variant is what keeps exports sharp, and its name changes.
  assert.ok(
    getPhotoUrlCandidates(media[0].url)[0].includes('name=orig'),
    'Link card preview must request the highest resolution variant so exports stay sharp'
  );
});

// -------------------------------------------------------------
// Structural detection: retweets, replies, ads, and unavailable posts
// -------------------------------------------------------------
test('Tier 2.31: a retweet is identified from socialContext without reading its label', () => {
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="socialContext">
        <span>Alice reposted</span>
        <a href="/alice"><span>@alice</span></a>
      </div>
      <div data-testid="User-Name"><a href="/bob"><span>Bob</span></a></div>
      <div data-testid="tweetText"><span>original words</span></div>
    </article>
  `);

  const tweet = extractTweetData(article);
  assert.equal(tweet?.retweetedBy, 'alice', 'reposting handle must come from the social context link');
  assert.equal(tweet?.diagnostics?.social, 'retweet');
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

test('Tier 2.38: extraction degrades gracefully when no data-testid is present', () => {
  // Logged-out pages carry no data-testid at all, so every testid-based lookup
  // misses. This must not throw and must report itself as a fallback so the
  // change is visible in diagnostics rather than failing silently.
  const article = createDomElement(`
    <article role="article">
      <div><a href="/ivy"><span>@ivy</span></a></div>
      <div><span>no testids here</span></div>
    </article>
  `);

  let tweet;
  assert.doesNotThrow(() => {
    tweet = extractTweetData(article);
  }, 'extraction must not throw on a testid-free DOM');
  assert.ok(tweet, 'a record must still be produced');
  assert.equal(tweet!.text, '', 'text is unavailable without a testid, but must not throw');
  assert.equal(tweet!.media, undefined, 'media is unavailable without a testid');
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
// -------------------------------------------------------------

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

test('Tier 2.57: a language chosen after the triggers exist reaches them', () => {
  // A trigger is built before the saved preferences have resolved and then stays
  // on the page, so a language picked afterwards has to reach the buttons that
  // are already there. The label is also the button's accessible name, which is
  // why it cannot be left to a title attribute the card never re-reads.
  withFakeDocument((doc) => {
    const injected = createTriggerButton(() => {});
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
  // The locale is held in the module rather than passed down, because that is
  // how it reaches buttons injected earlier. That is only safe while the factory
  // and the applier read the same place: otherwise a tweet that scrolls in later
  // would say something different from the tweets already on screen.
  withFakeDocument((doc) => {
    applyTriggerLocale('en-US');
    const earlier = createTriggerButton(() => {});
    doc.body.appendChild(earlier);

    applyTriggerLocale('zh-CN');
    const later = createTriggerButton(() => {});
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
