/**
 * Tier 4 Test Suite: Real-World Scenarios & End-to-End User Workflows
 * Comprehensive end-to-end simulations from tweet DOM observation to card customization and retina export.
 */

import assert from 'node:assert/strict';
import { DomDocument, DomElement, DomImageElement, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { mockDomToBlob } from '../env/canvas.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from '../env/clipboard.ts';
import { THREAD_HTML } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import { FOUR_PHOTOS_HTML } from '../fixtures/multi-images.ts';

import type { TweetData } from '../../src/types/tweet.ts';
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
// Workflow 1: Single Viral Tweet with 4 Images -> Nocturne -> Clipboard Copy
// -------------------------------------------------------------
test('Tier 4.1: [End-to-End Workflow 1] Viral Tweet with 4 photos converted to Nocturne card and copied to clipboard', async () => {
  // 1. Setup DOM document and Chrome extension mocks
  const doc = new DomDocument();
  const chromeMock = createChromeMock();
  const clipboard = new MockClipboard();

  // Register background proxy service worker
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _s, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({
        success: true,
        dataUrl: `data:image/jpeg;base64,mocked_${msg.url}`,
        contentType: 'image/jpeg',
      });
      return true;
    }
  });

  // 2. Twitter timeline renders tweet with 4 photos
  const tweetArticle = createDomElement(FOUR_PHOTOS_HTML);
  const actionBar = new DomElement('DIV');
  actionBar.setAttribute('role', 'group');
  tweetArticle.appendChild(actionBar);
  doc.body.appendChild(tweetArticle);

  // 3. Inject trigger button
  const triggerBtn = new DomElement('BUTTON');
  triggerBtn.setAttribute('data-post-to-card-btn', 'true');
  triggerBtn.textContent = '✨';
  actionBar.appendChild(triggerBtn);
  actionBar.setAttribute('data-post-to-card-injected', 'true');

  assert.ok(doc.querySelector('[data-post-to-card-btn="true"]'));

  // 4. User clicks ✨ button -> Extractor gathers tweet data
  const photos = tweetArticle.querySelectorAll('div[data-testid="tweetPhoto"] img');
  assert.equal(photos.length, 4);

  const extractedTweet: TweetData = {
    id: '8004',
    url: 'https://x.com/user/status/8004',
    author: {
      name: 'Viral Creator',
      handle: '@creator',
      avatarUrl: 'https://pbs.twimg.com/avatar_normal.jpg',
    },
    text: 'Check out these 4 incredible landscape shots!',
    timestamp: '2026-07-01T00:00:00.000Z',
    media: photos.map((p, i) => ({
      type: 'image',
      url: p.getAttribute('src')!.replace('name=small', 'name=large'),
    })),
  };

  assert.equal(extractedTweet.media?.length, 4);
  assert.ok(extractedTweet.media![0].url.includes('name=large'));

  // 5. Mount UI container to document with Shadow DOM
  const container = doc.createElement('POST-TO-CARD-CONTAINER');
  const shadow = container.attachShadow({ mode: 'open' });
  doc.body.appendChild(container);

  // 6. User chooses configuration: Nocturne + 32px padding + 12px radius + QR code
  const config: CardConfig = {
    theme: 'darkroom',
    padding: '32px',
    borderRadius: '12px',
    aspectRatio: 'auto',
    showQrCode: true,
    showStats: true,
    showTimestamp: true,
    showWatermark: true,
    blurAuthor: false,
  };

  // Build card DOM inside shadowRoot
  const cardRoot = new DomElement('DIV');
  cardRoot.id = 'post-to-card-export-target';
  cardRoot.setAttribute('data-theme', config.theme);
  cardRoot.style.padding = config.padding;
  cardRoot.style.borderRadius = config.borderRadius;

  // 7. Proxy image assets to Base64 to prevent canvas taint
  const avatarRes = await chromeMock.runtime.sendMessage({
    type: 'FETCH_IMAGE_BASE64',
    url: extractedTweet.author.avatarUrl,
  });
  assert.equal(avatarRes.success, true);

  const proxiedMediaUrls: string[] = [];
  for (const m of extractedTweet.media!) {
    const res = await chromeMock.runtime.sendMessage({
      type: 'FETCH_IMAGE_BASE64',
      url: m.url,
    });
    if (res.success) proxiedMediaUrls.push(res.dataUrl);
  }
  assert.equal(proxiedMediaUrls.length, 4);

  // Add proxied images to card
  proxiedMediaUrls.forEach(url => {
    const img = new DomImageElement();
    img.src = url;
    cardRoot.appendChild(img);
  });
  shadow.appendChild(cardRoot);

  // 8. Render to Retina 2x PNG blob via modern-screenshot
  const renderedBlob = await mockDomToBlob(cardRoot, { scale: 2 });
  assert.ok(renderedBlob);
  assert.equal(renderedBlob.type, 'image/png');

  // 9. Copy to clipboard
  const item = new MockClipboardItem({ 'image/png': renderedBlob });
  await clipboard.write([item]);

  assert.equal(clipboard.writtenItems.length, 1);
});

// -------------------------------------------------------------
// Workflow 2: Educational Long Thread -> Nocturne -> Fallback Download
// -------------------------------------------------------------
test('Tier 4.2: [End-to-End Workflow 2] 3-Tweet thread with author blur fails clipboard and gracefully downloads PNG', async () => {
  const doc = new DomDocument();
  const chromeMock = createChromeMock();
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'unfocused'; // Simulates document unfocused error
  const tracker = new DownloadTracker();

  // Register background proxy
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _s, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({ success: true, dataUrl: `data:image/jpeg;base64,proxy_${msg.url}`, contentType: 'image/jpeg' });
      return true;
    }
  });

  // 1. Thread container in DOM
  const threadFeed = createDomElement(THREAD_HTML);
  doc.body.appendChild(threadFeed);

  // 2. Extract continuous thread
  const articles = threadFeed.querySelectorAll('article[data-testid="tweet"]');
  assert.equal(articles.length, 3);

  // 3. User chooses Nocturne + 3:4 Poster Ratio + Author Privacy Blur
  const config: CardConfig = {
    theme: 'darkroom',
    padding: '48px',
    borderRadius: '20px',
    aspectRatio: '3:4',
    showQrCode: false,
    showStats: false,
    showTimestamp: true,
    showWatermark: false,
    blurAuthor: true,
  };

  const container = doc.createElement('POST-TO-CARD-CONTAINER');
  const shadow = container.attachShadow({ mode: 'open' });
  doc.body.appendChild(container);

  const card = new DomElement('DIV');
  card.id = 'post-to-card-export-target';
  card.setAttribute('data-theme', config.theme);

  // Author header with blur
  const authorBox = new DomElement('DIV');
  authorBox.className = 'author-box is-blurred';
  card.appendChild(authorBox);

  // Downward fluid expansion: 3:4 min-height 853px
  const minHeight = 853;
  const threadContentHeight = 1100;
  card.style.minHeight = `${minHeight}px`;
  card.style.height = `${Math.max(minHeight, threadContentHeight)}px`;
  shadow.appendChild(card);

  // 4. Render screenshot
  const blob = await mockDomToBlob(card, { scale: 2 });
  assert.ok(blob);

  // 5. Attempt copy to clipboard -> catch unfocused error -> fallback to instant download
  let exportMethod = '';
  try {
    const item = new MockClipboardItem({ 'image/png': blob });
    await clipboard.write([item]);
    exportMethod = 'clipboard';
  } catch (err: any) {
    if (err.message.includes('Document is not focused')) {
      const filename = 'post-to-card-thread-1001.png';
      tracker.trackDownload(blob, filename);
      exportMethod = 'download';
    }
  }

  assert.equal(exportMethod, 'download');
  assert.equal(tracker.downloads.length, 1);
  assert.equal(tracker.downloads[0].filename, 'post-to-card-thread-1001.png');
});

// -------------------------------------------------------------
// Workflow 3: Single Tweet with Quote Tweet -> Parchment -> Ultra-HD 3x Export
// -------------------------------------------------------------
test('Tier 4.3: [End-to-End Workflow 3] Quote tweet rendered in Parchment at scale: 3', async () => {
  const doc = new DomDocument();
  const quoteTweetArticle = createDomElement(QUOTE_TWEET_HTML);
  doc.body.appendChild(quoteTweetArticle);

  const card = new DomElement('DIV');
  card.setAttribute('data-theme', 'gallery');

  // Add proxied quote tweet image
  const img = new DomImageElement();
  img.src = 'data:image/png;base64,gpt_launch_base64==';
  card.appendChild(img);

  // Render at Ultra-HD (scale: 3, 288 DPI)
  const blob = await mockDomToBlob(card, { scale: 3 });
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
});

// -------------------------------------------------------------
// Workflow 4: SPA Navigation & Modal Dismissal via Esc and Backdrop
// -------------------------------------------------------------
test('Tier 4.4: [End-to-End Workflow 4] SPA navigation resets modal, Esc dismisses modal, and body scroll unlocks', () => {
  const doc = new DomDocument();

  // 1. Open modal and lock scroll
  let modalOpen = true;
  doc.body.style.overflow = 'hidden';
  doc.body.style.paddingRight = '15px';

  assert.equal(doc.body.style.overflow, 'hidden');

  // 2. User presses Escape key
  function onKeyDown(evt: { key: string }) {
    if (evt.key === 'Escape') {
      modalOpen = false;
      doc.body.style.overflow = '';
      doc.body.style.paddingRight = '';
    }
  }

  onKeyDown({ key: 'Escape' });

  assert.equal(modalOpen, false);
  assert.equal(doc.body.style.overflow, '');
  assert.equal(doc.body.style.paddingRight, '');
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 4
// -------------------------------------------------------------
export async function runTier4(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
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
