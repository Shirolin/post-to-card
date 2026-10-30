/**
 * Tier 4 Test Suite: Real-World Scenarios & End-to-End User Workflows
 *
 * Each workflow runs the shipped chain end to end: recorded fixture markup through
 * the real extractor and the real `resolveThread`, that data through the real
 * `Card`, the images the card paints through the real Base64 bridge, and the blob
 * through the real clipboard-with-fallback decision in `exportBlobWithFallback`.
 *
 * One step is stubbed and it is the same one tier 5 stubs: the rasterizer. Node has
 * no canvas, so `modern-screenshot` is aliased to a recorder (see
 * `tests/env/modern-screenshot-stub.ts`). Everything the claim is actually about —
 * which images exist, whether they were cleaned before rasterizing, and where the
 * blob went — is production code, `renderCardToBlob` included.
 *
 * The previous revision hand-built the card DOM, the config, the blur box, the
 * Escape handler and the clipboard try/catch, then asserted its own scaffolding
 * back. TEST_INFRA.md's zero-tautology rule is why this file is shaped this way.
 */

import assert from 'node:assert/strict';

import { DomDocument, DomElement, DomImageElement, DomShadowRoot, createDomElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { withClipboard } from '../env/clipboard.ts';
import { renderComponent, loadModule, rasterizer, exportEngine, cardRenderer } from '../env/render.ts';
import { createSuite } from '../env/harness.ts';

import { resolveThread } from '../../src/content/adapter/resolver.ts';
import { extractTweetData } from '../../src/content/adapter/extractor.ts';
import { isAllowedHost } from '../../src/background/proxy.ts';
import { DEFAULT_CARD_CONFIG } from '../../src/content/ui/themes.ts';

import { THREAD_HTML } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML } from '../fixtures/quote-tweet.ts';
import { FOUR_PHOTOS_HTML } from '../fixtures/multi-images.ts';

import type { CardConfig } from '../../src/types/card.ts';

const { test, run } = createSuite();

// -------------------------------------------------------------
// Environment
//
// The adapter walks out of the article it is given to find the rest of the
// conversation, so a fixture has to be attached to a live document rather than
// handed over detached -- a detached element resolves as a one-post thread.
// -------------------------------------------------------------

type Listener = (event: { type: string }) => void;

const windowListeners = new Map<string, Set<Listener>>();

const FAKE_WINDOW = {
  location: { origin: 'https://x.com', pathname: '/ada/status/1001' },
  innerWidth: 1200,
  scrollY: 0,
  scrollTo: () => {},
  addEventListener: (type: string, cb: Listener) => {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type)!.add(cb);
  },
  removeEventListener: (type: string, cb: Listener) => {
    windowListeners.get(type)?.delete(cb);
  },
  dispatchEvent: (event: { type: string }) => {
    for (const cb of windowListeners.get(event.type) || []) cb(event);
  },
};

interface Sandbox {
  doc: DomDocument;
  chrome: ReturnType<typeof createChromeMock>;
}

/** Runs `body` with a fresh document, window and background proxy installed. */
async function withSandbox(body: (s: Sandbox) => Promise<void>): Promise<void> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    window: scope.window,
    chrome: scope.chrome,
    // The export engine asks `root instanceof ShadowRoot` to decide where the
    // off-screen copy goes, and `node instanceof HTMLElement` inside its filter.
    // Neither class exists in Node, so both have to be reachable as globals.
    ShadowRoot: scope.ShadowRoot,
    HTMLElement: scope.HTMLElement,
  };

  const doc = new DomDocument();
  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({
        success: true,
        dataUrl: `data:image/jpeg;base64,proxied_${Buffer.from(msg.url).toString('base64')}`,
        contentType: 'image/jpeg',
      });
      return true;
    }
  });

  scope.document = doc;
  scope.window = FAKE_WINDOW;
  scope.chrome = chromeMock;
  scope.ShadowRoot = DomShadowRoot;
  scope.HTMLElement = DomElement;
  windowListeners.clear();

  try {
    await body({ doc, chrome: chromeMock });
  } finally {
    scope.document = saved.document;
    scope.window = saved.window;
    scope.chrome = saved.chrome;
    scope.ShadowRoot = saved.ShadowRoot;
    scope.HTMLElement = saved.HTMLElement;
  }
}

/** Production's default with the theme swapped for the one these workflows are
 * about, and the locale pinned so the copy does not follow the machine. */
const CARD_CONFIG: CardConfig = { ...DEFAULT_CARD_CONFIG, theme: 'darkroom', locale: 'en-US' };

const renderCard = cardRenderer(CARD_CONFIG);

/**
 * The images the extractor produced, as a card element the export can walk.
 *
 * Built through the document and attached to it, because that is the only way a
 * card exists: an element made with a bare constructor has no document, and the
 * engine's clone then rebuilds its images as plain tags with no `src` to read.
 */
function cardElementWithImages(urls: string[]): { card: DomElement; images: DomImageElement[] } {
  const doc = (globalThis as Record<string, unknown>).document as DomDocument;
  const card = doc.createElement('div');
  card.id = 'post-to-card-export-target';
  doc.body.appendChild(card);

  const images = urls.map((url) => {
    const img = doc.createElement('img') as DomImageElement;
    img.src = url;
    card.appendChild(img);
    return img;
  });
  return { card, images };
}

/**
 * Exports the card through the real engine and returns the image sources the
 * rasterizer was actually handed, plus the blob.
 *
 * What matters about the export is not that a picture came out but that the
 * picture was taken from an origin-clean tree: a remote `src` surviving into the
 * rasterizer is what taints the canvas. Reading the recorder is how that is
 * checked without a canvas to check it on.
 */
async function exportCard(
  card: DomElement,
  options: { scale?: number } = {}
): Promise<{ blob: Blob; sources: string[] }> {
  const stub = await rasterizer();
  stub.resetRasterizer();

  const engine = await exportEngine();
  const blob = await engine.renderCardToBlob(card as unknown as HTMLElement, options);
  const target = stub.rasterizerCalls[0]?.target as DomElement | undefined;
  assert.ok(target, 'the export engine never reached the rasterizer');
  const sources = Array.from(target.querySelectorAll<DomImageElement>('img')).map((img) => img.src);
  return { blob, sources };
}

/** Where the blob went, decided by the same copy of the engine that made it. */
async function exportBlob(
  blob: Blob,
  action: 'copy' | 'download',
  filename: string
): Promise<{ success: boolean; method: string; filename: string }> {
  const engine = await exportEngine();
  return engine.exportBlobWithFallback(blob, action, filename);
}

/**
 * Runs `body` with a working clipboard and returns the download anchors left in
 * the document. A download is observed where it happens: as the `<a download>` the
 * fallback path appends and clicks, read back before its cleanup timer fires.
 */
// -------------------------------------------------------------
// Workflow 1: Viral Tweet with 4 photos -> Darkroom -> Clipboard Copy
// -------------------------------------------------------------
test('Tier 4.1: a four-photo tweet extracts, renders, rasterizes clean and reaches the clipboard', async () => {
  await withSandbox(async ({ doc }) => {
    // 1. The timeline renders the post; the extractor reads it.
    const article = createDomElement(FOUR_PHOTOS_HTML);
    doc.body.appendChild(article);

    const thread = resolveThread(article);
    const tweet = thread.tweets[0];
    assert.equal(tweet.media?.length, 4, 'the extractor did not find all four photos');

    // The extractor is what upgrades the asset, so a URL that is not twimg, or not
    // upgraded, is a regression in the chain this workflow is about.
    for (const media of tweet.media!) {
      assert.match(media.url, /^https:\/\/pbs\.twimg\.com\/media\//);
      assert.match(media.url, /name=orig/, `photo was not upgraded: ${media.url}`);
      assert.ok(isAllowedHost(media.url), `the proxy would refuse to fetch ${media.url}`);
    }

    // 2. The card renders those four photos.
    const html = await renderCard({ data: { ...tweet, author: { name: 'Viral Creator', handle: '@creator' } } });
    assert.equal((html.match(/class="media-box"/g) || []).length, 4);
    assert.ok(html.includes('data-theme="darkroom"'));

    // 3. Export: clean the images, rasterize, and copy.
    const { card } = cardElementWithImages(tweet.media!.map((m) => m.url));
    const { blob, sources } = await exportCard(card, { scale: 2 });
    assert.equal(blob.type, 'image/png');
    assert.equal(sources.length, 4, 'the rasterizer was handed a different number of photos');
    for (const src of sources) {
      assert.ok(src.startsWith('data:image/jpeg;base64,proxied_'), `left un-proxied: ${src}`);
    }

    const anchors = await withClipboard('none', async (clipboard) => {
      const result = await exportBlob(blob, 'copy', 'viral.png');
      assert.equal(result.success, true);
      assert.equal(result.method, 'clipboard', 'a working clipboard must be used rather than silently downloaded');
      assert.equal(clipboard.writtenItems.length, 1);
    });
    assert.equal(anchors.length, 0, 'a successful copy must not also trigger a download');
  });
});

// -------------------------------------------------------------
// Workflow 2: Three-post thread with author blur -> clipboard refuses -> download
// -------------------------------------------------------------
test('Tier 4.2: a three-post thread resolves, blurs its author, and falls back to a download', async () => {
  await withSandbox(async ({ doc }) => {
    const feed = createDomElement(THREAD_HTML);
    doc.body.appendChild(feed);

    const articles = feed.querySelectorAll('article[data-testid="tweet"]');
    assert.equal(articles.length, 3, 'the fixture no longer holds three posts');

    const thread = resolveThread(articles[0]);
    assert.equal(thread.tweets.length, 3, 'the thread walker dropped posts');
    assert.equal(thread.isSingle, false);
    assert.equal(thread.tweets[0].diagnostics?.source, 'dom');

    const handles = new Set(thread.tweets.map((t) => t.author.handle));
    assert.equal(handles.size, 1, `the thread merged another author's post: ${[...handles].join(', ')}`);

    // The card blurs every byline it prints, the lead post's and the quote's,
    // and nothing else.
    const html = await renderCard({ data: thread, config: { blurAuthor: true, aspectRatio: '3:4' } });
    const blurred = [...html.matchAll(/class="([^"]*\bis-blurred\b[^"]*)"/g)].map((m) => m[1]);
    assert.ok(blurred.length > 0, 'blurAuthor did not reach the card');
    for (const classes of blurred) {
      assert.ok(
        /^quote-(avatar|name|handle)\b|^author-(header|avatar|avatar-img|name|handle)\b/.test(classes),
        `the privacy blur landed outside an author block: "${classes}"`
      );
    }

    // The clipboard refuses, so the export has to fall back to a download.
    const { card } = cardElementWithImages(['https://pbs.twimg.com/media/thread_a.jpg?name=orig']);
    const { blob } = await exportCard(card, { scale: 2 });

    const anchors = await withClipboard('unfocused', async (clipboard) => {
      const result = await exportBlob(blob, 'copy', 'post-to-card-thread-1001.png');
      assert.equal(result.success, true, 'a refused clipboard is not a failed export');
      assert.equal(result.method, 'download');
      assert.equal(result.filename, 'post-to-card-thread-1001.png');
      assert.equal(clipboard.writtenItems.length, 0);
    });

    assert.equal(anchors.length, 1, 'the card was never actually offered as a download');
    assert.equal(anchors[0].getAttribute('download'), 'post-to-card-thread-1001.png');
  });
});

// -------------------------------------------------------------
// Workflow 3: Quote tweet -> the quote reaches the card -> explicit download
// -------------------------------------------------------------
test('Tier 4.3: a quote tweet extracts its quote and renders it, then downloads on request', async () => {
  await withSandbox(async ({ doc }) => {
    const article = createDomElement(QUOTE_TWEET_HTML);
    doc.body.appendChild(article);

    const tweet = extractTweetData(article);
    assert.ok(tweet.quotePost, 'the quote did not survive extraction');
    assert.equal(tweet.quotePost!.author.handle, '@gkev1n');
    assert.ok(tweet.quotePost!.text.length > 0, 'the quote body is empty');

    const html = await renderCard({ data: { ...tweet, author: { name: 'Ada', handle: '@ada_builds' } } });
    assert.equal((html.match(/class="quote-card"/g) || []).length, 1);
    assert.ok(html.includes(tweet.quotePost!.text.slice(0, 20)), 'the quoted body did not reach the markup');

    // The explicit download action skips the clipboard entirely.
    const { card } = cardElementWithImages(['https://pbs.twimg.com/media/quoted.jpg?name=orig']);
    const { blob } = await exportCard(card, { scale: 3 });

    const anchors = await withClipboard('none', async (clipboard) => {
      const result = await exportBlob(blob, 'download', 'post-to-card-quote.png');
      assert.equal(result.success, true);
      assert.equal(result.method, 'download');
      assert.equal(clipboard.writtenItems.length, 0, 'a download request must not touch the clipboard');
    });

    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].getAttribute('download'), 'post-to-card-quote.png');
  });
});

// -------------------------------------------------------------
// Workflow 3b: What the export draws, and what the preview only shows
//
// The export draws a clone of the card, with computed styles copied onto it --
// so a blurred author is a blurred face in the picture, exactly as on screen.
// What the clone must *not* carry is preview furniture: the ignore attributes
// are what the engine removes before rasterizing, and they sit on the privacy
// mark, never on a node that holds a portrait.
//
// Two failures this pins, both real: a button wrapping a portrait that carried
// `data-html2canvas-ignore` (the face vanished from every export), and an export
// designed to drop hidden authors entirely (a blurred face became a hole while
// the name and handle stayed).
// -------------------------------------------------------------
test('Tier 4.12: the export keeps both portraits, the hidden one still blurred, and drops preview furniture', async () => {
  await withSandbox(async ({ doc }) => {
    const ANY = globalThis as Record<string, any>;
    const savedCustomElements = ANY.customElements;
    ANY.customElements = doc.customElements;

    let exported = false;
    const { openCardModal, closeCardModal } = await loadModule('/src/content/container/element.ts');
    let cardEl: DomElement | null = null;
    try {
      openCardModal(
        {
          author: { name: 'outer author', handle: '@outer' },
          isSingle: true,
          targetTweetIndex: 0,
          tweets: [{
            id: '95001',
            url: 'https://x.com/outer/status/95001',
            author: { name: 'outer author', handle: '@outer' },
            text: 'outer',
            // One photo, so the card carries the engine's other preview-only
            // node too: the waiting block over the picture's cell.
            media: [{ type: 'image', url: 'https://pbs.twimg.com/media/pic.jpg' }],
            quotePost: { author: { name: 'quoted author', handle: '@quoted' }, text: 'quoted' },
          }],
        },
        async () => {
          exported = true;
          return { success: true, method: 'download', filename: 'x.png' } as any;
        }
      );
      await new Promise((resolve) => setTimeout(resolve, 150));

      const shadow = (doc.querySelector('post-to-card-container') as any).shadow as any;
      // The switch ships off, so hiding this post's author is the click's work.
      (shadow.querySelector('.author-avatar') as any).click();
      await new Promise((resolve) => setTimeout(resolve, 40));

      cardEl = shadow.querySelector('#post-to-card-export-target') as DomElement;
      (shadow.querySelector('.export-actions .btn-secondary') as any).click();
      for (let i = 0; i < 40 && !exported; i++) await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      closeCardModal();
      ANY.customElements = savedCustomElements;
    }

    assert.ok(exported, 'the panel never asked for an export');
    assert.ok(cardEl, 'the mounted card was never found');

    // The card the picture is drawn from says: one author hidden, one shown.
    const blurredPortraits = (root: DomElement) =>
      [...root.querySelectorAll('.author-avatar-img'), ...root.querySelectorAll('.quote-avatar')]
        .filter((node) => (node.getAttribute('class') || '').split(' ').includes('is-blurred'));
    assert.equal(blurredPortraits(cardEl).length, 1, 'the card hides exactly one of the two authors');
    assert.equal(cardEl.querySelectorAll('.author-avatar-img').length, 1);
    assert.equal(cardEl.querySelectorAll('.quote-avatar').length, 1);

    const stub = await rasterizer();
    stub.resetRasterizer();
    const engine = await exportEngine();
    await engine.renderCardToBlob(cardEl as unknown as HTMLElement, { scale: 2 });

    const target = stub.rasterizerCalls[0]?.target as DomElement | undefined;
    assert.ok(target, 'the export engine never reached the rasterizer');

    // Both faces are in the picture. This is the failure the ignore attribute on
    // the quoted author's button caused: its portrait went with the button.
    assert.equal(target.querySelectorAll('.author-avatar-img').length, 1,
      'the post\'s own author is drawn');
    assert.equal(target.querySelectorAll('.quote-avatar').length, 1,
      'and so is the quoted author\'s');
    // The hidden one is drawn blurred rather than left out: the clone carries the
    // class, and the rasterizer copies `filter` from the computed style.
    assert.equal(blurredPortraits(target).length, 1,
      'the hidden author is a blurred face in the picture, not a hole');
    // Preview-only furniture is still removed. The card's media placeholder is
    // the one on this card: the engine drops every ignored node from the clone.
    assert.equal(target.querySelectorAll('.media-picture').length, 1,
      'the photo is part of the picture');
    assert.equal(target.querySelectorAll('.media-placeholder').length, 0,
      'while the waiting block around it is preview-only and never drawn');
    const ignored = [...target.querySelectorAll('span'), ...target.querySelectorAll('div')]
      .filter((node) => node.getAttribute('data-html2canvas-ignore') !== null ||
        node.getAttribute('data-export-ignore') !== null);
    assert.equal(ignored.length, 0, 'no ignored node survives into the clone');
    // The buttons themselves stay, because they are what holds the portraits.
    const toggles = target.querySelectorAll('.author-privacy-toggle');
    assert.equal(toggles.length, 2, 'both avatar switches survive into the clone');
    assert.equal(
      toggles.filter((button) => button.querySelector('img') !== null).length,
      2,
      'and each still holds its portrait'
    );
  });
});

// -------------------------------------------------------------
// Workflow 4: SPA navigation away, and the scroll lock given back
// -------------------------------------------------------------
test('Tier 4.4: the scroll lock is reentrant, restores what it found, and a closed modal renders nothing', async () => {
  const modal = await loadModule('/src/content/ui/Modal.tsx');
  const lockScroll = modal.lockScroll as () => void;
  const unlockScroll = modal.unlockScroll as () => void;
  assert.equal(typeof lockScroll, 'function');
  assert.equal(typeof unlockScroll, 'function');

  await withSandbox(async ({ doc }) => {
    // A host page that already had its own overflow set: unlocking must put that
    // back, not blank it.
    doc.documentElement.style.overflow = 'scroll';
    doc.body.style.overflow = 'auto';
    doc.body.style.paddingRight = '4px';

    lockScroll();
    assert.equal(doc.documentElement.style.overflow, 'hidden', 'the scrolling element is documentElement on an X page');
    assert.equal(doc.body.style.overflow, 'hidden');

    // A second modal opening while the first is still up must not unlock early.
    lockScroll();
    unlockScroll();
    assert.equal(doc.body.style.overflow, 'hidden', 'the lock released while a modal was still open');

    unlockScroll();
    assert.equal(doc.documentElement.style.overflow, 'scroll', 'the host page lost its own overflow');
    assert.equal(doc.body.style.overflow, 'auto');
    assert.equal(doc.body.style.paddingRight, '4px');

    // An over-unlock must not corrupt the next lock.
    unlockScroll();
    lockScroll();
    assert.equal(doc.body.style.overflow, 'hidden');
    unlockScroll();

    const closed = await renderComponent('/src/content/ui/Modal.tsx', 'Modal', {
      isOpen: false,
      locale: 'en-US',
      summary: 'x',
      onClose: () => {},
      children: null,
    });
    assert.equal(closed, '', 'a closed modal must render nothing');

    const open = await renderComponent('/src/content/ui/Modal.tsx', 'Modal', {
      isOpen: true,
      locale: 'en-US',
      summary: 'Ada · @ada',
      onClose: () => {},
      children: 'card',
    });
    assert.ok(open.includes('card'), 'the open modal dropped its children');
    assert.ok(open.length > 0);
  });
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 4
// -------------------------------------------------------------
export function runTier4() {
  return run();
}
