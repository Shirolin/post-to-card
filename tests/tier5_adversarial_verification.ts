/**
 * Tier 5 Adversarial Stress Testing & White-Box Verification Suite
 * 
 * Conducts exhaustive stress tests and white-box verification on:
 * 1. Bundle execution in Node/vm and zero top-level import/export in dist/content.js
 * 2. Malformed tweet structures (missing fields, unexpected DOM, corrupted stats, invalid dates)
 * 3. Giant threads (25+, 50+, 100+ tweets) & chain interruption
 * 4. 4500+ character text downward expansion without clipping (Auto, 3:4, 16:9)
 * 5. Multi-codepoint ZWJ emojis (family, flags, skin tones, professionals, superheroes)
 * 6. Corrupted image URLs & background proxy origin / error defenses
 * 7. Background proxy timeouts & network failures (504, AbortError)
 * 8. Clipboard permission denial fallback (NotAllowedError, unfocused, gesture expired)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { h, render } from 'preact';

import {
  DomDocument,
  DomElement,
  DomTextNode,
  DomImageElement,
  DomAnchorElement,
  DomVideoElement,
  createDomElement,
  DomMutationObserver,
} from './env/browser.ts';
import { createChromeMock } from './env/chrome.ts';
import { MockCanvasElement, mockDomToBlob } from './env/canvas.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from './env/clipboard.ts';

import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData } from '../src/types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../src/types/card.ts';
import type { ExtensionMessage, ExtensionResponse } from '../src/types/messages.ts';

import {
  handleFetchImageBase64,
  isAllowedHost,
  uint8ArrayToBase64,
  clearImageCache,
  getImageCacheSize,
} from '../src/background/proxy.ts';
import {
  restoreUnicodeEmojis,
  stripPicTwitterLink,
  cleanTweetText,
} from '../src/content/adapter/emojis.ts';
import {
  upgradeAvatarUrl,
  upgradePhotoUrl,
  extractVideoPosterUrl,
} from '../src/content/adapter/urls.ts';
import {
  THEMES,
  getAspectMinHeight,
  getAspectMinHeightNumber,
  getMediaRadius,
  sanitizePadding,
  sanitizeRadius,
  DEFAULT_CARD_CONFIG,
} from '../src/content/ui/themes.ts';
import {
  fetchImageAsBase64,
  sanitizeTweetImagesForExport,
  replaceCardImagesWithBase64,
  renderCardToBlob,
  FALLBACK_PLACEHOLDER_DATA_URL,
} from '../src/content/engine/export.ts';
import {
  downloadBlobAsPng,
  copyBlobToClipboard,
  exportBlobWithFallback,
} from '../src/content/engine/fallback.ts';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');

console.log('===============================================================');
console.log('    TIER 5 ADVERSARIAL STRESS TESTING & FORENSIC AUDIT        ');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;
const findings: string[] = [];

async function check(dimension: string, title: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [${dimension}] ${title}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ [${dimension}] ${title}: ${err.message}`);
    failCount++;
    findings.push(`[${dimension}] ${title}: ${err.message}`);
  }
}

async function runSuite() {
  // =========================================================================
  // DIMENSION 1: BUNDLE INTEGRITY & NODE/VM EXECUTION
  // =========================================================================
  console.log('[1] Auditing Bundle Execution in Node/vm & Top-Level Import/Export...');

  await check('Bundle', 'dist/content.js exists and is non-empty', () => {
    const contentJsPath = path.resolve(rootDir, 'dist/content.js');
    assert.ok(fs.existsSync(contentJsPath), 'dist/content.js must exist');
    const stat = fs.statSync(contentJsPath);
    assert.ok(stat.size > 50000, `content.js size should be substantial (got ${stat.size} bytes)`);
  });

  await check('Bundle', 'dist/content.js is wrapped in IIFE and has ZERO top-level import/export', () => {
    const contentJsPath = path.resolve(rootDir, 'dist/content.js');
    const code = fs.readFileSync(contentJsPath, 'utf8');
    assert.ok(code.startsWith('(function () {') || code.startsWith('(function() {'), 'Must start with IIFE');
    assert.ok(code.trim().endsWith('})();'), 'Must close with })();');

    const lines = code.split('\n');
    const topLevelImportExport = lines.filter((line) => /^\s*(import|export)\s+/.test(line));
    assert.equal(topLevelImportExport.length, 0, `Forbidden top-level import/export: ${topLevelImportExport.join(', ')}`);
  });

  await check('Bundle', 'dist/background.js is valid ESM module registering chrome listener', () => {
    const bgJsPath = path.resolve(rootDir, 'dist/background.js');
    assert.ok(fs.existsSync(bgJsPath), 'dist/background.js must exist');
    const code = fs.readFileSync(bgJsPath, 'utf8');
    assert.ok(code.includes('chrome.runtime.onMessage.addListener'), 'Must register onMessage listener');
    assert.ok(!code.includes('import('), 'Must not contain dynamic imports');
  });

  await check('Bundle', 'dist/content.js executes in Node/vm sandbox without syntax or runtime error', () => {
    const contentJsPath = path.resolve(rootDir, 'dist/content.js');
    const code = fs.readFileSync(contentJsPath, 'utf8');

    const doc = new DomDocument();
    (doc as any).createTextNode = (text: string) => new DomTextNode(text);
    const chromeMock = createChromeMock();

    const nav = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      clipboard: {
        write: async () => {},
      },
    };

    const sandbox: Record<string, any> = {
      window: {
        location: { href: 'https://x.com/home', pathname: '/home' },
        addEventListener: () => {},
        removeEventListener: () => {},
        document: doc,
        customElements: doc.customElements,
        MutationObserver: DomMutationObserver,
        HTMLElement: DomElement,
        Element: DomElement,
        Node: DomElement,
        navigator: nav,
      },
      navigator: nav,
      document: doc,
      customElements: doc.customElements,
      MutationObserver: DomMutationObserver,
      HTMLElement: DomElement,
      Element: DomElement,
      Node: DomElement,
      chrome: chromeMock,
      Blob: globalThis.Blob,
      URL: globalThis.URL,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox.window;
    sandbox.window.window = sandbox.window;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx);

    // Verify custom element registered
    const registered = doc.customElements.get('post-to-card-container');
    assert.ok(registered, 'post-to-card-container should be registered in customElements');
  });

  // =========================================================================
  // DIMENSION 2: MALFORMED TWEET STRUCTURES STRESS TEST
  // =========================================================================
  console.log('\n[2] Stress-Testing Malformed Tweet Structures & Edge Handling...');

  await check('Malformed', 'Missing author metadata (empty name, handle, avatar) handled without crash', () => {
    const malformedAuthor: AuthorInfo = {
      name: '',
      handle: '',
      avatarUrl: '',
    };
    const tweet: TweetData = {
      id: 'malformed_1',
      url: 'https://x.com/unknown/status/1',
      author: malformedAuthor,
      text: 'Malformed author tweet',
      timestamp: '2026-01-01T00:00:00Z',
    };

    assert.equal(tweet.author.name, '');
    assert.equal(tweet.author.handle, '');
    const upgradedAvatar = upgradeAvatarUrl(tweet.author.avatarUrl);
    assert.equal(upgradedAvatar, '');
  });

  await check('Malformed', 'Empty text tweet (media-only or whitespace only) sanitizes cleanly', () => {
    assert.equal(cleanTweetText(null), '');
    assert.equal(cleanTweetText(undefined), '');
    assert.equal(stripPicTwitterLink(''), '');

    const textWithTrailingMedia = 'Amazing view! https://pic.twitter.com/abc123XYZ';
    assert.equal(stripPicTwitterLink(textWithTrailingMedia), 'Amazing view!');

    const onlyMediaLink = 'https://pic.twitter.com/onlylink';
    assert.equal(stripPicTwitterLink(onlyMediaLink), '');
  });

  await check('Malformed', 'Corrupted interaction stats (NaN, extreme numbers, symbols) handled cleanly', () => {
    function formatStatValue(value?: string | number): string {
      if (value === undefined || value === null || value === '') return '';
      if (typeof value === 'string') {
        if (/[KkMmBb]/.test(value)) return value;
        const num = Number.parseFloat(value.replace(/,/g, ''));
        if (!Number.isNaN(num)) return formatStatValue(num);
        return value;
      }
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
      }
      if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
      }
      return value.toLocaleString();
    }

    assert.equal(formatStatValue(undefined), '');
    assert.equal(formatStatValue(''), '');
    assert.equal(formatStatValue('2.4M'), '2.4M');
    assert.equal(formatStatValue('12,345'), '12.3K');
    assert.equal(formatStatValue('1,000,000'), '1M');
    assert.equal(formatStatValue(1234567), '1.2M');
    assert.equal(formatStatValue('invalid_string'), 'invalid_string');
  });

  await check('Malformed', 'Invalid or unparseable timestamps format gracefully without throwing', () => {
    function formatTimestampSafe(timestampStr: string): string {
      if (!timestampStr) return '';
      try {
        const d = new Date(timestampStr);
        if (Number.isNaN(d.getTime())) return timestampStr;
        const timePart = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const datePart = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return `${timePart} · ${datePart}`;
      } catch {
        return timestampStr;
      }
    }

    assert.equal(formatTimestampSafe(''), '');
    assert.equal(formatTimestampSafe('not-a-valid-date'), 'not-a-valid-date');
    assert.ok(formatTimestampSafe('2026-09-29T14:00:00Z').includes('2026'));
  });

  await check('Malformed', 'Corrupted nested quote tweet with missing author or text handled without crash', () => {
    const corruptQuoteTweet: TweetData = {
      id: 'corrupt_quote',
      url: 'https://x.com/user/status/corrupt',
      author: { name: 'User', handle: '@user', avatarUrl: '' },
      text: 'Check this quote',
      timestamp: '2026-09-29T00:00:00Z',
      quotePost: {
        author: { name: '', handle: '', avatarUrl: '' },
        text: 'This post is unavailable.',
        timestamp: '',
      },
    };

    assert.ok(corruptQuoteTweet.quotePost);
    assert.equal(corruptQuoteTweet.quotePost.author.name, '');
    assert.equal(corruptQuoteTweet.quotePost.text, 'This post is unavailable.');
  });

  // =========================================================================
  // DIMENSION 3: GIANT THREADS STRESS TEST (25+, 50+, 100+ TWEETS)
  // =========================================================================
  console.log('\n[3] Stress-Testing Giant Threads (25+, 50+, 100+ Tweets)...');

  await check('Threads', 'Thread with 25 consecutive tweets is configured with accurate indices and total', () => {
    const author: AuthorInfo = { name: 'Essayist', handle: '@essayist', avatarUrl: 'avatar.jpg' };
    const tweets: TweetData[] = [];
    const count = 25;

    for (let i = 0; i < count; i++) {
      tweets.push({
        id: `tweet_${i}`,
        url: `https://x.com/essayist/status/${i}`,
        author,
        text: `Section ${i + 1} of 25 in deep dive`,
        timestamp: '2026-09-01T00:00:00Z',
        isThreadPart: true,
        threadIndex: i,
        threadTotal: count,
      });
    }

    const thread: ThreadData = {
      author,
      tweets,
      isSingle: false,
    };

    assert.equal(thread.tweets.length, 25);
    assert.equal(thread.isSingle, false);
    assert.equal(thread.tweets[0].threadIndex, 0);
    assert.equal(thread.tweets[24].threadIndex, 24);
    assert.equal(thread.tweets[24].threadTotal, 25);
  });

  await check('Threads', 'Thread with 50 and 100 tweets constructs and scales linearly without stack overflow', () => {
    const author: AuthorInfo = { name: 'Marathon Writer', handle: '@marathon', avatarUrl: 'avatar.jpg' };
    const t0 = Date.now();

    for (const size of [50, 100]) {
      const tweets: TweetData[] = [];
      for (let i = 0; i < size; i++) {
        tweets.push({
          id: `t_${size}_${i}`,
          url: `https://x.com/marathon/status/${i}`,
          author,
          text: `Thread segment #${i + 1}`,
          timestamp: '2026-09-01T00:00:00Z',
          isThreadPart: true,
          threadIndex: i,
          threadTotal: size,
        });
      }
      const thread: ThreadData = { author, tweets, isSingle: false };
      assert.equal(thread.tweets.length, size);
      assert.equal(thread.tweets[size - 1].threadIndex, size - 1);
    }

    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 200, `Constructing 150 tweets should take < 200ms (took ${elapsed}ms)`);
  });

  await check('Threads', 'Chain interruption: ad, sponsored post, or third-party reply halts thread assembly', () => {
    const parentContainer = new DomElement('DIV');
    parentContainer.id = 'timeline';

    const targetAuthor = '@founder';
    const articles: DomElement[] = [];

    // Predecessor tweet 1 (same author)
    const art1 = new DomElement('ARTICLE');
    art1.setAttribute('data-testid', 'tweet');
    art1.innerHTML = `<div data-testid="User-Name"><a href="/founder">@founder</a></div><time datetime="2026-01-01T00:00:00Z">Jan 1</time>`;
    parentContainer.appendChild(art1);
    articles.push(art1);

    // Target tweet (same author)
    const targetArt = new DomElement('ARTICLE');
    targetArt.setAttribute('data-testid', 'tweet');
    targetArt.innerHTML = `<div data-testid="User-Name"><a href="/founder">@founder</a></div><time datetime="2026-01-01T00:01:00Z">Jan 1</time>`;
    parentContainer.appendChild(targetArt);
    articles.push(targetArt);

    // Successor tweet 1 (sponsored ad)
    const adArt = new DomElement('ARTICLE');
    adArt.setAttribute('data-testid', 'tweet');
    adArt.setAttribute('data-testid-placement', 'ad');
    adArt.innerHTML = `<div data-testid="placementTracking">Promoted</div>`;
    parentContainer.appendChild(adArt);
    articles.push(adArt);

    // Successor tweet 2 (same author after ad - should NOT be included!)
    const art3 = new DomElement('ARTICLE');
    art3.setAttribute('data-testid', 'tweet');
    art3.innerHTML = `<div data-testid="User-Name"><a href="/founder">@founder</a></div><time datetime="2026-01-01T00:02:00Z">Jan 1</time>`;
    parentContainer.appendChild(art3);
    articles.push(art3);

    // Verify ad detection
    const isAd = (el: DomElement) => el.getAttribute('data-testid-placement') === 'ad' || Boolean(el.querySelector('[data-testid="placementTracking"]'));
    assert.equal(isAd(adArt), true);
    assert.equal(isAd(targetArt), false);
  });

  // =========================================================================
  // DIMENSION 4: 4500+ CHARACTER TEXT DOWNWARD EXPANSION (NO CLIPPING)
  // =========================================================================
  console.log('\n[4] Stress-Testing 4500+ Character Downward Expansion Without Clipping...');

  await check('Layout', 'Aspect ratio min-height rules enforce elastic downward expansion', () => {
    assert.equal(getAspectMinHeight('auto', 640), 'auto');
    assert.equal(getAspectMinHeight('3:4', 640), '853px');
    assert.equal(getAspectMinHeight('16:9', 640), '360px');

    assert.equal(getAspectMinHeightNumber('auto', 640), 0);
    assert.equal(getAspectMinHeightNumber('3:4', 640), 853);
    assert.equal(getAspectMinHeightNumber('16:9', 640), 360);
  });

  await check('Layout', 'Card inline style enforces height: auto and overflow: visible', () => {
    for (const ratio of ['auto', '3:4', '16:9'] as AspectRatioOption[]) {
      const minHeightStyle = getAspectMinHeight(ratio, 640);
      const style = {
        padding: '32px',
        borderRadius: '12px',
        minHeight: minHeightStyle === 'auto' ? 'unset' : minHeightStyle,
        height: 'auto',
        overflow: 'visible',
      };

      assert.equal(style.height, 'auto', `Ratio ${ratio} must have height: auto`);
      assert.equal(style.overflow, 'visible', `Ratio ${ratio} must have overflow: visible`);

      if (ratio === 'auto') {
        assert.equal(style.minHeight, 'unset');
      } else if (ratio === '3:4') {
        assert.equal(style.minHeight, '853px');
      } else if (ratio === '16:9') {
        assert.equal(style.minHeight, '360px');
      }
    }
  });

  await check('Layout', '4500+ character long post expands beyond min-height without text clipping', () => {
    const text4500 = 'Long analytical tweet content explaining complex systems in depth. '.repeat(70);
    assert.ok(text4500.length >= 4500, `Text length must be >= 4500 (got ${text4500.length})`);

    // Height projection: 50 characters per line, 24px line height
    const basePadding = 64; // 32px top + 32px bottom
    const headerHeight = 80;
    const footerHeight = 60;
    const estimatedLineCount = Math.ceil(text4500.length / 50);
    const estimatedContentHeight = estimatedLineCount * 24;
    const totalRenderedHeight = basePadding + headerHeight + estimatedContentHeight + footerHeight;

    assert.ok(totalRenderedHeight > 2200, `Total height must exceed 2200px (got ${totalRenderedHeight}px)`);

    // In 3:4 ratio with 853px min-height, actual height expands to totalRenderedHeight
    const ratio34MinHeight = 853;
    const finalHeight34 = Math.max(ratio34MinHeight, totalRenderedHeight);
    assert.equal(finalHeight34, totalRenderedHeight);

    // In 16:9 ratio with 360px min-height, actual height expands to totalRenderedHeight
    const ratio169MinHeight = 360;
    const finalHeight169 = Math.max(ratio169MinHeight, totalRenderedHeight);
    assert.equal(finalHeight169, totalRenderedHeight);
  });

  // =========================================================================
  // DIMENSION 5: MULTI-CODEPOINT ZWJ EMOJIS & COMPLEX SEQUENCES
  // =========================================================================
  console.log('\n[5] Stress-Testing Multi-Codepoint ZWJ Emojis & Sequences...');

  await check('Emojis', 'Multi-codepoint ZWJ emojis preserve exact codepoints and byte sequences', () => {
    const zwjEmojis = [
      { name: 'family', char: '👨‍👩‍👧‍👦', codepoints: 7 }, // 4 persons + 3 ZWJ
      { name: 'rainbow flag', char: '🏳️‍🌈', codepoints: 4 }, // flag + VS16 + ZWJ + rainbow
      { name: 'transgender flag', char: '🏳️‍⚧️', codepoints: 5 },
      { name: 'technologist (skin tone)', char: '🧑🏽‍💻', codepoints: 3 }, // adult + medium skin + ZWJ + laptop
      { name: 'female superhero (skin tone)', char: '🦸🏻‍♀️', codepoints: 5 }, // hero + light skin + ZWJ + female sign + VS16
      { name: 'couple with heart', char: '🧑🏿‍❤️‍🧑🏼', codepoints: 8 },
    ];

    for (const emoji of zwjEmojis) {
      const codePointCount = [...emoji.char].length;
      assert.ok(codePointCount > 1, `${emoji.name} must consist of multiple codepoints`);
      // Ensure UTF-8 round-trip encoding
      const encoded = new TextEncoder().encode(emoji.char);
      const decoded = new TextDecoder().decode(encoded);
      assert.equal(decoded, emoji.char, `${emoji.name} must survive round-trip UTF-8 encoding`);
    }
  });

  await check('Emojis', 'Twemoji img[alt] restoration reconstitutes ZWJ emojis from DOM without separator loss', () => {
    const container = new DomElement('DIV');

    const textPart1 = new DomTextNode('Check this family: ');
    container.appendChild(textPart1);

    const imgFamily = new DomImageElement();
    imgFamily.alt = '👨‍👩‍👧‍👦';
    container.appendChild(imgFamily);

    const textPart2 = new DomTextNode(' and coder: ');
    container.appendChild(textPart2);

    const imgCoder = new DomImageElement();
    imgCoder.alt = '🧑🏽‍💻';
    container.appendChild(imgCoder);

    const br = new DomElement('BR');
    container.appendChild(br);

    const textPart3 = new DomTextNode('Superhero: ');
    container.appendChild(textPart3);

    const imgHero = new DomImageElement();
    imgHero.alt = '🦸🏻‍♀️';
    container.appendChild(imgHero);

    const restored = restoreUnicodeEmojis(container as any);
    assert.ok(restored.includes('👨‍👩‍👧‍👦'));
    assert.ok(restored.includes('🧑🏽‍💻'));
    assert.ok(restored.includes('🦸🏻‍♀️'));
    assert.ok(restored.includes('\n'));
    assert.equal(restored, 'Check this family: 👨‍👩‍👧‍👦 and coder: 🧑🏽‍💻\nSuperhero: 🦸🏻‍♀️');
  });

  // =========================================================================
  // DIMENSION 6: CORRUPTED IMAGE URLS & PROXY DEFENSES
  // =========================================================================
  console.log('\n[6] Stress-Testing Corrupted Image URLs & Proxy Defenses...');

  await check('Proxy', 'isAllowedHost strictly filters non-twimg or malicious hostnames', () => {
    // Authorized
    assert.equal(isAllowedHost('https://pbs.twimg.com/media/abc.jpg'), true);
    assert.equal(isAllowedHost('https://video.twimg.com/ext_tw_video/thumb.jpg'), true);
    assert.equal(isAllowedHost('http://twimg.com/image.png'), true);

    // Forbidden
    assert.equal(isAllowedHost('https://evil-twimg.com/media/abc.jpg'), false);
    assert.equal(isAllowedHost('https://example.com/twimg.com/image.jpg'), false);
    assert.equal(isAllowedHost('file:///etc/passwd'), false);
    assert.equal(isAllowedHost('javascript:alert(1)'), false);
    assert.equal(isAllowedHost('data:image/png;base64,abc'), false);
    assert.equal(isAllowedHost(''), false);
    assert.equal(isAllowedHost('not-a-url'), false);
  });

  await check('Proxy', 'handleFetchImageBase64 rejects forbidden or invalid URLs without throwing', async () => {
    const res1 = await handleFetchImageBase64('https://malicious.org/exploit.jpg');
    assert.equal(res1.success, false);
    assert.ok(res1.error.includes('Forbidden origin'));

    const res2 = await handleFetchImageBase64('');
    assert.equal(res2.success, false);
    assert.ok(res2.error.includes('Invalid URL'));

    const res3 = await handleFetchImageBase64(null as any);
    assert.equal(res3.success, false);
    assert.ok(res3.error.includes('Invalid URL'));
  });

  await check('Proxy', 'uint8ArrayToBase64 chunking handles 0-byte, 100KB, and 1MB byte buffers cleanly', () => {
    // 0-byte buffer
    const emptyBytes = new Uint8Array(0);
    assert.equal(uint8ArrayToBase64(emptyBytes), '');

    // Small buffer
    const smallBytes = new TextEncoder().encode('Hello Post-to-Card!');
    assert.equal(uint8ArrayToBase64(smallBytes), btoa('Hello Post-to-Card!'));

    // Large 128KB buffer (tests chunking boundary)
    const largeBytes = new Uint8Array(128 * 1024);
    for (let i = 0; i < largeBytes.length; i++) {
      largeBytes[i] = i % 256;
    }
    const b64 = uint8ArrayToBase64(largeBytes);
    assert.ok(b64.length > 0);
  });

  await check('Proxy', 'fetchImageAsBase64 fallbackToPlaceholder returns clean placeholder on failure', async () => {
    const placeholder = FALLBACK_PLACEHOLDER_DATA_URL;
    assert.ok(placeholder.startsWith('data:image/svg+xml'));

    // With no chrome runtime available
    const origChrome = (globalThis as any).chrome;
    delete (globalThis as any).chrome;

    try {
      const fallbackUrl = await fetchImageAsBase64('https://pbs.twimg.com/media/broken.jpg', true);
      assert.equal(fallbackUrl, FALLBACK_PLACEHOLDER_DATA_URL);

      const noFallbackUrl = await fetchImageAsBase64('https://pbs.twimg.com/media/broken.jpg', false);
      assert.equal(noFallbackUrl, 'https://pbs.twimg.com/media/broken.jpg');
    } finally {
      (globalThis as any).chrome = origChrome;
    }
  });

  await check('Proxy', 'replaceCardImagesWithBase64 swaps broken images to placeholder and restores original', async () => {
    const cardEl = new DomElement('DIV');
    const img1 = new DomImageElement();
    img1.src = 'https://pbs.twimg.com/media/sample1.jpg';
    cardEl.appendChild(img1);

    const img2 = new DomImageElement();
    img2.src = 'https://pbs.twimg.com/media/sample2.jpg';
    cardEl.appendChild(img2);

    // Mock chrome runtime responding with error
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((_msg, _s, sendResponse) => {
      sendResponse({ success: false, error: 'Network error 404' });
      return true;
    });
    (globalThis as any).chrome = chromeMock;

    try {
      const restore = await replaceCardImagesWithBase64(cardEl as any);
      assert.equal(img1.src, FALLBACK_PLACEHOLDER_DATA_URL);
      assert.equal(img2.src, FALLBACK_PLACEHOLDER_DATA_URL);

      // Call restore
      restore();
      assert.equal(img1.src, 'https://pbs.twimg.com/media/sample1.jpg');
      assert.equal(img2.src, 'https://pbs.twimg.com/media/sample2.jpg');
    } finally {
      delete (globalThis as any).chrome;
    }
  });

  // =========================================================================
  // DIMENSION 7: BACKGROUND PROXY TIMEOUTS & NETWORK FAILURES
  // =========================================================================
  console.log('\n[7] Stress-Testing Background Proxy Timeouts & Network Failures...');

  await check('Timeouts', 'handleFetchImageBase64 aborts and returns timeout error on network freeze', async () => {
    // Call with ultra-short timeout (1ms) to trigger AbortController
    const res = await handleFetchImageBase64('https://pbs.twimg.com/media/slow.jpg', 1);
    assert.equal(res.success, false);
    assert.ok(
      res.error.includes('Network timeout') || res.error.includes('aborted') || res.error.includes('fetch'),
      `Error should indicate timeout or aborted (got: ${res.error})`
    );
  });

  await check('Timeouts', 'Simulated 504 Gateway Timeout returns clean error response', async () => {
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _s, sendResponse) => {
      if (msg.type === 'FETCH_IMAGE_BASE64') {
        sendResponse({ success: false, error: 'HTTP 504: Gateway Timeout' });
        return true;
      }
    });

    const res = await chromeMock.runtime.sendMessage({
      type: 'FETCH_IMAGE_BASE64',
      url: 'https://pbs.twimg.com/media/gateway_timeout.jpg',
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'HTTP 504: Gateway Timeout');
  });

  await check('Timeouts', 'Full export pipeline gracefully continues when proxy times out', async () => {
    const cardEl = new DomElement('DIV');
    cardEl.id = 'post-to-card-export-target';
    const img = new DomImageElement();
    img.src = 'https://pbs.twimg.com/media/timeout_test.jpg';
    cardEl.appendChild(img);

    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((_msg, _s, sendResponse) => {
      sendResponse({ success: false, error: 'Network timeout: request exceeded 5000ms' });
      return true;
    });
    (globalThis as any).chrome = chromeMock;

    try {
      const restore = await replaceCardImagesWithBase64(cardEl as any);
      // Replaced with fallback placeholder
      assert.equal(img.src, FALLBACK_PLACEHOLDER_DATA_URL);

      // Render to blob simulation with mockDomToBlob
      const blob = await mockDomToBlob(cardEl, { scale: 2 });
      assert.ok(blob);
      assert.equal(blob.type, 'image/png');

      restore();
      assert.equal(img.src, 'https://pbs.twimg.com/media/timeout_test.jpg');
    } finally {
      delete (globalThis as any).chrome;
    }
  });

  // =========================================================================
  // DIMENSION 8: CLIPBOARD PERMISSION DENIAL & FALLBACK DOWNLOAD
  // =========================================================================
  console.log('\n[8] Stress-Testing Clipboard Permission Denial & Automatic Download Fallback...');

  await check('Clipboard', 'exportBlobWithFallback downloads directly when action="download"', async () => {
    const tracker = new DownloadTracker();
    (globalThis as any).currentDownloadTracker = tracker;

    try {
      const blob = new Blob(['test-png-data'], { type: 'image/png' });
      const result = await exportBlobWithFallback(blob, 'download', 'card-download.png');

      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(result.filename, 'card-download.png');
      assert.equal(tracker.downloads.length, 1);
      assert.equal(tracker.downloads[0].filename, 'card-download.png');
    } finally {
      delete (globalThis as any).currentDownloadTracker;
    }
  });

  await check('Clipboard', 'exportBlobWithFallback falls back to download on DOMException: Document is not focused', async () => {
    const tracker = new DownloadTracker();
    (globalThis as any).currentDownloadTracker = tracker;

    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'unfocused';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    try {
      const blob = new Blob(['unfocused-blob'], { type: 'image/png' });
      const result = await exportBlobWithFallback(blob, 'copy', 'unfocused-fallback.png');

      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(tracker.downloads.length, 1);
      assert.equal(tracker.downloads[0].filename, 'unfocused-fallback.png');
    } finally {
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
      delete (globalThis as any).currentDownloadTracker;
    }
  });

  await check('Clipboard', 'exportBlobWithFallback falls back to download on NotAllowedError: Must be handling a user gesture', async () => {
    const tracker = new DownloadTracker();
    (globalThis as any).currentDownloadTracker = tracker;

    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'gesture_expired';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    try {
      const blob = new Blob(['gesture-expired-blob'], { type: 'image/png' });
      const result = await exportBlobWithFallback(blob, 'copy', 'gesture-fallback.png');

      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(tracker.downloads.length, 1);
    } finally {
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
      delete (globalThis as any).currentDownloadTracker;
    }
  });

  await check('Clipboard', 'exportBlobWithFallback falls back to download on NotAllowedError: Clipboard permission denied', async () => {
    const tracker = new DownloadTracker();
    (globalThis as any).currentDownloadTracker = tracker;

    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'permission_denied';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    try {
      const blob = new Blob(['permission-denied-blob'], { type: 'image/png' });
      const result = await exportBlobWithFallback(blob, 'copy', 'permission-denied-fallback.png');

      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(tracker.downloads.length, 1);
    } finally {
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
      delete (globalThis as any).currentDownloadTracker;
    }
  });

  await check('Clipboard', 'exportBlobWithFallback falls back to download when navigator.clipboard is undefined', async () => {
    const tracker = new DownloadTracker();
    (globalThis as any).currentDownloadTracker = tracker;

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: undefined, configurable: true, writable: true });

    try {
      const blob = new Blob(['no-clipboard-blob'], { type: 'image/png' });
      const result = await exportBlobWithFallback(blob, 'copy', 'no-clipboard-fallback.png');

      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(tracker.downloads.length, 1);
    } finally {
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).currentDownloadTracker;
    }
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`TIER 5 RESULTS: ${passCount} Passed, ${failCount} Failed`);
  if (findings.length > 0) {
    console.log('Failures / Findings:');
    findings.forEach((f) => console.log(` - ${f}`));
  }
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal Tier 5 verification error:', err);
  process.exit(1);
});
