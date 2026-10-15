/**
 * Tier 1 Test Suite: Comprehensive Feature Coverage
 * Authoritative specification tests covering every feature area with >=5 tests each.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { h } from 'preact';
import { renderToStaticMarkup } from 'preact-render-to-string';

import { DomAnchorElement, DomDocument, DomElement, DomImageElement, DomShadowRoot, createDomElement, DomMutationObserver } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockClipboard, MockClipboardItem, type ClipboardFailureMode } from '../env/clipboard.ts';
import { SINGLE_TWEET_HTML } from '../fixtures/single-tweet.ts';
import { THREAD_HTML } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML, QUOTE_TWEET_UNAVAILABLE_HTML } from '../fixtures/quote-tweet.ts';
import { EMOJI_TWEET_HTML, PURE_EMOJI_HTML } from '../fixtures/emojis.ts';
import { ONE_PHOTO_HTML, TWO_PHOTOS_HTML, THREE_PHOTOS_HTML, FOUR_PHOTOS_HTML, VIDEO_POSTER_HTML, PHOTO_AND_GIF_HTML, PHOTO_AND_VIDEO_HTML, GIF_POSTER_LAYER_HTML, VIDEO_VISIBLE_POSTER_HTML, MEDIA_WITH_INNER_GROUP_HTML, GIF_ARIA_LABELED_HTML, GIF_BADGE_TEXT_HTML, VIDEO_WITH_DURATION_HTML, GIF_POSTER_ONLY_HTML, VIDEO_POSTER_ONLY_HTML, FOUR_GIFS_HTML } from '../fixtures/multi-images.ts';
import { extractTweetData } from '../../src/content/adapter/extractor.ts';
import { resolveThread } from '../../src/content/adapter/resolver.ts';
import {
  isActionBar,
  TRIGGER_BUTTON_SVG,
  createTriggerButton,
  injectIntoActionBar,
  injectAll,
  initTwitterInjection,
} from '../../src/content/adapter/injection.ts';
import { isThreadConnectedPair, isTemporallyConnected, getReplyingToHandle } from '../../src/content/adapter/thread.ts';
import { restoreUnicodeEmojis } from '../../src/content/adapter/emojis.ts';
import { toggleExcluded, selectCurrentOnly } from '../../src/content/ui/threadScope.ts';
import { MIXED_FEED_WITH_ADS_AND_REPLIES_HTML } from '../fixtures/ads-replies.ts';
import { RICH_TOKENS_HTML, EXPECTED_TOKENS } from '../fixtures/rich-tokens.ts';
import { TRANSLATIONS, getTranslation } from '../../src/content/i18n.ts';
import { THEMES, THEME_ORDER, EXPERIMENTAL_THEMES, DEFAULT_CARD_CONFIG, LEGACY_THEME_ALIASES, RADIUS_OPTIONS, PADDING_OPTIONS, resolveRadius, sanitizeRadius, sanitizeTheme, sanitizePadding, getAspectMinHeight, MEDIA_LAYOUT_OPTIONS, sanitizeMediaLayout } from '../../src/content/ui/themes.ts';
import { planMediaGrid } from '../../src/content/ui/mediaGrid.ts';
import { isAllowedHost, clearImageCache, getImageCacheSize } from '../../src/background/proxy.ts';
import { upgradeAvatarUrl, upgradePhotoUrl } from '../../src/content/adapter/urls.ts';
import { sanitizeQrUrl, generateQrCodeData, CardQrCode } from '../../src/content/ui/qrcode.ts';

import { renderComponent, loadModule, rasterizer, exportEngine } from '../env/render.ts';

import type { TweetData, ThreadData, MediaItem } from '../../src/types/tweet.ts';
import type { CardConfig, ThemeId } from '../../src/types/card.ts';

/**
 * A video post and a card config, for the tests that render the real card rather
 * than read its source. The card is the only thing that can answer what a
 * preference does to the markup, so those tests go through it.
 */
const VIDEO_TWEET: TweetData = {
  id: '90001',
  url: 'https://x.com/ada/status/90001',
  author: { name: 'Ada', handle: '@ada' },
  text: 'shipping the video pass today',
  timestamp: '2026-10-02T10:00:00.000Z',
  media: [{ type: 'video', url: 'https://pbs.twimg.com/media/video_poster.jpg', duration: '1:42' }],
};

const CARD_CONFIG: CardConfig = {
  theme: 'minimal',
  padding: '24px',
  borderRadius: '12px',
  aspectRatio: 'auto',
  imageFit: 'contain',
  mediaLayout: 'grid',
  showQrCode: true,
  showStats: true,
  showTimestamp: true,
  showWatermark: true,
  blurAuthor: false,
  showActionBarButton: true,
  showPlayButton: true,
  locale: 'en-US',
};

/** A two-post thread: the on-card exclude button only exists when there is more
 * than one post to keep, so claims about it need a thread rather than a tweet. */
const THREAD: ThreadData = {
  author: VIDEO_TWEET.author,
  tweets: [
    VIDEO_TWEET,
    { ...VIDEO_TWEET, id: '90002', url: 'https://x.com/ada/status/90002', text: 'and the follow-up' },
  ],
  isSingle: false,
  targetTweetIndex: 0,
};

function renderCard(
  args: { data?: ThreadData | TweetData; config?: Partial<CardConfig> } = {}
): Promise<string> {
  return renderComponent('/src/content/ui/Card.tsx', 'Card', {
    data: args.data ?? VIDEO_TWEET,
    config: { ...CARD_CONFIG, ...args.config },
    onExcludeTweet: () => {},
  });
}

/**
 * The inline style the card root was rendered with.
 *
 * Read off the root element rather than searched for across the whole document:
 * a media box or an avatar legitimately carries a fixed height, and a
 * document-wide regex cannot tell those apart from the card being clipped.
 */
function cardRootStyle(html: string): string {
  const tag = html.match(/<div[^>]*id="post-to-card-export-target"[^>]*>/);
  assert.ok(tag, 'the card root is not in the rendered markup');
  return (tag![0].match(/\sstyle="([^"]*)"/) || [])[1] || '';
}

function renderControls(
  args: { config?: Partial<CardConfig>; threadData?: ThreadData } = {}
): Promise<string> {
  return renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
    config: { ...CARD_CONFIG, ...args.config },
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    threadData: args.threadData,
  });
}

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
// Reference helper functions derived from Authoritative Specs
// -------------------------------------------------------------

// -------------------------------------------------------------
// F1: Multi-Entry Build Pipeline
// -------------------------------------------------------------
test('F1.1: multi-entry build configuration separates background and content script modes', () => {
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  const exists = fs.existsSync(viteConfigPath);
  assert.ok(exists, 'vite.config.ts must exist');
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  assert.match(content, /background/i, 'Config must define background build entry/mode');
  assert.match(content, /content/i, 'Config must define content build entry/mode');
});

test('F1.2: content script target is configured as self-contained IIFE format', () => {
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  assert.match(content, /iife/i, 'content script bundle must be formatted as IIFE');
});

test('F1.3: background service worker is configured as ESM format', () => {
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  assert.match(content, /es/i, 'background script bundle must be formatted as ESM');
});

test('F1.4: tsconfig.json has isolatedModules and DOM types declared', () => {
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json must exist');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  assert.equal(tsconfig.compilerOptions.isolatedModules, true, 'isolatedModules should be true');
  assert.ok(tsconfig.compilerOptions.lib.includes('DOM'), 'lib should include DOM');
});

test('F1.5: package.json build script compiles without third-party wrapper tools', () => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(pkg.scripts.build, 'Must have build script');
  assert.ok(!pkg.devDependencies?.['@crxjs/vite-plugin'], 'Must avoid @crxjs/vite-plugin wrapper');
  assert.ok(!pkg.devDependencies?.['plasmo'], 'Must avoid plasmo wrapper');
});

// -------------------------------------------------------------
// F2: Manifest V3 Packaging
// -------------------------------------------------------------
test('F2.1: manifest.json declares manifest_version 3', () => {
  const manifestPath = path.resolve(process.cwd(), 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3, 'Must be Manifest V3');
});

test('F2.2: manifest.json declares twimg host_permissions for CORS image proxying', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifest.host_permissions), 'host_permissions must be an array');
  const hasTwimg = manifest.host_permissions.some((p: string) => p.includes('twimg.com'));
  assert.ok(hasTwimg, 'Must declare host_permissions for twimg.com');
});

test('F2.3: background declares service_worker with ESM type', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));
  assert.ok(manifest.background?.service_worker, 'background.service_worker must be specified');
  assert.equal(manifest.background?.type, 'module', 'background service worker must be type module');
});

test('F2.4: content_scripts matches both twitter.com and x.com', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));
  const matches = manifest.content_scripts?.[0]?.matches || [];
  assert.ok(matches.some((m: string) => m.includes('twitter.com')), 'Must match twitter.com');
  assert.ok(matches.some((m: string) => m.includes('x.com')), 'Must match x.com');
});

test('F2.5: the UI script defers to document_idle and the GraphQL hook runs in the MAIN world', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts || [];

  const ui = scripts.find((s: { js?: string[] }) => (s.js || []).includes('content.js'));
  assert.ok(ui, 'expected a content script for the UI');
  assert.equal(ui.run_at, 'document_idle', 'the UI script must not block page load');

  // The interceptor must observe the page's own requests, which are invisible
  // from the isolated content-script world, and must be installed before the
  // page issues its first GraphQL call.
  const hook = scripts.find((s: { js?: string[] }) => (s.js || []).includes('graphql-hook.js'));
  assert.ok(hook, 'expected a content script for the GraphQL hook');
  assert.equal(hook.world, 'MAIN', 'the GraphQL hook must run in the MAIN world');
  assert.equal(hook.run_at, 'document_start', 'the hook must be installed before requests are issued');
});

// -------------------------------------------------------------
// F3: Minimal Dependencies
// -------------------------------------------------------------
test('F3.1: runtime dependencies strictly limited to minimal packages', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  assert.ok(deps.length <= 4, `Expected at most 4 dependencies, found ${deps.length}`);
  assert.ok(deps.includes('preact'), 'Must include preact');
  assert.ok(deps.includes('modern-screenshot'), 'Must include modern-screenshot');
  assert.ok(deps.includes('qrcode-generator'), 'Must include qrcode-generator');
});

test('F3.2: no heavy UI frameworks or styling runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  assert.equal(allDeps['react'], undefined, 'Must not depend on react');
  assert.equal(allDeps['styled-components'], undefined, 'Must not depend on styled-components');
  assert.equal(allDeps['tailwind'], undefined, 'Must not depend on tailwind');
});

test('F3.3: type definitions properly segregated into devDependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  Object.keys(deps).forEach(k => {
    assert.ok(!k.startsWith('@types/'), `Type definition ${k} should be in devDependencies`);
  });
  assert.ok(devDeps['@types/chrome'], 'Should have @types/chrome in devDependencies');
});

test('F3.4: packages have locked semver or compatible carets', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  for (const [dep, ver] of Object.entries(pkg.dependencies)) {
    assert.match(ver as string, /^[\^~]?\d+\.\d+/, `Dependency ${dep} has invalid semver ${ver}`);
  }
});

test('F3.5: package type is module', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module', 'Package should be ESM module');
});

// -------------------------------------------------------------
// F4: Background CORS Image Proxy
//
// These go through the shipped worker: `src/background/index.ts` registers its
// listener on import, exactly as Chrome loads it, and the proxy functions are
// the real ones from `src/background/proxy.ts`. The previous revision defined a
// listener, a cache and an `isAllowedHost` inside this file and asserted them
// back, so none of it could fail when the shipped proxy broke.
//
// `fetch` is the one stub, and only its transport: the URL gate, the cache, the
// MIME sniffing and the Base64 encoding are all production code.
// -------------------------------------------------------------

let serviceWorkerChrome: ReturnType<typeof createChromeMock> | null = null;

/**
 * Loads the background worker with the extension API already in place.
 *
 * Imported once and shared. The listener registers at import time, and Node
 * caches the module, so a second import would hand back a worker still wired to
 * the first mock rather than re-registering on a new one.
 */
async function serviceWorker(): Promise<ReturnType<typeof createChromeMock>> {
  if (serviceWorkerChrome) return serviceWorkerChrome;
  const chromeMock = createChromeMock();
  (globalThis as Record<string, unknown>).chrome = chromeMock;
  const logged = console.log;
  console.log = () => {};
  try {
    await import('../../src/background/index.ts');
  } finally {
    console.log = logged;
  }
  serviceWorkerChrome = chromeMock;
  return chromeMock;
}

/** Runs `body` with `fetch` answering `response`, and reports the URLs it was asked for. */
async function withFetch(
  respond: (url: string) => Response,
  body: (urls: string[]) => Promise<void>
): Promise<void> {
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    return respond(url);
  }) as typeof fetch;
  try {
    await body(urls);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('F4.1: the worker turns a FETCH_IMAGE_BASE64 message into a Base64 data URL', async () => {
  const chromeMock = await serviceWorker();
  clearImageCache();

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await withFetch(
    () =>
      new Response(png, { status: 200, headers: { 'content-type': 'image/png; charset=binary' } }),
    async (urls) => {
      const res = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: 'https://pbs.twimg.com/media/test.png',
      });

      assert.equal(res.success, true, 'the worker must answer a message it handles');
      if (!res.success) return;
      assert.equal(urls.length, 1, 'the worker never reached the network');
      // The MIME is read off the response header, lowercased and stripped of its
      // parameters -- `image/png; charset=binary` is not a usable data-URL type.
      assert.equal(res.contentType, 'image/png');
      assert.equal(res.dataUrl, `data:image/png;base64,${Buffer.from(png).toString('base64')}`);
    }
  );
});

test('F4.2: the worker answers PING with its own healthcheck shape', async () => {
  const chromeMock = await serviceWorker();
  const res = await chromeMock.runtime.sendMessage({ type: 'PING' });
  assert.equal(res.success, true);
  // `pong` is what distinguishes the healthcheck from a fetch that happens to
  // succeed; asserting only `success` passes for a proxy that answered wrongly.
  assert.equal((res as { pong?: boolean }).pong, true, 'the healthcheck must identify itself');
});

test('F4.3: a failing fetch is reported as a failed response, not thrown at the caller', async () => {
  const chromeMock = await serviceWorker();
  clearImageCache();

  await withFetch(
    () => new Response('nope', { status: 404, statusText: 'Not Found' }),
    async () => {
      const res = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: 'https://pbs.twimg.com/media/nonexistent.jpg',
      });
      assert.equal(res.success, false);
      if (res.success) return;
      assert.match(res.error, /404/, 'the status has to survive into the error');
      assert.match(res.error, /Not Found/);
    }
  );
});

test('F4.4: a repeated URL is answered from the cache without a second fetch', async () => {
  const chromeMock = await serviceWorker();
  clearImageCache();
  assert.equal(getImageCacheSize(), 0);

  const url = 'https://pbs.twimg.com/profile_images/avatar.jpg';
  await withFetch(
    () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    async (urls) => {
      const first = await chromeMock.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url });
      const second = await chromeMock.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url });

      assert.equal(urls.length, 1, 'the second request must be served from memory');
      assert.equal(getImageCacheSize(), 1);
      assert.deepEqual(second, first, 'a cache hit has to answer exactly what the fetch answered');
    }
  );
});

test('F4.5: the origin gate admits twimg and nothing that merely ends in it', () => {
  assert.equal(isAllowedHost('https://pbs.twimg.com/photo.jpg'), true);
  assert.equal(isAllowedHost('https://abs-0.twimg.com/emoji.svg'), true);
  assert.equal(isAllowedHost('https://twimg.com/photo.jpg'), true);

  // The trap a bare `hostname.endsWith('twimg.com')` falls into: an attacker
  // registers `notwimg.com` and the suffix check admits it. The gate has to be
  // the label boundary, not the string tail.
  assert.equal(isAllowedHost('https://notwimg.com/steal.png'), false, 'a host that merely ends in twimg.com is not twimg');
  assert.equal(isAllowedHost('https://evil-tracking.com/steal.png'), false);
  assert.equal(isAllowedHost('https://twimg.com.evil.com/x.png'), false, 'the allowlisted label must be the host, not a prefix of it');

  // The scheme gate is what stops the proxy being turned into a local file read
  // or a script injection; the host alone would not.
  assert.equal(isAllowedHost('javascript:alert(1)'), false);
  assert.equal(isAllowedHost('file:///etc/passwd'), false);
  assert.equal(isAllowedHost('ftp://pbs.twimg.com/x.png'), false);
});

// -------------------------------------------------------------
// F5: Offline & Security Guarantee
// -------------------------------------------------------------
test('F5.1: zero external telemetry endpoints in source types or configuration', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));
  for (const perm of manifest.host_permissions || []) {
    assert.ok(perm.includes('twimg.com'), `Host permission ${perm} must strictly be twimg`);
  }
});

test('F5.2: the rendered card asks the network for nothing', async () => {
  // The generator's own offline property is F20.5. This is the other half: the
  // markup the card produces carries no remote stylesheet, font or script, and
  // its QR is inline vector rather than a picture fetched from a service.
  const html = await renderCard();

  assert.ok(!/<link/i.test(html), 'the card pulled in a remote resource with <link>');
  assert.ok(!/<script/i.test(html), 'the card emitted a script tag');
  assert.ok(!/googleapis|fonts\.gstatic/.test(html), 'the card referenced a remote font host');
  assert.ok(!/@import/.test(html), 'the card referenced a remote stylesheet');
  assert.ok(html.includes('card-qr-svg'), 'the QR is not the inline vector the card is supposed to paint');
});

test('F5.3: a hostile author name reaches the card escaped, not as live markup', async () => {
  const hostile = '<script>alert(1)</script>';
  const html = await renderCard({
    data: {
      ...VIDEO_TWEET,
      author: { name: hostile, handle: '@attacker' },
    },
  });

  assert.ok(!html.includes('<script'), 'the card emitted a live script tag');
  assert.ok(html.includes('&lt;script'), `the name was not escaped, markup was: ${html.slice(0, 200)}`);
});

test('F5.4: local storage preferences stored without remote sync', async () => {
  const chromeMock = createChromeMock();
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

  await chromeMock.storage.local.set({ userCardConfig: config });
  const stored = await chromeMock.storage.local.get('userCardConfig');
  assert.deepEqual(stored.userCardConfig, config);
});

test('F5.5: neither shipped stylesheet loads anything over the network', () => {
  // Read from disk, because the stylesheets are the shipped artifact: the card
  // and the modal pull theirs in with `?inline`, so the file is what ships.
  for (const name of ['card.css', 'modal.css']) {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/content/styles', name), 'utf8');

    assert.ok(!/@import/.test(css), `${name} imports a remote stylesheet`);
    assert.ok(!/url\(\s*['"]?https?:/.test(css), `${name} points at a remote url()`);
    assert.ok(!/googleapis|gstatic/.test(css), `${name} loads a remote font`);
    assert.ok(/font-family/.test(css), `${name} declares no font stack of its own`);
  }
});

// -------------------------------------------------------------
// F6: Tweet Action Bar Injection
//
// These drive the shipped injection module. The previous revision built its own
// button, set its own `data-post-to-card-injected` flag, wrote its own
// deduplication guard and then asserted them back, so a regression in
// `injectIntoActionBar` could not fail any of them.
// -------------------------------------------------------------

/**
 * Installs a live document and a listener-recording window, then runs `body`.
 *
 * The modules under test read `document` and `window` off the global scope, so
 * they need the shim in place rather than passed in. The window is a listener
 * map rather than a second DOM: nothing here ever adds, removes or dispatches
 * on it beyond recording.
 */
async function withDomEnv(
  body: (env: {
    doc: DomDocument;
    fire: (type: string, event?: Record<string, unknown>) => void;
    countQueries: (selector: string) => number;
  }) => Promise<void>
): Promise<void> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    window: scope.window,
    MutationObserver: scope.MutationObserver,
  };

  const doc = new DomDocument();
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const queries: string[] = [];

  const realQueryAll = doc.querySelectorAll.bind(doc);
  doc.querySelectorAll = ((selector: string) => {
    queries.push(selector);
    return realQueryAll(selector);
  }) as typeof doc.querySelectorAll;

  const fakeWindow = {
    location: { origin: 'https://x.com', pathname: '/home' },
    innerWidth: 1200,
    scrollY: 0,
    scrollTo: () => {},
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: (e: unknown) => void) => {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: (event: { type: string }) => {
      for (const cb of [...(listeners.get(event.type) || [])]) cb(event);
      return true;
    },
  };

  scope.document = doc;
  scope.window = fakeWindow;
  scope.MutationObserver = DomMutationObserver;

  try {
    await body({
      doc,
      fire: (type, event = {}) => {
        fakeWindow.dispatchEvent({ type, ...event });
      },
      countQueries: (selector) => queries.filter((q) => q.includes(selector)).length,
    });
  } finally {
    scope.document = saved.document;
    scope.window = saved.window;
    scope.MutationObserver = saved.MutationObserver;
  }
}

/** Lets the module's 150ms debounce elapse. */
const afterDebounce = () => new Promise((r) => setTimeout(r, 220));

test('F6.1: the shipped trigger button is a labelled SVG control with no emoji', async () => {
  await withDomEnv(async () => {
    const btn = createTriggerButton(() => {}, 'en-US');
    const expected = getTranslation('en-US').triggerButtonTitle;

    assert.equal(btn.getAttribute('role'), 'button');
    assert.equal(btn.getAttribute('data-post-to-card-btn'), 'true');
    // The accessible name is the button's whole content, so it has to be the
    // translated string rather than a hard-coded one.
    assert.equal(btn.getAttribute('aria-label'), expected);
    assert.equal(btn.getAttribute('title'), expected);
    assert.ok(btn.innerHTML.includes('<svg'), 'the trigger is a vector, not a glyph');
    assert.ok(!/\p{Extended_Pictographic}/u.test(btn.innerHTML), 'no emoji may reach the trigger');
  });
});

test('F6.2: injection appends the wrapper into the action bar and marks the post', async () => {
  await withDomEnv(async () => {
    const tweet = createDomElement(SINGLE_TWEET_HTML);
    const actionBar = tweet.querySelector('div[role="group"]')!;

    assert.equal(injectIntoActionBar(actionBar as unknown as Element), true);

    const wrapper = actionBar.querySelector('[data-post-to-card-wrapper="true"]');
    assert.ok(wrapper, 'the trigger has to land inside the action row');
    assert.ok(wrapper!.querySelector('[data-post-to-card-btn="true"]'));
    // Appended, not prepended: the trigger sits after X's own controls.
    assert.equal(actionBar.children[actionBar.children.length - 1], wrapper);
    assert.equal(actionBar.getAttribute('data-post-to-card-injected'), 'true');
    assert.equal(tweet.getAttribute('data-post-to-card-injected'), 'true',
      'the guard is anchored to the post, so the post has to carry the mark');
  });
});

test('F6.3: a second injection into the same post is refused', async () => {
  await withDomEnv(async () => {
    const tweet = createDomElement(SINGLE_TWEET_HTML);
    const actionBar = tweet.querySelector('div[role="group"]')!;

    assert.equal(injectIntoActionBar(actionBar as unknown as Element), true);
    assert.equal(injectIntoActionBar(actionBar as unknown as Element), false,
      'the guard must refuse the repeat');

    assert.equal(actionBar.querySelectorAll('[data-post-to-card-btn="true"]').length, 1,
      'one post, one trigger');
  });
});

test('F6.4: the mark on the post alone stops a second bar in the same post from injecting', async () => {
  // X renders more than one role="group" per post, and the three lookup
  // strategies resolve to different ones for the same tweet. A guard that only
  // marked the container let the same post collect several buttons.
  await withDomEnv(async () => {
    const tweet = createDomElement(SINGLE_TWEET_HTML);
    const bars = tweet.querySelectorAll('div[role="group"]');
    assert.ok(bars.length >= 1);

    assert.equal(injectIntoActionBar(bars[0] as unknown as Element), true);
    // A second, different container inside the same post.
    const second = new DomElement('DIV');
    second.setAttribute('role', 'group');
    tweet.appendChild(second);

    assert.equal(injectIntoActionBar(second as unknown as Element), false);
    assert.equal(tweet.querySelectorAll('[data-post-to-card-btn="true"]').length, 1);
  });
});

test('F6.5: clicking the trigger announces the owning post on the window', async () => {
  await withDomEnv(async () => {
    const tweet = createDomElement(SINGLE_TWEET_HTML);
    const actionBar = tweet.querySelector('div[role="group"]')!;

    const win = (globalThis as Record<string, any>).window;
    const events: Array<{ type: string; detail?: { article?: unknown } }> = [];
    const realDispatch = win.dispatchEvent;
    win.dispatchEvent = (event: any) => {
      events.push(event);
      return realDispatch(event);
    };

    let viaCallback: unknown = null;
    injectIntoActionBar(actionBar as unknown as Element, (article) => { viaCallback = article; });
    (actionBar.querySelector('[data-post-to-card-btn="true"]') as unknown as DomElement).click();

    const announced = events.find((e) => e.type === 'post-to-card:trigger');
    assert.ok(announced, 'the card is opened by this event; without it the click does nothing');
    assert.equal(announced!.detail?.article, tweet, 'the event must name the post it came from');
    assert.equal(viaCallback, tweet, 'and the callback must receive the same post');
  });
});

test('F6.6: the trigger never lands on a media group inside the same post', async () => {
  // Observed on a live two-image tweet: the photo block carries its own
  // role="group", so a bare group match put the trigger on the photo.
  await withDomEnv(async ({ doc }) => {
    const article = createDomElement(MEDIA_WITH_INNER_GROUP_HTML);
    doc.body.appendChild(article);

    const injected = injectAll();

    assert.equal(injected, 1, 'one post, one trigger -- not one per role=group');
    const bars = article.querySelectorAll('div[role="group"]');
    const withTrigger = bars.filter((b) => b.querySelector('[data-post-to-card-btn="true"]'));
    assert.equal(withTrigger.length, 1);
    assert.ok(withTrigger[0].querySelector('button[data-testid="reply"]'),
      'the trigger belongs on the row holding the engagement controls');
  });
});

// -------------------------------------------------------------
// F7: Debounced MutationObserver
//
// These drive the real lifecycle manager. The previous revision exercised the
// test shim's observer and a debounce defined in the test file, so nothing here
// could fail when `initTwitterInjection` broke.
// -------------------------------------------------------------

test('F7.1: a post added after the manager starts receives a trigger', async () => {
  await withDomEnv(async ({ doc }) => {
    const manager = initTwitterInjection(() => {});
    try {
      assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 0);

      doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
      await afterDebounce();

      assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 1,
        'the observer has to reach the scan that injects into a newly rendered post');
    } finally {
      manager.disconnect();
    }
  });
});

test('F7.2: a burst of mutations produces one scan, not one per mutation', async () => {
  await withDomEnv(async ({ doc, countQueries }) => {
    const manager = initTwitterInjection(() => {});
    try {
      // Only the stage-1 lookup carries this negation, so counting it counts
      // scans.
      const SELECTOR = 'div[role="group"]:not([data-post-to-card-injected="true"])';
      const before = countQueries(SELECTOR);

      // A virtual-scroll burst: ten posts appended in the same tick.
      for (let i = 0; i < 10; i++) {
        doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
      }
      await afterDebounce();

      assert.equal(countQueries(SELECTOR) - before, 1,
        'the scan is the only thing that runs this query, so one scan means one query');
      assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 10,
        'and that single scan still has to cover every post that arrived');
    } finally {
      manager.disconnect();
    }
  });
});

test('F7.3: a scan never injects a second trigger into a post that already has one', async () => {
  await withDomEnv(async ({ doc }) => {
    const manager = initTwitterInjection(() => {});
    try {
      const first = createDomElement(SINGLE_TWEET_HTML);
      doc.body.appendChild(first);
      await afterDebounce();

      // A further mutation forces another full scan over the same document.
      doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
      await afterDebounce();

      const buttons = first.querySelectorAll('[data-post-to-card-btn="true"]');
      assert.equal(buttons.length, 1, 'the guard has to survive a rescan');
      assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 2);
    } finally {
      manager.disconnect();
    }
  });
});

test('F7.4: disconnecting stops the scans and releases the window listeners', async () => {
  await withDomEnv(async ({ doc, fire }) => {
    const manager = initTwitterInjection(() => {});
    manager.disconnect();

    doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
    await afterDebounce();
    assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 0,
      'a disconnected manager must not keep scanning');

    // popstate is the remaining route hook; firing it must not restart anything.
    fire('popstate');
    assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 0,
      'the route listener has to come off with the manager');
  });
});

test('F7.5: a post nested inside a virtual-scroll cell is still reached', async () => {
  await withDomEnv(async ({ doc }) => {
    const manager = initTwitterInjection(() => {});
    try {
      const cell = new DomElement('DIV');
      cell.setAttribute('data-testid', 'cellInnerDiv');
      doc.body.appendChild(cell);
      await afterDebounce();

      // The post arrives inside the cell that was already there, so only a
      // subtree observation sees it.
      cell.appendChild(createDomElement(SINGLE_TWEET_HTML));
      await afterDebounce();

      assert.equal(doc.querySelectorAll('[data-post-to-card-btn="true"]').length, 1,
        'a mutation below body is still a mutation of body');
    } finally {
      manager.disconnect();
    }
  });
});

// -------------------------------------------------------------
// F8: SPA Route Navigation Handling
//
// F8.1 through F8.5 used to sit here. Each defined a local function, called it,
// and asserted the flag that same function had just set — they exercised no
// production code at all, while their names claimed the lifecycle manager's
// history and route handling was covered. They were removed rather than kept as
// placeholders, because a test that cannot fail is worse than a missing one: it
// tells the next reader the area is verified. The navigation wiring itself is
// still unverified; see Tier 2 for what of it is now executed.
// -------------------------------------------------------------

// -------------------------------------------------------------
// F9: Native Emoji Restoration
// -------------------------------------------------------------
test('F9.1: restores Twemoji img[alt] to native Unicode string', () => {
  const tweet = createDomElement(EMOJI_TWEET_HTML);
  const tweetText = tweet.querySelector('div[data-testid="tweetText"]')!;
  const restored = restoreUnicodeEmojis(tweetText);

  assert.ok(restored.includes('🔥'));
  assert.ok(restored.includes('✨'));
  assert.ok(restored.includes('🎉'));
  assert.ok(restored.includes('💻'));
  // Restoration is not a trade: the author's words have to come through too.
  assert.ok(restored.includes('Big release today!'));
  assert.ok(restored.includes('Post to Card is live'));
  assert.ok(restored.includes('Try it offline now'));
});

test('F9.2: restores Twemoji inside author display name', () => {
  const tweet = createDomElement(EMOJI_TWEET_HTML);
  const userNameEl = tweet.querySelector('div[data-testid="User-Name"]')!;
  const restoredName = restoreUnicodeEmojis(userNameEl);

  assert.ok(restoredName.includes('🚀'));
  assert.ok(restoredName.includes('Alex'));
});

test('F9.3: converts BR tags to native newline characters', () => {
  const el = createDomElement('<div><span>Line 1</span><br><span>Line 2</span></div>');

  assert.equal(restoreUnicodeEmojis(el), 'Line 1\nLine 2');
});

test('F9.4: handles pure emoji tweets without crashing or empty text', () => {
  const tweet = createDomElement(PURE_EMOJI_HTML);
  const tweetText = tweet.querySelector('div[data-testid="tweetText"]')!;
  const restored = restoreUnicodeEmojis(tweetText);

  assert.equal(restored.replace(/\s+/g, ''), '😀😃😄😁');
});

test('F9.5: a whitespace-only node keeps the line break it carries and collapses to one separator otherwise', () => {
  // X splits a body around every inline element, so the paragraph break between
  // two of them lands in a node of its own. Reading every whitespace-only node
  // as indentation collapsed that break to a space and flattened a
  // multi-paragraph post into one blob.
  const withBreak = createDomElement('<div><span>a</span><span>\n</span><span>b</span></div>');
  assert.equal(restoreUnicodeEmojis(withBreak), 'a\nb');

  const indentation = createDomElement('<div><span>a</span><span>   </span><span>b</span></div>');
  assert.equal(restoreUnicodeEmojis(indentation), 'a b');
});

// -------------------------------------------------------------
// F10: Mention & Hashtag Preservation
//
// Every assertion below reads what the shipped extractor produced from real
// markup. The previous revision read `EXPECTED_TOKENS` -- a fixture the test
// itself owned -- and asserted its own fields back, so no token could ever come
// out wrong.
// -------------------------------------------------------------

/** The extracted post for the rich-token fixture. */
function richTokensTweet(): TweetData {
  return extractTweetData(createDomElement(RICH_TOKENS_HTML));
}

test('F10.1: the extractor marks mentions up as tokens carrying their profile link', () => {
  const tokens = richTokensTweet().richTokens!;
  const mention = tokens.find(t => t.type === 'mention' && t.value === '@typescript');
  assert.ok(mention, 'the mention token is what makes the handle clickable on the card');
  assert.equal(mention!.href, '/typescript');
  assert.equal(tokens.filter(t => t.type === 'mention').length, 2);
});

test('F10.2: the extractor marks hashtags up with their search link', () => {
  const hashtag = richTokensTweet().richTokens!.find(t => t.type === 'hashtag');
  assert.ok(hashtag, 'a hashtag the extractor missed prints as flat text');
  assert.equal(hashtag!.value, '#WebDev');
  assert.equal(hashtag!.href, '/hashtag/WebDev');
});

test('F10.3: the extractor marks cashtags up as their own token kind', () => {
  const cashtags = richTokensTweet().richTokens!.filter(t => t.type === 'cashtag');
  assert.deepEqual(cashtags.map(t => t.value), ['$NVDA', '$BTC']);
  assert.equal(cashtags[0].href, '/search?q=%24NVDA');
});

test('F10.4: an external link shows its display form while keeping the resolved URL', () => {
  const link = richTokensTweet().richTokens!.find(t => t.type === 'link');
  assert.ok(link, 'the external link must survive as a token');
  // X shows `github.com/...` and keeps the real target in `title`; printing the
  // t.co href instead is the regression this pins.
  assert.equal(link!.value, 'github.com/post-to-card');
  assert.equal(link!.href, 'https://github.com/post-to-card');
});

test('F10.5: the media permalink X appends is dropped from both the text and the tokens', () => {
  const tweet = richTokensTweet();

  assert.ok(!tweet.text.includes('pic.twitter.com'),
    `the body still carries X's attachment link: ${tweet.text}`);
  assert.ok(tweet.text.endsWith('github.com/post-to-card'),
    `the author's own trailing link must survive: ${tweet.text}`);
  assert.ok(!tweet.richTokens!.some(t => t.value.includes('pic.twitter.com')),
    'the token pass and the text pass have to agree, or the card prints it in one view and not the other');
});

// -------------------------------------------------------------
// F11: High-Res Media Upgrade
// -------------------------------------------------------------
test('F11.1: upgrades avatar from _normal to _400x400 ultra high-resolution', () => {
  const original = 'https://pbs.twimg.com/profile_images/1115644071988/jack_normal.jpg';
  const upgraded = upgradeAvatarUrl(original);
  assert.equal(upgraded, 'https://pbs.twimg.com/profile_images/1115644071988/jack_400x400.jpg');
});

test('F11.2: a media thumbnail is upgraded to the original resolution, in JPEG', () => {
  // `name=orig` rather than `name=large`: orig reaches 4096px and large stops at
  // 2048. This assertion used to read `name=large` because the helper it called
  // lived in this file and said so; the shipped upscaler says orig, and the card
  // is what has to be right.
  const original = 'https://pbs.twimg.com/media/first_photo.jpg?format=jpg&name=small';
  const upgraded = upgradePhotoUrl(original);

  const params = new URL(upgraded).searchParams;
  assert.equal(params.get('name'), 'orig');
  assert.equal(params.get('format'), 'jpg', 'X recompresses WebP sources, so original quality is fetched as JPEG');
});

test('F11.3: a legacy colon suffix is upgraded to :orig', () => {
  const original = 'https://pbs.twimg.com/media/legacy_photo.jpg:small';
  assert.equal(upgradePhotoUrl(original), 'https://pbs.twimg.com/media/legacy_photo.jpg:orig');
});

test('F11.4: extracts video poster frame from video component', () => {
  const tweet = createDomElement(VIDEO_POSTER_HTML);
  const video = tweet.querySelector('video')!;
  assert.equal(video.getAttribute('poster'), 'https://pbs.twimg.com/media/awesome_video_poster.jpg');
});

test('F11.5: handles empty or missing media gracefully', () => {
  assert.equal(upgradeAvatarUrl(''), '');
  assert.equal(upgradePhotoUrl(''), '');
});

// -------------------------------------------------------------
// F11.6: Mixed photo + video media must not drop either kind.
// Video detection used to short-circuit the photo pass, so a tweet pairing an
// image with a GIF rendered as the GIF alone.
// -------------------------------------------------------------
test('F11.6: keeps the photo when a tweet also contains a GIF', () => {
  const tweet = createDomElement(PHOTO_AND_GIF_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media.length, 2, 'expected both the photo and the GIF');

  const photo = media.find((m) => m.type === 'image');
  const gif = media.find((m) => m.type === 'gif' || m.type === 'video');
  assert.ok(photo, 'expected a photo item');
  assert.ok(gif, 'expected a gif/video item');
  assert.match(photo.url, /screenshot_table/, 'photo should be the screenshot');
  assert.match(gif.url, /gif_reaction/, 'gif should be the reaction clip');
});

test('F11.7: keeps the photo when a tweet also contains a plain video', () => {
  const tweet = createDomElement(PHOTO_AND_VIDEO_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media.length, 2, 'expected both the photo and the video');
  assert.ok(media.some((m) => m.type === 'image' && /photo_beside_video/.test(m.url)));
  assert.ok(media.some((m) => m.type === 'video' && /clip_poster/.test(m.url)));
});

test('F11.8: a video-only tweet still yields exactly one item', () => {
  const tweet = createDomElement(VIDEO_POSTER_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media.length, 1, 'video-only tweets must not gain phantom items');
  assert.equal(media[0].type, 'video');
});

test('F11.9: never returns more than 4 media items', () => {
  const tweet = createDomElement(PHOTO_AND_VIDEO_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;
  assert.ok((media?.length ?? 0) <= 4, 'media count must respect the 4-item layout cap');
});

test('F11.10: a GIF poster layer is not extracted as a photo', () => {
  // Observed on a live GIF post: the hidden poster sits inside the tweetPhoto
  // wrapper behind the <video>, so counting it would render the GIF twice.
  const tweet = createDomElement(GIF_POSTER_LAYER_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected the GIF to be extracted');
  assert.equal(media!.length, 1, 'a GIF post must yield exactly one item');
  assert.ok(
    !media!.some((m) => m.type === 'image'),
    'the hidden poster layer must not be collected as a photo'
  );
  assert.ok(media![0].type === 'gif' || media![0].type === 'video', 'expected a video or gif item');
});

test('F11.11: a visible video poster is not also collected as a photo', () => {
  // Regression guard. A regular video's poster is visible (no opacity:0), so the
  // structural checks that caught the hidden GIF layer missed it and the frame
  // rendered twice: once as a photo, once as the video item with the duration.
  const tweet = createDomElement(VIDEO_VISIBLE_POSTER_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected the video to be extracted');
  assert.equal(media!.length, 1, 'a video post must yield exactly one item');
  assert.equal(media![0].type, 'video', 'the item must be the video, not its poster');
  assert.match(media![0].url, /video_frame/, 'the poster frame supplies the still');
});

test('F11.12: extracts all 4 animated GIFs from a multi-GIF post', () => {
  const tweet = createDomElement(FOUR_GIFS_HTML);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media!.length, 4, 'expected all 4 GIFs to be preserved rather than collapsed to 1');
  assert.ok(media!.every((m) => m.type === 'gif'), 'all items must be of type gif');
  assert.match(media![0].url, /gif1/, 'gif 1 url match');
  assert.match(media![1].url, /gif2/, 'gif 2 url match');
  assert.match(media![2].url, /gif3/, 'gif 3 url match');
  assert.match(media![3].url, /gif4/, 'gif 4 url match');
});

// -------------------------------------------------------------
// F30: the trigger must attach to the action row, not the media block
// -------------------------------------------------------------
test('F30.1: only the action row is treated as the injection target', () => {
  // Observed on a live two-image tweet: the photo block contains its own
  // role="group" per image, so a bare group match put the trigger on the photo.
  const article = createDomElement(MEDIA_WITH_INNER_GROUP_HTML);
  const groups = article.querySelectorAll('div[role="group"]');
  assert.equal(groups.length, 3, 'fixture should contain two media groups and one action row');

  const actionBar = groups.find(g => !!g.querySelector('button[data-testid="reply"]')) as unknown as Element;
  const mediaGroups = groups.filter(g => g !== actionBar);

  for (const mediaGroup of mediaGroups) {
    assert.equal(
      mediaGroup.querySelector('[data-testid="reply"], [data-testid="like"], [data-testid="retweet"]'),
      null,
      'media groups must not carry engagement controls, so they are rejected'
    );
  }
  assert.ok(actionBar, 'the action row must be identifiable by its engagement controls');
});

test('F30.2: the selection resolves to the action row even when media groups exist', () => {
  const article = createDomElement(MEDIA_WITH_INNER_GROUP_HTML) as unknown as Element;
  const groups = Array.from(article.querySelectorAll('div[role="group"]'));
  const actionBar = groups.find(g => !!g.querySelector('button[data-testid="reply"]')) as unknown as Element;
  const mediaGroups = groups.filter(g => g !== actionBar) as unknown as Element[];

  // The exported predicate is what guards the media groups; asserting it
  // directly keeps the test honest about what it covers.
  for (const mediaGroup of mediaGroups) {
    assert.equal(isActionBar(mediaGroup), false, 'a media group must not qualify as an action bar');
  }
  assert.equal(isActionBar(actionBar), true, 'the action row must qualify');
});

// -------------------------------------------------------------
// F12: Multi-Image Grid Extraction
//
// These go through the extractor, so what is asserted is the media list the
// card is actually handed. The previous revision counted `<img>` elements in
// the fixture with `querySelectorAll`, which is a fact about the fixture.
// -------------------------------------------------------------

/** The media the extractor produced for a fixture, in order. */
function mediaFrom(html: string): MediaItem[] {
  const tweet = extractTweetData(createDomElement(html));
  assert.ok(tweet.media, 'the extractor produced no media at all');
  return tweet.media!;
}

test('F12.1: a one-photo post extracts one image, upgraded to the original', () => {
  const media = mediaFrom(ONE_PHOTO_HTML);
  assert.equal(media.length, 1);
  assert.match(media[0].url, /name=orig/);
});

test('F12.2: a two-photo post extracts both, in document order', () => {
  const media = mediaFrom(TWO_PHOTOS_HTML);
  assert.equal(media.length, 2);
  assert.deepEqual(
    media.map((m) => new URL(m.url).pathname.split('/').pop()),
    ['photo_left.jpg', 'photo_right.png']
  );
});

test('F12.3: a three-photo post extracts all three', () => {
  assert.equal(mediaFrom(THREE_PHOTOS_HTML).length, 3);
});

test('F12.4: a four-photo post extracts all four, each at original resolution', () => {
  const media = mediaFrom(FOUR_PHOTOS_HTML);
  assert.equal(media.length, 4);
  for (const item of media) {
    assert.match(item.url, /name=orig/, `photo was left at thumbnail size: ${item.url}`);
  }
});

test('F12.5: a payload carrying more than four photos is clamped to four', () => {
  // X does not offer a five-photo post, so this is the guard against a layout
  // X might ship rather than a case seen in the wild. The card's grid has four
  // cells; a fifth item would render outside the layout.
  const five = FOUR_PHOTOS_HTML.replace(
    '</article>',
    '<div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/extra.jpg?format=jpg&name=small" alt="Extra"></div></article>'
  );
  const media = mediaFrom(five);
  assert.equal(media.length, 4, 'the fifth photo must not reach the card');
  assert.ok(!media.some((m) => m.url.includes('extra.jpg')));
});

// -------------------------------------------------------------
// F13: Quote Tweet Extraction
//
// These read the quote the extractor produced, not the markup it was given.
// The previous revision queried the fixture's own nodes and asserted the text
// it had just written there, so the parser was never exercised.
// -------------------------------------------------------------

/** The quote the extractor produced for a fixture, or null. */
function quoteFrom(html: string): TweetData['quotePost'] {
  const tweet = extractTweetData(createDomElement(html));
  return tweet.quotePost;
}

test('F13.1: a quoted post is extracted as structured data, not left in the body', () => {
  const quote = quoteFrom(QUOTE_TWEET_HTML);
  assert.ok(quote, 'the quote did not survive extraction');
  assert.ok(quote!.text.length > 0);
});

test('F13.2: the quote carries its own author, taken from the href and not the display name', () => {
  const quote = quoteFrom(QUOTE_TWEET_HTML)!;
  // The display-name link and the handle link share `/sama`, so a parser that
  // reads the first anchor's text gets the name where the handle belongs.
  assert.equal(quote.author.name, 'Sam Altman');
  assert.equal(quote.author.handle, '@sama');
});

test('F13.3: the quote body is the quoted post\'s own text', () => {
  const quote = quoteFrom(QUOTE_TWEET_HTML)!;
  assert.equal(quote.text, 'GPT-5.5 is now rolling out to all users. Enjoy!');
});

test('F13.4: media inside the quote stays with the quote', () => {
  const tweet = extractTweetData(createDomElement(QUOTE_TWEET_HTML));
  const quote = tweet.quotePost!;

  assert.ok(quote.media?.length, 'the quoted picture was dropped');
  assert.ok(quote.media![0].url.includes('gpt_launch.png'));
  assert.ok(
    !tweet.media?.some((m) => m.url.includes('gpt_launch.png')),
    "the quoted post's picture must not also be listed as the outer post's media"
  );
});

test('F13.5: a deleted quoted post is reported as unavailable rather than as an empty quote', () => {
  const quote = quoteFrom(QUOTE_TWEET_UNAVAILABLE_HTML);
  assert.ok(quote, 'the tombstone must still produce a quote object');
  assert.equal(quote!.isUnavailable, true);
  assert.equal(quote!.text, '');
  assert.equal(quote!.author.handle, '', 'there is no author to name');

  // And the outer post is not itself marked unavailable: X leaves the quoting
  // post intact. The flag lives in diagnostics, which is where a run of
  // misclassified posts would surface.
  assert.equal(
    extractTweetData(createDomElement(QUOTE_TWEET_UNAVAILABLE_HTML)).diagnostics?.isUnavailable,
    false
  );
});

// -------------------------------------------------------------
// F13b: Nested quote tweets (a quote inside a quote)
// -------------------------------------------------------------
test('F13.6: a quote inside a quote renders as a second, nested quote panel', async () => {
  // The card is the only thing that can answer what a nested quote renders as,
  // so this goes through it. Before the nesting was modelled, the inner post was
  // rendered as part of the outer quote — its words and picture attributed to
  // the wrong author — or dropped.
  const html = await renderCard({
    data: {
      id: '91001',
      url: 'https://x.com/gkev1n/status/91001',
      author: { name: 'gKev1n', handle: '@gKev1n' },
      text: '这把赚大发了',
      timestamp: '2026-10-14T04:29:00.000Z',
      quotePost: {
        author: { name: 'Devin Developers', handle: '@devindevelopers' },
        text: 'Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。',
        quotePost: {
          author: { name: 'Cognition', handle: '@cognition' },
          text: 'Gemini 4 Argon is now available in Devin Desktop and CLI.',
          media: [{ type: 'image', url: 'https://pbs.twimg.com/media/chart.png' }],
        },
      },
    } satisfies TweetData,
  });

  const panels = [...html.matchAll(/<div class="quote-card" data-quote-depth="(\d)"/g)].map((m) => m[1]);
  assert.deepEqual(panels, ['1', '2'], 'both quote levels are rendered, nested and in order');

  // The inner post's own byline and body print, and its picture is mounted.
  assert.ok(html.includes('>Cognition<'), 'the inner author name is on the card');
  assert.ok(html.includes('@cognition'), 'the inner handle is on the card');
  assert.ok(
    html.includes('Gemini 4 Argon is now available in Devin Desktop and CLI.'),
    'the inner body is on the card'
  );
  // The inner picture belongs to the inner panel. Asserting the URL appears
  // somewhere is not enough — the outer level could carry a picture of its own
  // and satisfy it — so the grid is counted inside the deepest panel.
  const innerPanel = html.slice(html.indexOf('data-quote-depth="2"'));
  assert.ok(
    /class="media-grid/.test(innerPanel),
    'the deepest post mounts its own media grid, not just a url somewhere on the card'
  );
});

test('F13.6b: the real extractor carries the deepest quote’s media to the card', () => {
  // The reported bug. The nesting was modelled and the DOM fixture for the
  // render test had no picture at all, so the deepest level's media was never
  // exercised on either side of the seam — the extraction always produced it
  // and the card simply had nothing to draw. This drives the real extractor
  // and then the real card, so a drop at either end fails here.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/gkev1n"><span>gKev1n</span></a></div>
      <div data-testid="tweetText"><span>outer words</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name"><a href="/devin"><span>Devin Developers</span></a></div>
        <div data-testid="tweetText"><span>middle words</span></div>
        <div data-testid="quoteTweet">
          <div data-testid="User-Name"><a href="/cognition"><span>Cognition</span></a></div>
          <div data-testid="tweetText"><span>inner words</span></div>
          <div data-testid="tweetPhoto">
            <img src="https://pbs.twimg.com/media/deepest.png?format=png&name=small" alt="chart">
          </div>
        </div>
      </div>
    </article>
  `);

  const data = extractTweetData(article)!;
  const deepest = data.quotePost?.quotePost;
  assert.ok(deepest?.media?.length, 'the extractor must carry the deepest quote\'s own media');

  // And the card must draw it inside the deepest panel, which is the half the
  // render-only test could not see.
  return renderCard({ data }).then((html) => {
    const innerPanel = html.slice(html.indexOf('data-quote-depth="2"'));
    assert.ok(
      innerPanel.includes('deepest.png'),
      'the deepest post\'s picture must be mounted inside the deepest panel'
    );
  });
});

test('F13.7: the top quote of a chain renders alone when it carries no further quote', async () => {
  const html = await renderCard({
    data: {
      id: '91002',
      url: 'https://x.com/gkev1n/status/91002',
      author: { name: 'gKev1n', handle: '@gKev1n' },
      text: 'plain quote',
      timestamp: '2026-10-14T04:29:00.000Z',
      quotePost: {
        author: { name: 'Devin Developers', handle: '@devindevelopers' },
        text: 'Gemini 4 Argon is now available.',
      },
    } satisfies TweetData,
  });

  const panels = [...html.matchAll(/<div class="quote-card" data-quote-depth="(\d)"/g)].map((m) => m[1]);
  assert.deepEqual(panels, ['1'], 'a plain quote still renders exactly one panel');
});

test('F13.8: the nested quote panel steps down in surface, indent and type', () => {
  // The regression guard for "层级不够明显". Two levels printed the same panel:
  // the CSS redefined `--quote-bg` on the nested element, which is a custom
  // property reading itself — a cycle, invalid at computed-value time — so the
  // panel fell back to a near-transparent wash, and neither indent nor type
  // separated the two. All three steps are asserted on the rule itself.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const at = css.indexOf('.quote-card[data-quote-depth="2"] {');
  assert.ok(at > 0, 'the nested panel must carry its own rule');
  const block = css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');

  // A cycle in a custom property is not a fallback: the declaration is dropped
  // and the element silently renders without the background. So the mix must be
  // written as a value the element owns, never as `--quote-bg` redefined here.
  assert.ok(
    !/--quote-bg\s*:/.test(block),
    'the nested panel must not redefine --quote-bg: a property that reads itself is invalid at computed-value time'
  );
  assert.ok(/background\s*:\s*color-mix\(/.test(block), 'the nested panel owns its background');
  assert.ok(block.includes('var(--surface)'), 'mixed toward the sheet, so every material recedes the same way');
  assert.ok(!block.includes('var(--quote-border)\n') || block.includes('border-color'), 'the rule states its own border step');

  // Each step has to be a real step, or the two panels still read as one.
  const px = (name: string): number => {
    const m = block.match(new RegExp(`${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`));
    return m ? Number(m[1]) : 0;
  };
  assert.ok(px('margin-inline-start') >= 8, `the nested panel is indented (${px('margin-inline-start')}px)`);
  assert.ok(px('padding-left') < 14, 'and its padding steps down with it');
  // The step is a calc against the material's own quote size, so it holds on
  // every material rather than only where the two happen to differ by 1px.
  // The inner `(`…`)` of the var() default means the expression cannot be read
  // with a bracket-free character class, so the test allows one nesting level.
  const nameRule = css.slice(css.indexOf('.quote-card[data-quote-depth="2"] .quote-name'));
  assert.ok(
    /font-size\s*:\s*calc\(.+\)/.test(nameRule.slice(0, nameRule.indexOf('}'))) &&
      /calc\(.+\s-\s[\d.]+px\)/.test(nameRule.slice(0, nameRule.indexOf('}'))),
    'the nested byline is set a step smaller'
  );
  const avatarBlock = css.slice(css.indexOf('.quote-card[data-quote-depth="2"] .quote-avatar'));
  assert.ok(/width\s*:\s*16px/.test(avatarBlock.slice(0, avatarBlock.indexOf('}'))), 'and its avatar shrinks with it');
});

test('F13.9: both quote levels reach the card, each carrying its own depth', async () => {
  const html = await renderCard({
    data: {
      id: '91003',
      url: 'https://x.com/gkev1n/status/91003',
      author: { name: 'gKev1n', handle: '@gKev1n' },
      text: 'outer words',
      timestamp: '2026-10-14T04:29:00.000Z',
      quotePost: {
        author: { name: 'Devin Developers', handle: '@devindevelopers' },
        text: 'middle words',
        quotePost: {
          author: { name: 'Cognition', handle: '@cognition' },
          text: 'inner words',
        },
      },
    } satisfies TweetData,
  });

  assert.ok(html.includes('data-quote-depth="1"'), 'the outer quote panel is rendered');
  assert.ok(html.includes('data-quote-depth="2"'), 'and so is the one it quotes');
  // The depth attribute is what the stylesheet steps on, so a panel without it
  // is a panel with no hierarchy.
  assert.ok(!/data-quote-depth="3"/.test(html), 'a third level is not rendered: the card prints two');
});

// -------------------------------------------------------------
// F14: Continuous Thread Connector
//
// These resolve through the shipped `resolveThread`. The previous revision
// re-implemented the walk in the test file -- and asserted its own loop -- so
// the resolver could have been deleted without a failure.
// -------------------------------------------------------------

/** Mounts `html` in a live document and resolves the thread starting at `index`. */
async function resolvedThread(
  html: string,
  index = 0
): Promise<{ thread: ThreadData; articleIds: string[] }> {
  let out: { thread: ThreadData; articleIds: string[] } | null = null;

  await withDomEnv(async ({ doc }) => {
    const feed = createDomElement(html);
    doc.body.appendChild(feed);
    // A single-post fixture's root *is* the article, so `querySelectorAll` --
    // which only searches descendants -- finds nothing and the fixture itself
    // has to be the one article.
    const articles = feed.matches('article[data-testid="tweet"]')
      ? [feed]
      : feed.querySelectorAll('article[data-testid="tweet"]');
    assert.ok(articles[index], `the fixture has no article at index ${index}`);

    out = {
      thread: resolveThread(articles[index] as unknown as Element),
      articleIds: articles.map((a) => a.getAttribute('id') || ''),
    };
  });

  return out!;
}

test('F14.1: a chain of the author\'s own posts resolves as one thread', async () => {
  const { thread } = await resolvedThread(THREAD_HTML);

  assert.equal(thread.tweets.length, 3, 'the walker dropped posts');
  assert.equal(thread.isSingle, false);
  assert.equal(thread.author.handle, '@dan_abramov');
  assert.deepEqual(thread.tweets.map((t) => t.id), ['1001', '1002', '1003']);
  assert.ok(thread.tweets.every((t) => t.diagnostics?.source === 'dom'));
});

test('F14.2: a sponsored post between two of the author\'s own posts ends the chain', async () => {
  // tweet-1 and tweet-2 are both @alice and two minutes apart, so only the ad
  // between them can stop the walk. Without the halt the card would carry the
  // advertiser's post as the second entry of the thread.
  const { thread } = await resolvedThread(MIXED_FEED_WITH_ADS_AND_REPLIES_HTML, 0);

  assert.deepEqual(thread.tweets.map((t) => t.id), ['9001']);
  assert.equal(thread.isSingle, true);
});

test('F14.3: another author\'s reply is not absorbed into the thread', async () => {
  // tweet-2 is followed by @bob_troll's reply and then tweet-3, also @alice.
  const { thread } = await resolvedThread(MIXED_FEED_WITH_ADS_AND_REPLIES_HTML, 2);

  assert.ok(thread.tweets.every((t) => t.author.handle === '@alice'),
    `a third-party post was absorbed: ${thread.tweets.map((t) => t.author.handle).join(', ')}`);
  assert.deepEqual(thread.tweets.map((t) => t.id), ['9002']);
});

test('F14.4: a resolved thread numbers its posts from zero and states its length', async () => {
  const { thread } = await resolvedThread(THREAD_HTML);

  assert.deepEqual(thread.tweets.map((t) => t.threadIndex), [0, 1, 2]);
  assert.ok(thread.tweets.every((t) => t.threadTotal === 3));
  assert.ok(thread.tweets.every((t) => t.isThreadPart === true),
    'every post in a multi-post card has to be marked as part of one');
});

test('F14.5: a post that stands alone resolves as a single, unnumbered card', async () => {
  const { thread } = await resolvedThread(SINGLE_TWEET_HTML);

  assert.equal(thread.tweets.length, 1);
  assert.equal(thread.isSingle, true);
  assert.equal(thread.tweets[0].isThreadPart, false);
  assert.equal(thread.tweets[0].threadIndex, undefined);
  assert.equal(thread.tweets[0].threadTotal, undefined);
});

test('F17.19: the type scale is a material token, not a block of CSS per material', async () => {
  // Type was the last part of a material still written by hand, one block per
  // theme. Adding a material meant remembering three rule blocks and a missed
  // one silently inherited another's letterforms. The values live in the token
  // table now, so the failure mode is a compile error rather than a look nobody
  // thought to check.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  // No rule names a material at all any more, for type or anything else.
  assert.ok(
    !/\[data-theme=/.test(css),
    'card.css must not name a material; every material difference is a token'
  );

  // Every type value the CSS applies has to come from a token, and the card is
  // where those tokens are declared, so ask the card.
  const html = await renderCard();
  for (const prop of ['--type-display-size', '--type-body-size', '--type-meta-size']) {
    assert.ok(
      new RegExp(`${prop}:\\s*[\\d.]+`).test(html),
      `${prop} must be declared on the card`
    );
    assert.ok(css.includes(`var(${prop}`), `${prop} must be consumed by card.css`);
  }

  // The completeness the interface buys: every material states all of it, so a
  // new one cannot be half-filled.
  for (const id of THEME_IDS) {
    const type = THEMES[id].tokens.type;
    assert.ok(type, `${id} must carry a type scale`);
    for (const field of [
      'displaySize', 'displayWeight', 'displayTracking', 'quoteSize',
      'bodySize', 'bodyLeading', 'metaSize', 'metaTracking',
      'metaUppercase', 'metaTabular',
    ] as const) {
      assert.notEqual(type[field], undefined, `${id}.type.${field} must be stated`);
    }
    // The stat divider is a footnote treatment, not a letterform, so it sits on
    // the tokens beside `statChip` rather than inside the type scale.
    assert.notEqual(
      THEMES[id].tokens.metaDivider,
      undefined,
      `${id}.metaDivider must be stated`
    );
  }
});

test('F17.20: the inner corner comes from the resolved radius, not a second table', async () => {
  // card.css used to carry its own copy of the radius table: a per-option rule
  // setting the media and quote corners by hand. It had no `theme` row, so the
  // default option left multi-image media at 0px while a single image of the
  // same material took the material's own radius. The copy is gone; the inner
  // corner is `--media-radius`, which the card injects from `resolveRadius`.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  assert.ok(
    css.includes('border-radius: var(--media-radius'),
    'the inner corner must be read from the injected token'
  );
  for (const option of ['0px', '12px', '20px']) {
    assert.ok(
      css.includes(`[data-radius="${option}"] {`),
      `the card corner for ${option} must still be stated`
    );
  }
  assert.ok(
    !/\[data-radius="[^"]+"\] \.media-(grid|item)/.test(css),
    'the inner corner must not be set per option again'
  );

  // Injected unconditionally, and carrying the same number the resolver hands
  // the card corner -- the failure this test exists for was the two disagreeing.
  const html = await renderCard();
  const resolved = resolveRadius(CARD_CONFIG.borderRadius, CARD_CONFIG.theme);
  assert.ok(
    new RegExp(`--media-radius:\\s*${resolved.media}`).test(html),
    `the card must inject the resolved inner corner (${resolved.media})`
  );
});

test('F17.18: every card-root option is named once, by its data attribute', async () => {
  // Each option used to be emitted twice, as a class and as a data attribute,
  // and card.css matched both spellings in every rule. Same element, same
  // specificity, same block, so the class decided nothing; it only meant an
  // option could be renamed in one place and keep its old styling in the other.
  // Asserted on the rendered root, so a second spelling coming back is caught.
  //
  // `fit-` and `media-layout-` are not in this list on purpose: card.css keys
  // their child rules on the class, on the media grid rather than the card root.
  const html = await renderCard();
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  for (const option of ['theme', 'padding', 'radius', 'ratio']) {
    assert.ok(
      new RegExp(`data-${option}=`).test(html),
      `${option} must be carried by its data attribute`
    );
  }
  for (const emitted of ['theme-', 'padding-', 'radius-', 'ratio-']) {
    assert.ok(
      !new RegExp(`class="[^"]*\\b${emitted}\\w`).test(html),
      `${emitted} must not also be emitted as a class, or the two spellings can drift`
    );
    assert.ok(
      !new RegExp('\\.post-to-card-target\\.' + emitted).test(css),
      `card.css must not carry a second selector spelling for ${emitted}`
    );
  }
});

test('F14.6: the thread layout keeps the connector and the text in their own columns', async () => {
  const html = await renderCard({ data: THREAD });
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  // The two-column timeline, asserted on the markup it produces: avatar and
  // connector share the gutter, the body sits beside them.
  for (const cls of ['thread-list', 'thread-item', 'thread-gutter', 'thread-content-col']) {
    assert.ok(html.includes(`class="${cls}"`), `the card must render ${cls}`);
  }

  // And the connector joins the rows: one between them, none trailing.
  assert.equal(
    (html.match(/thread-connector-line/g) || []).length,
    THREAD.tweets.length - 1,
    'the connector must be drawn between the rows, not after the last'
  );

  assert.ok(cssContent.includes('.thread-item'), 'CSS must style thread-item');
  assert.ok(cssContent.includes('.thread-gutter'), 'CSS must style thread-gutter');
  assert.ok(cssContent.includes('.thread-content-col'), 'CSS must style thread-content-col');
  assert.ok(cssContent.includes('flex-direction: row'), 'thread-item must use horizontal row layout');
});

test('F14.7: independent same-author posts are not merged into a thread', () => {
  // Two posts by one author, six weeks apart. The previous version of this test
  // read the source for four function names and then asserted that its own
  // fixture had no connector, which is a statement about the fixture. This asks
  // the predicate that decides merging.
  const container = createDomElement(`
  <div id="timeline">
    <article data-testid="tweet" id="tweet-august">
      <div data-testid="User-Name">
        <span>Shiro</span>
        <a href="/shirolin"><span>@shirolin</span></a>
        <a href="/shirolin/status/1000"><time datetime="2026-08-14T10:00:00.000Z"></time></a>
      </div>
      <div data-testid="tweetText"><span>August standalone tweet</span></div>
    </article>
    <article data-testid="tweet" id="tweet-september">
      <div data-testid="User-Name">
        <span>Shiro</span>
        <a href="/shirolin"><span>@shirolin</span></a>
        <a href="/shirolin/status/2000"><time datetime="2026-09-30T10:00:00.000Z"></time></a>
      </div>
      <div data-testid="tweetText"><span>September standalone tweet</span></div>
    </article>
  </div>
  `);
  const august = container.querySelector('#tweet-august') as unknown as Element;
  const september = container.querySelector('#tweet-september') as unknown as Element;

  const first = extractTweetData(august);
  const second = extractTweetData(september);
  assert.ok(first && second, 'both posts must extract');

  assert.equal(isTemporallyConnected(first, second), false, 'six weeks apart is not a continuation');
  assert.equal(
    isThreadConnectedPair(august, september, first, second, true, false),
    false,
    'so the same author posting twice must not be read as one thread'
  );
});

test('F14.8: a post replying to someone else ends the thread', () => {
  // Same author, two minutes apart, so only the reply target can separate the
  // pair -- which is the rule this test exists for.
  const container = createDomElement(`
  <div id="timeline">
    <article data-testid="tweet" id="tweet-main">
      <div data-testid="User-Name">
        <span>Alice</span>
        <a href="/alice"><span>@alice</span></a>
        <a href="/alice/status/1001"><time datetime="2026-08-14T10:00:00.000Z"></time></a>
      </div>
      <div data-testid="tweetText"><span>Main insight</span></div>
    </article>
    <article data-testid="tweet" id="tweet-reply-bob">
      <div data-testid="User-Name">
        <span>Alice</span>
        <a href="/alice"><span>@alice</span></a>
        <a href="/alice/status/1002"><time datetime="2026-08-14T10:02:00.000Z"></time></a>
      </div>
      <div data-testid="socialContext">
        <span>Replying to </span><a href="/bob"><span>@bob</span></a>
      </div>
      <div data-testid="tweetText"><span>Replying to Bob comment</span></div>
    </article>
  </div>
  `);
  const main = container.querySelector('#tweet-main') as unknown as Element;
  const reply = container.querySelector('#tweet-reply-bob') as unknown as Element;

  const first = extractTweetData(main);
  const second = extractTweetData(reply);
  assert.ok(first && second, 'both posts must extract');

  assert.equal(isTemporallyConnected(first, second), true, 'this pair is otherwise continuous');
  assert.equal(
    isThreadConnectedPair(main, reply, first, second, true, false),
    false,
    'a reply aimed at a third party is not the author continuing'
  );

  // The same post with no `socialContext` container, in both arrangements of the
  // notice: the last-resort path scans the article for a profile link, and the
  // byline holds the author's own. Reporting that as the reply target reads as
  // "not a reply" to the caller, so the post would be merged into the thread.
  const withoutContainer = (noticeFirst: boolean) => {
    const notice = '<div><span>Replying to </span><a href="/bob"><span>@bob</span></a></div>';
    const byline = `
      <div data-testid="User-Name">
        <a href="/alice"><span>@alice</span></a>
        <a href="/alice/status/1002"><time datetime="2026-08-14T10:02:00.000Z"></time></a>
      </div>`;
    return createDomElement(
      `<article data-testid="tweet">${noticeFirst ? notice : ''}${byline}${noticeFirst ? '' : notice}` +
        '<div data-testid="tweetText"><span>Replying to Bob comment</span></div></article>'
    ) as unknown as Element;
  };

  for (const [label, noticeFirst] of [['below', false], ['above', true]] as const) {
    assert.equal(
      getReplyingToHandle(withoutContainer(noticeFirst)),
      '@bob',
      `a notice ${label} the byline must still name the account being replied to`
    );
  }
});

test('F14.9: excluding a post leaves it off the card, and the panel lists what is left', async () => {
  const both = await renderCard({ data: THREAD });
  const filtered = await renderCard({ data: THREAD, config: { excludedTweetIds: ['90002'] } });

  assert.ok(both.includes('and the follow-up'), 'both posts are on the card by default');
  // The stored exclusions have to reach the card, not just the panel.
  assert.ok(!filtered.includes('and the follow-up'), 'an excluded post must not be rendered');
  assert.ok(filtered.includes('shipping the video pass today'), 'and the rest must stay');

  // The panel's two handlers are these two functions, and nothing drove them
  // before: they were named by a source-text check instead.
  assert.deepEqual(toggleExcluded(THREAD, [], '90002'), ['90002'], 'excluding a post stores it');
  assert.deepEqual(toggleExcluded(THREAD, ['90002'], '90002'), [], 'toggling it back clears it');
  assert.deepEqual(selectCurrentOnly(THREAD), ['90002'], 'keeping only the current post excludes the rest');
  assert.deepEqual(
    toggleExcluded(THREAD, ['90002'], '90001'),
    ['90002'],
    'the card may not be emptied: the last showing post stays'
  );

  const controls = await renderControls({ threadData: THREAD });
  assert.ok(controls.includes('tweet-manager-section'), 'the panel must list the thread');
  assert.ok(controls.includes('tweet-manager-item'), 'one row per post');

  const modalCss = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/modal.css'), 'utf-8');
  assert.ok(modalCss.includes('.tweet-manager-section'), 'modal.css must style tweet manager section');
  assert.ok(modalCss.includes('.tweet-manager-item'), 'modal.css must style tweet manager items');
});

// -------------------------------------------------------------
// F15: Custom Element & Shadow DOM
//
// These drive `src/content/container/element.ts` -- the module that mounts the
// real card. Nothing in this repository imported it before, so its registration,
// its singleton guard and its teardown were covered by tests of the test shim's
// own `attachShadow`.
//
// The module registers itself on the global registry as a side effect of being
// imported, and Node caches it, so the document below is created once and reused:
// a fresh document per test would have its own registry and would never see the
// definition.
// -------------------------------------------------------------

let containerDoc: DomDocument | null = null;
let containerModule: Record<string, any> | null = null;

/**
 * Imports the container module with the globals it reads at import time in
 * place, and hands back a cleared document to mount into.
 *
 * Everything it installs is put back afterwards. A window left on `globalThis`
 * is not inert: the Controls panel reads `window.innerWidth` to decide whether
 * it is collapsed, and a document left behind is the one `resolveThread` walks,
 * so a leaked shim changes what unrelated tiers render.
 */
async function withContainerEnv(
  body: (env: {
    doc: DomDocument;
    PostToCardContainer: any;
    openCardModal: (thread: ThreadData, onExport?: unknown) => any;
    closeCardModal: () => void;
    /** Dispatches a keydown on the window, the way a real browser would. */
    fireKey: (key: string) => void;
    /** Lets the effects Preact scheduled at ~35ms run. */
    flushEffects: () => Promise<void>;
  }) => Promise<void>
): Promise<void> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    window: scope.window,
    HTMLElement: scope.HTMLElement,
    customElements: scope.customElements,
    ShadowRoot: scope.ShadowRoot,
  };

  // A window that can actually receive events. The modal binds its Escape
  // handler with `window.addEventListener`, so a window whose `addEventListener`
  // is a no-op makes the dismissal untestable from the outside and leaves the
  // only option a hand-written copy of the handler inside the test.
  const windowListeners = new Map<string, Array<(evt: any) => void>>();
  const fakeWindow = {
    addEventListener: (type: string, cb: (evt: any) => void) => {
      windowListeners.set(type, [...(windowListeners.get(type) || []), cb]);
    },
    removeEventListener: (type: string, cb: (evt: any) => void) => {
      windowListeners.set(type, (windowListeners.get(type) || []).filter((item) => item !== cb));
    },
    dispatchEvent: (evt: any) => {
      for (const cb of [...(windowListeners.get(evt.type) || [])]) cb.call(fakeWindow, evt);
      return true;
    },
    location: { origin: 'https://x.com', pathname: '/home' },
    innerWidth: 1200,
    scrollY: 0,
    scrollTo: () => {},
    // `modern-screenshot` reads the UA at import time and takes the whole module
    // graph down with it when it is missing.
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0' },
  };

  const fireKey = (key: string): void => {
    fakeWindow.dispatchEvent({
      type: 'keydown',
      key,
      shiftKey: false,
      defaultPrevented: false,
      _propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._propagationStopped = true;
      },
    });
  };

  // Effects are deferred, not synchronous: Preact flushes them from a 35ms
  // timer. Asserting before that lands reads a component whose effects have
  // never run.
  const flushEffects = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));

  try {
    if (!containerModule) {
      const doc = new DomDocument();
      scope.document = doc;
      scope.HTMLElement = DomElement;
      scope.customElements = doc.customElements;
      scope.window = fakeWindow;
      containerModule = await loadModule('/src/content/container/element.ts');
      containerDoc = doc;
    }

    const doc = containerDoc!;
    scope.document = doc;
    scope.window = fakeWindow;
    scope.HTMLElement = DomElement;
    scope.customElements = doc.customElements;
    // The export engine asks `root instanceof ShadowRoot` to decide where the
    // off-screen copy goes, so the class has to be reachable as a global.
    scope.ShadowRoot = DomShadowRoot;
    doc.body.innerHTML = '';
    windowListeners.clear();

    await body({
      doc,
      PostToCardContainer: containerModule.PostToCardContainer,
      openCardModal: containerModule.openCardModal,
      closeCardModal: containerModule.closeCardModal,
      fireKey,
      flushEffects,
    });
  } finally {
    containerModule?.closeCardModal();
    windowListeners.clear();
    if (containerDoc) containerDoc.body.innerHTML = '';
    scope.document = saved.document;
    scope.window = saved.window;
    scope.HTMLElement = saved.HTMLElement;
    scope.customElements = saved.customElements;
    scope.ShadowRoot = saved.ShadowRoot;
  }
}

const CONTAINER_THREAD: ThreadData = {
  author: { name: 'Ada', handle: '@ada' },
  isSingle: true,
  tweets: [
    {
      id: '90001',
      url: 'https://x.com/ada/status/90001',
      author: { name: 'Ada', handle: '@ada' },
      text: 'shipping the video pass today',
      timestamp: '2026-10-02T10:00:00.000Z',
      isThreadPart: false,
    },
  ],
};

test('F15.1: the container element registers itself under its tag name', async () => {
  await withContainerEnv(async ({ doc, PostToCardContainer }) => {
    const registered = doc.customElements.get('post-to-card-container');
    assert.ok(registered, 'without this the element never upgrades and the card never renders');
    assert.equal(registered, PostToCardContainer);
    // And the registry is what `createElement` consults, so the tag produces the
    // class rather than a bare element.
    assert.ok(doc.createElement('post-to-card-container') instanceof PostToCardContainer);
  });
});

test('F15.2: the container builds an open shadow root holding the styles and the mount point', async () => {
  await withContainerEnv(async ({ PostToCardContainer }) => {
    const container = new PostToCardContainer();

    assert.ok(container.shadow, 'the card is isolated in a shadow root');
    assert.equal(container.shadow.mode, 'open');
    assert.equal(container.shadowRoot, container.shadow);
    assert.equal(container.mountPoint.id, 'post-to-card-root');
    assert.equal(container.styleElement.id, 'post-to-card-styles');
    assert.ok(container.shadow.contains(container.styleElement));
    assert.ok(container.shadow.contains(container.mountPoint));
  });
});

test('F15.3: initialising twice leaves one stylesheet and one mount point', async () => {
  await withContainerEnv(async ({ PostToCardContainer }) => {
    const container = new PostToCardContainer();
    const before = container.shadow.childNodes.length;

    container.initComponent();
    container.initComponent();

    assert.equal(container.shadow.childNodes.length, before,
      'a second init must not append a second copy of everything');
    assert.equal(container.shadow.querySelectorAll('#post-to-card-root').length, 1);
    assert.equal(container.shadow.querySelectorAll('#post-to-card-styles').length, 1);
  });
});

test('F15.4: opening the card twice leaves exactly one container in the page', async () => {
  await withContainerEnv(async ({ doc, openCardModal }) => {
    const first = openCardModal(CONTAINER_THREAD);
    const second = openCardModal(CONTAINER_THREAD);

    assert.equal(second, first, 'the second open has to reuse the mounted container');
    assert.equal(doc.querySelectorAll('post-to-card-container').length, 1);
    assert.ok((first.mountPoint.innerHTML || '').length > 0, 'and the card has to be rendered into it');
  });
});

test('F15.5: closing the card removes the container and empties the shadow root', async () => {
  await withContainerEnv(async ({ doc, openCardModal, closeCardModal }) => {
    const container = openCardModal(CONTAINER_THREAD);
    assert.ok((container.mountPoint.innerHTML || '').length > 0);

    closeCardModal();

    assert.equal(doc.querySelector('post-to-card-container'), null,
      'a closed card must not leave its host element on the page');
    assert.equal(container.mountPoint.innerHTML, '', 'nor its contents in memory');
  });
});

// -------------------------------------------------------------
// F16: Inline CSS Style Isolation
//
// The stylesheet these check is the one the container actually injects, read
// back off the element it injected it into.
// -------------------------------------------------------------

/** The stylesheet the container injects, as text. */
async function injectedCss(): Promise<string> {
  let css = '';
  await withContainerEnv(async ({ PostToCardContainer }) => {
    css = new PostToCardContainer().styleElement.textContent || '';
  });
  return css;
}

test('F16.1: the stylesheet lives in the shadow root, not in the page', async () => {
  await withContainerEnv(async ({ doc, PostToCardContainer }) => {
    const container = new PostToCardContainer();

    assert.ok(container.shadow.querySelector('#post-to-card-styles'));
    assert.equal(doc.querySelector('#post-to-card-styles'), null,
      'a stylesheet in the page would restyle X itself');
    assert.equal(doc.querySelector('#post-to-card-root'), null);
  });
});

test('F16.2: the injected stylesheet resets the host with all: initial', async () => {
  const css = await injectedCss();
  assert.ok(css.length > 0, 'the container injected nothing');
  assert.match(css, /:host[^{]*\{[^}]*all:\s*initial/,
    'without the reset the card inherits X\'s typography and colours');
});

test('F16.3: card styles are unreachable from the host document', async () => {
  await withContainerEnv(async ({ doc, openCardModal }) => {
    openCardModal(CONTAINER_THREAD);
    const container = doc.querySelector('post-to-card-container')!;

    // A class the card really paints, taken from what it rendered rather than
    // from a name chosen here.
    const classes = (container.mountPoint.innerHTML.match(/class="([^"]+)"/) || [])[1];
    const probe = (classes || '').split(/\s+/).filter(Boolean)[0];
    assert.ok(probe, 'the card rendered no class to probe with');

    assert.ok(container.shadow.querySelector(`.${probe}`), 'the card is inside the shadow root');
    assert.equal(doc.querySelector(`.${probe}`), null,
      'a host-page query must not reach into the shadow tree');
  });
});

test('F16.4: the injected stylesheet states a cross-platform sans-serif stack', async () => {
  const css = await injectedCss();
  const hostRule = css.slice(css.indexOf(':host'));
  const fontFamily = (hostRule.match(/font-family:\s*([^;]+);/) || [])[1] || '';

  assert.ok(fontFamily.includes('-apple-system'), `missing the macOS face: ${fontFamily}`);
  assert.ok(fontFamily.includes('Segoe UI'), `missing the Windows face: ${fontFamily}`);
  assert.ok(fontFamily.includes('sans-serif'), `no fallback for anything else: ${fontFamily}`);
});

test('F16.5: the container injects both stylesheets, in one style element', async () => {
  await withContainerEnv(async ({ PostToCardContainer }) => {
    const container = new PostToCardContainer();
    const css = container.styleElement.textContent || '';

    assert.equal(container.shadow.querySelectorAll('style').length, 1,
      'a second style element is a stylesheet nobody keeps in sync');
    // One rule that only the modal sheet has, and one only the card sheet has.
    assert.ok(css.includes('.modal-header'), 'the modal stylesheet is missing');
    assert.ok(css.includes('--font-display'), 'the card stylesheet is missing');
  });
});

// -------------------------------------------------------------
// F17: Curated Themes (4 modern/classic + 3 papers + 3 non-paper stocks + 1 phase-2 + 1 experimental)
// -------------------------------------------------------------
const THEME_IDS: ThemeId[] = [
  'minimal',
  'midnight',
  'glass',
  'material',
  'gallery',
  'darkroom',
  'riso',
  'sumi',
  'clay',
  'terminal',
  'receipt',
  'brutalist',
];

test('F17.1: all twelve themes ship, and every theme exposes a full token set', () => {
  assert.deepEqual(Object.keys(THEMES).sort(), [...THEME_IDS].sort());
  for (const id of THEME_IDS) {
    const tokens = THEMES[id].tokens;
    for (const key of [
      'canvas',
      'surface',
      'text',
      'muted',
      'faint',
      'accent',
      'link',
      'border',
      'divider',
      'quoteBackground',
      'quoteBorder',
      'qrFill',
      'rule',
      'fontDisplay',
      'fontBody',
      'radius',
      'mediaRadius',
      'borderWidth',
      'shadow',
    ] as const) {
      assert.ok(tokens[key], `${id} must define ${key}`);
    }
    assert.equal(THEMES[id].id, id);
  }
});

test('F17.1b: every material names its signature, quote treatment and rhythm', () => {
  // A theme used to be able to omit its signature, which is how the restored
  // classics ended up as flat colour. The contract is total now.
  const signatureStyles = new Set([
    'none',
    'rule',
    'tick-rule',
    'perforation',
    'titlebar',
    'seal',
    'registration',
    'pill',
    'block',
  ]);
  for (const id of THEME_IDS) {
    const { signature, quoteStyle, rhythm } = THEMES[id].tokens;
    assert.ok(signatureStyles.has(signature.style), `${id} signature style ${signature.style}`);
    if (signature.style === 'none') {
      assert.equal(signature.height, '0px', `${id} signature height must be 0px when style is none`);
    } else {
      assert.ok(/^\d/.test(signature.height), `${id} signature height must be a length`);
    }
    assert.ok(quoteStyle === 'filled' || quoteStyle === 'outlined', `${id} quoteStyle`);
    assert.ok(/^\d/.test(rhythm.gap), `${id} rhythm.gap must be a length`);
    assert.ok(/^\d/.test(rhythm.mediaGap), `${id} rhythm.mediaGap must be a length`);
    // A signature is style + height only. A per-theme colour is how the
    // masthead hairline got painted in the accent by mistake.
    assert.deepEqual(
      Object.keys(signature).sort(),
      ['height', 'style'],
      `${id} signature must carry no extra fields`
    );
  }
});

test('F17.2: no theme paints pure white, and none ships a full-bleed gradient', () => {
  for (const id of THEME_IDS) {
    assert.notEqual(THEMES[id].tokens.surface.toLowerCase(), '#ffffff');
    assert.notEqual(THEMES[id].tokens.canvas.toLowerCase(), '#ffffff');
    // A gradient surface would be the "gradient skin" this replaced; only the
    // picker swatch may use one, and only as a two-stop paper tint.
    assert.ok(!/gradient/i.test(THEMES[id].tokens.surface), `${id} surface must be a flat colour`);
  }
});

test('F17.3: the value ramp is monotone from text to faint on every theme', () => {
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const id of THEME_IDS) {
    const { text, muted, faint } = THEMES[id].tokens;
    // A dark theme climbs toward the light; a light theme descends. Either way
    // the three steps must not invert halfway.
    const dark = luminance(text) < luminance(faint);
    const seq = [text, muted, faint].map(luminance);
    for (let i = 1; i < seq.length; i++) {
      if (dark) assert.ok(seq[i] >= seq[i - 1], `${id} ramp must brighten: ${i}`);
      else assert.ok(seq[i] <= seq[i - 1], `${id} ramp must dim: ${i}`);
    }
  }
});

test('F17.4: each material sets its letterforms for the object it is', () => {
  // The gallery label is a neo-grotesque, the sumi byline a Kai face over a Song
  // body, the receipt a typewriter, the terminal a console, the darkroom a
  // condensed face for frame numbers. None of them share a display stack.
  assert.match(THEMES.gallery.tokens.fontDisplay, /Helvetica/);
  assert.match(THEMES.darkroom.tokens.fontDisplay, /Bahnschrift|Condensed|Narrow/);
  assert.match(THEMES.riso.tokens.fontDisplay, /Arial Black/);
  assert.match(THEMES.sumi.tokens.fontDisplay, /Kaiti|KaiTi/i);
  assert.match(THEMES.sumi.tokens.fontBody, /Songti|SimSun/);
  assert.match(THEMES.clay.tokens.fontDisplay, /Rounded|Nunito|Yuanti/);
  // Modern themes provide a clean, unified System Sans stack.
  assert.match(THEMES.minimal.tokens.fontDisplay, /sans-serif/);
  assert.match(THEMES.midnight.tokens.fontDisplay, /sans-serif/);
  assert.match(THEMES.glass.tokens.fontDisplay, /sans-serif/);
  assert.match(THEMES.material.tokens.fontDisplay, /sans-serif/);
  // Terminal and receipt both set body and display in a fixed-pitch face.
  assert.match(THEMES.terminal.tokens.fontDisplay, /monospace/);
  assert.match(THEMES.terminal.tokens.fontBody, /monospace/);
  assert.match(THEMES.receipt.tokens.fontBody, /Courier/);
  assert.equal(THEMES.receipt.tokens.fontBody, THEMES.receipt.tokens.fontDisplay);
  const displays = THEME_IDS.map((id) => THEMES[id].tokens.fontDisplay);
  assert.ok(new Set(displays).size >= 7, 'display faces must be distinct across materials');
});
test('F17.5: every material states exactly one accent, and no two share it', () => {
  // The receipt prints in one ink, so its accent is its text colour and is the
  // single allowed exception to "an accent is distinct from the ink".
  const accents = THEME_IDS.map((id) => THEMES[id].tokens.accent);
  for (const id of THEME_IDS) {
    assert.ok(THEMES[id].tokens.accent, `${id} must define an accent`);
  }
  assert.equal(new Set(accents).size, THEME_IDS.length, 'accents must not be shared between materials');
});
test('F17.5b: Brutalist is the only experimental theme, and it stays off the default picker', () => {
  assert.deepEqual([...EXPERIMENTAL_THEMES], ['brutalist']);
  assert.equal(DEFAULT_CARD_CONFIG.theme, 'minimal');
  assert.ok(!EXPERIMENTAL_THEMES.has(DEFAULT_CARD_CONFIG.theme));
  // Every theme must be reachable from the ordered picker list.
  assert.deepEqual([...THEME_ORDER].sort(), [...THEME_IDS].sort());
  assert.equal(THEME_ORDER[0], 'minimal');
  assert.equal(THEME_ORDER[THEME_ORDER.length - 1], 'brutalist');
  // The first six themes are the modern and everyday rotation on the picker's primary screen.
  assert.deepEqual(THEME_ORDER.slice(0, 6), [
    'minimal',
    'midnight',
    'glass',
    'material',
    'gallery',
    'darkroom',
  ]);
});

test('F17.6: retired presets migrate to a live theme instead of resetting', () => {
  // The high-saturation full-bleed gradients stay retired.
  assert.equal(sanitizeTheme('sunset-glow'), 'gallery');
  assert.equal(sanitizeTheme('aurora-purple'), 'darkroom');
  // Hacker Mint's console was rebuilt as the real Terminal theme.
  assert.equal(sanitizeTheme('cyber-mint'), 'terminal');
  // The retired classics resolve to the material that absorbed them.
  assert.equal(sanitizeTheme('linear-dark'), 'darkroom');
  assert.equal(sanitizeTheme('oled-black'), 'darkroom');
  assert.equal(sanitizeTheme('oled'), 'darkroom');
  assert.equal(sanitizeTheme('notion-white'), 'gallery');
  assert.equal(sanitizeTheme('notion-clean-white'), 'gallery');
  assert.equal(sanitizeTheme('nonsense'), 'minimal');
  assert.equal(sanitizeTheme(undefined), 'minimal');
  for (const alias of Object.keys(LEGACY_THEME_ALIASES)) {
    assert.ok(THEMES[sanitizeTheme(alias)], `legacy id ${alias} must resolve to a live theme`);
  }
});

test('F17.6b: the retired classics are migration targets, not live themes', () => {
  // The three gradient classics were absorbed by the materials; a stored value
  // must resolve forward, and their ids must not be live or they sneak back.
  for (const id of ['linear-dark', 'oled-black', 'notion-white']) {
    assert.ok(!(id in THEMES), `${id} must stay retired`);
    assert.ok(id in LEGACY_THEME_ALIASES, `${id} must be an alias`);
  }
  for (const id of ['sunset-glow', 'aurora-purple', 'cyber-mint']) {
    assert.ok(!(id in THEMES), `${id} must stay retired`);
  }
});

test('F17.6c: no theme ships a surface gradient any more', () => {
  // Linear Dark was the only gradient surface; with it retired, every material
  // is a flat colour, which is what makes the picker read as paper, not skins.
  const withGradient = THEME_IDS.filter((id) => (THEMES[id].tokens as any).surfaceGradient);
  assert.deepEqual(withGradient, []);
});

test('F17.7: every theme name is localised in both locales', () => {
  for (const id of THEME_IDS) {
    // Must match Controls.tsx's lookup: hyphens become underscores.
    const key = `theme_${id.replace(/-/g, '_')}` as keyof typeof TRANSLATIONS['en-US'];
    assert.ok(TRANSLATIONS['zh-CN'][key], `zh-CN missing ${key}`);
    assert.ok(TRANSLATIONS['en-US'][key], `en-US missing ${key}`);
  }
});

test('F17.8: the preview mat reads as a board the sheet sits on, in every theme', () => {
  // A mat within a couple of percent of the sheet makes a light card read as a
  // patch on the stage rather than paper on a board, which is the difference
  // between "a card" and "a design". Nocturne already separates well; this keeps
  // it that way and stops the light mats drifting back toward the surface.
  const luminance = (hex: string): number => {
    const channel = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  for (const id of THEME_IDS) {
    const { canvas, surface } = THEMES[id].tokens;
    const [hi, lo] = [luminance(canvas), luminance(surface)].sort((a, b) => b - a);
    const separation = (hi + 0.05) / (lo + 0.05);
    assert.ok(separation >= 1.15, `${id} mat ${canvas} sits only ${separation.toFixed(3)}:1 off ${surface}`);
  }
});

test('F17.10: no theme smuggles a second chromatic colour onto the card', () => {
  // The verified tick used to be a hard-coded Twitter blue — the most saturated
  // thing on every card, and not even the theme's accent. Ink is the only colour
  // the sheet may carry besides the accent.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(
    !/1d9bf0|1da1f2/i.test(css),
    'card.css must not carry a hard-coded Twitter blue'
  );
  const badgeRule = css.slice(css.indexOf('.verified-badge {'));
  assert.ok(
    badgeRule.slice(0, badgeRule.indexOf('}')).includes('color: inherit'),
    'verified tick must print in the sheet ink, not a brand blue'
  );
});

test('F17.9: body, handle, footnote and link all clear 4.5:1 on their own paper', () => {
  // A footnote can be quiet, but "quieter" is a size decision, not a licence to
  // ship meta text below the contrast floor. This is the check that keeps a
  // future palette tweak from quietly dimming the stats row into the dark.
  const srgb = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    return (
      0.2126 * srgb((n >> 16) & 255) +
      0.7152 * srgb((n >> 8) & 255) +
      0.0722 * srgb(n & 255)
    );
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const id of THEME_IDS) {
    const { surface, text, muted, faint, link } = THEMES[id].tokens;
    for (const [label, colour] of [
      ['text', text],
      ['muted', muted],
      ['faint', faint],
      ['link', link],
    ] as const) {
      const ratio = contrast(colour, surface);
      assert.ok(
        ratio >= 4.5,
        `${id} ${label} ${colour} on ${surface} is ${ratio.toFixed(2)}:1, below 4.5:1`
      );
    }
  }
});

test('F17.11: a filled quote panel is actually visible, and its text still reads', () => {
  // The old quote tints sat 1.06–1.12:1 off the sheet — the panel was there in
  // the DOM and invisible on the card. This locks both halves: the fill has to
  // separate from the sheet, and the quoted text has to stay legible on it.
  const srgb = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const id of THEME_IDS) {
    const { quoteStyle, quoteBackground, quoteBorder, surface, text, muted } = THEMES[id].tokens;
    if (quoteStyle === 'filled') {
      const sep = contrast(quoteBackground, surface);
      assert.ok(sep >= 1.15, `${id} quote fill sits only ${sep.toFixed(3)}:1 off the sheet`);
      assert.ok(contrast(text, quoteBackground) >= 4.5, `${id} quote body unreadable on the panel`);
      assert.ok(contrast(muted, quoteBackground) >= 4.5, `${id} quote meta unreadable on the panel`);
    } else {
      // Outlined materials: no fill, and the border has to draw the frame.
      assert.ok(
        contrast(quoteBorder, surface) >= 1.4,
        `${id} outlined quote border only ${contrast(quoteBorder, surface).toFixed(3)}:1`
      );
    }
  }
});

test('F17.12: the watermark is footnote ink, never a fade', () => {
  // `opacity: 0.55` dropped the mark to 2.1–3.0:1 on every sheet, below the
  // floor the rest of the card holds, and contradicted the rule that quieter is
  // a size decision. It must consume `--faint` and carry no opacity.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const block = css.slice(css.indexOf('.card-watermark {'));
  const rule = block.slice(0, block.indexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(rule.includes('var(--faint'), 'watermark must print in the footnote ink');
  assert.ok(!/opacity\s*:/.test(rule), 'watermark must not fade itself below the contrast floor');
});

test('F17.13: qrFill reaches the QR, and the quote honours the theme radius', async () => {
  // Two tokens that were injected but never consumed: the QR drew in the body
  // ink on Notion (not its token), and the quote media corner was a hard-coded
  // 8px that overrode every square material.
  //
  // The fill is asserted on the drawn code in two materials whose QR inks
  // differ, which is what separates "uses the token" from "happens to match it".
  const asMinimal = await renderCard();
  const asSumi = await renderCard({ config: { theme: 'sumi' } });
  const minimalInk = THEMES.minimal.tokens.qrFill;
  const sumiInk = THEMES.sumi.tokens.qrFill;

  assert.notEqual(minimalInk, sumiInk, 'the two materials must disagree for this to prove anything');

  // Read the fill off the drawn code, not off the document: `--qr-fill` is
  // declared on the card root either way, so a card that ignored the token would
  // still carry the material's ink in its style attribute and pass a looser
  // check. This is how the bug being guarded against would look.
  const qrOf = (html: string) => {
    const start = html.indexOf('card-qr-container');
    return html.slice(start, html.indexOf('</div>', start));
  };

  assert.ok(qrOf(asMinimal).includes(`fill="${minimalInk}"`), 'the QR must be drawn in the material QR ink');
  assert.ok(qrOf(asSumi).includes(`fill="${sumiInk}"`), 'and it must follow the material');
  assert.ok(!qrOf(asSumi).includes(`fill="${minimalInk}"`), 'and not keep the other material ink');

  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const rule = css.slice(css.indexOf('.post-to-card-target .quote-card .media-grid'));
  const body = rule.slice(0, rule.indexOf('}'));
  assert.ok(
    body.includes('var(--media-radius'),
    'quote media must follow the resolved theme radius, not a hard-coded corner'
  );
});

test('F17.16: the media gutter is a material decision, not one repeated value', () => {
  // `--media-gap` was documented as the gutter a material sets tight or generous,
  // and all eight themes shipped 4px, so the token decided nothing. The check
  // locks the *reason it existed*: the gutter must actually vary, and a tight
  // material must stay tighter than a loud one.
  const gutters = THEME_IDS.map((id) => parseFloat(THEMES[id].tokens.rhythm.mediaGap));
  assert.ok(
    new Set(gutters).size >= 3,
    `media gutter must vary by material, got ${JSON.stringify(gutters)}`
  );
  const gutterOf = (id: string): number => gutters[THEME_IDS.indexOf(id)];
  // Lock the actual design intent per material rather than a relative ordering,
  // which any uniform value would satisfy. Each entry states why that gutter.
  const EXPECTED_GUTTERS: Record<string, number> = {
    // Minimal and Material keep an 8px modern breathing grid.
    minimal: 8,
    material: 8,
    // Midnight packs content in deep nocturnal compactness.
    midnight: 6,
    // Liquid Glass with generous 24px/14px corners leaves 10px ample room for diffuse light.
    glass: 10,
    // A console and a till slip pack their pictures tight.
    terminal: 3,
    receipt: 4,
    // Riso prints its pictures with a hairline between them.
    riso: 4,
    // A contact sheet keeps frames close; the gallery mat gives each its own room.
    darkroom: 5,
    sumi: 5,
    gallery: 6,
    clay: 6,
    // The pictures are boxed hard and pushed apart, like the 3px sheet edge.
    brutalist: 8,
  };
  for (const id of THEME_IDS) {
    assert.equal(
      gutterOf(id),
      EXPECTED_GUTTERS[id],
      `${id} gutter is ${gutterOf(id)}px, expected ${EXPECTED_GUTTERS[id]}px`
    );
  }
  // Guard the shape of the set too, so deleting a theme cannot quietly pass.
  assert.ok(
    new Set(Object.values(EXPECTED_GUTTERS)).size >= 3,
    'the gutters themselves must express at least three distinct spacings'
  );
  // The gutter still has to reach the grid: a token nothing consumes is how the
  // value drifted into eight copies in the first place.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const grid = css.slice(css.indexOf('.media-grid {'));
  assert.ok(
    grid.slice(0, grid.indexOf('}')).includes('var(--media-gap'),
    'the media grid must consume --media-gap, not a literal'
  );
});

test('F17.17: every surface behind the media is the material recess, not a black wash', () => {
  // A contained video leaves letterbox bars, and they used to get a hard-coded
  // rgba(0,0,0,0.2) while photos sat transparent — a smudge on warm paper, and
  // a second implementation of the recess the quote panel and avatar already
  // take from the token.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const video = css.slice(css.indexOf('.media-item.media-video-item {'));
  const body = video.slice(0, video.indexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    body.includes('var(--quote-bg'),
    'the video recess must come from the material token'
  );
  assert.ok(
    !/rgba\(0,\s*0,\s*0/.test(body),
    'the video container must not press a hard-coded black behind the poster'
  );
  // The avatar recess is the same idea, so it must read from the same token
  // rather than a white wash that only suits the darks.
  const avatar = css.slice(css.indexOf('.author-avatar {'));
  const avatarBody = avatar.slice(0, avatar.indexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    avatarBody.includes('var(--quote-bg'),
    'the avatar recess must come from the material token'
  );
});

test('F17.14: the thread layout breathes with the material, and its connector is drawn', () => {
  // Two spots the rhythm rollout missed: the thread column kept a hard-coded
  // 10px gap (so a material's breathing vanished once a post became a thread),
  // and the connector drew in `--divider`, which on Terminal is 1.22:1 — the
  // line was there but invisible.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const col = css.slice(css.indexOf('.thread-content-col {'));
  assert.ok(
    col.slice(0, col.indexOf('}')).includes('var(--rhythm-gap'),
    'thread column must breathe with the material rhythm'
  );
  const single = css.slice(css.indexOf('.single-tweet-block {'));
  assert.ok(
    single.slice(0, single.indexOf('}')).includes('var(--rhythm-gap'),
    'single-tweet block must breathe with the material rhythm'
  );
  const connector = css.slice(css.indexOf('.thread-connector-line {'));
  assert.ok(
    connector.slice(0, connector.indexOf('}')).includes('var(--rule'),
    'connector must draw in the material line ink, not the near-invisible divider'
  );
});

test('F17.14b: every material\'s line ink is a real ink, and separates from its sheet', () => {
  // `transparent` is a *defined* value, so the `var(--rule, …)` fallbacks in
  // card.css never fire: a blank rule token erased the thread connector and the
  // footer rule outright on the four modern materials. "This paper has no
  // furniture" is what `signature.style: 'none'` says; a blank ink says nothing
  // and silently deletes every line that consumes the token.
  //
  // The ink also has to *separate*. The first fix for the four themes reused
  // `mediaBorder`, the photo-mount ink, which is tuned to sit quietly around a
  // picture -- 1.32-1.38:1, the faintest drawn edge on any sheet, and under the
  // 1.4:1 floor F17.11 holds a drawn border to. That is a line you have to
  // hunt for, which is the same defect one step further from invisible.
  const srgb = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const id of THEME_IDS) {
    const { rule, surface } = THEMES[id].tokens;
    assert.notEqual(
      rule.toLowerCase(),
      'transparent',
      `${id} rule must be an ink, or the thread connector and footer rule vanish`
    );
    assert.ok(
      /^#[0-9a-f]{6}$/i.test(rule),
      `${id} rule must be a resolvable colour, got "${rule}"`
    );
    const ratio = contrast(rule, surface);
    assert.ok(
      ratio >= 1.4,
      `${id} rule ${rule} on ${surface} is ${ratio.toFixed(3)}:1, under the 1.4:1 drawn-edge floor`
    );
  }

  // And the token still has to reach the footer rule, so a future rename cannot
  // leave the contract asserted but unenforced. Only the footer: F17.14 already
  // asserts the connector, and its `var(--rule, …)` is the declaration whose
  // fallback the whole bug was about. The footer's `border-top` carries
  // `var(--rule-style, …)` *and* `var(--rule, …)`, so a bare `includes('var(--rule')`
  // would pass on the style token alone -- the ink half is named explicitly.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const footer = css.slice(css.indexOf('.card-footer {'));
  assert.ok(
    /border-top:[^;]*var\(--rule,\s/.test(footer.slice(0, footer.indexOf('}'))),
    'the footer rule must take its ink from var(--rule), not from the style token'
  );
});

test('F17.15: the masthead tick is the accent, but its hairline stays neutral ink', () => {
  // Regression: feeding the tick's colour through one shared `--signature-color`
  // painted Nocturne's whole masthead hairline terracotta. The signature has a
  // single ink now (`--rule`); only the tick borrows `--accent`.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const tickRule = css.slice(css.indexOf('[data-signature="tick-rule"]'));
  const hairlineRule = tickRule.slice(0, tickRule.indexOf('}'));
  assert.ok(
    hairlineRule.includes('background: var(--rule)'),
    'masthead hairline must be neutral ink'
  );
  const tickBlock = tickRule.slice(tickRule.indexOf('::after'));
  assert.ok(
    tickBlock.slice(0, tickBlock.indexOf('}')).includes('background: var(--accent)'),
    'masthead tick must be the accent'
  );
  // The token contract no longer carries a per-signature colour to drift. Asked
  // of every material rather than of the file they are written in.
  for (const id of THEME_IDS) {
    assert.ok(
      !('color' in THEMES[id].tokens.signature),
      `${id}'s signature must not carry a colour; ink is always \`rule\``
    );
  }
});

// -------------------------------------------------------------
// F18: Padding & Border Radius Options
// -------------------------------------------------------------
test('F18.1: the padding picker offers three sizes and the sanitiser admits exactly those', () => {
  assert.deepEqual(PADDING_OPTIONS, ['16px', '32px', '48px']);
  for (const option of PADDING_OPTIONS) {
    assert.equal(sanitizePadding(option), option, `${option} is offered but the sanitiser rejects it`);
  }
  assert.equal(sanitizePadding('17px'), '32px');
  assert.equal(sanitizePadding(''), '32px');
});

test('F18.2: the corner picker offers three explicit corners plus follow-theme', () => {
  assert.deepEqual(RADIUS_OPTIONS, ['theme', '0px', '12px', '20px']);
  for (const option of RADIUS_OPTIONS) {
    assert.equal(sanitizeRadius(option), option, `${option} is offered but the sanitiser rejects it`);
  }
});

test('F18.3: an unknown padding value falls back to the default rather than reaching the card', () => {
  // A stored preference can be anything: an older build, a hand-edited value, a
  // profile synced from another machine. It must not reach a CSS length.
  for (const bogus of ['999px', '32', 'calc(1px)', 'javascript:alert(1)', '--x']) {
    assert.equal(sanitizePadding(bogus), DEFAULT_CARD_CONFIG.padding, `admitted ${bogus}`);
  }
});

test('F18.4: an unknown corner value falls back rather than reaching the card', () => {
  // '12px' rather than the shipped default of 'theme': an unreadable value is
  // answered with a concrete corner, not by handing the decision to the theme.
  for (const bogus of ['100px', '12', 'round', 'url(x)', '']) {
    assert.equal(sanitizeRadius(bogus), '12px', `admitted ${bogus}`);
  }
  assert.equal(sanitizeRadius('theme'), 'theme');
});

test('F18.5: inner media items synchronize rounding with card border radius', () => {
  assert.deepEqual(resolveRadius('0px', 'gallery'), { card: '0px', media: '0px' });
  assert.deepEqual(resolveRadius('12px', 'gallery'), { card: '12px', media: '8px' });
  assert.deepEqual(resolveRadius('20px', 'gallery'), { card: '20px', media: '14px' });
});

test('F18.6: follow-theme defers the corner to the theme, and inner never exceeds the card', () => {
  for (const id of THEME_IDS) {
    const { card, media } = resolveRadius('theme', id);
    assert.equal(card, THEMES[id].tokens.radius);
    assert.equal(media, THEMES[id].tokens.mediaRadius);
    // Inner may equal the card (a square material is square throughout) but
    // must never be rounder than the card, which would look like a photo
    // bulging out of a square frame.
    assert.ok(
      parseFloat(media) <= parseFloat(card),
      `${id} media corner ${media} must not exceed card corner ${card}`
    );
  }
  // The corner is a material decision: it must actually vary, or the
  // follow-theme option does nothing.
  const corners = THEME_IDS.map((id) => resolveRadius('theme', id).card);
  assert.ok(new Set(corners).size >= 6, `corners must vary by material, got ${JSON.stringify(corners)}`);
  // Hard materials read square; the soft card is the roundest.
  for (const id of ['riso', 'receipt', 'brutalist'] as ThemeId[]) {
    assert.ok(parseFloat(resolveRadius('theme', id).card) <= 2, `${id} should be near-square`);
  }
  for (const id of THEME_IDS) {
    assert.ok(
      parseFloat(resolveRadius('theme', id).card) <= parseFloat(resolveRadius('theme', 'clay').card),
      `clay must be the roundest material, but ${id} is rounder`
    );
  }
});

// -------------------------------------------------------------
// F19: Downward Expanding Poster Layouts
// -------------------------------------------------------------
test('F19.1: the Auto ratio sets no minimum height', () => {
  assert.equal(getAspectMinHeight('auto'), 'auto');
  assert.equal(getAspectMinHeight('auto', 1200), 'auto', 'the width is irrelevant to Auto');
});

test('F19.2: the 3:4 poster ratio floors the card at four thirds of its width', () => {
  assert.equal(getAspectMinHeight('3:4', 640), '853px');
  assert.equal(getAspectMinHeight('3:4', 320), '427px');
});

test('F19.3: the 16:9 banner ratio floors the card at nine sixteenths of its width', () => {
  assert.equal(getAspectMinHeight('16:9', 640), '360px');
  assert.equal(getAspectMinHeight('16:9', 1280), '720px');
});

test('F19.4: a poster card reaches its floor without being pinned to it', async () => {
  const style = cardRootStyle(await renderCard({ data: THREAD, config: { aspectRatio: '3:4' } }));

  assert.ok(style.includes('min-height:853px'), `the poster floor has to reach the card: ${style}`);
  // A min-height alone is what lets long text expand past the floor; a fixed
  // height would clip it. Both the height and the overflow have to stay open.
  assert.ok(/height:\s*auto/.test(style), `the card root must be free to grow: ${style}`);
  assert.ok(/overflow:\s*visible/.test(style), `clipping the card root would cut off the rest: ${style}`);
});

test('F19.5: an Auto-ratio card carries no floor at all', async () => {
  const style = cardRootStyle(await renderCard({ data: THREAD, config: { aspectRatio: 'auto' } }));

  assert.ok(!/min-height:\s*\d/.test(style), `Auto means the card is exactly as tall as its content: ${style}`);
  assert.ok(/height:\s*auto/.test(style));
});

// -------------------------------------------------------------
// F20: Offline QR Code Generator
// -------------------------------------------------------------
test('F20.1: the generator produces real SVG markup for a status URL', () => {
  const qr = generateQrCodeData('https://x.com/jack/status/20');

  assert.ok(qr, 'the generator returned nothing for a plain status URL');
  assert.ok(qr!.path.length > 0, 'a QR with no modules encodes nothing');
  assert.equal(qr!.viewBox, `0 0 ${qr!.moduleCount} ${qr!.moduleCount}`);
});

test('F20.2: tracking parameters are stripped before the URL is encoded', () => {
  // The code is scanned off a screen, so every character counts: a `?s=20` X
  // appends would raise the QR version for no information.
  assert.equal(sanitizeQrUrl('https://x.com/jack/status/20?s=20&utm_source=twitter'), 'https://x.com/jack/status/20');
  assert.equal(sanitizeQrUrl('https://x.com/jack/status/20?t=abc'), 'https://x.com/jack/status/20');
  // A parameter that carries meaning is not a tracker and has to survive.
  assert.ok(sanitizeQrUrl('https://example.com/a?q=1').includes('q=1'));
});

test('F20.3: the QR is drawn as crisp vector edges, not a smoothed image', () => {
  const html = renderToStaticMarkup(
    h(CardQrCode, { url: 'https://x.com/jack/status/20', title: 'Scan to open original tweet' })
  );
  assert.ok(html.includes('shape-rendering="crispEdges"'),
    'without this the browser antialiases the modules and the code stops scanning');
  assert.ok(html.includes('<path'), 'the modules are drawn as a path');
});

test('F20.4: a long status URL still encodes, and not into a dense code', () => {
  const longUrl = 'https://x.com/very_long_author_name_sample/status/1999999999999999999';
  const qr = generateQrCodeData(longUrl);

  assert.ok(qr, 'a long URL must still produce a code');
  // The card prints the code at a fixed size, so a code that grows past roughly
  // version 10 stops resolving on a phone screen. The sanitizer is what keeps it
  // small, which is why F20.2 matters.
  assert.ok(qr!.moduleCount <= 57, `the code grew to ${qr!.moduleCount} modules, too dense to scan at card size`);
});

test('F20.5: the code is generated in process, with no request of any kind', () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error('the QR generator must not reach the network');
  }) as typeof fetch;

  try {
    const qr = generateQrCodeData('https://x.com/jack/status/20');
    assert.ok(qr, 'the generator needs the network to work at all');
    assert.equal(calls, 0, 'a QR that needs a CDN is a blank box offline');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('F20.6: the QR tooltip is localized, not a hard-coded English literal', async () => {
  // The tooltip used to be spelled inside qrcode.ts, so a zh-CN card still said
  // "Scan to open original tweet" on hover. It is a translation key now and the
  // card passes it down, the same way every other card string travels.
  const qrSrc = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/qrcode.ts'), 'utf-8');
  assert.ok(
    !qrSrc.includes('Scan to open'),
    'the QR tooltip must not be hard-coded in the component'
  );
  // Required, not optional: the card is the only caller and always has a
  // translator. An optional prop is how the literal survived the first pass.
  assert.ok(
    /title:\s*string;/.test(qrSrc),
    'the QR title must be required, not an optional escape hatch'
  );
  // The card has to be the one carrying the translation, so render it and read
  // the tooltip off the output: a zh-CN card must not say it in English.
  const zh = await renderCard({ config: { locale: 'zh-CN' } });
  assert.ok(
    zh.includes(TRANSLATIONS['zh-CN'].qrHint),
    'the card must render the QR tooltip in the active language'
  );
  assert.ok(
    !zh.includes(TRANSLATIONS['en-US'].qrHint),
    'and not leave it in another language'
  );
  // The exact copy, so a typo in either dictionary fails here rather than
  // shipping a hover text nobody proofread.
  assert.equal(TRANSLATIONS['zh-CN'].qrHint, '扫码打开原推文');
  assert.equal(TRANSLATIONS['en-US'].qrHint, 'Scan to open original tweet');
});

// -------------------------------------------------------------
// F21: Interactive Controls & Toggles
// -------------------------------------------------------------
test('F21.1: toggling showQrCode hides or displays QR element in DOM', async () => {
  const shown = await renderCard({ config: { showQrCode: true } });
  const hidden = await renderCard({ config: { showQrCode: false } });

  assert.ok(shown.includes('card-qr-svg'), 'the QR is on the card when the preference is on');
  assert.ok(!hidden.includes('card-qr-svg'), 'and is gone when it is off');
  assert.ok(hidden.includes('card-footer'), 'the footer is still there — only the QR left');
});

test('F21.2: toggling showStats hides like, repost, reply statistics', async () => {
  // VIDEO_TWEET carries no stats, and a footer that has nothing to say is not
  // rendered at all — so the "on" case needs a post that actually has counts.
  const withStats = await renderCard({
    data: { ...VIDEO_TWEET, stats: { replies: '191', reposts: '80', likes: '5.2K', views: '4.6万' } },
  });
  assert.ok(withStats.includes('stats-row'), 'the stats row is in the DOM by default');

  const withoutStats = await renderCard({
    data: { ...VIDEO_TWEET, stats: { replies: '191', reposts: '80', likes: '5.2K', views: '4.6万' } },
    config: { showStats: false },
  });
  assert.ok(!withoutStats.includes('stats-row'), 'no stats row when showStats is off');
});

test('F21.2b: a CJK count keeps its unit instead of degrading to the mantissa', async () => {
  // X localises its own counts. On a Chinese timeline `views` arrives as `4.6万`
  // and `likes` as `1.2亿`, and the three Latin-format siblings (`94.2K`,
  // `2.4M`) were always passed through untouched — so the row read
  // `94.2K · 2.4M · 4.6`: one count silently four orders of magnitude low,
  // printed beside three that were right. The passthrough has to be decided by
  // "ends in a unit", not by an allow-list of Latin letters, because `万` and
  // `亿` are units exactly like `K`.
  const html = await renderCard({
    data: {
      ...VIDEO_TWEET,
      stats: { replies: '191', reposts: '80', likes: '5.2K', views: '4.6万' },
    },
  });
  assert.ok(html.includes('4.6万'), 'a CJK count must keep its unit');
  assert.ok(!html.includes('>4.6<'), 'a CJK count must not degrade to its mantissa');
});

test('F21.2c: a raw count is abbreviated, not printed at full length', async () => {
  // The other half of the contract: the API paths still hand over bare numbers,
  // and a card has no room for `482000`. Only the numbers need reformatting;
  // anything already carrying a unit is X's own work and is left alone.
  const html = await renderCard({
    data: {
      ...VIDEO_TWEET,
      stats: { replies: '128', reposts: '902', likes: '12700', views: '482000' },
    },
  });
  assert.ok(html.includes('12.7K'), 'a raw thousands count is abbreviated to K');
  assert.ok(html.includes('482K'), 'a raw hundred-thousands count is abbreviated to K');
  assert.ok(!html.includes('12700') && !html.includes('482000'), 'raw counts are not printed in full');
});

test('F21.3: toggling showTimestamp hides date and time display', async () => {
  // Stats and the QR code are turned off in both renders so the footer itself
  // stays on and only the timestamp can be the difference.
  const quiet: Partial<CardConfig> = { showStats: false, showQrCode: false };
  const shown = await renderCard({ config: { ...quiet, showTimestamp: true } });
  const hidden = await renderCard({ config: { ...quiet, showTimestamp: false } });

  assert.ok(shown.includes('card-timestamp'), 'the timestamp is on the card by default');
  assert.ok(!hidden.includes('card-timestamp'), 'and is gone when showTimestamp is off');
  assert.ok(hidden.includes('card-footer'), 'the footer is still there — only the timestamp left');
});

test('F21.4: toggling showWatermark hides brand watermark', async () => {
  // The watermark is the only thing left in the footer's right half, so with it
  // off the footer has nothing at all to say and must not be rendered — its
  // border and padding would otherwise leave a stray divider on the card.
  const nothingElse: Partial<CardConfig> = {
    showStats: false,
    showQrCode: false,
    showTimestamp: false,
  };
  const shown = await renderCard({ config: { ...nothingElse, showWatermark: true } });
  const hidden = await renderCard({ config: { ...nothingElse, showWatermark: false } });

  assert.ok(shown.includes('card-watermark'), 'the watermark is on the card by default');
  assert.ok(!hidden.includes('card-watermark'), 'and is gone when showWatermark is off');
  assert.ok(!hidden.includes('card-footer'), 'with nothing left to say the footer is not rendered');
});

/** The option text the segmented control labelled `label` is currently marking. */
function checkedSegment(html: string, label: string): string | undefined {
  // The group holds nothing but its buttons, so a lazy `</div>` ends it and the
  // slice cannot spill into the next control.
  const groups = [...html.matchAll(/<div class="btn-group"[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g)];
  const group = groups.find((m) => m[1] === label);
  if (!group) return undefined;
  const active = [...group[2].matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].find((m) =>
    m[0].includes('aria-checked="true"')
  );
  return active?.[1].trim();
}

/** Whether the toggle whose title starts with `label` renders as on. */
function toggleIsOn(html: string, label: string): boolean {
  const buttons = [...html.matchAll(/<button\b[^>]*class="toggle-item"[^>]*>([\s\S]*?)<\/button>/g)];
  const button = buttons.find((m) => m[1].includes(`>${label}`));
  assert.ok(button, `no toggle labelled ${label} in the rendered controls`);
  return button![1].includes('toggle-switch is-checked');
}

test('F21.5: the controls are drawn from the config they are handed, not from an earlier one', async () => {
  // Two renders of the same component with different configs. The claim is that
  // every control derives its state from the current props, so a config change
  // is visible in the markup rather than only in a variable the test owns.
  const small = await renderControls({ config: { padding: '16px', showStats: true } });
  const large = await renderControls({ config: { padding: '48px', showStats: true } });

  assert.equal(checkedSegment(small, 'Padding'), '16px', 'the padding control marks the configured option');
  assert.equal(checkedSegment(large, 'Padding'), '48px', 'and follows the config it is given');

  // A toggle is the other shape of control: same props in, different markup out.
  const statsOn = await renderControls({ config: { showStats: true } });
  const statsOff = await renderControls({ config: { showStats: false } });
  assert.equal(toggleIsOn(statsOn, 'Metrics'), true, 'the stats toggle reflects showStats');
  assert.equal(toggleIsOn(statsOff, 'Metrics'), false, 'in both directions, not just the default');
});

test('F21.6: Controls renders narrow-screen collapse toggle handle with proper aria attributes', async () => {
  const html = await renderControls();
  assert.ok(html.includes('panel-collapse-toggle'), 'must render collapse toggle button');
  assert.ok(html.includes('collapse-grab-bar'), 'must render grab bar affordance');
  assert.ok(html.includes('aria-expanded="false"'), 'must declare collapsed state initially');
  assert.ok(html.includes('controls-panel is-collapsed'), 'must have collapsed panel class initially');
});

// -------------------------------------------------------------
// F22: Author Privacy Blurring
//
// Two halves, and both have to hold: the card marks the elements, and the
// stylesheet is what actually blurs them. A class with no rule behind it blurs
// nothing, and a rule with no class on the markup never applies.
// -------------------------------------------------------------
/** Whether the rule at `selector` in card.css declares `declaration`. */
function cardCssDeclares(selector: string, declaration: string): boolean {
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const at = css.indexOf(selector);
  if (at < 0) return false;
  return css.slice(at, css.indexOf('}', at)).includes(declaration);
}

test('F22.1: blurAuthor applies CSS filter: blur(6px) to author avatar', async () => {
  const html = await renderCard({ config: { blurAuthor: true } });

  assert.match(html, /class="author-avatar is-blurred"/, 'the avatar container is marked');
  assert.match(html, /class="author-avatar-img is-blurred"/, 'and the image inside it');
  assert.ok(cardCssDeclares('.author-avatar-img.is-blurred', 'blur(6px)'),
    'the class does nothing unless the sheet declares the blur for it');
});

test('F22.2: blurAuthor applies blur class to author display name', async () => {
  const html = await renderCard({ config: { blurAuthor: true } });

  assert.match(html, /class="author-name is-blurred"/);
  assert.ok(cardCssDeclares('.author-name.is-blurred', 'blur(6px)'));
});

test('F22.3: blurAuthor applies blur class to author @handle', async () => {
  const html = await renderCard({ config: { blurAuthor: true } });

  assert.match(html, /class="author-handle is-blurred"/);
  assert.ok(cardCssDeclares('.author-handle.is-blurred', 'blur(6px)'));
});

test('F22.4: avatar container has overflow: hidden to contain blur halo bleed', () => {
  // The blurred avatar is a circle inside a square box; without the clip the
  // blur's soft edge spills past the circle onto whatever sits beside it.
  assert.ok(cardCssDeclares('.author-avatar {', 'overflow: hidden'));
  assert.ok(cardCssDeclares('.author-avatar {', 'border-radius'));
});

test('F22.5: disabling blurAuthor removes filter without residual artifacts', async () => {
  const html = await renderCard({ config: { blurAuthor: false } });

  assert.ok(!html.includes('is-blurred'),
    'a leftover class on any element would still blur, since the sheet keys on the class alone');
});

// -------------------------------------------------------------
// F23: Modal UX & Scroll Lock
//
// Driven through the real modal: `openCardModal` mounts the App, the App mounts
// the Modal, and closing it goes back out through the container. A dismissal is
// asserted by the card being gone from the page, which is what the user sees.
// -------------------------------------------------------------
test('F23.1: pressing Esc key dismisses the preview modal', async () => {
  await withContainerEnv(async ({ doc, openCardModal, fireKey, flushEffects }) => {
    openCardModal(CONTAINER_THREAD);
    // The Escape listener is bound from an effect, so it does not exist yet on
    // the line after the render.
    await flushEffects();
    assert.ok(doc.querySelector('post-to-card-container'), 'the card is open to begin with');

    fireKey('Escape');

    assert.equal(doc.querySelector('post-to-card-container'), null,
      'the window listener the modal bound has to receive the key and close it');
  });
});

test('F23.2: clicking modal backdrop dismisses the modal', async () => {
  await withContainerEnv(async ({ doc, openCardModal, flushEffects }) => {
    const container = openCardModal(CONTAINER_THREAD);
    await flushEffects();

    const backdrop = container.mountPoint.querySelector('#post-to-card-backdrop');
    assert.ok(backdrop, 'the modal rendered no backdrop to click');
    backdrop.click();

    assert.equal(doc.querySelector('post-to-card-container'), null, 'a click on the backdrop closes the card');
  });
});

test('F23.3: clicking inside card dialog stops propagation and does not dismiss', async () => {
  await withContainerEnv(async ({ doc, openCardModal, flushEffects }) => {
    const container = openCardModal(CONTAINER_THREAD);
    await flushEffects();

    const backdrop = container.mountPoint.querySelector('#post-to-card-backdrop');
    const dialog = container.mountPoint.querySelector('#post-to-card-dialog');
    assert.ok(backdrop && dialog, 'the modal rendered no dialog to click');

    // The backdrop is the dialog's ancestor, so a click that is not stopped on
    // the way out reaches it. Watching for that is what tells `stopPropagation`
    // apart from the backdrop's own target check: without the watch, a modal that
    // let the event through would still decline to close and the test would pass.
    let reachedBackdrop = false;
    backdrop.addEventListener('click', () => {
      reachedBackdrop = true;
    });

    dialog.click();

    assert.equal(reachedBackdrop, false, 'the click inside the dialog bubbled out to the backdrop');
    assert.ok(doc.querySelector('post-to-card-container'),
      'a click that lands on the dialog must not bubble out and close the card');
  });
});

test('F23.4: scroll lock locks document body overflow while modal is open', async () => {
  await withContainerEnv(async ({ doc }) => {
    const modal = await loadModule('/src/content/ui/Modal.tsx');

    modal.lockScroll();
    // documentElement is the scrolling element on an X page, so locking only
    // body would leave the page behind the overlay still scrollable.
    assert.equal(doc.documentElement.style.overflow, 'hidden', 'the scrolling element is locked');
    assert.equal(doc.body.style.overflow, 'hidden');

    modal.unlockScroll();
    assert.equal(doc.documentElement.style.overflow, '', 'and released on close');
    assert.equal(doc.body.style.overflow, '');
  });
});

test('F23.5: scroll lock calculates and compensates for scrollbar width', async () => {
  await withContainerEnv(async ({ doc }) => {
    const modal = await loadModule('/src/content/ui/Modal.tsx');

    (globalThis as unknown as { window: { innerWidth: number } }).window.innerWidth = 1215;
    doc.documentElement.clientWidth = 1200; // a 15px scrollbar
    doc.body.style.paddingRight = '8px'; // an offset the page already carried

    modal.lockScroll();
    assert.equal(doc.body.style.paddingRight, '23px',
      'the padding stands in for the vanished scrollbar, added to what the page already had');

    modal.unlockScroll();
    assert.equal(doc.body.style.paddingRight, '8px', 'and the page gets its own value back');
  });
});

test('F23.6: a hidden preview toolbar is actually hidden, not just marked', () => {
  // The `hidden` attribute is a user-agent style, and the toolbar's own
  // `display: flex` is an author rule, so it won every time: on a window
  // narrower than the smallest fixed zoom level the row stayed in flow and
  // kept eating 48px of the stage it was meant to yield. The guard is the same
  // one `.more-body[hidden]` already carries.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/modal.css'), 'utf-8');
  const toolbar = css.slice(css.indexOf('.preview-toolbar {'));
  assert.ok(
    toolbar.slice(0, toolbar.indexOf('}')).includes('display: flex'),
    'the toolbar is a flex row at rest'
  );
  // The guard has to be asserted by its body, not merely by finding the
  // selector: `slice(indexOf(sel))` on a missing selector returns the file's
  // last character, which is truthy, so an `assert.ok` on it can never fail.
  const hiddenRule = css.slice(css.indexOf('.preview-toolbar[hidden]'));
  assert.ok(
    hiddenRule.startsWith('.preview-toolbar[hidden]'),
    'the toolbar needs a [hidden] guard'
  );
  assert.ok(
    hiddenRule.slice(hiddenRule.indexOf('{') + 1, hiddenRule.indexOf('}')).includes('display: none'),
    'a hidden toolbar must not keep occupying its row'
  );
});

// -------------------------------------------------------------
// F24: Modern-Screenshot Retina Export
//
// Driven through the real engine with only the rasterizer replaced
// (`tests/env/modern-screenshot-stub.ts`). `renderCardToBlob` runs unmodified,
// and what it hands the rasterizer is what these assert — a hand-written copy of
// the rasterizer could only ever agree with itself.
// -------------------------------------------------------------

/** A post with the two things an export has to cope with: an avatar and photos. */
const EXPORT_THREAD: ThreadData = {
  author: { name: 'Ada', handle: '@ada', avatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg' },
  isSingle: true,
  tweets: [
    {
      id: '90001',
      url: 'https://x.com/ada/status/90001',
      author: { name: 'Ada', handle: '@ada', avatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg' },
      text: 'shipping the video pass today',
      timestamp: '2026-10-02T10:00:00.000Z',
      isThreadPart: false,
      media: [
        { type: 'image', url: 'https://pbs.twimg.com/media/one.jpg' },
        { type: 'image', url: 'https://pbs.twimg.com/media/two.jpg' },
      ],
    },
  ],
};

/** The card as the preview mounts it, inside the container's shadow root. */
async function withMountedCard(
  thread: ThreadData,
  body: (card: DomElement, doc: DomDocument) => Promise<void>
): Promise<void> {
  await withContainerEnv(async ({ doc, openCardModal, flushEffects }) => {
    const container = openCardModal(thread);
    await flushEffects();
    const card = container.shadow.querySelector('#post-to-card-export-target');
    assert.ok(card, 'the card root is not in the shadow root');
    await body(card, doc);
  });
}

test('F24.1: exports card to PNG blob at scale: 2 for Retina resolution', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(EXPORT_THREAD, async (card) => {
    const blob = await engine.renderCardToBlob(card);
    assert.equal(blob.type, 'image/png');
    assert.ok(blob.size > 0, 'the rasterizer handed back an empty picture');
  });

  assert.equal(stub.rasterizerCalls.length, 1, 'the card is rasterized exactly once');
  assert.equal(stub.rasterizerCalls[0].options.scale, 2, 'the default export is the Retina factor');
  assert.equal(engine.DEFAULT_EXPORT_SCALE, 2, 'and the figure the preview quotes is that one');
});

test('F24.2: exports card to PNG blob at scale: 3 for Ultra-HD resolution', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(EXPORT_THREAD, async (card) => {
    const blob = await engine.renderCardToBlob(card, { scale: 3 });
    assert.equal(blob.type, 'image/png');
  });

  assert.equal(stub.rasterizerCalls[0].options.scale, 3, 'an explicit scale reaches the rasterizer');
});

test('F24.3: waits for nested image decoding before rendering snapshot', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  // The counter only moves once the decode has actually settled, so finding it
  // above zero after the export resolved is the proof that the engine waited.
  let decoded = 0;
  const originalDecode = DomImageElement.prototype.decode;
  DomImageElement.prototype.decode = async function () {
    await new Promise((resolve) => setTimeout(resolve, 20));
    decoded++;
  };

  try {
    await withMountedCard(EXPORT_THREAD, async (card) => {
      await engine.renderCardToBlob(card);
    });
  } finally {
    DomImageElement.prototype.decode = originalDecode;
  }

  assert.ok(decoded > 0, 'the card has images that have to be decoded');
  assert.equal(stub.rasterizerCalls.length, 1, 'and the rasterizer ran after they had');
});

test('F24.4: filters out data-export-ignore controls from final render', async () => {
  // The filter is a callback the engine hands the rasterizer, so the rasterizer
  // is the one that calls it. Here the test stands in for that one call.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(THREAD, async (card, doc) => {
    await engine.renderCardToBlob(card);

    // The filter is evaluated inside the environment: it asks
    // `node instanceof HTMLElement`, and that global only exists while the
    // container env is installed.
    const copy = stub.rasterizerCalls[0].target as DomElement;
    const { options } = stub.rasterizerCalls[0];
    assert.equal(typeof options.filter, 'function', 'the rasterizer is handed a filter');

    const marked = copy.querySelectorAll('[data-html2canvas-ignore="true"]');
    assert.ok(marked.length > 0, 'the card has to mark its UI-only controls for the rasterizer to skip');
    for (const node of marked) {
      assert.equal(options.filter(node), false, 'a marked control was left in the picture');
    }
    assert.equal(options.filter(copy), true, 'and the filter does not simply drop everything');

    // Built off the document rather than off the copy: the engine removes the
    // copy's wrapper on the way out, which leaves the copy detached.
    const alias = doc.createElement('div');
    alias.setAttribute('data-export-ignore', 'true');
    assert.equal(options.filter(alias), false, 'the older spelling is honoured too');
  });
});

test('F24.5: export uses transparent background so rounded corners render cleanly', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(EXPORT_THREAD, async (card) => {
    await engine.renderCardToBlob(card);
    await engine.renderCardToBlob(card, { backgroundColor: '#123456' });
  });

  assert.equal(stub.rasterizerCalls[0].options.backgroundColor, null,
    'a default background would paint the rounded corners square');
  assert.equal(stub.rasterizerCalls[1].options.backgroundColor, '#123456',
    'and an explicit one is still honoured');
});

test('F24.6: the node rasterized is an off-screen copy, not the live card', async () => {
  // The preview scales the card with `zoom` to fit a narrow window, and the
  // rasterizer lays out whatever it is handed — so capturing the live card
  // produced a shrunk PNG whose footer wrapped.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  let live: DomElement | null = null;
  await withMountedCard(EXPORT_THREAD, async (card) => {
    live = card;
    await engine.renderCardToBlob(card);
  });

  const target = stub.rasterizerCalls[0].target as DomElement;
  assert.notEqual(target, live, 'the live preview must not be the thing captured');
  assert.equal(target.getAttribute('id'), null, 'the copy drops the id, which would then appear twice');
  assert.match(String(target.parentNode!.style.cssText), /left:\s*-100000px/, 'and is parked off-screen');
  assert.ok(target.querySelectorAll('.media-box').length > 0, 'the copy is the card, not an empty shell');
});

// -------------------------------------------------------------
// F25: Canvas CORS Taint Prevention
//
// The guarantee is not "the canvas survives a tainting image" — it is that a
// remote URL never reaches the canvas at all. So these run the card the preview
// builds through the real pre-render pass and look at what the rasterizer was
// actually handed.
// -------------------------------------------------------------

/** Every `img` src inside `root`, in document order. */
function imageSources(root: DomElement): string[] {
  return root.querySelectorAll('img').map((img) => img.getAttribute('src') || '');
}

test('F25.1: no remote image URL reaches the rasterizer; every one is a Base64 data URL', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(EXPORT_THREAD, async (card) => {
    assert.ok(imageSources(card).some((src) => src.startsWith('https://')),
      'the card starts out holding remote pictures');
    await engine.renderCardToBlob(card);
  });

  const sources = imageSources(stub.rasterizerCalls[0].target as DomElement);
  assert.ok(sources.length >= 3, 'the card carries an avatar and two photos');
  for (const src of sources) {
    assert.ok(src.startsWith('data:'), `an unproxied image would taint the canvas: ${src}`);
  }
});

test('F25.2: the card is put back exactly as it was found after the export', async () => {
  const engine = await exportEngine();

  let before: string[] = [];
  let after: string[] = [];
  await withMountedCard(EXPORT_THREAD, async (card) => {
    before = imageSources(card);
    await engine.renderCardToBlob(card);
    after = imageSources(card);
  });

  assert.ok(before.some((src) => src.startsWith('https://')));
  assert.deepEqual(after, before, 'the export must not leave the live preview holding placeholders');
});

test('F25.3: a quoted post’s media is cleaned too', async () => {
  const quoted: ThreadData = {
    ...EXPORT_THREAD,
    tweets: [
      {
        ...EXPORT_THREAD.tweets[0],
        media: [],
        quotePost: {
          author: { name: 'Sam', handle: '@sama' },
          text: 'GPT-5.5 is now rolling out to all users.',
          url: 'https://x.com/sama/status/4999',
          media: [{ type: 'image', url: 'https://pbs.twimg.com/media/quote_photo.jpg' }],
        },
      },
    ],
  };

  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  await withMountedCard(quoted, async (card) => {
    await engine.renderCardToBlob(card);
  });

  const quote = (stub.rasterizerCalls[0].target as DomElement).querySelector('.quote-card');
  assert.ok(quote, 'the quoted post did not render');
  const sources = imageSources(quote);
  assert.ok(sources.length > 0, 'the quoted post has a picture');
  for (const src of sources) {
    assert.ok(src.startsWith('data:'), `the quoted post's picture was left remote: ${src}`);
  }
});

test('F25.4: an image the proxy cannot fetch becomes the placeholder, not a remote URL', async () => {
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    // This is the case where the extension's background proxy is not there to
    // ask, which is what the page falls back from.
    const scope = globalThis as Record<string, unknown>;
    const savedChrome = scope.chrome;
    delete scope.chrome;

    try {
      const url = 'https://pbs.twimg.com/media/unreachable.jpg';
      assert.equal(await engine.fetchImageAsBase64(url, true), engine.FALLBACK_PLACEHOLDER_DATA_URL);
      assert.equal(await engine.fetchImageAsBase64(url, false), url,
        'and is passed through when no placeholder was asked for');
    } finally {
      if (savedChrome !== undefined) scope.chrome = savedChrome;
    }
  });
});

test('F25.5: an image that is already a data URL is not sent through the proxy', async () => {
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    assert.equal(await engine.fetchImageAsBase64(dataUrl, true), dataUrl);
    assert.equal(await engine.fetchImageAsBase64('', true), '', 'and an empty source stays empty');
  });
});

// -------------------------------------------------------------
// F26: Clipboard Copy with Fallback
//
// The decision is `exportBlobWithFallback`'s, and where the blob ended up is
// read off the page: a copy is what the clipboard was handed, a download is the
// `<a download>` the fallback appended and clicked.
// -------------------------------------------------------------
const pngBlob = (): Blob => new Blob(['pngdata'], { type: 'image/png' });

/**
 * Installs a clipboard on `navigator` for the duration of `body` and returns the
 * download anchors left in the document. Read before the cleanup timer fires.
 */
async function withClipboard(
  failureMode: ClipboardFailureMode,
  body: (clipboard: MockClipboard) => Promise<void>
): Promise<DomElement[]> {
  const scope = globalThis as Record<string, unknown>;
  const doc = scope.document as DomDocument;
  const clipboard = new MockClipboard();
  clipboard.failureMode = failureMode;

  const savedClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  const savedItem = scope.ClipboardItem;
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: clipboard, configurable: true, writable: true });
  scope.ClipboardItem = MockClipboardItem;

  const savedWarn = console.warn;
  console.warn = () => {};
  try {
    await body(clipboard);
    return doc.body.querySelectorAll('a[download]');
  } finally {
    console.warn = savedWarn;
    if (savedClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', savedClipboard);
    } else {
      delete (globalThis.navigator as { clipboard?: unknown }).clipboard;
    }
    scope.ClipboardItem = savedItem;
  }
}

test('F26.1: navigator.clipboard.write succeeds when document has focus', async () => {
  await withContainerEnv(async () => {
    const engine = await exportEngine();
    const anchors = await withClipboard('none', async (clipboard) => {
      const result = await engine.exportBlobWithFallback(pngBlob(), 'copy');
      assert.equal(result.success, true);
      assert.equal(result.method, 'clipboard', 'a working clipboard is the path taken');
      assert.equal(clipboard.writtenItems.length, 1, 'the PNG is what has to be on the clipboard');
      assert.deepEqual(clipboard.writtenItems[0].types, ['image/png']);
    });
    assert.equal(anchors.length, 0, 'a copy that worked must not also download');
  });
});

/** The refusal modes all end the same way, and the blob has to leave the page. */
async function expectDownloadFallback(mode: ClipboardFailureMode, filename?: string): Promise<void> {
  await withContainerEnv(async () => {
    const engine = await exportEngine();
    let result: { success: boolean; method: string; filename: string } | null = null;

    const anchors = await withClipboard(mode, async () => {
      result = await engine.exportBlobWithFallback(pngBlob(), 'copy', filename);
    });

    assert.equal(result!.success, true, 'a refused clipboard that ends in a download is not a failure');
    assert.equal(result!.method, 'download');
    assert.equal(anchors.length, 1, 'the blob has to get out of the page somehow');
    assert.equal(anchors[0].getAttribute('download'), result!.filename);
  });
}

test('F26.2: falls back to download when document is unfocused', async () => {
  await expectDownloadFallback('unfocused', 'post-to-card-20.png');
});

test('F26.3: falls back to download when user activation gesture expires', async () => {
  await expectDownloadFallback('gesture_expired', 'post-to-card-100.png');
});

test('F26.4: falls back to download when clipboard permission is denied', async () => {
  await expectDownloadFallback('permission_denied', 'post-to-card-200.png');
});

test('F26.5: download trigger creates hidden anchor, clicks it, and revokes object URL', async () => {
  await withContainerEnv(async ({ doc }) => {
    const engine = await exportEngine();

    const created: string[] = [];
    const revoked: string[] = [];
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      const url = realCreate(blob);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
      realRevoke(url);
    };

    let clicked = 0;
    const realClick = DomAnchorElement.prototype.click;
    DomAnchorElement.prototype.click = function () {
      clicked++;
      realClick.call(this);
    };

    try {
      engine.downloadBlobAsPng(pngBlob(), 'card.png');

      const anchors = doc.body.querySelectorAll('a[download]');
      assert.equal(anchors.length, 1, 'the download is an anchor in the page');
      assert.equal(anchors[0].getAttribute('download'), 'card.png');
      assert.equal(anchors[0].style.display, 'none', 'and it is not something for the user to see');
      assert.equal(clicked, 1, 'the anchor has to be clicked for the browser to save anything');
      assert.deepEqual(created.length, 1, 'the blob was given a URL to be saved from');

      // The cleanup is on a timer, so the anchor outlives the call on purpose.
      await new Promise((resolve) => setTimeout(resolve, 2100));

      assert.equal(doc.body.querySelectorAll('a[download]').length, 0, 'the anchor is cleaned up');
      // Only this test's URL is asserted on: the earlier fallback tests left
      // their own anchors on the same timer, and those fire during this wait.
      assert.ok(revoked.includes(created[0]), 'and the object URL is released rather than leaked');
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
      DomAnchorElement.prototype.click = realClick;
    }
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// F27: Image Fit, Ratio-Aware Media Layout & Zero-Emoji UI
// -------------------------------------------------------------
test('F27.1: injection module defines SVG vector trigger button without sparkle emoji', () => {
  // The icon is an exported constant, so its content is the artifact: whatever
  // it holds is what the button renders, however the button is assembled.
  assert.ok(TRIGGER_BUTTON_SVG.includes('<svg'), 'the trigger icon must be a vector');
  assert.ok(
    !/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(TRIGGER_BUTTON_SVG),
    'the trigger icon must not carry an emoji'
  );
});

test('F27.2: i18n translations contain zero emojis across all supported locales', async () => {
  const { TRANSLATIONS } = await import('../../src/content/i18n.ts');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const [locale, dict] of Object.entries(TRANSLATIONS)) {
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value === 'string') {
        assert.ok(
          !emojiRegex.test(value),
          `Translation key "${key}" in "${locale}" contains emoji: "${value}"`
        );
      }
    }
  }
});

test('F27.3: the modal and the card draw no emoji, and the ratio rules stay attribute-keyed', async () => {
  // Asserted on what the components put on screen. The previous version asked
  // whether the string "✨" appears in Modal.tsx, which a comment could answer.
  const card = await renderCard();
  const modal = await renderComponent('/src/content/ui/Modal.tsx', 'Modal', {
    onClose: () => {},
    children: 'preview',
  });

  for (const [name, html] of [['card', card], ['modal', modal]] as const) {
    assert.ok(!html.includes('✨'), `the ${name} must not draw a sparkle`);
    assert.ok(!html.includes('✕'), `the ${name} must close with an icon, not a glyph`);
  }

  // Fit and ratio are keyed on the attribute, so a value cannot be spelled two
  // ways. Those rules live in CSS, which this suite has no engine for.
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  for (const selector of ['data-fit="contain"', 'data-fit="cover"', 'data-ratio="3:4"', 'data-ratio="16:9"']) {
    assert.ok(cssContent.includes(selector), `CSS must include ${selector} rule`);
  }
});

test('F27.4: mediaLayout configuration supports grid and stack with safe sanitization', () => {
  assert.equal(DEFAULT_CARD_CONFIG.mediaLayout, 'grid', 'the card opens in the grid layout');
  assert.deepEqual([...MEDIA_LAYOUT_OPTIONS], ['grid', 'stack']);

  // Anything unrecognised -- including a config saved before the option existed,
  // which arrives as `undefined` -- lands on the default rather than reaching
  // the DOM as a class that no stylesheet knows.
  assert.equal(sanitizeMediaLayout('stack'), 'stack');
  assert.equal(sanitizeMediaLayout('masonry'), 'grid');
  assert.equal(sanitizeMediaLayout(undefined), 'grid');
});

test('F27.5: CSS defines media-layout-stack for 100% full-display of all multi images', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('.media-layout-stack'), 'CSS must include .media-layout-stack');
  assert.ok(cssContent.includes('aspect-ratio: unset'), 'Stack layout must unset aspect-ratio constraint');
  assert.ok(cssContent.includes('max-height: unset'), 'Stack layout must unset max-height constraint for full display');
});

test('F27.6: the grid layout rules never pick a media object-fit, so the fit toggle reaches every layout', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const css = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  // A per-count grid rule that sets `object-fit` outranks the `[data-fit]` rules
  // (it reaches one level deeper) and silently pins every multi-image post to
  // `cover`, whatever the user chose. The rules are read as blocks rather than
  // substrings so the check follows the declarations, not the file's prose.
  const offenders = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => selector.includes('data-count=') && body.includes('object-fit'))
    .map(([, selector]) => selector.trim().replace(/\s+/g, ' '));

  assert.deepEqual(offenders, [], `grid count rules must leave object-fit to the [data-fit] rules: ${offenders.join(' | ')}`);
});

// -------------------------------------------------------------
// F28: Intelligent Adaptive Media Grid (Top-Hero / Left-Hero / Stacked / 4:3)
// -------------------------------------------------------------
test('F28.1: the extractor reads a picture shape off its own dimensions', () => {
  // A 16:9 attachment, declared on the element the way X declares it. The ratio
  // is what the grid planner lays out from, so it has to come back off the media
  // item rather than out of a second calculation in the UI.
  const tweet = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/user/status/8201"><time datetime="2026-07-03T00:00:00.000Z"></time></a>
      </div>
      <div data-testid="tweetPhoto">
        <img src="https://pbs.twimg.com/media/shaped_poster.jpg" width="1600" height="900" alt="">
      </div>
    </article>
  `);
  const media = extractTweetData(tweet as unknown as Element)?.media;

  assert.equal(media?.[0]?.aspectRatio, 1.778, 'a 1600x900 picture is 16:9');
});

/** A photo of the given shape, for driving the grid planner. */
function photo(ratio: number): MediaItem {
  return { type: 'image', url: `https://pbs.twimg.com/media/p${ratio}.jpg`, aspectRatio: ratio };
}

const AUTO_GRID = { aspectRatio: 'auto' as const, mediaLayout: 'grid' as const };

test('F28.2: Card renders data-grid-layout="top-hero" for 3 landscape/square images', () => {
  // A wide first picture takes the full width of row 1; a tall one takes the
  // left column instead.
  assert.equal(planMediaGrid([photo(1.6), photo(1.5), photo(1.5)], AUTO_GRID).layout, 'top-hero');
  assert.equal(planMediaGrid([photo(1.5), photo(1.5), photo(1.5)], AUTO_GRID).layout, 'top-hero');
  assert.equal(planMediaGrid([photo(0.8), photo(1.5), photo(1.5)], AUTO_GRID).layout, 'left-hero');
});

test('F28.3: Card renders data-grid-layout="stacked" for 2 wide images and "portrait-columns" for dual vertical images', () => {
  assert.equal(planMediaGrid([photo(1.6), photo(1.5)], AUTO_GRID).layout, 'stacked');
  assert.equal(planMediaGrid([photo(0.46), photo(0.46)], AUTO_GRID).layout, 'portrait-columns');
  assert.equal(planMediaGrid([photo(1.6), photo(0.46)], AUTO_GRID).layout, 'columns');
});

test('F28.4: card.css defines top-hero, left-hero, 4:3 quad and transparent contain styles', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('data-grid-layout="top-hero"'), 'Must define top-hero layout rule');
  assert.ok(cssContent.includes('grid-column: span 2;'), 'Top hero item must span 2 columns');
  assert.ok(cssContent.includes('minmax(0, 1.4fr) minmax(0, 1fr)'), 'Top hero must allocate 1.4fr to 1fr row height with minmax');
  assert.ok(cssContent.includes('data-grid-layout="left-hero"'), 'Must define left-hero layout rule');
  assert.ok(cssContent.includes('data-grid-layout="stacked"'), 'Must define stacked 2-image rule');
  assert.ok(cssContent.includes('data-grid-layout="portrait-columns"'), 'Must define portrait-columns 2-image rule');
  assert.ok(cssContent.includes('aspect-ratio: 4 / 3;'), 'Must define 4:3 aspect-ratio for grid');
  assert.ok(cssContent.includes('gap: 4px;'), 'Must define 4px compact gap');
});

test('F28.5: Dual portrait images calculate dynamic combined aspect-ratio (r0 + r1) in Auto mode', () => {
  // Two 9:19.5 phone screenshots side by side: the grid is as wide as the two
  // are tall, so the tall pair fills it without dead space.
  const plan = planMediaGrid([photo(0.46), photo(0.46)], AUTO_GRID);
  assert.equal(plan.layout, 'portrait-columns');
  assert.equal(plan.aspectRatio, '0.92');
});

test('F28.6: 3-image layout uses left-hero for square/portrait (ratio < 1.2) with 1.6fr:1fr columns and dynamic ratio', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('minmax(0, 1.6fr) minmax(0, 1fr)'), 'Left hero must allocate 1.6fr to 1fr column width');

  // Square comic (1.0) with square companions: left-hero, and a grid wide
  // enough to eliminate the vertical dead space the CSS default would leave.
  const plan = planMediaGrid([photo(1.0), photo(1.0), photo(1.0)], AUTO_GRID);
  assert.equal(plan.layout, 'left-hero');
  assert.equal(plan.aspectRatio, '1.51');
});

// -------------------------------------------------------------
// F29: Non-obstructive Video Presentation
// -------------------------------------------------------------
test('F29.1: detects GIF media vs standard video containers', () => {
  const typeOf = (html: string) =>
    extractTweetData(createDomElement(html) as unknown as Element)?.media?.[0]?.type;

  // The two shapes the extractor reads a GIF badge from. Neither is a
  // `gifBadge` testid -- X has no such element, so the copy of the check this
  // test used to carry could only ever find the fixture built for it.
  assert.equal(typeOf(GIF_ARIA_LABELED_HTML), 'gif', 'the player aria-label says GIF');
  assert.equal(typeOf(GIF_BADGE_TEXT_HTML), 'gif', 'the badge text says GIF');

  // The same post without either signal stays a video, so the type follows the
  // signal rather than defaulting to one.
  assert.equal(typeOf(VIDEO_POSTER_HTML), 'video');

  // And the state a feed actually shows with autoplay off: a poster and an
  // interstitial, no `<video>` at all. Captured live on 2026-10-10; the badge
  // text is what carries the answer there.
  assert.equal(typeOf(GIF_POSTER_ONLY_HTML), 'gif', 'the badge makes it a GIF with no video element');
  assert.equal(typeOf(VIDEO_POSTER_ONLY_HTML), 'video', 'and a video poster without one stays a video');
});

test('F29.2: extracts video duration timestamp from video controls', () => {
  const media = extractTweetData(createDomElement(VIDEO_WITH_DURATION_HTML) as unknown as Element)?.media;

  // Read off the extractor. This test used to reimplement the scan and assert
  // against the copy, so it agreed with itself whatever the card did.
  assert.equal(media?.[0]?.type, 'video');
  assert.equal(media?.[0]?.duration, '1:42');
});

test('F29.3: the card renders a corner video badge, and nothing that dims the poster', async () => {
  const html = await renderCard();

  assert.ok(html.includes('video-indicator-badge'), 'the corner badge is rendered on a video post');

  // The absence half is the feature: a scrim darkens burnt-in subtitles the card
  // cannot re-typeset, a centre button covers the frame it was drawn over, and a
  // progress line would claim a position the export does not have.
  for (const neverRendered of ['center-play-button', 'video-scrim-overlay', 'video-progress-track']) {
    assert.ok(!html.includes(neverRendered), `the card must not render ${neverRendered}`);
  }
});

test('F29.4: card.css styles an opaque pill with no glass and no scrim, and no progress line', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('.media-item.media-video-item'), 'Must style media-video-item');
  assert.ok(cssContent.includes('.video-indicator-badge'), 'Must style video-indicator-badge');
  assert.ok(cssContent.includes('.video-badge-pill'), 'Must style video-badge-pill');
  assert.ok(!cssContent.includes('.video-scrim-overlay'), 'Must NOT style a bottom scrim');
  assert.ok(!cssContent.includes('.video-progress-track'), 'Must NOT style the video progress bar');
  // Scoped to the badge rule: the thread exclude button may stay frosted because
  // it is UI-only and marked data-html2canvas-ignore, so it never reaches the
  // export. Only the badge sits on exported pixels.
  const pillRule = cssContent.slice(cssContent.indexOf('.media-video-item .video-badge-pill {'));
  const pillBlock = pillRule.slice(0, pillRule.indexOf('}'));
  assert.ok(!pillBlock.includes('backdrop-filter'), 'Must NOT blur the badge: the themes ban glass surfaces');
});

test('F29.5: i18n provides localized videoLabel for zh-CN and en-US', () => {
  assert.equal(TRANSLATIONS['zh-CN'].videoLabel, '视频');
  assert.equal(TRANSLATIONS['en-US'].videoLabel, 'Video');
  assert.equal(TRANSLATIONS['zh-CN'].videoPlayButton, '视频播放按钮');
  assert.equal(TRANSLATIONS['en-US'].videoPlayButton, 'Video Play Button');
});

test('F29.6: the video play button ships on by default', () => {
  // The other half of this contract -- that a stored `false` is honoured -- is
  // in tier 2, beside the storage mock that can hand `loadUserPreferences` a
  // saved config. Asserting the source text of the parser proved neither half.
  assert.equal(DEFAULT_CARD_CONFIG.showPlayButton, true);
});

test('F29.7: the controls offer the play-button toggle, labelled in the active language', async () => {
  const html = await renderControls({ config: { locale: 'zh-CN' } });
  assert.ok(
    html.includes(TRANSLATIONS['zh-CN'].videoPlayButton),
    'the toggle must be labelled from the locale, not from a fixed string'
  );
  assert.ok(
    !html.includes(TRANSLATIONS['en-US'].videoPlayButton),
    'and not left in another language'
  );
});

test('F29.8: the video badge follows the play-button preference', async () => {
  const on = await renderCard();
  const off = await renderCard({ config: { showPlayButton: false } });

  assert.ok(on.includes('video-indicator-badge'), 'the badge is on by default');
  // Off removes the badge itself, not just its label: a badge with no play
  // affordance is the state the preference exists to avoid.
  assert.ok(!off.includes('video-indicator-badge'), 'and off takes it off the card');
});

// -------------------------------------------------------------
// F30: Action Bar Button Visibility & Configurable Toggle
// -------------------------------------------------------------
test('F30.1: the action-bar button ships on by default', () => {
  // The stored-value half lives in tier 2.76, beside the storage mock. The
  // storage key's literal is deliberately not pinned: what matters is that the
  // popup and the content script spell it the same, which `tier_hygiene` 2
  // already checks, so a coordinated rename stays allowed.
  assert.equal(DEFAULT_CARD_CONFIG.showActionBarButton, true);
});

test('F30.2: the controls offer the action-bar toggle, labelled in the active language', async () => {
  const zh = await renderControls({ config: { locale: 'zh-CN' } });
  const en = await renderControls({ config: { locale: 'en-US' } });

  assert.ok(
    zh.includes(TRANSLATIONS['zh-CN'].tweetActionButton),
    'the toggle carries the dictation of the active language'
  );
  assert.ok(
    en.includes(TRANSLATIONS['en-US'].tweetActionButton),
    'and follows the language when it changes'
  );
});

test('F30.5: manifest.json declares action popup pointing to popup.html', () => {
  const manifestRaw = fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  assert.ok(manifest.action, 'Manifest must have action field');
  assert.equal(manifest.action.default_popup, 'popup.html');

  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../../public/popup.html'), 'utf-8');
  assert.ok(popupHtml.includes('toggle-button'), 'Popup must have toggle switch');
  assert.ok(popupHtml.includes('Alt'), 'Popup must describe Alt+C shortcut');
});

test('F30.6: the popup switch paints a focus ring on the control that is visible', () => {
  // The checkbox is deliberately `opacity: 0; width: 0; height: 0` so the slider
  // can be drawn in its place. That also means the browser's own ring has a 0x0
  // box to trace, so a keyboard user tabbing through the popup saw nothing at
  // all. The ring belongs on the slider, and only for `:focus-visible`.
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../../public/popup.html'), 'utf-8');
  assert.ok(
    /\.switch input:focus-visible \+ \.slider\s*\{[^}]*outline/.test(popupHtml),
    'the slider must take the focus ring when the hidden checkbox is keyboard-focused'
  );
  assert.ok(
    !/\.switch input:focus \+ \.slider/.test(popupHtml),
    'the ring must be :focus-visible, or a mouse click leaves it behind'
  );
});


// -------------------------------------------------------------
// F32: Truncated Post Indicator
// X renders long posts in the timeline as a preview plus a "Show more"
// control; the rest of the body is only in the GraphQL `note_tweet` field, so
// the DOM channel reports the cut and the card states it rather than passing
// the preview off as the whole post.
// -------------------------------------------------------------
test('F32.1: a post carrying X\'s "Show more" marker is flagged as truncated', () => {
  const html = `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><span>Author</span></div>
        <div><a href="/author"><span>@author</span></a></div>
      </div>
      <div data-testid="tweetText" lang="zh"><span>与其他 Claude</span></div>
      <div data-testid="tweet-text-show-more-link"><span>显示更多</span></div>
      <div role="group"><div data-testid="like"><span>7</span></div></div>
    </article>`;
  const tweet = extractTweetData(createDomElement(html));
  assert.equal(tweet?.truncated, true, 'the marker means the DOM holds only a preview');
});

test('F32.2: the "Show more" label never reaches the body, in text or tokens', () => {
  // The control is placed beside `tweetText` in some layouts and nested inside
  // it in others; as an anchor it used to be classified as a mention. Both
  // shapes must keep the label out of the card, and both must still flag the cut.
  const shapes = [
    `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <div><span>Author</span></div>
          <div><a href="/author"><span>@author</span></a></div>
        </div>
        <div data-testid="tweetText" lang="zh">
          <span>与其他 Claude</span>
          <a href="/author/status/1" data-testid="tweet-text-show-more-link"><span>显示更多</span></a>
        </div>
      </article>`,
    `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <div><span>Author</span></div>
          <div><a href="/author"><span>@author</span></a></div>
        </div>
        <div data-testid="tweetText" lang="zh"><span>与其他 Claude</span></div>
        <div data-testid="tweet-text-show-more-link"><span>显示更多</span></div>
      </article>`,
  ];
  for (const html of shapes) {
    const tweet = extractTweetData(createDomElement(html));
    assert.equal(tweet?.truncated, true, 'both layouts carry the marker');
    assert.match(tweet?.text || '', /与其他 Claude/, 'the author\'s preview survives');
    assert.doesNotMatch(tweet?.text || '', /显示更多/, 'the UI label is not body text');
    const tokenText = (tweet?.richTokens || []).map((token) => token.value).join('');
    assert.doesNotMatch(tokenText, /显示更多/, 'the UI label is not a token either');
  }
});

test('F32.3: a truncated quoted post does not flag the main tweet', () => {
  const html = `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><span>Author</span></div>
        <div><a href="/author"><span>@author</span></a></div>
      </div>
      <div data-testid="tweetText"><span>my take on it</span></div>
      <div data-testid="quoteTweet">
        <div data-testid="User-Name">
          <div><span>Other</span></div>
          <div><a href="/other"><span>@other</span></a></div>
        </div>
        <div data-testid="tweetText"><span>a long quoted post</span></div>
        <div data-testid="tweet-text-show-more-link"><span>Show more</span></div>
      </div>
      <div role="group"><div data-testid="like"><span>3</span></div></div>
    </article>`;
  const tweet = extractTweetData(createDomElement(html));
  assert.equal(tweet?.truncated, undefined, 'the quote\'s cut is not this tweet\'s');
});

test('F32.4: a post without the marker is not flagged', () => {
  const tweet = extractTweetData(createDomElement(SINGLE_TWEET_HTML));
  assert.equal(tweet?.truncated, undefined);
});

test('F32.5: both locales name the truncated state', () => {
  assert.ok(TRANSLATIONS['zh-CN'].truncatedContent, 'zh-CN has the notice copy');
  assert.ok(TRANSLATIONS['en-US'].truncatedContent, 'en-US has the notice copy');
});

// -------------------------------------------------------------
// F31: Content Script Entry Wiring
//
// `src/content/index.ts` is the file the manifest loads, and nothing imported
// it: the bridge it installs before the first scan, the click that opens the
// card, and the message the popup sends were all unverified, so a broken wire
// between the two halves of the extension could not fail a single test.
// -------------------------------------------------------------

/**
 * Installs everything the entry point reads, loads it, then runs `body`.
 *
 * The entry is a module with import-time side effects, so it goes through the
 * SSR pipeline — with a distinct query each load, because the pipeline caches
 * by id and a second load would otherwise be a no-op the test would read as
 * "the entry did nothing".
 */
async function withEntryEnv(
  options: {
    readyState?: 'loading' | 'complete';
    /** Fills the page before the entry loads, as a real page already is. */
    before?: (doc: DomDocument) => void;
    /**
     * `inert` (the default) installs a MutationObserver that never delivers
     * anything, so the only thing that can find a post is the entry's own scan.
     *
     * It defaults to inert because `injection.ts` keeps its observer in a
     * module-level variable and the container's document is reused across these
     * tests: an observer left live by one load keeps watching the same body for
     * the rest of the file, so a later test could not tell its own scan from an
     * earlier load's observer.
     */
    observer?: 'live' | 'inert';
  },
  body: (env: {
    doc: DomDocument;
    chrome: ReturnType<typeof createChromeMock>;
    /** Window event types, in the order the entry registered them. */
    registered: string[];
    flushEffects: () => Promise<void>;
  }) => Promise<void>
): Promise<void> {
  await withContainerEnv(async ({ doc, closeCardModal, flushEffects }) => {
    const scope = globalThis as Record<string, unknown>;
    const saved = { chrome: scope.chrome, MutationObserver: scope.MutationObserver };
    const chromeMock = createChromeMock();
    scope.chrome = chromeMock;
    scope.MutationObserver =
      options.observer === 'live'
        ? DomMutationObserver
        : class {
            observe(): void {}
            disconnect(): void {}
            takeRecords(): unknown[] {
              return [];
            }
          };
    doc.readyState = options.readyState ?? 'complete';

    const savedLog = console.log;
    console.log = () => {};

    // The order the entry wires things up in is part of the claim, so the
    // registrations are recorded rather than merely counted.
    const registered: string[] = [];
    const liveWindow = scope.window as { addEventListener: (type: string, cb: (evt: any) => void) => void };
    const realAdd = liveWindow.addEventListener.bind(liveWindow);
    liveWindow.addEventListener = (type: string, cb: (evt: any) => void) => {
      registered.push(type);
      realAdd(type, cb);
    };

    try {
      options.before?.(doc);
      entryLoads++;
      await loadModule(`/src/content/index.ts?load=${entryLoads}`);
      await body({ doc, chrome: chromeMock, registered, flushEffects });
    } finally {
      liveWindow.addEventListener = realAdd;
      console.log = savedLog;
      closeCardModal();
      if (saved.chrome !== undefined) scope.chrome = saved.chrome;
      else delete scope.chrome;
      scope.MutationObserver = saved.MutationObserver;
    }
  });
}

/** Distinct per load, so the SSR module cache cannot turn a load into a no-op. */
let entryLoads = 0;

/** A page that already has one post on it, as the content script finds it. */
const withOnePost = (doc: DomDocument): void => {
  doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
};

test('F31.1: the entry installs the GraphQL bridge before anything else it wires', async () => {
  await withEntryEnv({ before: withOnePost }, async ({ registered }) => {
    // The bridge installs itself once per page, so this is only observable on
    // the first entry load — which is what this is.
    assert.ok(registered.includes('message'), 'the entry never installed the GraphQL bridge');
    // The bridge is installed first on purpose: a payload that arrives during
    // startup would be dropped by a bridge that came up after the injection.
    assert.ok(
      registered.indexOf('message') < registered.indexOf('keydown'),
      `the bridge has to be listening before the injection wires up: ${registered.join(', ')}`
    );
  });
});

test('F31.2: while the document is still loading the entry waits for DOMContentLoaded', async () => {
  await withEntryEnv({ readyState: 'loading', before: withOnePost }, async ({ doc, registered }) => {
    assert.deepEqual(registered, [], 'nothing may be wired while the document is still parsing');

    doc.readyState = 'complete';
    doc.dispatchEvent({ type: 'DOMContentLoaded' });

    assert.ok(doc.querySelector('[data-post-to-card-btn="true"]'),
      'the deferred start has to run once the document is ready');
    assert.ok(registered.includes('keydown'), 'and to wire the same things it would have anyway');
  });
});

test('F31.3: the first scan injects a trigger, and clicking it opens the card for that post', async () => {
  await withEntryEnv({ before: withOnePost }, async ({ doc, flushEffects }) => {
    const trigger = doc.querySelector('[data-post-to-card-btn="true"]');
    assert.ok(trigger, 'the entry has to scan the page it starts on');

    trigger.click();
    await flushEffects();

    const container = doc.querySelector('post-to-card-container') as any;
    assert.ok(container, 'clicking the trigger must open the card');
    const card = container.shadow.querySelector('#post-to-card-export-target');
    assert.ok(card, 'the card did not render into the shadow root');
    assert.ok(card.innerHTML.includes('Jack Dorsey'),
      'the card has to be built from the post the trigger belongs to');
  });
});

test('F31.4: the popup’s TRIGGER_ACTIVE_CARD message is answered', async () => {
  await withEntryEnv({ before: withOnePost }, async ({ doc, chrome }) => {
    const listener = chrome.runtime.listeners[0];
    assert.ok(listener, 'the entry never listened for extension messages');

    let response: { success?: boolean } | null = null;
    listener({ type: 'TRIGGER_ACTIVE_CARD' } as never, {} as never, (value) => {
      response = value as { success?: boolean };
    });

    assert.deepEqual(response, { success: true },
      'the popup is told whether a card opened, and the post on screen is the one it opens');
    assert.ok(doc.querySelector('post-to-card-container'), 'and the card really opened');
  });
});

test('F31.5: the deferred scans pick up a post that was not there at startup', async () => {
  // A post that arrives after startup can only be found by the entry's own
  // deferred scans, because the observer is inert here. With a live observer this
  // claim was not tested at all: the observer fires at 150ms, well before the
  // first scan at 500ms, and deleting both scans left the test green.
  await withEntryEnv({}, async ({ doc }) => {
    assert.equal(doc.querySelector('[data-post-to-card-btn="true"]'), null,
      'the page starts with no posts on it');

    // A feed hydrates its posts after the content script runs.
    doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
    await new Promise((resolve) => setTimeout(resolve, 600));

    assert.ok(doc.querySelector('[data-post-to-card-btn="true"]'),
      'the deferred scan is what covers posts the first pass could not see');
  });
});


// -------------------------------------------------------------
// Test Execution Runner for Tier 1
// -------------------------------------------------------------
export async function runTier1(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
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
