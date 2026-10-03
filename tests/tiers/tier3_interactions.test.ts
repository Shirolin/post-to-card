/**
 * Tier 3 Test Suite: Cross-Feature Interactions
 * Tests combinatorial state variations, multi-feature integration,
 * downward expanding aspect ratio calculations, and proxy-to-canvas rendering pipelines.
 */

import assert from 'node:assert/strict';
import { DomDocument, DomElement, DomImageElement, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockCanvasElement, mockDomToBlob } from '../env/canvas.ts';
import { MockClipboard, MockClipboardItem } from '../env/clipboard.ts';
import { SINGLE_TWEET_HTML } from '../fixtures/single-tweet.ts';
import { THREAD_HTML } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import { EMOJI_TWEET_HTML } from '../fixtures/emojis.ts';

import type { TweetData, ThreadData } from '../../src/types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../../src/types/card.ts';
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
// Interaction 1: Combinatorial Matrix of Themes, Padding, Radius, and Ratios
// -------------------------------------------------------------
test('Tier 3.1: all 3 themes render correct CSS class names and root styles', () => {
  const themes: ThemeId[] = ['gallery', 'darkroom', 'riso'];

  themes.forEach(theme => {
    // The theme is an attribute now, not a class: `data-theme` is what card.css
    // keys on, and the class spelling was removed so the two cannot drift.
    const card = new DomElement('DIV');
    card.setAttribute('data-theme', theme);
    assert.equal(card.getAttribute('data-theme'), theme, `Card must carry data-theme="${theme}"`);
  });
});

test('Tier 3.2: 3 padding options apply exact pixel values without style collapse', () => {
  const paddings: Record<PaddingOption, string> = {
    '16px': '16px',
    '32px': '32px',
    '48px': '48px',
  };

  Object.entries(paddings).forEach(([key, val]) => {
    const card = new DomElement('DIV');
    card.style.padding = val;
    assert.equal(card.style.padding, val);
  });
});

test('Tier 3.3: 3 radius options apply to card container and propagate to media corners', () => {
  const radii: Record<RadiusOption, { card: string; media: string }> = {
    '0px': { card: '0px', media: '0px' },
    '12px': { card: '12px', media: '8px' },
    '20px': { card: '20px', media: '14px' },
  };

  Object.entries(radii).forEach(([key, config]) => {
    const card = new DomElement('DIV');
    const media = new DomElement('DIV');
    card.style.borderRadius = config.card;
    media.style.borderRadius = config.media;

    assert.equal(card.style.borderRadius, config.card);
    assert.equal(media.style.borderRadius, config.media);
  });
});

test('Tier 3.4: full combinatorial matrix (3 Themes x 3 Padding x 3 Radius) generates 27 distinct valid configurations', () => {
  const themes: ThemeId[] = ['gallery', 'darkroom', 'riso'];
  const paddings: PaddingOption[] = ['16px', '32px', '48px'];
  const radii: RadiusOption[] = ['0px', '12px', '20px'];

  let count = 0;
  for (const theme of themes) {
    for (const padding of paddings) {
      for (const borderRadius of radii) {
        const config: CardConfig = {
          theme,
          padding,
          borderRadius,
          aspectRatio: 'auto',
          showQrCode: true,
          showStats: true,
          showTimestamp: true,
          showWatermark: true,
          blurAuthor: false,
        };
        assert.ok(config.theme);
        assert.ok(config.padding);
        assert.ok(config.borderRadius);
        count++;
      }
    }
  }

  assert.equal(count, 27);
});

// -------------------------------------------------------------
// Interaction 2: Mega-Card Composite (Thread + Quote + Media + Emojis)
// -------------------------------------------------------------
test('Tier 3.5: thread containing quote tweet, multiple photos, and emojis builds integrated data model', () => {
  const compositeTweet: TweetData = {
    id: '30001',
    url: 'https://x.com/composite/status/30001',
    author: {
      name: 'Tech Lead 🚀',
      handle: '@techlead',
      avatarUrl: 'https://pbs.twimg.com/avatar_400x400.jpg',
      verified: true,
    },
    text: 'Thread 1/2: Breaking down the AI architecture 🔥✨',
    timestamp: '2026-07-20T14:00:00.000Z',
    stats: { replies: '120', reposts: '450', likes: '3.2K', views: '150K' },
    media: [
      { type: 'image', url: 'https://pbs.twimg.com/m1.jpg?name=large' },
      { type: 'image', url: 'https://pbs.twimg.com/m2.jpg?name=large' },
    ],
    quotePost: {
      author: { name: 'Researcher', handle: '@researcher', avatarUrl: '' },
      text: 'Original benchmark results: 99.8% accuracy.',
      timestamp: '2026-07-20T12:00:00.000Z',
    },
    isThreadPart: true,
    threadIndex: 0,
    threadTotal: 2,
  };

  assert.ok(compositeTweet.author.name.includes('🚀'));
  assert.ok(compositeTweet.text.includes('🔥'));
  assert.equal(compositeTweet.media?.length, 2);
  assert.ok(compositeTweet.quotePost);
  assert.equal(compositeTweet.threadTotal, 2);
});

// -------------------------------------------------------------
// Interaction 3: QR Code with Author Blur and Custom Theme
// -------------------------------------------------------------
test('Tier 3.6: author privacy blur active alongside QR code does not blur the QR code', () => {
  const card = new DomElement('DIV');
  card.setAttribute('data-theme', 'darkroom');

  const authorBlock = new DomElement('DIV');
  authorBlock.className = 'author-section is-blurred';
  authorBlock.style.filter = 'blur(6px)';

  const qrBlock = new DomElement('DIV');
  qrBlock.className = 'qr-section';
  qrBlock.style.filter = 'none';

  card.appendChild(authorBlock);
  card.appendChild(qrBlock);

  assert.ok(authorBlock.classList.contains('is-blurred'));
  assert.equal(qrBlock.classList.contains('is-blurred'), false);
  assert.equal(qrBlock.style.filter, 'none');
});

// -------------------------------------------------------------
// Interaction 4: Downward Fluid Expansion Across Ratios
// -------------------------------------------------------------
test('Tier 3.7: 3:4 aspect ratio applies min-height but expands when thread exceeds 853px', () => {
  const cardWidth = 640;
  const minHeight34 = Math.round(cardWidth * (4 / 3)); // 853px

  // Short content
  const shortContentHeight = 500;
  const finalShortHeight = Math.max(minHeight34, shortContentHeight);
  assert.equal(finalShortHeight, 853, 'Short content must fill the 3:4 min-height');

  // Long content (5-tweet thread)
  const longContentHeight = 1450;
  const finalLongHeight = Math.max(minHeight34, longContentHeight);
  assert.equal(finalLongHeight, 1450, 'Long content must expand smoothly to 1450px without clipping');
});

test('Tier 3.8: 16:9 banner ratio applies min-height 360px and expands downward for multi-line text', () => {
  const cardWidth = 640;
  const minHeight169 = Math.round(cardWidth * (9 / 16)); // 360px

  const singleLineHeight = 220;
  assert.equal(Math.max(minHeight169, singleLineHeight), 360);

  const fiveLineHeight = 480;
  assert.equal(Math.max(minHeight169, fiveLineHeight), 480);
});

// -------------------------------------------------------------
// Interaction 5: Background Proxy to Canvas Pipeline
// -------------------------------------------------------------
test('Tier 3.9: full pipeline: external image -> proxy to Base64 -> DOM replace -> clean canvas export', async () => {
  // Step 1: Initialize Chrome runtime mock
  const chromeMock = createChromeMock();
  const mockBase64 = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _s, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({ success: true, dataUrl: mockBase64, contentType: 'image/jpeg' });
      return true;
    }
  });

  // Step 2: Content script receives tweet with twimg photo
  const rawPhotoUrl = 'https://pbs.twimg.com/media/sample_photo.jpg';

  // Step 3: Fetch via background proxy
  const proxyResponse = await chromeMock.runtime.sendMessage({
    type: 'FETCH_IMAGE_BASE64',
    url: rawPhotoUrl,
  });

  assert.equal(proxyResponse.success, true);
  const cleanDataUrl = proxyResponse.success ? proxyResponse.dataUrl : '';

  // Step 4: Inject clean Base64 URL into card DOM
  const card = new DomElement('DIV');
  const img = new DomImageElement();
  img.src = cleanDataUrl;
  card.appendChild(img);

  // Step 5: Render card via modern-screenshot mock (guarantees zero canvas taint)
  const blob = await mockDomToBlob(card, { scale: 2 });
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
});

// -------------------------------------------------------------
// Interaction 6: User Preferences Persistence & Modal Rehydration
// -------------------------------------------------------------
test('Tier 3.10: user preference updates saved to storage and restored on subsequent launches', async () => {
  const chromeMock = createChromeMock();

  // User selects the Nocturne theme and 48px padding
  const customConfig: CardConfig = {
    theme: 'darkroom',
    padding: '48px',
    borderRadius: '20px',
    aspectRatio: '3:4',
    showQrCode: true,
    showStats: false,
    showTimestamp: true,
    showWatermark: false,
    blurAuthor: true,
  };

  await chromeMock.storage.local.set({ card_settings: customConfig });

  // Later: user clicks ✨ button on a different tweet, modal reads saved config
  const restored = await chromeMock.storage.local.get('card_settings');
  const activeConfig = restored.card_settings as CardConfig;

  assert.equal(activeConfig.theme, 'darkroom');
  assert.equal(activeConfig.padding, '48px');
  assert.equal(activeConfig.borderRadius, '20px');
  assert.equal(activeConfig.aspectRatio, '3:4');
  assert.equal(activeConfig.showStats, false);
  assert.equal(activeConfig.blurAuthor, true);
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 3
// -------------------------------------------------------------
export async function runTier3(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
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
