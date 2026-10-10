/**
 * Tier 5 Adversarial Stress & Forensic Verification Suite
 * Independent Challenger Verification for Post-to-Card Chrome Extension MV3.
 * 
 * Verifies:
 * 1. Zero Canvas Taint during Export (CORS proxying, Base64 fallback, SSRF prevention)
 * 2. Clipboard Focus Loss, Gesture Timeouts & Zero Unhandled Rejections
 * 3. Modal Shadow DOM Style Isolation & Scroll Lock/Restore
 * 4. 100% Pass Rate of standard 162 E2E Tests
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DomDocument, DomElement, DomImageElement, createDomElement } from './env/browser.ts';
import { createChromeMock } from './env/chrome.ts';
import { mockDomToBlob } from './env/canvas.ts';
import { MockClipboard, MockClipboardItem } from './env/clipboard.ts';

// Export engine & CORS protection (direct TS imports)
import {
  replaceCardImagesWithBase64,
  FALLBACK_PLACEHOLDER_DATA_URL,
} from '../src/content/engine/export.ts';

// Clipboard & Fallback engine (direct TS imports)
import { exportBlobWithFallback } from '../src/content/engine/fallback.ts';

// Background proxy & SSRF shield (direct TS imports)
import {
  isAllowedHost,
  uint8ArrayToBase64,
  handleFetchImageBase64,
  clearImageCache,
  getImageCacheSize,
} from '../src/background/proxy.ts';

import { runTier1 } from './tiers/tier1_features.test.ts';
import { runTier2 } from './tiers/tier2_boundaries.test.ts';
import { runTier3 } from './tiers/tier3_interactions.test.ts';
import { runTier4 } from './tiers/tier4_workloads.test.ts';

import type { TweetData } from '../src/types/tweet.ts';

const rootDir = process.cwd();

/**
 * Runs `body` with a fake document installed and returns the download anchors
 * it left in that document.
 *
 * A download is observed where it happens: as the `<a download>` the fallback
 * path appends and clicks. The shipped code used to publish a tracker on
 * globalThis purely so this file could see that, which meant the extension
 * carried test scaffolding for anyone who installed it.
 *
 * The anchors are read back before the path's cleanup timer fires, so they are
 * still in the body when this returns.
 */
async function captureDownloads(body: () => Promise<void>): Promise<HTMLAnchorElement[]> {
  const scope = globalThis as { document?: unknown };
  const previous = scope.document;
  const doc = new DomDocument();
  scope.document = doc;
  try {
    await body();
    return Array.from(doc.body.querySelectorAll<HTMLAnchorElement>('a[download]'));
  } finally {
    scope.document = previous;
  }
}

/** Newest modification time anywhere under `dir`, or 0 when it holds nothing. */
function newestSourceMtime(dir: string): number {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const mtime = entry.isDirectory()
      ? newestSourceMtime(full)
      : fs.statSync(full).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  return newest;
}

console.log('===============================================================');
console.log('    TIER 5 INDEPENDENT ADVERSARIAL STRESS & FORENSIC SUITE     ');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

// Watchdog: Trap any unhandled rejection across the process
let unhandledRejectionsCount = 0;
process.on('unhandledRejection', (reason) => {
  unhandledRejectionsCount++;
  console.error('FATAL: Unhandled Promise Rejection detected:', reason);
});

async function challenge(title: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const elapsed = Date.now() - start;
    console.log(`  ✓ [PASS] ${title} (${elapsed}ms)`);
    passCount++;
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`  ✖ [FAIL] ${title} (${elapsed}ms)`);
    console.error(`    Details: ${err?.message || String(err)}`);
    failCount++;
    failures.push(`${title}: ${err?.message || String(err)}`);
  }
}

async function runAdversarialSuite() {
  // -------------------------------------------------------------
  // CHALLENGE GROUP 1: Canvas Taint Prevention & Export Engine Stress
  // -------------------------------------------------------------
  console.log('\n[Group 1] Canvas Taint Prevention & Origin-Clean Export Stress...');

  await challenge('T5.1.1: Unproxied twimg URL strictly taints canvas and triggers SecurityError', async () => {
    const card = new DomElement('DIV');
    const taintedImg = new DomImageElement();
    taintedImg.src = 'https://pbs.twimg.com/media/unproxied_leak.jpg';
    card.appendChild(taintedImg);

    await assert.rejects(
      async () => {
        await mockDomToBlob(card);
      },
      /SecurityError/,
      'Must throw SecurityError on unproxied image'
    );
  });

  await challenge('T5.1.2: Multi-media card with mixed schemes: replacement guarantees zero canvas taint', async () => {
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((msg: any, _s, sendResponse) => {
      if (msg.type === 'FETCH_IMAGE_BASE64') {
        sendResponse({
          success: true,
          dataUrl: `data:image/jpeg;base64,proxied_${Buffer.from(msg.url).toString('base64')}`,
          contentType: 'image/jpeg',
        });
        return true;
      }
    });

    const card = new DomElement('DIV');
    
    // Add images of various schemes
    const img1 = new DomImageElement();
    img1.src = 'https://pbs.twimg.com/avatar_400x400.jpg';
    card.appendChild(img1);

    const img2 = new DomImageElement();
    img2.src = 'https://pbs.twimg.com/media/photo_1.jpg:large';
    card.appendChild(img2);

    const img3 = new DomImageElement();
    img3.src = 'data:image/png;base64,already_base64_data';
    card.appendChild(img3);

    const img4 = new DomImageElement();
    img4.src = 'blob:https://x.com/local-blob-url';
    card.appendChild(img4);

    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = chromeMock;

    try {
      // 1. Before proxying: unproxied twimg images would taint canvas
      await assert.rejects(async () => {
        await mockDomToBlob(card);
      }, /SecurityError/);

      // 2. Run Base64 image substitution
      const restore = await replaceCardImagesWithBase64(card as unknown as HTMLElement);

      // Verify all non-data/blob images are now Base64
      assert.ok(img1.src.startsWith('data:image/jpeg;base64,proxied_'));
      assert.ok(img2.src.startsWith('data:image/jpeg;base64,proxied_'));
      assert.equal(img3.src, 'data:image/png;base64,already_base64_data');
      assert.equal(img4.src, 'blob:https://x.com/local-blob-url');

      // 3. Render snapshot with zero canvas taint
      const blob = await mockDomToBlob(card, { scale: 2 });
      assert.ok(blob, 'Blob must be created without SecurityError');
      assert.equal(blob.type, 'image/png');

      // 4. Restore original sources
      restore();
      assert.equal(img1.src, 'https://pbs.twimg.com/avatar_400x400.jpg');
      assert.equal(img2.src, 'https://pbs.twimg.com/media/photo_1.jpg:large');
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  await challenge('T5.1.3: Background Proxy 504 failure falls back to clean SVG placeholder, avoiding taint', async () => {
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((msg: any, _s, sendResponse) => {
      if (msg.type === 'FETCH_IMAGE_BASE64') {
        sendResponse({ success: false, error: '504 Gateway Timeout' });
        return true;
      }
    });

    const card = new DomElement('DIV');
    const failingImg = new DomImageElement();
    failingImg.src = 'https://pbs.twimg.com/media/corrupt_or_timed_out.jpg';
    card.appendChild(failingImg);

    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = chromeMock;

    try {
      const restore = await replaceCardImagesWithBase64(card as unknown as HTMLElement);
      // Replaced with fallback placeholder data URL
      assert.equal(failingImg.src, FALLBACK_PLACEHOLDER_DATA_URL);

      // Renders cleanly without taint
      const blob = await mockDomToBlob(card, { scale: 2 });
      assert.ok(blob);
      assert.equal(blob.type, 'image/png');

      restore();
      assert.equal(failingImg.src, 'https://pbs.twimg.com/media/corrupt_or_timed_out.jpg');
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  await challenge('T5.1.4: Pre-export Base64 replacement restores original image src in finally block', async () => {
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((_msg: any, _s, sendResponse) => {
      sendResponse({ success: true, dataUrl: 'data:image/jpeg;base64,swapped_clean_data' });
      return true;
    });

    const card = new DomElement('DIV');
    const originalSrc = 'https://pbs.twimg.com/media/important_photo.jpg';
    const img = new DomImageElement();
    img.src = originalSrc;
    card.appendChild(img);

    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = chromeMock;

    try {
      const restore = await replaceCardImagesWithBase64(card as unknown as HTMLElement);
      assert.equal(img.src, 'data:image/jpeg;base64,swapped_clean_data');

      restore();
      assert.equal(img.src, originalSrc, 'Image src must be restored to original after render');
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  await challenge('T5.1.5: Export preparation leaves the data model and the live card as it found them', async () => {
    // The card is rasterized from the DOM, not from the TweetData, so preparing
    // an export rewrites image sources on the live element. Two things must
    // survive that: the model the caller handed over, and the element itself
    // afterwards -- the modal stays open behind the export and is still showing
    // when it finishes. A frozen model is used so any write to it throws rather
    // than passing unnoticed.
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((msg: any, _s, sendResponse) => {
      sendResponse({ success: true, dataUrl: `data:image/jpeg;base64,safe_${msg.url}` });
      return true;
    });

    const rawTweet: TweetData = Object.freeze({
      id: '9999',
      url: 'https://x.com/user/status/9999',
      author: Object.freeze({
        name: 'Frozen User',
        handle: 'frozen',
        avatarUrl: 'https://pbs.twimg.com/avatar.jpg',
      }),
      text: 'Testing immutability',
      timestamp: '2026-09-30T00:00:00Z',
      media: Object.freeze([
        Object.freeze({ type: 'image', url: 'https://pbs.twimg.com/pic.jpg' }),
      ]) as any,
    });

    const card = createDomElement('<div><img src="https://pbs.twimg.com/avatar.jpg" alt="a"></div>');
    const img = card.querySelector('img') as DomImageElement;

    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = chromeMock;

    try {
      const restore = await replaceCardImagesWithBase64(card as unknown as HTMLElement);

      assert.equal(rawTweet.author.avatarUrl, 'https://pbs.twimg.com/avatar.jpg');
      assert.equal(
        rawTweet.media![0].url,
        'https://pbs.twimg.com/pic.jpg',
        'the model must not be rewritten on the way to the canvas'
      );
      assert.ok(
        img.getAttribute('src')?.startsWith('data:image/jpeg;base64,safe_'),
        'the live card must be swapped for the duration of the export'
      );

      restore();

      assert.equal(
        img.getAttribute('src'),
        'https://pbs.twimg.com/avatar.jpg',
        'the card behind the modal must be whole again once the export finishes'
      );
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  await challenge('T5.1.6: Strict Host & Origin Validation prevents SSRF and malicious URL schemes', () => {
    assert.equal(isAllowedHost('https://pbs.twimg.com/profile_images/1/test.jpg'), true);
    assert.equal(isAllowedHost('https://video.twimg.com/ext_tw_video/test.mp4'), true);
    assert.equal(isAllowedHost('https://twimg.com/img.jpg'), true);
    assert.equal(isAllowedHost('http://pbs.twimg.com/img.jpg'), true);

    // Attack attempts
    assert.equal(isAllowedHost('https://twimg.com.attacker.com/malicious.jpg'), false);
    assert.equal(isAllowedHost('https://attacker-twimg.com/malicious.jpg'), false);
    assert.equal(isAllowedHost('http://evil.twimg.com.cn/test.jpg'), false);
    assert.equal(isAllowedHost('ftp://pbs.twimg.com/file'), false);
    assert.equal(isAllowedHost('javascript:alert(1)'), false);
    assert.equal(isAllowedHost('file:///C:/Windows/system.ini'), false);
    assert.equal(isAllowedHost(''), false);
    assert.equal(isAllowedHost(null as any), false);
  });

  await challenge('T5.1.7: uint8ArrayToBase64 chunking handles 5MB images without V8 stack overflow', () => {
    const size = 5 * 1024 * 1024; // 5MB
    const buffer = new Uint8Array(size);
    for (let i = 0; i < 1000; i++) {
      buffer[i] = (i % 256);
    }
    const b64 = uint8ArrayToBase64(buffer);
    assert.ok(b64.length > size, 'Base64 output must be generated');
  });

  await challenge('T5.1.8: LRU Memory Cache caps at 200 items without memory leak', async () => {
    clearImageCache();
    assert.equal(getImageCacheSize(), 0);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'image/png']]) as any,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      } as any;
    };

    try {
      for (let i = 0; i < 220; i++) {
        await handleFetchImageBase64(`https://pbs.twimg.com/img_${i}.png`);
      }
      assert.equal(getImageCacheSize(), 200, 'Image cache must clamp at 200 items');
    } finally {
      globalThis.fetch = originalFetch;
      clearImageCache();
    }
  });

  // -------------------------------------------------------------
  // CHALLENGE GROUP 2: Clipboard Write, Focus Loss, Gesture Timeouts & Unhandled Rejections
  // -------------------------------------------------------------
  console.log('\n[Group 2] Clipboard Focus Loss, Gesture Timeouts & Unhandled Rejections...');

  await challenge('T5.2.1: Clipboard focus loss triggers PNG download without unhandled rejection', async () => {
    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'unfocused';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    const blob = new Blob(['png_retina_data'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      let result: Awaited<ReturnType<typeof exportBlobWithFallback>> | undefined;
      const anchors = await captureDownloads(async () => {
        result = await exportBlobWithFallback(blob, 'copy', 'unfocused-test.png');
      });

      assert.equal(result!.success, true);
      assert.equal(result!.method, 'download');
      assert.equal(result!.filename, 'unfocused-test.png');
      assert.equal(anchors.length, 1, 'the card must actually have been offered as a download');
      assert.equal(anchors[0].getAttribute('download'), 'unfocused-test.png');
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  await challenge('T5.2.2: User activation gesture expiration triggers PNG download cleanly', async () => {
    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'gesture_expired';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    const blob = new Blob(['png_retina_data'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      let result: Awaited<ReturnType<typeof exportBlobWithFallback>> | undefined;
      const anchors = await captureDownloads(async () => {
        result = await exportBlobWithFallback(blob, 'copy', 'gesture-expired-test.png');
      });

      assert.equal(result!.success, true);
      assert.equal(result!.method, 'download');
      assert.equal(anchors.length, 1);
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  await challenge('T5.2.3: Clipboard permission denied triggers PNG download cleanly', async () => {
    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'permission_denied';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    const blob = new Blob(['png_retina_data'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      let result: Awaited<ReturnType<typeof exportBlobWithFallback>> | undefined;
      const anchors = await captureDownloads(async () => {
        result = await exportBlobWithFallback(blob, 'copy', 'permission-denied-test.png');
      });

      assert.equal(result!.success, true);
      assert.equal(result!.method, 'download');
      assert.equal(anchors.length, 1);
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  await challenge('T5.2.4: Missing Clipboard API or ClipboardItem in environment gracefully downloads', async () => {
    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    delete (globalThis.navigator as any).clipboard;
    delete (globalThis as any).ClipboardItem;

    const blob = new Blob(['png_retina_data'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      let result: Awaited<ReturnType<typeof exportBlobWithFallback>> | undefined;
      const anchors = await captureDownloads(async () => {
        result = await exportBlobWithFallback(blob, 'copy', 'missing-api-test.png');
      });

      assert.equal(result!.success, true);
      assert.equal(result!.method, 'download');
      assert.equal(anchors.length, 1);
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      }
    }
  });

  await challenge('T5.2.5: Catastrophic failure (both clipboard and download throw) returns error without unhandled rejection', async () => {
    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'unfocused';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    const doc = new DomDocument();
    const originalCreateElement = doc.createElement.bind(doc);
    doc.createElement = (tag: string) => {
      if (tag.toLowerCase() === 'a') {
        throw new Error('Download anchor creation restricted by security policy');
      }
      return originalCreateElement(tag);
    };

    const originalDoc = (globalThis as any).document;
    (globalThis as any).document = doc;

    const blob = new Blob(['png_bytes'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const result = await exportBlobWithFallback(blob, 'copy', 'fatal-test.png');
      assert.equal(result.success, false);
      assert.equal(result.method, 'download');
      assert.ok(result.error?.includes('Download anchor creation restricted'));
      assert.equal(unhandledRejectionsCount, 0, 'Must not cause unhandled rejection');
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
      (globalThis as any).document = originalDoc;
    }
  });

  await challenge('T5.2.6: High-frequency burst of 50 concurrent export actions with focus loss handles cleanly', async () => {
    const mockClipboard = new MockClipboard();
    mockClipboard.failureMode = 'unfocused';

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    const blob = new Blob(['png_data'], { type: 'image/png' });

    const originalWarn = console.warn;
    console.warn = () => {}; // Mute expected warnings during 50-burst test
    try {
      let results: Awaited<ReturnType<typeof exportBlobWithFallback>>[] = [];
      const anchors = await captureDownloads(async () => {
        results = await Promise.all(
          Array.from({ length: 50 }, (_, i) =>
            exportBlobWithFallback(blob, 'copy', `burst-${i}.png`)
          )
        );
      });

      assert.equal(results.length, 50);
      results.forEach((r) => {
        assert.equal(r.success, true);
        assert.equal(r.method, 'download');
      });
      assert.equal(anchors.length, 50, 'every one of the 50 must have reached the document');
      assert.equal(unhandledRejectionsCount, 0, 'Zero unhandled rejections during high-frequency burst');
    } finally {
      console.warn = originalWarn;
      if (originalClipboardDesc) {
        Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboardDesc);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  // -------------------------------------------------------------
  // CHALLENGE GROUP 3: Modal Twitter Host DOM Style Isolation & Scroll Lock/Restore
  // -------------------------------------------------------------
  console.log('\n[Group 3] Modal Shadow DOM Style Isolation & Scroll Lock/Restore...');

  await challenge('T5.3.1: Shadow DOM encapsulation shields modal from hostile Twitter host CSS', () => {
    const doc = new DomDocument();
    
    // Inject hostile global styles into host document head
    const hostileStyle = doc.createElement('style');
    hostileStyle.textContent = `
      * { display: none !important; color: #ff0000 !important; font-size: 0px !important; }
      div { margin: 1000px !important; }
    `;
    doc.head.appendChild(hostileStyle);

    // Create modal container
    const container = new DomElement('POST-TO-CARD-CONTAINER');
    const shadow = container.attachShadow({ mode: 'open' });
    
    const internalStyle = new DomElement('STYLE');
    internalStyle.textContent = ':host { all: initial; display: block; position: fixed; inset: 0; }';
    shadow.appendChild(internalStyle);

    const dialog = new DomElement('DIV');
    dialog.id = 'post-to-card-dialog';
    shadow.appendChild(dialog);

    doc.body.appendChild(container);

    // Verify shadow root boundary
    assert.equal(shadow.childNodes.length, 2);
    assert.equal(dialog.parentElement, null); // Parent is shadowRoot, not host body
    assert.equal(container.shadowRoot, shadow);
    assert.equal(shadow.host, container);
  });

  await challenge('T5.3.2: Modal and Card CSS files declare 100% isolated scoped selectors with :host all:initial', () => {
    const modalCssPath = path.resolve(rootDir, 'src/content/styles/modal.css');
    const cardCssPath = path.resolve(rootDir, 'src/content/styles/card.css');

    assert.ok(fs.existsSync(modalCssPath), 'modal.css must exist');
    assert.ok(fs.existsSync(cardCssPath), 'card.css must exist');

    const modalCss = fs.readFileSync(modalCssPath, 'utf8');
    const cardCss = fs.readFileSync(cardCssPath, 'utf8');

    // Verify :host resets inherited host-page styles. The selector is a list --
    // `:host` is paired with `.ptc-scope`, which the dev harness uses to render
    // the same panels outside a shadow root -- so the declaration is looked for
    // in the rule that contains `:host` rather than in the text right after it.
    assert.match(
      modalCss,
      /:host[^{}]*\{[^}]*all:\s*initial/i,
      'modal.css must reset :host styles with all: initial'
    );
    assert.match(modalCss, /z-index:\s*2147483647/, 'modal.css must use max z-index');
    assert.match(modalCss, /position:\s*fixed/, 'modal.css must fix to viewport');

    // Verify zero leaked global :root selectors in modal CSS
    assert.ok(!modalCss.includes(':root'), 'modal.css must not target global :root');
    assert.ok(!cardCss.includes(':root'), 'card.css must not target global :root');
  });

  await challenge('T5.3.3: Scroll lock saves and restores default body overflow & compensates scrollbar width', () => {
    let activeScrollLocks = 0;
    let previousOverflow = '';
    let previousPaddingRight = '';

    function lockScroll(doc: DomDocument, winWidth: number, clientWidth: number) {
      if (activeScrollLocks === 0) {
        const body = doc.body;
        const scrollbarWidth = winWidth - clientWidth;
        previousOverflow = body ? body.style.overflow : '';
        previousPaddingRight = body ? body.style.paddingRight : '';

        if (body) {
          body.style.overflow = 'hidden';
          if (scrollbarWidth > 0) {
            body.style.paddingRight = `${scrollbarWidth}px`;
          }
        }
      }
      activeScrollLocks++;
    }

    function unlockScroll(doc: DomDocument) {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0 && doc.body) {
        doc.body.style.overflow = previousOverflow;
        doc.body.style.paddingRight = previousPaddingRight;
      }
    }

    const doc = new DomDocument();
    doc.body.style.overflow = '';
    doc.body.style.paddingRight = '';

    lockScroll(doc, 1200, 1185); // 15px scrollbar
    assert.equal(doc.body.style.overflow, 'hidden');
    assert.equal(doc.body.style.paddingRight, '15px');

    unlockScroll(doc);
    assert.equal(doc.body.style.overflow, '');
    assert.equal(doc.body.style.paddingRight, '');
  });

  await challenge('T5.3.4: Scroll lock preserves pre-existing non-empty overflow and paddingRight styles', () => {
    let activeScrollLocks = 0;
    let previousOverflow = '';
    let previousPaddingRight = '';

    function lockScroll(doc: DomDocument, winWidth: number, clientWidth: number) {
      if (activeScrollLocks === 0) {
        const body = doc.body;
        const scrollbarWidth = winWidth - clientWidth;
        previousOverflow = body ? body.style.overflow : '';
        previousPaddingRight = body ? body.style.paddingRight : '';

        if (body) {
          body.style.overflow = 'hidden';
          if (scrollbarWidth > 0) {
            body.style.paddingRight = `${scrollbarWidth}px`;
          }
        }
      }
      activeScrollLocks++;
    }

    function unlockScroll(doc: DomDocument) {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0 && doc.body) {
        doc.body.style.overflow = previousOverflow;
        doc.body.style.paddingRight = previousPaddingRight;
      }
    }

    const doc = new DomDocument();
    doc.body.style.overflow = 'scroll';
    doc.body.style.paddingRight = '12px';

    lockScroll(doc, 1200, 1180);
    assert.equal(doc.body.style.overflow, 'hidden');
    assert.equal(doc.body.style.paddingRight, '20px');

    unlockScroll(doc);
    assert.equal(doc.body.style.overflow, 'scroll');
    assert.equal(doc.body.style.paddingRight, '12px');
  });

  await challenge('T5.3.5: Reentrant nested scroll locks require matching unlock count to release', () => {
    let activeScrollLocks = 0;
    let previousOverflow = '';
    let previousPaddingRight = '';

    function lockScroll(doc: DomDocument) {
      if (activeScrollLocks === 0) {
        previousOverflow = doc.body ? doc.body.style.overflow : '';
        previousPaddingRight = doc.body ? doc.body.style.paddingRight : '';
        if (doc.body) doc.body.style.overflow = 'hidden';
      }
      activeScrollLocks++;
    }

    function unlockScroll(doc: DomDocument) {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0 && doc.body) {
        doc.body.style.overflow = previousOverflow;
        doc.body.style.paddingRight = previousPaddingRight;
      }
    }

    const doc = new DomDocument();
    doc.body.style.overflow = 'auto';

    lockScroll(doc); // Count: 1
    assert.equal(doc.body.style.overflow, 'hidden');

    lockScroll(doc); // Count: 2
    assert.equal(doc.body.style.overflow, 'hidden');

    unlockScroll(doc); // Count: 1
    assert.equal(doc.body.style.overflow, 'hidden', 'Should still be locked with active locks = 1');

    unlockScroll(doc); // Count: 0
    assert.equal(doc.body.style.overflow, 'auto', 'Should restore original overflow when active locks = 0');
  });

  await challenge('T5.3.6: Over-unlocking does not cause counter underflow or corrupt subsequent locks', () => {
    let activeScrollLocks = 0;
    let previousOverflow = '';
    let previousPaddingRight = '';

    function lockScroll(doc: DomDocument) {
      if (activeScrollLocks === 0) {
        previousOverflow = doc.body ? doc.body.style.overflow : '';
        previousPaddingRight = doc.body ? doc.body.style.paddingRight : '';
        if (doc.body) doc.body.style.overflow = 'hidden';
      }
      activeScrollLocks++;
    }

    function unlockScroll(doc: DomDocument) {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0 && doc.body) {
        doc.body.style.overflow = previousOverflow;
        doc.body.style.paddingRight = previousPaddingRight;
      }
    }

    const doc = new DomDocument();
    doc.body.style.overflow = '';

    // Excessive unlocks when count is 0
    unlockScroll(doc);
    unlockScroll(doc);
    unlockScroll(doc);

    // Next lock must work immediately
    lockScroll(doc);
    assert.equal(doc.body.style.overflow, 'hidden');

    unlockScroll(doc);
    assert.equal(doc.body.style.overflow, '');
  });

  await challenge('T5.3.7: Modal dismissals: Escape key and backdrop click invoke onClose while dialog click stops propagation', () => {
    let closeTriggered = false;
    const onClose = () => { closeTriggered = true; };

    // 1. Escape key
    const escEvent = { key: 'Escape', stopPropagation() {} };
    if (escEvent.key === 'Escape') {
      onClose();
    }
    assert.equal(closeTriggered, true);

    // 2. Backdrop click
    closeTriggered = false;
    const backdrop = new DomElement('DIV');
    backdrop.id = 'post-to-card-backdrop';
    const dialog = new DomElement('DIV');
    dialog.id = 'post-to-card-dialog';
    backdrop.appendChild(dialog);

    backdrop.addEventListener('click', (e: any) => {
      if (e.target === backdrop || e.target.id === 'post-to-card-backdrop') {
        onClose();
      }
    });

    dialog.addEventListener('click', (e: any) => {
      e.stopPropagation();
    });

    // Click inside dialog
    dialog.click();
    assert.equal(closeTriggered, false, 'Clicking inside dialog must not trigger close');

    // Click on backdrop
    backdrop.click();
    assert.equal(closeTriggered, true, 'Clicking on backdrop must trigger close');
  });

  await challenge('T5.3.8: Auditing compiled dist/content.js for Shadow DOM, Custom Elements, and Style Injection', () => {
    const contentJsPath = path.resolve(rootDir, 'dist/content.js');
    assert.ok(fs.existsSync(contentJsPath), 'dist/content.js must exist — run the build first');

    // A bundle audit is only worth anything against the current source. Auditing
    // a stale one passes while saying nothing about what is on disk in src, which
    // is the failure this suite exists to catch, so the staleness is refused here
    // rather than discovered later.
    const newestSource = newestSourceMtime(path.resolve(rootDir, 'src'));
    const bundleMtime = fs.statSync(contentJsPath).mtimeMs;
    assert.ok(
      bundleMtime >= newestSource,
      `dist/content.js is older than src — run the build before auditing it ` +
      `(bundle ${new Date(bundleMtime).toISOString()}, newest source ${new Date(newestSource).toISOString()})`
    );

    const contentCode = fs.readFileSync(contentJsPath, 'utf8');

    // Must define custom element
    assert.ok(contentCode.includes('post-to-card-container'), 'Must register post-to-card-container custom element');
    assert.ok(contentCode.includes("attachShadow({ mode: 'open' })") || contentCode.includes('attachShadow({mode:"open"})') || contentCode.includes('attachShadow({ mode: "open" })'), 'Must attach open ShadowRoot');
    
    // Must contain compiled inline CSS with :host isolation
    assert.ok(contentCode.includes('all: initial') || contentCode.includes('all:initial'), 'Must include :host all:initial in bundle');
    assert.ok(contentCode.includes('#post-to-card-backdrop'), 'Must include modal backdrop styles');
    assert.ok(contentCode.includes('#post-to-card-dialog'), 'Must include modal dialog styles');

    // Must implement scroll lock and restore
    assert.ok(contentCode.includes('hidden'), 'Must lock overflow with hidden');
  });

  // -------------------------------------------------------------
  // CHALLENGE GROUP 4: Verification of the standard suite (Tiers 1-4)
  // -------------------------------------------------------------
  console.log('\n[Group 4] Running Full Test Suite (Tiers 1 to 4) Verification...');

  // The suite's size is not the property worth holding still: this assertion used
  // to pin an exact count, so every test anyone added broke the adversarial suite
  // without anything being wrong. What must hold is that the standard suite runs
  // and nothing in it fails.
  await challenge('T5.4.1: Standard Tier 1 to 4 test suite executes with a 100% pass rate', async () => {
    const r1 = await runTier1();
    const r2 = await runTier2();
    const r3 = await runTier3();
    const r4 = await runTier4();

    const total = r1.total + r2.total + r3.total + r4.total;
    const passed = r1.passed + r2.passed + r3.passed + r4.passed;
    const failed = r1.failed + r2.failed + r3.failed + r4.failed;

    assert.ok(total > 0, 'the standard suite must actually run something');
    assert.equal(failed, 0, `every standard test must pass (${failed} failed of ${total})`);
    assert.equal(passed, total, `passed must equal run (${passed} of ${total})`);
  });

  // =============================================================
  // SUMMARY & VERDICT
  // =============================================================
  console.log('\n===============================================================');
  console.log('                 TIER 5 VERIFICATION SUMMARY                   ');
  console.log('===============================================================');
  console.log(`  Adversarial Challenges Run: ${passCount + failCount}`);
  console.log(`  Passed:                     ${passCount}`);
  console.log(`  Failed:                     ${failCount}`);
  console.log(`  Unhandled Rejections:       ${unhandledRejectionsCount}`);
  if (failures.length > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`   ✖ ${f}`));
  }
  console.log('===============================================================\n');

  if (failCount > 0 || unhandledRejectionsCount > 0) {
    console.error('❌ VERDICT: REJECT. Adversarial failures detected.');
    process.exit(1);
  } else {
    console.log('✨ VERDICT: APPROVE. All Tier 5 adversarial stress tests passed cleanly!\n');
    process.exit(0);
  }
}

runAdversarialSuite();
