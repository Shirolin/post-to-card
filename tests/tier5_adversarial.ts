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

import { DomDocument, DomElement, DomImageElement, DomShadowRoot, createDomElement } from './env/browser.ts';
import { createChromeMock } from './env/chrome.ts';
import { loadModule, renderComponent, rasterizer, exportEngine } from './env/render.ts';
import { MockClipboard, MockClipboardItem } from './env/clipboard.ts';

// The export engine is loaded through the SSR pipeline so it is the copy wired
// to the rasterizer stand-in; a direct import would be Node's second copy,
// talking to the real `modern-screenshot` and failing for want of a canvas.

// Clipboard & Fallback engine (direct TS imports)
import { exportBlobWithFallback, classifyClipboardFailure } from '../src/content/engine/export.ts';

// Background proxy & SSRF shield (direct TS imports)
import {
  isAllowedHost,
  uint8ArrayToBase64,
  handleFetchImageBase64,
  clearImageCache,
  getImageCacheSize,
  getImageCacheChars,
  setImageCacheBudget,
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

/**
 * Runs `body` with a document, a background proxy in the state named, and a card
 * builder that attaches its images where the export engine can find them.
 *
 * The card has to be built through the document and left in it: the engine
 * clones the live card, and a clone of an element that never had a document
 * rebuilds its images as plain tags with no `src` to hand the rasterizer.
 */
async function withExportEnv(
  proxy: 'working' | 'failing' | 'absent',
  body: (env: { doc: DomDocument; card: (urls: string[]) => DomImageElement[] }) => Promise<void>
): Promise<void> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    chrome: scope.chrome,
    ShadowRoot: scope.ShadowRoot,
    HTMLElement: scope.HTMLElement,
  };

  const doc = new DomDocument();
  scope.document = doc;
  scope.ShadowRoot = DomShadowRoot;
  scope.HTMLElement = DomElement;

  if (proxy === 'absent') {
    delete scope.chrome;
  } else {
    const chromeMock = createChromeMock();
    chromeMock.runtime.onMessage.addListener((msg: any, _s: unknown, sendResponse: (r: unknown) => void) => {
      if (msg.type === 'FETCH_IMAGE_BASE64') {
        if (proxy === 'failing') {
          sendResponse({ success: false, error: '504 Gateway Timeout' });
        } else {
          sendResponse({
            success: true,
            dataUrl: `data:image/jpeg;base64,proxied_${Buffer.from(msg.url).toString('base64')}`,
            contentType: 'image/jpeg',
          });
        }
        return true;
      }
    });
    scope.chrome = chromeMock;
  }

  const card = (urls: string[]): DomImageElement[] => {
    const host = doc.createElement('div');
    host.id = 'post-to-card-export-target';
    doc.body.appendChild(host);
    return urls.map((url) => {
      const img = doc.createElement('img') as DomImageElement;
      img.src = url;
      host.appendChild(img);
      return img;
    });
  };

  try {
    await body({ doc, card });
  } finally {
    scope.document = saved.document;
    scope.chrome = saved.chrome;
    scope.ShadowRoot = saved.ShadowRoot;
    scope.HTMLElement = saved.HTMLElement;
  }
}

/**
 * Exports the card at `#post-to-card-export-target` and returns the image
 * sources the rasterizer was handed.
 *
 * A canvas cannot exist in Node, so the rasterizer is the one stubbed step (see
 * `tests/env/modern-screenshot-stub.ts`). What the export is judged on is what
 * it handed that rasterizer: an unproxied remote `src` surviving into it is what
 * would taint a real canvas, and that is production code's decision, not the
 * stand-in's.
 */
async function rasterizedSources(scale: number = 2): Promise<string[]> {
  const stub = await rasterizer();
  stub.resetRasterizer();

  const engine = await exportEngine();
  const card = document.getElementById('post-to-card-export-target');
  assert.ok(card, 'the card was not attached to the document');
  const blob = await engine.renderCardToBlob(card, { scale });
  assert.equal(blob.type, 'image/png');

  const target = stub.rasterizerCalls[0]?.target as DomElement | undefined;
  assert.ok(target, 'the export engine never reached the rasterizer');
  return Array.from(target.querySelectorAll<DomImageElement>('img')).map((img) => img.src);
}

/**
 * The shipped scroll lock, loaded through the SSR pipeline.
 *
 * Node cannot import a `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`), which is how this
 * suite came to declare its own `lockScroll`/`unlockScroll` and assert against
 * those — a re-implementation that keeps passing after the shipped one breaks.
 * The loaded module runs in Node, so it reads the same `globalThis.document` and
 * `globalThis.window` installed here.
 */
let modalModule: Promise<Record<string, unknown>> | null = null;

async function withScrollLock(
  viewport: { innerWidth: number; clientWidth: number; scrollY?: number },
  body: (env: { doc: DomDocument; lock: () => void; unlock: () => void }) => void | Promise<void>
): Promise<void> {
  const scope = globalThis as { document?: unknown; window?: unknown };
  const saved = { document: scope.document, window: scope.window };

  const doc = new DomDocument();
  doc.documentElement.clientWidth = viewport.clientWidth;

  scope.document = doc;
  scope.window = {
    location: { origin: 'https://x.com', pathname: '/' },
    innerWidth: viewport.innerWidth,
    scrollY: viewport.scrollY ?? 0,
    scrollTo: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };

  try {
    if (!modalModule) modalModule = loadModule('/src/content/ui/Modal.tsx');
    const mod = await modalModule;
    const lock = mod.lockScroll as () => void;
    const unlock = mod.unlockScroll as () => void;
    assert.equal(typeof lock, 'function', 'Modal.tsx no longer exports lockScroll');
    assert.equal(typeof unlock, 'function', 'Modal.tsx no longer exports unlockScroll');

    // The lock counter is module state shared by every challenge in this file, so
    // an unbalanced one would silently skip the styles in the next test. Drain it
    // before the body sets the page up; the drain's own restore is harmless
    // because the body writes its styles afterwards.
    for (let i = 0; i < 4; i++) unlock();

    await body({ doc, lock, unlock });
  } finally {
    scope.document = saved.document;
    scope.window = saved.window;
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

  await challenge('T5.1.1: With no proxy at all, no remote URL reaches the rasterizer', async () => {
    // The worst case: a twimg URL that nothing can fetch. Whatever the export
    // does with it, it must not be handed to the rasterizer as-is, because a
    // remote source on a canvas is exactly what taints it.
    await withExportEnv('absent', async ({ card }) => {
      card(['https://pbs.twimg.com/media/unproxied_leak.jpg']);

      const sources = await rasterizedSources();
      assert.equal(sources.length, 1);
      assert.ok(
        sources[0].startsWith('data:'),
        `a remote URL reached the rasterizer and would have tainted the canvas: ${sources[0]}`
      );
    });
  });

  await challenge('T5.1.2: Multi-media card with mixed schemes: replacement guarantees zero canvas taint', async () => {
    await withExportEnv('working', async ({ card }) => {
      const [img1, img2, img3, img4] = card([
        'https://pbs.twimg.com/avatar_400x400.jpg',
        'https://pbs.twimg.com/media/photo_1.jpg:large',
        'data:image/png;base64,already_base64_data',
        'blob:https://x.com/local-blob-url',
      ]);

      const sources = await rasterizedSources(2);

      // The two remote sources went through the background proxy; the two that
      // were already origin-clean were left exactly as they were.
      assert.equal(sources.length, 4);
      assert.equal(sources.filter((s) => s.startsWith('data:image/jpeg;base64,proxied_')).length, 2);
      assert.equal(sources.filter((s) => s === 'data:image/png;base64,already_base64_data').length, 1);
      assert.equal(sources.filter((s) => s === 'blob:https://x.com/local-blob-url').length, 1);
      assert.equal(sources.filter((s) => s.startsWith('http')).length, 0, 'a remote source survived into the rasterizer');

      // And the card behind the modal is whole again once the export is over.
      assert.equal(img1.src, 'https://pbs.twimg.com/avatar_400x400.jpg');
      assert.equal(img2.src, 'https://pbs.twimg.com/media/photo_1.jpg:large');
      assert.equal(img3.src, 'data:image/png;base64,already_base64_data');
      assert.equal(img4.src, 'blob:https://x.com/local-blob-url');
    });
  });

  await challenge('T5.1.3: Background Proxy 504 failure falls back to clean SVG placeholder, avoiding taint', async () => {
    await withExportEnv('failing', async ({ card }) => {
      const [failingImg] = card(['https://pbs.twimg.com/media/corrupt_or_timed_out.jpg']);

      const sources = await rasterizedSources(2);
      const engine = await exportEngine();
      assert.equal(
        sources[0],
        engine.FALLBACK_PLACEHOLDER_DATA_URL,
        'a proxy that could not fetch the picture must still yield something origin-clean'
      );

      assert.equal(
        failingImg.src,
        'https://pbs.twimg.com/media/corrupt_or_timed_out.jpg',
        'the placeholder is for the canvas, not for the card on screen'
      );
    });
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
      const preparation = await (await exportEngine()).prepareCardImages(card as unknown as HTMLElement);
      assert.equal(img.src, 'data:image/jpeg;base64,swapped_clean_data');

      preparation.restore();
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
      const preparation = await (await exportEngine()).prepareCardImages(card as unknown as HTMLElement);

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

      preparation.restore();

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
      // The count bound is asserted here as "the cap, and never anything bigger".
      // It used to say "exactly 200", which held only because the cache filled
      // differently: past the cap the oldest entry is evicted, that entry is a
      // URL this loop will ask for again, and asking again is a *hit* -- a hit
      // must not evict a different entry, so the size settles below 200. The cap
      // is the invariant; the settling point depends on the order the URLs are
      // replayed in, and T5.1.9 pins the hit path on purpose.
      for (let i = 0; i < 220; i++) {
        await handleFetchImageBase64(`https://pbs.twimg.com/img_${i}.png`);
      }
      assert.ok(
        getImageCacheSize() <= 200,
        `Image cache grew to ${getImageCacheSize()} items, past its cap`
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearImageCache();
    }
  });

  await challenge('T5.1.9: the image cache is bounded by bytes, and by a count', async () => {
    // A count says nothing about what the worker is holding: one `name=orig`
    // photo is megabytes once base64, so 200 of them is hundreds of megabytes.
    // Two properties, one small budget each, so the test costs neither memory:
    //
    //   1. With a byte budget the cache evicts by size, oldest picture first.
    //   2. With room to spare it still stops at 200 entries.
    //
    // A third picture past the whole budget is handed to its caller and never
    // remembered -- evicting everything the smaller pictures were kept for would
    // be the worse trade.
    clearImageCache();
    const originalFetch = globalThis.fetch;
    const size = 4096;
    const serve = (bytes: number) => {
      globalThis.fetch = async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'image/png']]) as any,
          arrayBuffer: async () => new Uint8Array(bytes).buffer,
        }) as any;
    };
    // `data:image/png;base64,` is 22 characters; base64 is 4 per 3 bytes.
    const oneDataUrl = 22 + Math.ceil((size * 4) / 3);

    try {
      serve(size);
      // 1. Two pictures fit; a third pushes the oldest out.
      setImageCacheBudget(oneDataUrl * 2 + 10);
      for (let i = 0; i < 3; i++) {
        await handleFetchImageBase64(`https://pbs.twimg.com/sized_${i}.png`);
      }
      assert.equal(getImageCacheSize(), 2, 'the byte budget, not the count, decided');
      assert.ok(
        getImageCacheChars() <= oneDataUrl * 2 + 10,
        `the cache holds ${getImageCacheChars()} characters, past its budget`
      );

      // 2. A picture larger than the whole budget: delivered, not cached, and
      //    it evicts nothing on its way through.
      serve(oneDataUrl * 4);
      const big = await handleFetchImageBase64('https://pbs.twimg.com/huge.png');
      assert.equal(big.success, true, 'the picture that did not fit was still delivered');
      assert.equal(getImageCacheSize(), 2, 'and it evicted nothing to make room for itself');

      // 3. The count bound still holds, asserted on the hits rather than on fresh
      //    URLs: with 200 entries held, re-asking for a picture already there is
      //    a hit, and a hit must not cost an unrelated entry its place.
      //
      //    `T5.1.8` above cannot say this: it asks for new URLs, and the oldest
      //    entry it evicts at the cap is the one it will ask for next time, so
      //    its second half is all hits and the cache drains to a handful. That is
      //    the pre-existing behaviour, not this budget's.
      serve(4);
      setImageCacheBudget(64 * 1024 * 1024);
      clearImageCache();
      for (let i = 0; i < 200; i++) {
        await handleFetchImageBase64(`https://pbs.twimg.com/fill_${i}.png`);
      }
      for (let i = 0; i < 200; i++) {
        await handleFetchImageBase64(`https://pbs.twimg.com/fill_${i}.png`);
      }
      assert.equal(getImageCacheSize(), 200, 'a second pass over the same 200 is all hits, not evictions');
    } finally {
      setImageCacheBudget(64 * 1024 * 1024);
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

  await challenge('T5.2.7: the clipboard classifier never throws on hostile input and never over-claims', async () => {
    // The function runs inside a catch handler, so an exception here would
    // replace the original failure with a new one. It is also the only thing
    // that turns browser text into a claim the UI shows, so the cases where the
    // evidence is ambiguous must stay `other`.
    const hostile: unknown[] = [
      undefined,
      null,
      '',
      'boom',
      42,
      {},
      [],
      { message: 123, name: 456 },
      Object.create(null),
      (() => {
        const err: any = new Error('x');
        Object.defineProperty(err, 'message', {
          get() {
            throw new Error('message getter exploded');
          },
        });
        return err;
      })(),
    ];

    for (const input of hostile) {
      const result = classifyClipboardFailure(input);
      assert.ok(['unsupported', 'permission', 'unfocused-or-gesture', 'other'].includes(result.reason));
      assert.equal(typeof result.message, 'string');
    }

    // Ambiguous evidence never becomes a specific claim.
    assert.equal(
      classifyClipboardFailure(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' })).reason,
      'other'
    );
    assert.equal(
      classifyClipboardFailure(new Error('SecurityError: blocked')).reason,
      'other'
    );
    // Only explicit wording may move it.
    assert.equal(
      classifyClipboardFailure(new Error('Document is not focused.')).reason,
      'unfocused-or-gesture'
    );
    assert.equal(
      classifyClipboardFailure(new Error('Clipboard permission denied.')).reason,
      'permission'
    );
    assert.equal(unhandledRejectionsCount, 0);
  });

  await challenge('T5.2.8: the clipboard is claimed inside the click, and the picture fills it in later', async () => {    // The clipboard write used to be issued after the export: hundreds of
    // milliseconds for a post, seconds for a thread. Chromium grants
    // `clipboard.write` on transient activation, which does not last that long,
    // so a long copy was refused and fell back to a download -- the threads the
    // user most wanted as a picture.
    //
    // This stands in for that browser: `write` counts as legal until the next
    // macrotask, and a promise-valued item is read after it. A synchronous
    // value would have to exist first, and constructing one would be the await
    // that loses the gesture. Whether Chromium in fact requires that is a claim
    // for `docs/live-verification.md`, not for this file.
    const engine = await exportEngine();
    let gestureAlive = true;
    let accepted = false;
    let heldPromise = false;
    const received: Blob[] = [];

    const store = {
      write(items: any[]) {
        accepted = gestureAlive;
        const value = items[0]?.data?.['image/png'];
        heldPromise = typeof (value as Promise<unknown>)?.then === 'function';
        return Promise.resolve(value).then((blob: Blob) => {
          received.push(blob);
        });
      },
    };

    const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: store, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: class {
        data: Record<string, unknown>;
        constructor(data: Record<string, unknown>) {
          this.data = data;
        }
      },
      configurable: true,
      writable: true,
    });

    try {
      let release: (blob: Blob | null) => void = () => {};
      const picture = new Promise<Blob | null>((resolve) => {
        release = resolve;
      });

      // The click: claim first, render second. The render resolves with the
      // measurement and carries the picture that is still being drawn.
      const handle = engine.beginClipboardWrite(
        Promise.resolve({ blob: picture, requestedScale: 3, appliedScale: 3 } as never)
      );
      gestureAlive = false;

      // The rasterizer finishes long after the activation is gone.
      await new Promise((resolve) => setTimeout(resolve, 5));
      release(new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }));
      await handle.written;
      await handle.picture;

      assert.equal(accepted, true, 'the write reached the clipboard after the activation had expired');
      assert.equal(heldPromise, true, 'the item was built with a value that had to exist already');
      assert.equal(received.length, 1, 'the clipboard never received the picture the render produced');
      assert.equal(engine.canUseImageClipboard(), true);
      assert.equal(unhandledRejectionsCount, 0);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis.navigator, 'clipboard', descriptor);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  await challenge('T5.2.9: a render that dies while the clipboard holds it is reported, not swallowed', async () => {
    // The other half of handing the clipboard a promise: the promise can fail.
    // The reason must reach the caller as data rather than as a rejection that
    // was already consumed, and no rejection may be left unobserved -- a
    // `then(onFulfilled, onRejected)` that re-throws is how a handled promise
    // still prints "Unhandled promise rejection".
    const engine = await exportEngine();
    const mock = new MockClipboard();
    const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: mock, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'ClipboardItem', { value: MockClipboardItem, configurable: true, writable: true });

    try {
      const failure = new Error('canvas exploded');
      const handle = engine.beginClipboardWrite(
        Promise.resolve({ blob: Promise.reject(failure) } as never)
      );
      const picture = await handle.picture;

      assert.equal(picture.blob, null, 'a failed render was handed to the clipboard as a picture');
      assert.equal(picture.failure, failure, 'the reason the render failed was replaced by a generic one');
      await handle.written.catch(() => {});

      // Let the microtask queue and the rejection tracker both run.
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(unhandledRejectionsCount, 0, 'the guarded picture printed an unhandled rejection');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis.navigator, 'clipboard', descriptor);
      } else {
        delete (globalThis.navigator as any).clipboard;
      }
      delete (globalThis as any).ClipboardItem;
    }
  });

  // -------------------------------------------------------------
  // CHALLENGE GROUP 3: Modal Shadow DOM Style Isolation & Scroll Lock/Restore
  // -------------------------------------------------------------
  console.log('\n[Group 3] Modal Shadow DOM Style Isolation & Scroll Lock/Restore...');

  // T5.3.1 used to build its own container, shadow root, style and dialog and
  // then assert the emulator's facts back (childNodes count, parentElement,
  // shadowRoot identity). Nothing shipped ran, so no regression in the modal
  // could fail it. The claim is covered where the real code is driven: tier1
  // F15.1 (the container upgrades through the registry) and F16.1 (its
  // stylesheet is in the shadow root and absent from the page), with the
  // stylesheet's own :host reset asserted by T5.3.2 below.

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

  await challenge('T5.3.3: Scroll lock saves and restores default body overflow & compensates scrollbar width', async () => {
    await withScrollLock({ innerWidth: 1200, clientWidth: 1185 }, ({ doc, lock, unlock }) => {
      lock();
      assert.equal(doc.documentElement.style.overflow, 'hidden', 'the scrolling element on an X page is documentElement');
      assert.equal(doc.body.style.overflow, 'hidden');
      assert.equal(doc.body.style.paddingRight, '15px');

      unlock();
      assert.equal(doc.documentElement.style.overflow, '');
      assert.equal(doc.body.style.overflow, '');
      assert.equal(doc.body.style.paddingRight, '');
    });
  });

  await challenge('T5.3.4: Scroll lock adds to a pre-existing paddingRight and gives it back on release', async () => {
    await withScrollLock({ innerWidth: 1200, clientWidth: 1180 }, ({ doc, lock, unlock }) => {
      doc.documentElement.style.overflow = 'auto';
      doc.body.style.overflow = 'scroll';
      doc.body.style.paddingRight = '12px';

      lock();
      assert.equal(doc.documentElement.style.overflow, 'hidden');
      assert.equal(doc.body.style.overflow, 'hidden');
      // The padding stands in for the scrollbar that just disappeared, so it is
      // 12 + 20. Writing 20 over the page's own 12 leaves the content 12px short
      // and it jumps sideways as the modal opens.
      assert.equal(doc.body.style.paddingRight, '32px');

      unlock();
      assert.equal(doc.documentElement.style.overflow, 'auto');
      assert.equal(doc.body.style.overflow, 'scroll');
      assert.equal(doc.body.style.paddingRight, '12px');
    });
  });

  await challenge('T5.3.5: Reentrant nested scroll locks require matching unlock count to release', async () => {
    await withScrollLock({ innerWidth: 1200, clientWidth: 1200 }, ({ doc, lock, unlock }) => {
      doc.body.style.overflow = 'auto';

      lock();
      assert.equal(doc.body.style.overflow, 'hidden');

      lock();
      assert.equal(doc.body.style.overflow, 'hidden');

      unlock();
      assert.equal(doc.body.style.overflow, 'hidden', 'a modal is still open, so the page must stay locked');

      unlock();
      assert.equal(doc.body.style.overflow, 'auto', 'the last release must restore what the page had');
    });
  });

  await challenge('T5.3.6: Over-unlocking does not cause counter underflow or corrupt subsequent locks', async () => {
    await withScrollLock({ innerWidth: 1200, clientWidth: 1200 }, ({ doc, lock, unlock }) => {
      doc.body.style.overflow = '';

      // Excessive unlocks when the counter is already zero
      unlock();
      unlock();
      unlock();

      // The next lock must still take effect
      lock();
      assert.equal(doc.body.style.overflow, 'hidden');

      unlock();
      assert.equal(doc.body.style.overflow, '');
    });
  });

  await challenge('T5.3.7: The dismissal surfaces the modal actually renders', async () => {
    // What a click or an Escape key does is wired by Preact's event system inside
    // the component, and SSR runs no effects — so the handlers themselves are only
    // observable in a browser (docs/live-verification.md). What is checkable here
    // is that the surfaces they attach to exist in the shipped markup and that the
    // backdrop covers the viewport, which is what makes a click outside reach it.
    const modal = await renderComponent('/src/content/ui/Modal.tsx', 'Modal', {
      isOpen: true,
      locale: 'en-US',
      summary: 'Ada · @ada',
      onClose: () => {},
      children: 'card',
    });

    assert.ok(modal.includes('card'), 'the modal dropped its children');
    const backdropIndex = modal.indexOf('post-to-card-backdrop');
    assert.ok(backdropIndex > -1, 'the modal renders no backdrop to click');

    const modalCss = fs.readFileSync(path.resolve(rootDir, 'src/content/styles/modal.css'), 'utf8');
    const backdropRule = modalCss.slice(modalCss.indexOf('#post-to-card-backdrop'));
    const declaration = backdropRule.slice(0, backdropRule.indexOf('}'));
    assert.ok(/position:\s*fixed/.test(declaration), 'the backdrop must be fixed to the viewport');
    assert.ok(/inset:\s*0|top:\s*0/.test(declaration), 'the backdrop must cover the viewport to receive a click');
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

  await challenge('T5.3.9: the built extension carries the _locales tree the manifest points at', () => {
    // Only two of the four build entries copy `public/`: `background` and
    // `content` set `publicDir`, while `popup` and `hook` pass `false`. So
    // `dist/_locales` exists only because one of the first two ran, and a
    // change to that flag would drop every translation from a bundle that still
    // builds, still installs, and simply shows English everywhere. Nothing else
    // in the suite looks inside `dist/` for anything but the scripts.
    const localesDir = path.resolve(rootDir, 'dist/_locales');
    assert.ok(
      fs.existsSync(localesDir),
      'dist/_locales is missing -- a bundle built without public/ cannot localise the manifest'
    );

    const built = fs.readdirSync(localesDir).filter((name) =>
      fs.statSync(path.join(localesDir, name)).isDirectory()
    );
    const shipped = fs.readdirSync(path.resolve(rootDir, 'public/_locales')).filter((name) =>
      fs.statSync(path.resolve(rootDir, 'public/_locales', name)).isDirectory()
    );
    assert.deepEqual(
      built.sort(),
      shipped.sort(),
      'dist/_locales must hold exactly the directories public/_locales does'
    );

    // And every one of them is loadable, with the same messages: a copy that
    // truncated a file would leave Chrome rejecting the install, which reads as
    // "the extension will not load" with no hint where to look. The reference
    // is the default locale by name rather than `shipped[0]`, which would be
    // whatever `readdir` happened to return first on this platform.
    const reference = Object.keys(
      JSON.parse(fs.readFileSync(path.join(localesDir, 'en_US', 'messages.json'), 'utf8'))
    ).sort();
    for (const dir of built) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(localesDir, dir, 'messages.json'), 'utf8')
      ) as Record<string, { message?: string }>;
      assert.deepEqual(
        Object.keys(messages).sort(),
        reference,
        `dist/_locales/${dir}/messages.json declares a different message set`
      );
      for (const key of reference) {
        assert.ok(
          typeof messages[key]?.message === 'string' && messages[key].message!.trim().length > 0,
          `dist/_locales/${dir}/messages.json's ${key} is empty`
        );
      }
    }
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
