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
import { createChromeMock, type SendOutcome } from '../env/chrome.ts';
import { withClipboard, type ClipboardFailureMode } from '../env/clipboard.ts';
import { channels, contrast, fromOklab, luminance, toOklab } from '../env/color.ts';
import { createSuite } from '../env/harness.ts';
import { SINGLE_TWEET_HTML } from '../fixtures/single-tweet.ts';
import { THREAD_HTML } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML, QUOTE_TWEET_UNAVAILABLE_HTML } from '../fixtures/quote-tweet.ts';
import { EMOJI_TWEET_HTML, PURE_EMOJI_HTML } from '../fixtures/emojis.ts';
import { ONE_PHOTO_HTML, TWO_PHOTOS_HTML, THREE_PHOTOS_HTML, FOUR_PHOTOS_HTML, VIDEO_POSTER_HTML, PHOTO_AND_GIF_HTML, PHOTO_AND_VIDEO_HTML, GIF_POSTER_LAYER_HTML, VIDEO_VISIBLE_POSTER_HTML, MEDIA_WITH_INNER_GROUP_HTML, GIF_ARIA_LABELED_HTML, GIF_BADGE_TEXT_HTML, VIDEO_WITH_DURATION_HTML, GIF_POSTER_ONLY_HTML, VIDEO_POSTER_ONLY_HTML, VIDEO_ARIA_LABEL_ONLY_HTML, FOUR_GIFS_HTML } from '../fixtures/multi-images.ts';
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
import { toggleExcluded, selectCurrentOnly } from '../../src/content/threadSession.ts';
import { MIXED_FEED_WITH_ADS_AND_REPLIES_HTML } from '../fixtures/ads-replies.ts';
import { RICH_TOKENS_HTML, EXPECTED_TOKENS } from '../fixtures/rich-tokens.ts';
import { TRANSLATIONS, SUPPORTED_LOCALES, getTranslation, resolveLocale } from '../../src/content/i18n.ts';
import { THEMES, THEME_ORDER, EXPERIMENTAL_THEMES, DEFAULT_CARD_CONFIG, LEGACY_THEME_ALIASES, RADIUS_OPTIONS, PADDING_OPTIONS, resolveRadius, sanitizeRadius, sanitizeTheme, sanitizePadding, sanitizeAspectRatio, MEDIA_LAYOUT_OPTIONS, sanitizeMediaLayout, CANVAS_RATIO_OPTIONS, CANVAS_BACKGROUNDS, CANVAS_BACKGROUND_ORDER, resolveCanvasBackground, sanitizeCanvasRatio, sanitizeCanvasBackground } from '../../src/content/ui/themes.ts';
import { ASPECT_RATIO, CANVAS_BACKGROUND, CANVAS_RATIO, IMAGE_FIT, MEDIA_LAYOUT, PADDING, RADIUS } from '../../src/content/ui/options.ts';
import { aspectMinHeight, CARD_WIDTH, GRID_TRACKS, heroCellRatio, heroRowShare, MEDIA_MOUNT, NARROW_BREAKPOINT, viewportPadding } from '../../src/content/ui/geometry.ts';
import { POPUP_COPY } from '../../src/content/popupCopy.ts';
import { sanitizeImageFit } from '../../src/content/ui/themes.ts';
import { planMediaGrid } from '../../src/content/ui/mediaGrid.ts';
import { isAllowedHost, clearImageCache, getImageCacheSize } from '../../src/background/proxy.ts';
import { upgradeAvatarUrl, upgradePhotoUrl, getPhotoPreviewUrl } from '../../src/content/adapter/urls.ts';
import { sanitizeQrUrl, generateQrCodeData, CardQrCode } from '../../src/content/ui/qrcode.ts';

import { renderComponent, loadModule, rasterizer, exportEngine, cardRenderer, cssSheet, type CssRule } from '../env/render.ts';

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

/**
 * The config a card is rendered with here.
 *
 * Spread from production's own default rather than re-listing the fields: the
 * hand-written copy had drifted (24px padding and a fixed 12px radius, neither
 * of which is what the extension ships), so the markup under test was not the
 * markup the card produces. Only the locale is pinned, because the copy has to
 * be deterministic while `detectDefaultLocale` reads the machine's language.
 */
const CARD_CONFIG: CardConfig = { ...DEFAULT_CARD_CONFIG, locale: 'en-US' };

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

const renderCard = cardRenderer(CARD_CONFIG, VIDEO_TWEET);

/**
 * The inline style the card root was rendered with.
 *
 * Read off the root element rather than searched for across the whole document:
 * a media box or an avatar legitimately carries a fixed height, and a
 * document-wide regex cannot tell those apart from the card being clipped.
 *
 * Matched by class, not by `id="post-to-card-export-target"`: that id is on the
 * mat the card is mounted on, and the mat carries a style of its own, so the
 * id would hand back the picture's inline style instead of the card's.
 */
function cardRootStyle(html: string): string {
  const tag = html.match(/<div[^>]*class="post-to-card-target[^"]*"[^>]*>/);
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

const { test, run } = createSuite();

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
      assert.equal(res.retryable, false,
        'a 404 is X answering about the picture; asking again cannot change that answer');
    }
  );

  // The other side of the same line, and the reason the proxy is the only layer
  // that can draw it: the status code is visible nowhere else. A 5xx never
  // reached the picture, so the caller is allowed to spend a retry on it.
  await withFetch(
    () => new Response('boom', { status: 503, statusText: 'Service Unavailable' }),
    async () => {
      const res = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: 'https://pbs.twimg.com/media/flaky.jpg',
      });
      assert.equal(res.success, false);
      if (res.success) return;
      assert.equal(res.retryable, true, 'a 5xx is the edge having a bad moment, not a verdict');
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

test('F4.6: the worker refuses a non-twimg URL instead of fetching it', async () => {
  // The gate that matters is the one on the message path, not the helper: the
  // worker forwards `message.url` straight into the proxy, and the proxy is the
  // last place that can say no. F4.5 exercises `isAllowedHost` on its own, so
  // deleting the guard left the suite green while any page could ask the worker
  // to fetch any host through the extension's own (permissioned) fetch.
  const chromeMock = await serviceWorker();
  clearImageCache();

  await withFetch(
    () => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    async (urls) => {
      const res = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: 'https://evil.example/steal.png',
      });

      assert.equal(res.success, false, 'the worker must refuse a foreign origin');
      if (res.success) return;
      assert.match(res.error, /Forbidden origin/, 'the refusal has to name the reason');
      assert.equal(urls.length, 0, 'and the forbidden URL must never be requested');
    }
  );
});

test('F4.7: a fetch that rejects is reported with the reason it failed', async () => {
  // The other half of F4.3: that test drives a 404 *response*, which returns
  // before the catch. A fetch that rejects — DNS, TLS, a connection reset —
  // arrives here instead, and the caller is told why.
  const chromeMock = await serviceWorker();
  clearImageCache();

  await withFetch(
    () => {
      throw new Error('socket hang up');
    },
    async () => {
      const res = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: 'https://pbs.twimg.com/media/unreachable.jpg',
      });

      assert.equal(res.success, false, 'a rejected fetch is a failed response, not a throw');
      if (res.success) return;
      assert.equal(res.error, 'socket hang up', 'and the failure reason reaches the caller');
      assert.equal(res.retryable, true,
        'the request never got an answer about the picture, so a second ask can still land');
    }
  );
});

test('F4.8: the cache evicts the least recently used entry, not the oldest', async () => {
  // The cache is capped at 200 and the cap is enforced by insertion order, so
  // the only thing that makes it LRU rather than FIFO is the delete-and-reinsert
  // on a hit. Dropping that left tier1 and tier5 green: the cap still held and
  // the size assertions still passed, while a hot avatar fell out of the cache
  // behind images nobody asks for twice.
  const chromeMock = await serviceWorker();
  clearImageCache();

  const urlOf = (i: number) => `https://pbs.twimg.com/media/entry_${i}.jpg`;
  const cap = 200;

  await withFetch(
    () => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    async (urls) => {
      for (let i = 0; i < cap; i++) {
        await chromeMock.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: urlOf(i) });
      }
      assert.equal(getImageCacheSize(), cap, 'the cache holds a full set');

      // Touch the first entry, then push the cache one past its cap. FIFO would
      // drop `entry_0`; LRU drops whatever the touch pushed second.
      await chromeMock.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: urlOf(0) });
      await chromeMock.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: urlOf(cap) });
      // At the cap, not over it: the bound is the thing this test asserts, and
      // the exact number it settles at past the cap depends on which URL the
      // replay happens to evict next.
      assert.ok(getImageCacheSize() <= cap, `the cache grew to ${getImageCacheSize()} past its cap`);

      const fetchesBefore = urls.length;
      const again = await chromeMock.runtime.sendMessage({
        type: 'FETCH_IMAGE_BASE64',
        url: urlOf(0),
      });
      assert.equal(again.success, true);
      assert.equal(urls.length, fetchesBefore, 'the touched entry survives the eviction');
    }
  );
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

test('F11.3b: the blurred stand-in asks X for the small variant, and invents one nowhere else', () => {
  // The card mounts `name=orig` and puts a blurred `name=small` copy underneath
  // while it waits. Only X's photo paths have that variant: an avatar, a data URL
  // or the harness's local picture must fall back to the tone block rather than
  // request a URL no host promised.
  const preview = getPhotoPreviewUrl('https://pbs.twimg.com/media/photo.jpg?format=jpg&name=orig');
  assert.ok(preview, 'an X photo has a small variant');
  assert.equal(new URL(preview).searchParams.get('name'), 'small');
  assert.equal(new URL(preview).searchParams.get('format'), 'jpg', 'the format the source named is kept');

  assert.equal(getPhotoPreviewUrl('https://pbs.twimg.com/profile_images/1/avatar_400x400.jpg'), null);
  assert.equal(getPhotoPreviewUrl('data:image/svg+xml;utf8,<svg/>'), null);
  assert.equal(getPhotoPreviewUrl('https://pbs.twimg.com/media/legacy_photo.jpg:orig'), null);
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

test('F11.5b: the blurred stand-in sits inside the placeholder the export ignores', async () => {
  // Two things are locked here. The stand-in must be derived from the mounted
  // picture (so it is the picture that is coming, not a generic shape), and it
  // must live inside the node the engine drops, or a blurred thumbnail could be
  // rasterized into the PNG. A non-X source must not get one invented for it.
  const render = (media: MediaItem[]) =>
    renderCard({
      data: {
        id: '93001',
        url: 'https://x.com/ada_builds/status/93001',
        author: { name: 'Ada', handle: '@ada_builds' },
        text: 'one picture',
        timestamp: '2026-10-24T00:00:00.000Z',
        media,
      } satisfies TweetData,
    });

  const html = await render([{ type: 'image', url: 'https://pbs.twimg.com/media/photo.jpg?format=jpg&name=orig' }]);
  const start = html.indexOf('<span class="media-placeholder"');
  const placeholder = html.slice(start, html.indexOf('</span>', start));
  assert.ok(placeholder.includes('data-html2canvas-ignore="true"'), 'the stand-in is excluded from the export');
  assert.ok(placeholder.includes('class="media-placeholder-preview"'), 'the copy is mounted inside the placeholder');
  assert.ok(placeholder.includes('name=small'), 'the copy asks for the small variant');

  const local = await render([{ type: 'image', url: 'data:image/svg+xml;utf8,<svg/>' }]);
  assert.ok(!local.includes('media-placeholder-preview'), 'no variant is invented for a source without one');
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
  // separated the two. All three steps are asserted on the rules that carry
  // them, read as declarations rather than as text.
  const sheet = cssSheet(path.resolve(__dirname, '../../src/content/styles/card.css'));
  const panel = '.quote-card[data-quote-depth="2"]';
  const rules = (selector: string): CssRule[] =>
    sheet.filter((r) => r.selectors.includes(selector));
  const body = rules(panel);
  assert.ok(body.length > 0, 'the nested panel must carry its own rule');

  // A cycle in a custom property is not a fallback: the declaration is dropped
  // and the element silently renders without the background. So the mix must be
  // written as a value the element owns, never as `--quote-bg` redefined here.
  assert.ok(
    !body.some((r) => r.declarations.some((d) => /^--quote-bg\s*:/.test(d))),
    'the nested panel must not redefine --quote-bg: a property that reads itself is invalid at computed-value time'
  );
  assert.ok(
    body.some((r) => r.declares('background', 'color-mix(')),
    'the nested panel owns its background'
  );
  assert.ok(
    body.some((r) => r.declares('background', 'var(--surface)')),
    'mixed toward the sheet, so every material recedes the same way'
  );
  // The border steps toward the sheet by the same 55%, rather than keeping the
  // outer panel's rule: an unstepped border printed the same line twice and the
  // two panels read as one.
  assert.ok(
    body.some((r) => r.declares('border-color', 'color-mix(')),
    'the nested panel states its own border step'
  );

  // Each step has to be a real step, or the two panels still read as one.
  const px = (property: string): number => {
    // The shorthand first (`padding: 9px 11px 10px`), then the longhand, which
    // wins where both are stated.
    const seen = body.flatMap((r) => r.declarations).reverse();
    const declaration =
      seen.find((d) => d.startsWith(`${property}-left:`)) ??
      seen.find((d) => d.startsWith(`${property}:`));
    const m = declaration?.match(/:\s*(?:[\d.]+px\s+)?(-?[\d.]+)px/);
    return m ? Number(m[1]) : 0;
  };
  assert.ok(px('margin-inline-start') >= 8, `the nested panel is indented (${px('margin-inline-start')}px)`);
  assert.ok(px('padding') > 0, 'and it states a padding of its own, so the indent is not cancelled by the outer rule');
  assert.ok(px('padding') < 14, `and its padding steps down with it (${px('padding')}px)`);

  // The step of type is a calc against the material's own quote size, so it
  // holds on every material rather than only where the two happen to differ by
  // 1px. Read off the declaration, not off a bracket pattern in the file.
  const nameRule = rules(`${panel} .quote-name`)[0];
  assert.ok(nameRule, 'the nested byline has its own rule');
  assert.ok(nameRule.declares('font-size', 'calc('), 'the nested byline is set a step smaller');
  assert.ok(nameRule.declares('font-size', 'var(--type-quote-size'), 'against the material\'s quote size');

  const avatarRule = rules(`${panel} .quote-avatar`)[0];
  assert.ok(avatarRule, 'the nested avatar has its own rule');
  assert.equal(avatarRule.declares('width', '16px'), true, 'and its avatar shrinks with it');
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

test('F17.24: the type scale is a material token, not a block of CSS per material', async () => {
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

test('F17.25: the inner corner comes from the resolved radius, not a second table', async () => {
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

// -------------------------------------------------------------
// The card's geometry: one source for the numbers the shape is built on
// -------------------------------------------------------------

test('F17.26: the card injects its geometry, and the stylesheet reads it', async () => {
  // The card's width used to be 640 in the stylesheet and 640 in the script, and
  // the 3:4 floor was 853px in one and `round(640 * 4/3)` in the other. The
  // stylesheet now reads the numbers the card injects, the way it already
  // reads every theme colour, so there is one place to change a width.
  const html = await renderCard();
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  assert.ok(
    new RegExp(`--card-width:\\s*${CARD_WIDTH}px`).test(html),
    `the card must inject its own width (${CARD_WIDTH}px)`
  );
  assert.ok(
    !/--card-width:\s*\d/.test(css),
    'card.css must not declare a width of its own — it consumes the injected one'
  );

  // The poster floor is computed from that width on both sides, and both round
  // to whole pixels: the stylesheet's `round()` and the module's `Math.round`
  // answer the same figure, so the fallback and the inline style cannot
  // disagree about a third of a pixel.
  assert.equal(aspectMinHeight('3:4', CARD_WIDTH), '853px');
  assert.ok(
    css.includes('min-height: round(calc(var(--card-width, 640px) * 4 / 3), 1px)'),
    'the stylesheet must floor the 3:4 card from the injected width, rounded to whole pixels'
  );
  assert.ok(
    css.includes('min-height: round(calc(var(--card-width, 640px) * 9 / 16), 1px)'),
    'and the 16:9 card the same way'
  );
});

test('F17.27: the grid planner and the stylesheet derive the hero weights from one place', async () => {
  // The dangerous copy: the stylesheet drew `1.6fr` columns and the planner
  // wrote down the numbers *derived* from them — 1.625 and 0.583 — by hand.
  // Change the stylesheet and the planner still described the old grid, so the
  // pictures were laid out against a shape the stylesheet no longer drew, and
  // nothing said so. Both now come from the same weights.
  const html = await renderCard();

  assert.ok(
    new RegExp(`--grid-left-hero:\\s*${GRID_TRACKS.leftHero}fr`).test(html),
    'the card must inject the left-hero column weight'
  );
  assert.ok(
    new RegExp(`--grid-top-hero:\\s*${GRID_TRACKS.topHero}fr`).test(html),
    'the card must inject the top-hero row weight'
  );

  // The planner's arithmetic is the reciprocal of the share the weights make,
  // not a number typed in beside it.
  const leftShare = GRID_TRACKS.leftHero / (GRID_TRACKS.leftHero + 1);
  assert.ok(
    Math.abs(heroCellRatio() - leftShare) < 1e-12,
    'the hero cell ratio must be the share the column weights make'
  );
  assert.ok(
    Math.abs(heroRowShare() - GRID_TRACKS.topHero / (GRID_TRACKS.topHero + 1)) < 1e-12,
    'the hero row share must be the share the row weights make'
  );

  // And the planner's answer must be what those weights imply. The left-hero
  // shape is a blend of what the hero column wants and what the pair beside it
  // wants, so the case that isolates the hero is the one where only the hero's
  // own shape is known: then the plan is that shape divided by the hero cell's
  // share of the grid, and nothing else.
  const heroOnly = planMediaGrid(
    [{ type: 'image', url: 'https://pbs.twimg.com/media/hero.jpg', aspectRatio: 1 },
     { type: 'image', url: 'https://pbs.twimg.com/media/second.jpg' },
     { type: 'image', url: 'https://pbs.twimg.com/media/third.jpg' }],
    AUTO_GRID
  );
  assert.equal(heroOnly.layout, 'left-hero');
  assert.equal(
    heroOnly.aspectRatio,
    (1 / heroCellRatio()).toFixed(2),
    'the planned shape must be the hero shape divided by the share the weights make'
  );

  // The top-hero shape is the hero row's share of the grid's height, times the
  // hero's own shape — again derived, not written down. A wide hero is chosen
  // because that is what the arrangement is for, and because a narrow one
  // would fall under the shape's own floor.
  const topHero = planMediaGrid(
    [{ type: 'image', url: 'https://pbs.twimg.com/media/hero.jpg', aspectRatio: 1.8 },
     { type: 'image', url: 'https://pbs.twimg.com/media/second.jpg' },
     { type: 'image', url: 'https://pbs.twimg.com/media/third.jpg' }],
    AUTO_GRID
  );
  assert.equal(topHero.layout, 'top-hero');
  assert.equal(
    topHero.aspectRatio,
    (heroRowShare() * 1.8).toFixed(2),
    'the planned shape must be the hero row share times the hero shape'
  );
});

test('F17.21: the mount a picture is hung on has one number, and it is the injected one', async () => {
  // The mount was 8px in the card, 8px in the stylesheet's mat rule and 0px in
  // the grid planner's fallback — two fallbacks that read as a contradiction
  // until you notice they answer for different cases. The card's own figure
  // now comes from one place.
  const plain = await renderCard();
  assert.ok(
    new RegExp(`--media-mount:\\s*0px`).test(plain),
    'a material that mounts nothing says so'
  );

  // A material that mounts its pictures says the one number.
  const gallery = await renderCard({ config: { theme: 'gallery' } });
  assert.ok(
    new RegExp(`--media-mount:\\s*${MEDIA_MOUNT}`).test(gallery),
    `the card must inject the mount (${MEDIA_MOUNT})`
  );
});

test('F17.22: the panel and the stage read the same narrow boundary', () => {
  // The stylesheet decides how the panel is laid out and the script decides
  // how it starts, so the boundary has to be one number. A media query's
  // condition cannot be read from the script, so this asserts the script's
  // side and the stylesheet's side agree.
  assert.equal(NARROW_BREAKPOINT, 900);
  assert.equal(viewportPadding(NARROW_BREAKPOINT), 12, 'at the boundary the stage trims');
  assert.equal(viewportPadding(NARROW_BREAKPOINT + 1), 24, 'past it the stage breathes');

  // The stylesheet's side, read as the conditions its rules sit under rather
  // than as a string: the panel's narrow layout has to be guarded by exactly
  // the script's boundary, and not by a condition that merely mentions it.
  // `@media not (max-width: 900px)` and `@media (max-width: 900px) and (…)`
  // both contain the substring and both put the panel on the wrong side.
  const sheet = cssSheet(path.resolve(__dirname, '../../src/content/styles/modal.css'));
  const narrow = sheet.filter((r) => r.selectors.includes('.controls-panel') && r.media.length > 0);
  assert.ok(narrow.length > 0, 'the panel must have a rule under a condition');

  const boundary = narrow.map((r) => r.media.join(' and ')).filter((c) => /max-width/.test(c));
  assert.deepEqual(
    boundary,
    [`(max-width: ${NARROW_BREAKPOINT}px)`],
    `the panel breaks only at the script's own boundary, got ${JSON.stringify(boundary)}`
  );

  // And the boundary is a real pair: nothing may sit between 900 and 901, or a
  // window one pixel wide of either rule falls through both.
  const width = (media: string): number | undefined => {
    const m = media.match(/\(min-width:\s*(\d+)px\)|\(max-width:\s*(\d+)px\)/);
    return m ? Number(m[1] ?? m[2]) : undefined;
  };
  const narrowMax = width(`(max-width: ${NARROW_BREAKPOINT}px)`)!;
  const wideMin = sheet
    .flatMap((r) => r.media.join(' and '))
    .map(width)
    .filter((w): w is number => w !== undefined)
    .find((w) => w > narrowMax);
  assert.ok(wideMin !== undefined, 'the wide layout must start somewhere above the narrow one');
  assert.equal(wideMin, narrowMax + 1, `a window at ${narrowMax + 0.5}px would match neither rule`);
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
    isThreadConnectedPair(
      { isDetailPage: false },
      { article: august, tweet: first },
      { article: september, tweet: second }
    ),
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
    isThreadConnectedPair(
      { isDetailPage: false },
      { article: main, tweet: first },
      { article: reply, tweet: second }
    ),
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
  //
  // Two flushes are needed, not one: the mount reads the stored preferences
  // asynchronously, and the answer lands in a state update that Preact then
  // flushes on the next timer. Measured on this machine, the stored theme
  // reaches the card 78-104ms after the mount — over two 35ms timers and the
  // storage round trip between them. The old 60ms was below even the low end
  // of that, so the assertion raced the answer and failed at random.
  const flushEffects = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 150));

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

/**
 * Waits for `condition`, and fails with `message` once `timeoutMs` is spent.
 *
 * The exports a few of these tests drive end when they end: a card with
 * pictures asks the background proxy once per URL, and how many scheduler ticks
 * that takes depends on the machine rather than on the assertion. A loop of a
 * fixed number of sleeps is a bet on that machine being fast, and a loaded one
 * loses it -- which is how F24.7 and F35.4 went red inside tier5 while passing
 * on an idle box, counted as a regression in the four-hundred-test rerun.
 *
 * The deadline sits above the product's own image budget
 * (`IMAGE_PROXY_BUDGET_MS`, 25s for a whole card), so reaching it means the
 * export is stuck, never that it is still doing something the product allows.
 */
async function waitFor(
  condition: () => boolean,
  message: string,
  timeoutMs = 30_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (condition()) return;
    if (Date.now() >= deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
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
  // Names that live on `Object.prototype` are not theme ids. The sanitizer used
  // to ask `val in THEMES`, which walks the prototype chain, so these passed for
  // live ids -- and `sanitizeTheme`'s answer is fed straight to
  // `THEMES[id].tokens`, which is the crash it exists to prevent. `hasOwn` is
  // what closes that, and only these names can tell the two apart: a test over
  // the real ids and the retired ones passes either way.
  for (const hostile of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(sanitizeTheme(hostile), 'minimal', `${hostile} must not resolve to a theme`);
  }
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

test('F17.7: every theme name is localised in every language', () => {
  for (const id of THEME_IDS) {
    // Must match Controls.tsx's lookup: hyphens become underscores.
    const key = `theme_${id.replace(/-/g, '_')}` as keyof typeof TRANSLATIONS['en-US'];
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(TRANSLATIONS[locale][key], `${locale} missing ${key}`);
    }
  }
});

test('F17.8: the preview mat reads as a board the sheet sits on, in every theme', () => {
  // A mat within a couple of percent of the sheet makes a light card read as a
  // patch on the stage rather than paper on a board, which is the difference
  // between "a card" and "a design". Nocturne already separates well; this keeps
  // it that way and stops the light mats drifting back toward the surface.
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

test('F17.23: the waiting sweep lifts every material’s recess, in one direction', () => {
  // The sweep used to be `color-mix(in srgb, var(--surface) 85%, transparent)`
  // over the recess. That is only a highlight where the sheet happens to be
  // lighter than the recess: on midnight, darkroom and terminal it darkened the
  // block, on glass the two are the same colour and the sweep was invisible, and
  // on brutalist it went the wrong way on a pale sheet.
  //
  // The rule is now a fixed perceptual step off the recess itself, declared
  // last so it is the one that wins; the plain mix before it is only there for
  // a browser without relative colour. The ratio below models that step, but
  // the model clips the gamut per channel where the browser reduces chroma --
  // it is a direction check, and dev/verify-motion.mjs reads what a browser
  // actually paints on all twelve materials.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const sheenRule = css.slice(css.indexOf('.media-placeholder::after'));
  const sheen = sheenRule.slice(0, sheenRule.indexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = [...sheen.matchAll(/background\s*:\s*([^;]+);/g)].map((m) =>
    m[1].replace(/\s+/g, ' ').trim()
  );
  const effective = declarations.at(-1) ?? '';
  assert.match(
    effective,
    /oklch\(from var\(--quote-bg\) calc\(l \+ 0\.1\) c h\)/,
    'the declaration that wins must lift the recess by a fixed perceptual step'
  );


  for (const id of THEME_IDS) {
    const recess = channels(THEMES[id].tokens.quoteBackground);
    const [L, a, b] = toOklab(recess);
    // The step is clamped by the gamut: a recess within 0.1 of white cannot be
    // lifted a full step, and no colour is. That covers the six near-white
    // materials (minimal, glass, riso, gallery, receipt, brutalist) -- it is a
    // limit of the material, not of the rule, so those are held to "brighter
    // and visible at all" rather than to the ratio the others get.
    const clamped = L + 0.1 > 1;
    const sheenColour = fromOklab(Math.min(1, L + 0.1), a, b);
    assert.ok(
      luminance(sheenColour) > luminance(recess),
      `${id} sweep is not brighter than the recess it lies on`
    );
    const ratio = contrast(sheenColour, recess);
    assert.ok(
      ratio >= (clamped ? 1.02 : 1.12),
      `${id} sweep only ${ratio.toFixed(2)}:1 off the recess — too faint to read as one`
    );
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
  // leave the contract asserted but unenforced. Only the footer: F17.14b already
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
  assert.equal(PADDING.default, '16px', 'the card ships at the tightest tier');
  for (const option of PADDING_OPTIONS) {
    assert.equal(sanitizePadding(option), option, `${option} is offered but the sanitiser rejects it`);
  }
  assert.equal(sanitizePadding('17px'), PADDING.default);
  assert.equal(sanitizePadding(''), PADDING.default);
});

test('F18.2: the corner picker offers three explicit corners plus follow-theme', () => {
  assert.deepEqual(RADIUS_OPTIONS, ['theme', '0px', '12px', '20px']);
  for (const option of RADIUS_OPTIONS) {
    assert.equal(sanitizeRadius(option), option, `${option} is offered but the sanitiser rejects it`);
  }
});

test('F18.2b: an option names its values and its default in one place', () => {
  // The picker list, the sanitiser and the shipped configuration were three
  // hand-written copies of the same option, and the corner's three copies
  // disagreed: the sanitiser answered '12px' for a value that was never set
  // while the card shipped with 'theme', which is what the `??` in
  // `normalizeStoredConfig` existed to paper over. One option now says all
  // three, so there is nothing left to disagree about.
  const options = [
    { name: 'padding', option: PADDING, shipped: DEFAULT_CARD_CONFIG.padding, sanitize: sanitizePadding },
    { name: 'radius', option: RADIUS, shipped: DEFAULT_CARD_CONFIG.borderRadius, sanitize: sanitizeRadius },
    { name: 'aspect ratio', option: ASPECT_RATIO, shipped: DEFAULT_CARD_CONFIG.aspectRatio, sanitize: sanitizeAspectRatio },
    { name: 'image fit', option: IMAGE_FIT, shipped: DEFAULT_CARD_CONFIG.imageFit, sanitize: sanitizeImageFit },
    { name: 'media layout', option: MEDIA_LAYOUT, shipped: DEFAULT_CARD_CONFIG.mediaLayout, sanitize: sanitizeMediaLayout },
    { name: 'canvas ratio', option: CANVAS_RATIO, shipped: DEFAULT_CARD_CONFIG.canvasRatio, sanitize: sanitizeCanvasRatio },
    { name: 'canvas background', option: CANVAS_BACKGROUND, shipped: DEFAULT_CARD_CONFIG.canvasBackground, sanitize: sanitizeCanvasBackground },
  ];

  for (const { name, option, shipped, sanitize } of options) {
    assert.ok(option.values.includes(option.default), `${name}'s default must be one of its own values`);
    assert.equal(shipped, option.default, `${name}'s shipped default must be the option's own`);

    // Every value the option offers survives a round trip, and everything else
    // falls back to the same default the card ships with.
    for (const value of option.values) {
      assert.equal(sanitize(value), value, `${name} must admit ${value}`);
    }
    for (const bogus of ['', 'nonsense', '__proto__', 'constructor', 42, null, undefined]) {
      assert.equal(
        sanitize(bogus as string),
        option.default,
        `${name} must answer ${JSON.stringify(bogus)} with its own default`
      );
    }
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
  // The shipped default rather than a concrete corner: a value that cannot be
  // read is not the user choosing a corner, so it must not pick one either.
  // Answering '12px' would put a specific roundness on every card whose stored
  // preference was damaged; answering 'theme' hands the decision back to the
  // material, which is where the card's own default leaves it too.
  for (const bogus of ['100px', '12', 'round', 'url(x)', '']) {
    assert.equal(sanitizeRadius(bogus), DEFAULT_CARD_CONFIG.borderRadius, `admitted ${bogus}`);
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
  assert.equal(aspectMinHeight('auto'), 'auto');
  assert.equal(aspectMinHeight('auto', 1200), 'auto', 'the width is irrelevant to Auto');
});

test('F19.2: the 3:4 poster ratio floors the card at four thirds of its width', () => {
  // Whole pixels, because a card is a picture: its height is read back out of
  // the raster, where a third of a pixel is a third of a pixel.
  assert.equal(aspectMinHeight('3:4', 640), '853px');
  assert.equal(aspectMinHeight('3:4', 320), '427px');
});

test('F19.3: the 16:9 banner ratio floors the card at nine sixteenths of its width', () => {
  assert.equal(aspectMinHeight('16:9', 640), '360px');
  assert.equal(aspectMinHeight('16:9', 1280), '720px');
});

test('F19.4: a poster card reaches its floor without being pinned to it', async () => {
  const style = cardRootStyle(await renderCard({ data: THREAD, config: { aspectRatio: '3:4' } }));

  assert.ok(
    style.includes(`min-height:${aspectMinHeight('3:4', CARD_WIDTH)}`),
    `the poster floor has to reach the card: ${style}`
  );
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

/**
 * Which footer switches the controls panel offers for a given post.
 *
 * The panel groups by what a control does rather than by its widget type, and
 * withholds a switch the post cannot use. Both claims are about the group's
 * membership, so they are read off the rendered roles rather than off class names
 * -- a relabelled heading or a reordered list is not a regression, but a switch
 * offered for a card that has nothing to print is.
 *
 * An empty array is also the answer for "there is no footer group at all", so a
 * caller asserting emptiness cannot tell the two apart. `footerGroupPresent`
 * does, because the group is the thing that should disappear entirely.
 */
async function footerSwitches(
  threadData: ThreadData
): Promise<{ labels: string[]; groupPresent: boolean }> {
  const html = await renderControls({ threadData });
  const footer = html.match(
    /<section class="control-section">\s*<span class="control-label"><span>Card Footer<\/span><\/span>([\s\S]*?)<\/section>/
  );
  return {
    labels: footer
      ? [...footer[1].matchAll(/class="toggle-title"[^>]*>([^<]+)</g)].map((m) => m[1].trim())
      : [],
    groupPresent: Boolean(footer),
  };
}

test('F21.7: a footer switch is withheld when the post has nothing to print', async () => {
  // A post with no link, no metrics and no timestamp. Each of the three footer
  // switches would render the same card either way, so offering it invites the
  // user to conclude the panel is broken.
  const bare = {
    id: 'bare',
    author: VIDEO_TWEET.author,
    text: 'a post with nothing on it',
    media: [],
  } as unknown as TweetData;
  const thread = { author: VIDEO_TWEET.author, isSingle: true, targetTweetIndex: 0, tweets: [bare] };

  // The group goes too. A heading over an empty list would spend panel space
  // advertising a footer that this card does not draw, which is the same "this
  // panel is broken" reading the suppression exists to avoid.
  const none = await footerSwitches(thread);
  assert.deepEqual(none.labels, [], 'no footer switch is offered for a post the card prints no footer for');
  assert.equal(none.groupPresent, false, 'and the empty heading is not left behind');

  // And the other way round: the same switch reappears once the data is there.
  // url is stripped so the QR stays withheld — this post gains metrics but no link.
  const { url: _drop, ...noUrl } = VIDEO_TWEET;
  const withStats = { ...noUrl, stats: { replies: '3', reposts: '2', likes: '9', views: '10' } };
  const thread2 = { ...thread, tweets: [withStats] };
  const some = await footerSwitches(thread2);
  assert.equal(some.groupPresent, true, 'the group returns once a switch is worth offering');
  assert.ok(some.labels.includes('Metrics &amp; Stats'), 'the stats switch returns once the post has metrics');
  assert.ok(some.labels.includes('Timestamp'), 'so does the timestamp one');
  assert.ok(!some.labels.includes('QR Code'), 'but not the QR — this post still has no link');
});

test('F21.8: with no post to judge, every footer switch is offered', async () => {
  const html = await renderControls();
  // SSR HTML-escapes ampersands, so `Metrics &amp; Stats` is the expected form.
  const switches = [...html.matchAll(/class="toggle-title"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
  assert.ok(switches.includes('Metrics &amp; Stats'), 'the stats switch is offered');
  assert.ok(switches.includes('Timestamp'), 'so is the timestamp one');
  assert.ok(switches.includes('QR Code'), 'and the QR one');
});

test('F21.9: the toggles are grouped by what they change, not by widget type', async () => {
  const html = await renderControls();

  // Every switch in the footer group adds information to the card. The one switch
  // that removes something -- the privacy blur -- has a heading of its own, so
  // "everything in this group hides" is a promise the group can keep.
  assert.ok(html.includes('<span>Privacy</span>'), 'privacy is its own group');
  const privacy = html.match(
    /<span>Privacy<\/span>[\s\S]*?class="toggle-title"[^>]*>([^<]+)</
  );
  assert.equal(privacy![1].trim(), 'Blur Author (Privacy)', 'and holds the one switch that hides');

  // The controls that change how a post is presented rather than what it says sit
  // behind the disclosure, each with a title explaining what the label does not.
  for (const title of ['Video Play Button', 'Credit &amp; build', 'Tweet Card Button']) {
    assert.ok(html.includes(`>${title}</span>`), `the "${title}" switch is offered`);
  }
  assert.ok(
    html.includes('While hidden, hover a post and press Alt + C'),
    'the action-bar switch says how to reach the card once the button is hidden'
  );
});

test('F21.10: the exported pixel size is read beside the export button', async () => {
  const html = await renderControls();
  assert.ok(
    !html.includes('export-size-hint'),
    'no figure is printed before the card has been measured — a frame has no height yet'
  );

  // With a size in hand it belongs to the action bar, not to the aspect ratio it
  // used to sit under: the height moves with padding, radius and the media grid
  // too, so under the ratio it read as though only the ratio changed it.
  const mod = await loadModule('/src/content/ui/Controls.tsx');
  const sized = renderToStaticMarkup(
    h(mod.Controls as never, {
      config: { ...CARD_CONFIG },
      onChange: () => {},
      onExportCopy: () => {},
      onExportDownload: () => {},
      exportSize: { width: 1280, height: 960 },
    })
  );
  assert.ok(sized.includes('export-size-hint'), 'the figure is rendered');
  assert.ok(/class="export-actions"[\s\S]*export-size-hint/.test(sized), 'inside the export action bar');
  assert.ok(
    sized.indexOf('export-size-hint') < sized.indexOf('btn-primary'),
    'and above the button it describes'
  );
});

/**
 * Which of the two media controls the panel offers, read off the radio groups'
 * accessible names rather than off a wrapper element, so the assertion is about
 * whether the control is offered rather than about how the markup nests.
 */
async function mediaControls(threadData?: ThreadData): Promise<string[]> {
  const html = await renderControls({ threadData });
  const en = TRANSLATIONS['en-US'];
  return [...html.matchAll(/role="radiogroup" aria-label="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((name) => name === en.imageFit || name === en.mediaLayout);
}

test('F21.11: the media controls are withheld when the card draws no picture', async () => {
  // Fit and layout act on pictures. A post with none renders the same card in
  // either setting, so offering them is the same "this panel is broken" reading
  // the footer switches are already withheld to avoid.
  const textOnly = {
    id: 'text-only',
    author: VIDEO_TWEET.author,
    text: 'a post with no picture on it',
    media: [],
  } as unknown as TweetData;
  const bare = {
    author: VIDEO_TWEET.author,
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [textOnly],
  };

  assert.deepEqual(
    await mediaControls(bare),
    [],
    'neither media control is offered for a post the card prints no picture for'
  );

  // They come back as soon as there is something to lay out -- including when the
  // picture is not on the first post, because the card draws media for every post
  // it prints, not only the first.
  const both = [TRANSLATIONS['en-US'].imageFit, TRANSLATIONS['en-US'].mediaLayout];

  assert.deepEqual(
    await mediaControls({ ...bare, tweets: [textOnly, VIDEO_TWEET] }),
    both,
    'a picture further down the thread brings both back'
  );

  // A quoted post's picture counts as well: the card mounts it with the same fit
  // and layout rules as any other.
  const quoted = {
    ...textOnly,
    quotePost: { ...VIDEO_TWEET, quotePost: undefined },
  } as unknown as TweetData;
  assert.deepEqual(
    await mediaControls({ ...bare, tweets: [quoted] }),
    both,
    "a quoted post's picture counts too"
  );

  // And with nothing to judge -- the string renderer, or a mount that has not
  // resolved a thread yet -- both are offered rather than guessed away.
  assert.deepEqual(await mediaControls(), both, 'with no post to judge, both are offered');
});

test('F21.14: the language picker marks the stored preference, "auto" included', async () => {
  // The picker is a radio group whose checked item is the one the panel says
  // you chose. It draws `sanitizeLocalePref(config.locale)`, not the resolved
  // language, and that distinction is the whole feature: resolving first would
  // light up "Deutsch" on a German machine whose setting is still "follow the
  // browser", and the user would have no way to see -- let alone keep -- the
  // setting they actually have.
  //
  // Nothing asserted the checked state before, so a picker that always marked
  // the first option passed everything.
  // Confined to the locale grid: the panel has eight other radio groups, and a
  // search over the whole document would count their selections too.
  const checkedInPicker = (html: string): string[] => {
    const start = html.indexOf('class="locale-grid"');
    assert.ok(start > -1, 'the language picker is not in the markup');
    const grid = html.slice(start, html.indexOf('</section>', start));
    return [...grid.matchAll(/aria-checked="true"[^>]*>([^<]*)</g)].map((m) => m[1]);
  };

  // The panel draws itself in the language the preference resolves to, so the
  // word for "auto" is that language's -- not English's, which is what a test
  // running on this machine's own tag would otherwise be pinning.
  const autoLabel = getTranslation(resolveLocale('auto')).languageAuto;
  const auto = checkedInPicker(await renderControls({ config: { locale: 'auto' } }));
  assert.deepEqual(
    auto,
    [autoLabel],
    '"auto" must be the only marked option when the preference is "auto"'
  );

  const german = checkedInPicker(await renderControls({ config: { locale: 'de' } }));
  assert.deepEqual(german, ['Deutsch'], 'a pinned language marks exactly its own option');
});

test('F21.12: the media controls lead the panel, ahead of the choices that hold', async () => {
  // Fit and layout are the only controls whose right answer is a property of the
  // post rather than of the user, so they expire per post while every other
  // answer here holds for weeks. That is why they come first.
  // The language label carries an ampersand, and SSR escapes it inside the
  // attribute, so the needle is escaped the same way before searching.
  const html = await renderControls();
  const en = TRANSLATIONS['en-US'];
  const at = (label: string) => html.indexOf(`aria-label="${label.replace(/&/g, '&amp;')}"`);
  const fit = at(en.imageFit);
  assert.ok(fit > -1, 'the fit control is rendered');
  assert.ok(fit < at(en.aspectRatio), 'ahead of the aspect ratio');
  assert.ok(fit < at(en.theme), 'ahead of the theme');
  assert.ok(at(en.language) > -1, 'the language picker is still rendered');
  assert.ok(
    fit < at(en.language),
    'and well ahead of the language picker, which lives in the disclosure'
  );
});

test('F21.13: the theme count does not move when the settings disclosure opens', async () => {
  // The label counts what the grid's own button reveals, so a section that has
  // nothing to do with themes must not change it. It used to be counted from a
  // pool that "More settings" also widened, so opening that section turned
  // "expand the other 7" into "the other 8" while the grid itself went on
  // showing the same four themes -- a number that changes under the user for no
  // reason they can see.
  await withContainerEnv(async ({ openCardModal, flushEffects }) => {
    const container = openCardModal(CONTAINER_THREAD);
    await flushEffects();

    const grid = container.shadow.querySelector('.theme-grid') as any;
    assert.ok(grid, 'the theme grid is rendered');
    const expand = (): any =>
      container.shadow.querySelector(`.more-toggle[aria-controls="${grid.id}"]`);
    const settings = (): any => container.shadow.querySelector('.more-section .more-toggle');
    assert.ok(expand(), 'the grid has its own expansion button');
    assert.ok(settings(), 'and the settings disclosure is there too');

    const label = expand().textContent;
    const promised = Number((label.match(/\d+/) || [])[0]);
    assert.ok(promised > 0, `the label promises a count: ${label}`);

    settings().click();
    await flushEffects();
    assert.equal(expand().textContent, label, 'opening the settings left the theme count alone');

    settings().click();
    await flushEffects();
    assert.equal(expand().textContent, label, 'and closing them left it alone too');

    // And the number is the truth about this button: expanding reveals exactly
    // the themes it promised, Brutalist included.
    const collapsed = container.shadow.querySelectorAll('.theme-button').length;
    expand().click();
    await flushEffects();
    const expanded = container.shadow.querySelectorAll('.theme-button').length;
    assert.equal(expanded - collapsed, promised, 'the expansion reveals what the label promised');
  });
});

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

test('F21.2d: a bookmark count is labelled as bookmarks, never as views', async () => {
  // Views and bookmarks came from two different nodes on the page
  // (`div[data-testid="viewCount"]` vs the bookmark button) and two different
  // GraphQL fields, but the card printed the pair through one slot:
  // `formatStat(stats.views || stats.bookmarks)`. A post whose views the
  // extraction missed but whose bookmarks it caught therefore showed the
  // bookmark count under "Views" with the views icon — a wrong number under the
  // wrong noun, which is worse than leaving the slot empty.
  const bookmarksOnly = await renderCard({
    data: { ...VIDEO_TWEET, stats: { replies: '191', reposts: '80', likes: '5.2K', bookmarks: '37' } },
  });
  assert.ok(bookmarksOnly.includes('37'), 'a bookmark count is still shown');
  assert.ok(
    bookmarksOnly.includes(`${TRANSLATIONS['en-US'].bookmarks}`),
    'and carries the bookmarks label it belongs to'
  );
  assert.ok(
    !bookmarksOnly.includes(`${TRANSLATIONS['en-US'].views}`),
    'but never the views label it does not'
  );

  // The views slot keeps its own icon, so the two metrics are told apart by
  // more than the title text.
  const viewsOnly = await renderCard({
    data: { ...VIDEO_TWEET, stats: { replies: '191', reposts: '80', likes: '5.2K', views: '842' } },
  });
  assert.ok(viewsOnly.includes('842'), 'a views count is shown');
  assert.ok(
    !viewsOnly.includes(`${TRANSLATIONS['en-US'].bookmarks}`),
    'and does not claim to be a bookmark count'
  );
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

test('F21.14: the sheet opens folded on a narrow window and open on a wide one', async () => {
  // F21.6 covers the string renderer, which has no window to measure. The two
  // real viewports are what this default is about. The boundary is the shared
  // constant, not a number typed here: `geometry` is what the stylesheet's media
  // query is kept honest against elsewhere in this file.
  const scope = globalThis as unknown as { window?: { innerWidth: number } };
  const saved = scope.window;
  try {
    scope.window = { innerWidth: NARROW_BREAKPOINT };
    const narrow = await renderControls();
    assert.ok(narrow.includes('controls-panel is-collapsed'), 'a phone opens on the preview, not on the controls');
    assert.ok(narrow.includes('aria-expanded="false"'), 'and the handle says the sheet is closed');

    scope.window = { innerWidth: NARROW_BREAKPOINT + 1 };
    const wide = await renderControls();
    assert.ok(!wide.includes('is-collapsed'), 'a wide screen opens expanded');
    assert.ok(wide.includes('aria-expanded="true"'), 'and the handle says the sheet is open');
  } finally {
    if (saved === undefined) delete scope.window;
    else scope.window = saved;
  }
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

test('F23.7: the preview opens on 适应', async () => {
  // The preview answers "show me the card I just asked for" before anything else,
  // so the level it opens on is the one that shows the whole card. It is also the
  // only level that stays meaningful on a phone, where every fixed percentage is
  // capped away -- and there the toolbar is the only control left, so opening on
  // a capped level would mean opening on a dead button.
  //
  // Nothing asserted this before: the selection was read off `ZOOM_LEVELS.length`
  // at mount, and swapping that for any other index kept every gate green.
  //
  // The locale is seeded because the radio is found by its label, and the default
  // comes off the machine's own `navigator.language`.
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;
  const chromeMock = createChromeMock();
  await chromeMock.storage.local.set({ post_to_card_user_prefs: { locale: 'en-US' } });
  scope.chrome = chromeMock;

  try {
    await withContainerEnv(async ({ openCardModal, flushEffects }) => {
      const container = openCardModal(CONTAINER_THREAD);
      await flushEffects();

      const en = TRANSLATIONS['en-US'];
      const group = container.shadow.querySelector(
        `[role="radiogroup"][aria-label="${en.zoomLabel}"]`
      ) as any;
      assert.ok(group, 'the preview toolbar has to be on screen to answer this');

      const radios = [...(group.querySelectorAll('[role="radio"]') as any)] as any[];
      const checked = radios.filter((radio) => radio.getAttribute('aria-checked') === 'true');
      assert.equal(checked.length, 1, `exactly one level is selected, got ${checked.length}`);
      assert.equal(checked[0].textContent.trim(), en.zoomFit, 'and it is 适应');
      assert.ok(
        checked[0].classList.contains('is-active'),
        'the selected level is the one styled as active'
      );
    });
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
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
// F23.8: the dialog takes focus only after the frame the click returns in
//
// Measuring is what put this rule here: focusing a dialog that was just
// inserted makes the browser run the host page's first style and layout pass
// before `focus()` returns — 180–280 ms of blocked main thread on an X status
// page, over half of the first card open (no focus: 28 ms). The focus has to
// land eventually, or the Tab trap and Escape handler are dead, so this
// asserts both halves: not in the click's own turn, and yes by the next one.
// -------------------------------------------------------------

test('F23.8: the dialog is not focused during the click that opened it', async () => {
  await withContainerEnv(async ({ doc, openCardModal }) => {
    const container = openCardModal(CONTAINER_THREAD);
    const dialog = container.mountPoint.querySelector('#post-to-card-dialog');
    assert.ok(dialog, 'the modal rendered no dialog');

    // Back to back, as they run inside the click handler: `openCardModal`
    // commits the render, and the ref and the effects are flushed right after
    // it. Nothing here awaits, so the focus, were it taken synchronously, would
    // already have landed on the line below.
    assert.notEqual(doc.activeElement, dialog, 'taking focus synchronously is what blocks the click');

    // The other half, so a modal that never focused at all cannot pass: the
    // shim has no frames, so the deferred focus lands on the next task.
    await waitFor(
      () => doc.activeElement === dialog,
      'the focus has to land on the next frame, not never'
    );
  });
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

/**
 * The exported element — the mat — as the preview mounts it.
 *
 * This is what the engine is handed, so a test that exports wants this one. A
 * test that reads the *card's* own attributes wants `cardRoot` instead: the mat
 * is an outer box and carries none of them.
 */
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

test('F24.1: a lone post exports at 3x, and a picture past X\'s display cap at 2x', async () => {
  // The scale is no longer one number for every card. X scales a picture down to
  // 2048px on display, so a single post -- 640x~400 at 3x is 1920 -- keeps its
  // pixels at 3x, while a thread is already past that at 2x and gains nothing
  // but a longer export from more. The rule is `defaultExportScale` in
  // `scale.ts`; what this drives is that the exporter reaches for it.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();
  const scale = await loadModule('/src/content/engine/scale.ts');
  assert.equal(scale.THREAD_EXPORT_SCALE, 2, 'the 2x floor is the one number a thread keeps');
  assert.equal(scale.SINGLE_POST_EXPORT_SCALE, 3);

  await withMountedCard(EXPORT_THREAD, async (card) => {
    const blob = await engine.renderCardToBlob(card);
    assert.equal(blob.type, 'image/png');
    assert.ok(blob.size > 0, 'the rasterizer handed back an empty picture');
  });
  assert.equal(stub.rasterizerCalls.length, 1, 'the card is rasterized exactly once');
  assert.equal(stub.rasterizerCalls[0].options.scale, 3, 'a lone post is exported at 3x');

  // And the picture that is past the cap: 2176px is what a five-post thread
  // measures, and 3x of it would be 6528 -- all but the top 2048 of it thrown
  // away by the service on the way in.
  const box = { width: 640, height: 2176 };
  assert.equal(scale.defaultExportScale(box), 2, 'a thread keeps the pixels X will keep');
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
    // Read off the live card: the engine drops marked nodes from the copy, so
    // the copy is exactly where they must no longer be found.
    const marked = card.querySelectorAll('[data-html2canvas-ignore="true"]');
    assert.ok(marked.length > 0, 'the card has to mark its UI-only controls for the rasterizer to skip');

    await engine.renderCardToBlob(card);

    // The filter is evaluated inside the environment: it asks
    // `node instanceof HTMLElement`, and that global only exists while the
    // container env is installed.
    const copy = stub.rasterizerCalls[0].target as DomElement;
    const { options } = stub.rasterizerCalls[0];
    assert.equal(typeof options.filter, 'function', 'the rasterizer is handed a filter');
    assert.equal(
      copy.querySelectorAll('[data-html2canvas-ignore="true"]').length,
      0,
      'a marked control must not reach the rasterizer at all'
    );
    for (const node of marked) {
      assert.equal(options.filter(node), false, 'a marked control was drawn, not skipped');
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

test('F24.7: a rasterizer failure reaches the user as the reason, not as a silent no-op', async () => {
  // `exportCard` deliberately lets the rasterizer's own failure through -- a
  // screenshot that never happened is a defect, not an outcome -- so the preview
  // is the only thing that can tell the user. This drives that hand-off end to
  // end: the stand-in rejects, and the string the user ends up reading is the
  // reason it gave.
  const stub = await rasterizer();
  stub.resetRasterizer();
  stub.failNextRasterization('canvas exploded');
  const engine = await exportEngine();

  await withContainerEnv(async ({ openCardModal, flushEffects }) => {
    // A stand-in for the real hand-off in `content/index.ts`, which is exactly
    // `exportCard(target, { action })`. Whether the engine resolves or throws is
    // what the preview has to cope with.
    let settled = false;
    const container = openCardModal(EXPORT_THREAD, (target: HTMLElement, action: string) =>
      engine.exportCard(target, { action }).finally(() => { settled = true; })
    );
    await flushEffects();

    const download = container.shadow.querySelector('.export-actions .btn-secondary');
    assert.ok(download, 'the preview has no download control to press');
    download.click();
    // The rejection travels back through the engine and the preview's own catch
    // before it becomes a status line. How long that takes is a property of the
    // export, not of this test, so it waits for the line rather than for a
    // quantity of ticks.
    await waitFor(() => {
      const shown = container.shadow.querySelector('.status-message');
      return settled && !!shown && shown.className.includes('is-error');
    }, 'the export never reported its failure');

    const status = container.shadow.querySelector('.status-message');
    assert.ok(status, 'a failed export said nothing at all');
    assert.equal(status.textContent, 'canvas exploded',
      'the reason the export failed never reached the user');
    assert.ok(status.className.includes('is-error'),
      'a failure was announced as an ordinary status');
  });
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
      const result = await engine.resolveImageForExport(url);
      assert.equal(result.ok, false, 'the picture could not be delivered');
      assert.equal(result.src, engine.FALLBACK_PLACEHOLDER_DATA_URL,
        'and what is drawn in its place is the placeholder, not the remote URL');
    } finally {
      if (savedChrome !== undefined) scope.chrome = savedChrome;
    }
  });
});

test('F25.5: an image that is already a data URL is not sent through the proxy', async () => {
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    const result = await engine.resolveImageForExport(dataUrl);
    assert.equal(result.ok, true);
    assert.equal(result.src, dataUrl);

    const empty = await engine.resolveImageForExport('');
    assert.equal(empty.ok, true, 'and an empty source stays empty');
    assert.equal(empty.src, '');
  });
});

test('F25.6: a message the worker never received is asked again; an answer it gave is final', async () => {
  // The proxy is a message to the MV3 service worker, and that channel fails
  // for reasons that have nothing to do with the picture: the worker is
  // evicted mid-export and the port closes. Every picture shares the one
  // worker, so one eviction used to turn the whole card grey -- the failure
  // the user saw as "5 张配图未能加载" on an otherwise successful export. A
  // rejection therefore has to be asked again.
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    const scope = globalThis as Record<string, unknown>;
    const savedChrome = scope.chrome;
    const url = 'https://pbs.twimg.com/media/dropped.jpg';

    try {
      let calls = 0;
      const retrying = createChromeMock();
      // A rejecting `sendMessage` is how Chrome reports an unreachable worker;
      // answering `{ success: false }` instead would be the different case
      // tested below.
      retrying.runtime.sendMessage = async () => {
        calls++;
        if (calls === 1) {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        return { success: true, dataUrl: 'data:image/jpeg;base64,RETRIED', contentType: 'image/jpeg' };
      };
      scope.chrome = retrying;

      assert.deepEqual(
        await engine.resolveImageForExport(url),
        { ok: true, src: 'data:image/jpeg;base64,RETRIED' },
        'a dropped message must not cost the picture'
      );
      assert.equal(calls, 2, 'the second ask is what recovered it');

      // Chrome's other shape for the same lost message: a worker that never
      // registered does not reject, it answers `undefined`. Reading only the
      // throw would leave this half grey.
      let silentCalls = 0;
      const silent = createChromeMock();
      silent.runtime.sendMessage = async () => {
        silentCalls++;
        return undefined as any;
      };
      scope.chrome = silent;

      assert.equal((await engine.resolveImageForExport(url)).src, engine.FALLBACK_PLACEHOLDER_DATA_URL);
      assert.equal(silentCalls, 3, 'a worker that never answers is asked the full number of times');

      // The other half of the rule. A worker that answered has already been to
      // the network and reported what it found; a 404 does not become a 200 on
      // the next ask, so re-asking only adds a round trip to every genuinely
      // missing picture and delays the export the user is waiting on.
      let answered = 0;
      const failing = createChromeMock();
      failing.runtime.sendMessage = async () => {
        answered++;
        return { success: false, error: 'HTTP 404: Not Found', retryable: false };
      };
      scope.chrome = failing;

      assert.equal((await engine.resolveImageForExport(url)).src, engine.FALLBACK_PLACEHOLDER_DATA_URL);
      assert.equal(answered, 1, 'an answer is final; only a lost message is retried');

      // And the middle case: an answer the proxy itself marked as the network
      // having a bad moment. The proxy is the only layer that saw the status
      // code, so it is the only one that can draw this line.
      let flaky = 0;
      const transient = createChromeMock();
      transient.runtime.sendMessage = async () => {
        flaky++;
        return flaky === 1
          ? { success: false, error: 'HTTP 503: Service Unavailable', retryable: true }
          : { success: true, dataUrl: 'data:image/jpeg;base64,LATE', contentType: 'image/jpeg' };
      };
      scope.chrome = transient;

      assert.deepEqual(
        await engine.resolveImageForExport(url),
        { ok: true, src: 'data:image/jpeg;base64,LATE' },
        'a 503 is worth one more ask'
      );
      assert.equal(flaky, 2);
    } finally {
      if (savedChrome !== undefined) scope.chrome = savedChrome;
      else delete scope.chrome;
    }
  });
});

test('F25.7: an avatar the proxy cannot deliver exports as the silhouette, not a grey square', async () => {
  // F25.6 stopped one eviction from greying the whole card. This is the other
  // half of the same screenshot: when a picture really cannot be fetched, what
  // the export draws in its place is a per-picture decision. A media picture
  // gets the neutral square, because a missing picture is information the
  // reader wants. An avatar has a designed state of its own -- the silhouette
  // the card already shows for an author with no picture -- and a dark square
  // where a face belongs is not it.
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    const scope = globalThis as Record<string, unknown>;
    const savedChrome = scope.chrome;

    try {
      const mock = createChromeMock();
      mock.runtime.sendMessage = async () => {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      };
      scope.chrome = mock;

      const card = new DomElement('DIV');
      const avatar = new DomImageElement();
      avatar.setAttribute('class', 'author-avatar-img');
      avatar.setAttribute('src', 'https://pbs.twimg.com/profile_images/1/x_400x400.jpg');
      const photo = new DomImageElement();
      photo.setAttribute('class', 'media-picture fit-contain');
      photo.setAttribute('src', 'https://pbs.twimg.com/media/p.jpg?format=jpg&name=orig');
      card.appendChild(avatar);
      card.appendChild(photo);

      const preparation = await engine.prepareCardImages(card);

      assert.ok(avatar.src.includes('%2371767b'),
        'an avatar falls back to the card silhouette, not the neutral square');
      assert.ok(photo.src.includes('%23333333'),
        'a media picture still gets the neutral square');
      assert.equal(preparation.failedImageCount, 2,
        'the export is degraded either way; the reader is still told what did not load');
    } finally {
      if (savedChrome !== undefined) scope.chrome = savedChrome;
      else delete scope.chrome;
    }
  });
});

// -------------------------------------------------------------
// F26: Clipboard Copy with Fallback
// -------------------------------------------------------------
test('F25.8: the rasterizer is handed a data URL, or nothing it can fetch', async () => {
  // The rasterizer meets pictures of its own — a background it has to resolve —
  // and asks for them through a hook. The hook's contract is narrow: a data URL
  // to draw, or `false` to say "this one is not mine to fetch".
  //
  // The rule is the same one the card's own pictures follow: a picture the
  // proxy could not deliver is drawn as the placeholder, and a blob URL is left
  // to the rasterizer, which can read one.
  const engine = await exportEngine();
  await withContainerEnv(async () => {
    const scope = globalThis as Record<string, unknown>;
    const savedChrome = scope.chrome;

    try {
      const mock = createChromeMock();
      mock.runtime.sendMessage = async () => ({
        success: true,
        dataUrl: 'data:image/jpeg;base64,PROXIED',
        contentType: 'image/jpeg',
      });
      scope.chrome = mock;

      const remote = await engine.resolveImageForExport('https://pbs.twimg.com/media/a.jpg');
      assert.equal(remote.ok, true);
      assert.equal(remote.src, 'data:image/jpeg;base64,PROXIED');

      // A blob URL is the rasterizer's own, and the proxy never sees one.
      const blob = await engine.resolveImageForExport('blob:http://x/abc');
      assert.equal(blob.ok, true);
      assert.equal(blob.src, 'blob:http://x/abc');
      assert.ok(!blob.src.startsWith('data:'), 'so the hook hands it back rather than drawing it');
    } finally {
      if (savedChrome !== undefined) scope.chrome = savedChrome;
      else delete scope.chrome;
    }
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

// -------------------------------------------------------------
// F33: Readable export filenames
// -------------------------------------------------------------

test('F33.1: a filename carries handle, date and an opening-line slug', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  assert.equal(
    engine.buildExportFilename({
      handle: '@Ada',
      text: 'Shipping the video pass today!',
      timestamp: '2026-10-02T10:00:00Z',
    }),
    'post-to-card_ada_2026-10-02_shipping-the-video-pass-today.png'
  );
});

test('F33.2: a missing or unusable handle falls back to `x`', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  for (const handle of [undefined, '', '@', '@@@', 'a/b:c*d?']) {
    const name = engine.buildExportFilename({ handle, text: 'hello', timestamp: '2026-10-02T10:00:00Z' });
    assert.match(name, /^post-to-card_[a-z0-9_]+_2026-10-02/, `unusable handle ${String(handle)}: ${name}`);
    assert.ok(!/[:<>"\\|?*/]/.test(name), `illegal character in ${name}`);
  }
  assert.equal(
    engine.buildExportFilename({ handle: '@@', timestamp: '2026-10-02T10:00:00Z' }),
    'post-to-card_x_2026-10-02.png',
    'and no slug segment is left behind'
  );
});

test('F33.3: Windows-illegal characters and trailing dots are removed', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  const name = engine.buildExportFilename({
    handle: 'ada',
    text: 'a<b>c:"d"/e\\f|g?h*i ...  ',
    timestamp: '2026-10-02T10:00:00Z',
  });
  assert.ok(!/[<>:"/\\|?*]/.test(name), `illegal character survived: ${name}`);
  assert.ok(name.endsWith('.png'));
  assert.ok(!/[. ]\.png$/.test(name), `a segment ended in a dot or space: ${name}`);
});

test('F33.4: CJK text is kept, long text is truncated by code point', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  const cjk = engine.buildExportFilename({
    handle: 'ada',
    text: '今天发布了视频功能',
    timestamp: '2026-10-02T10:00:00Z',
  });
  assert.ok(cjk.includes('今天发布了视频功能'), `CJK was dropped: ${cjk}`);

  // Astral letters survive the whitelist (\p{L}), so this is the input that
  // actually reaches the truncation boundary. Emoji do not: they are filtered
  // out, which let the old version of this case pass without truncating.
  const long = engine.buildExportFilename(
    {
      handle: 'ada',
      text: '\u{1D400}'.repeat(200),
      timestamp: '2026-10-02T10:00:00Z',
    },
    // The default 120 cannot be reached from the production caller (the slug is
    // already capped); a small limit is what exercises the branch.
    { maxLength: 45 }
  );
  assert.ok(Array.from(long).length <= 45, `name too long: ${Array.from(long).length} code points`);
  assert.ok(
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(long),
    'a surrogate pair was sliced in half'
  );
  assert.ok(!long.includes('�'), 'and replaced with a replacement character');
});

test('F33.4b: combining marks are kept and equivalent Unicode forms agree', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  const devanagari = engine.buildExportFilename({
    handle: 'ada',
    text: 'हिन्दी',
    timestamp: '2026-10-02T10:00:00Z',
  });
  // Dropping \p{M} leaves a consonant skeleton that no longer spells the word.
  assert.ok(devanagari.includes('हिन्दी'), `combining marks were dropped: ${devanagari}`);

  const composed = engine.buildExportFilename({
    handle: 'ada',
    text: 'café au lait',
    timestamp: '2026-10-02T10:00:00Z',
  });
  // Decomposed e + U+0301, spelled with escapes so an editor cannot normalise
  // it back to the composed form and quietly make this assertion vacuous.
  const decomposed = engine.buildExportFilename({
    handle: 'ada',
    text: 'café au lait',
    timestamp: '2026-10-02T10:00:00Z',
  });
  assert.equal(decomposed, composed, 'the same post must name its file the same way');
});

test('F33.5: an unparseable timestamp falls back to the supplied date', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  const name = engine.buildExportFilename({
    handle: 'ada',
    timestamp: 'not-a-date',
    now: new Date('2026-03-04T00:00:00Z'),
  });
  assert.equal(name, 'post-to-card_ada_2026-03-04.png');
});

test('F33.6: URL-only text produces no slug, and reserved device names are defused', async () => {
  const engine = await loadModule('/src/content/engine/index.ts');
  assert.equal(
    engine.buildExportFilename({
      handle: 'ada',
      text: 'https://example.com/some/long/path',
      timestamp: '2026-10-02T10:00:00Z',
    }),
    'post-to-card_ada_2026-10-02.png',
    'a link is not a title'
  );

  // The prefix already keeps this out of the reserved set; the check is that a
  // hostile slug cannot reintroduce it after sanitising.
  const reserved = engine.buildExportFilename({
    handle: 'ada',
    text: 'CON',
    timestamp: '2026-10-02T10:00:00Z',
  });
  assert.match(reserved, /^post-to-card_ada_2026-10-02_con\.png$/);
});

test('F33.7: the export handler names the file after the target tweet, not the first one', async () => {
  const entry = await loadModule('/src/content/exportHandler.ts');
  const thread: ThreadData = {
    author: { name: 'Ada', handle: '@ada' },
    isSingle: false,
    targetTweetIndex: 1,
    tweets: [
      { ...CONTAINER_THREAD.tweets[0], text: 'first post', timestamp: '2026-10-01T10:00:00Z' },
      { ...CONTAINER_THREAD.tweets[0], id: '90002', text: 'second post', timestamp: '2026-10-02T10:00:00Z' },
    ],
  };

  const engine = await loadModule('/src/content/engine/index.ts');
  const expected = engine.buildExportFilename({
    handle: '@ada',
    text: 'second post',
    timestamp: '2026-10-02T10:00:00Z',
  });

  const handler = entry.createExportHandler(thread) as (
    target: HTMLElement,
    action: string
  ) => Promise<{ filename: string }>;

  const stub = await rasterizer();
  stub.resetRasterizer();
  await withMountedCard(thread, async (card) => {
    const result = await handler(card as unknown as HTMLElement, 'download');
    assert.equal(result.filename, expected);
  });
});

// -------------------------------------------------------------
// F34: The size readout and the exporter share one scale calculation
// -------------------------------------------------------------

test('F34.1: a tall card is reduced to fit the canvas edge', async () => {
  const scale = await loadModule('/src/content/engine/scale.ts');
  const fit = scale.fitScaleToCanvas({ width: 640, height: 40000 }, 2);
  assert.equal(fit.applied, 1.63, 'floor(65535 / 40000 * 100) / 100');
  assert.equal(fit.reduced, true);

  // The product must never exceed the edge; rounding up would.
  assert.ok(fit.applied * 40000 <= scale.MAX_CANVAS_EDGE);
});

test('F34.2: an unmeasured card is left at the requested scale', async () => {
  const scale = await loadModule('/src/content/engine/scale.ts');
  for (const measured of [{ width: 0, height: 0 }, { width: 640, height: 0 }, { width: 0, height: 900 }]) {
    const fit = scale.fitScaleToCanvas(measured, 2);
    assert.equal(fit.applied, 2, 'a zero measurement is not evidence of a problem');
    assert.equal(fit.reduced, false);
  }
});

test('F34.3: a card that already fits is not reduced', async () => {
  const scale = await loadModule('/src/content/engine/scale.ts');
  const fit = scale.fitScaleToCanvas({ width: 640, height: 1000 }, 3);
  assert.equal(fit.applied, 3);
  assert.equal(fit.reduced, false);
});

test('F34.4: the export reports the scale it actually used', async () => {
  // The shim has no layout, so the measured height is injected. `renderCardToBlob`
  // measures the copy it just cloned, which is a fresh node created inside the
  // engine -- the only place the injection can be aimed at is `cloneNode`, the
  // one call every copy comes from.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();

  let report: any = null;
  await withMountedCard(EXPORT_THREAD, async (card) => {
    const element = card as any;
    const realClone = element.cloneNode.bind(element);
    element.cloneNode = (deep?: boolean) => {
      const copy = realClone(deep);
      Object.defineProperty(copy, 'offsetWidth', { value: 640, configurable: true });
      // Tall enough for the limit to bite, short enough that 1x still fits:
      // past 65535 nothing can be exported, which is F34.7's case.
      Object.defineProperty(copy, 'offsetHeight', { value: 40000, configurable: true });
      return copy;
    };

    try {
      await engine.renderCardToBlob(card, { report: (next: unknown) => { report = next; } });
    } finally {
      element.cloneNode = realClone;
    }
  });

  assert.ok(report, 'the engine said nothing about the export');
  assert.equal(report.requestedScale, 2);
  assert.equal(report.appliedScale, 1.63, 'floor(65535 / 40000 * 100) / 100');
  assert.equal(report.scaleReduced, true);
  assert.equal(stub.rasterizerCalls[0].options.scale, report.appliedScale,
    'the readout and the renderer must quote the same number');
});

test('F34.7: a card taller than any canvas is refused, not quoted at a size', async () => {
  const scale = await loadModule('/src/content/engine/scale.ts');
  const fit = scale.fitScaleToCanvas({ width: 640, height: 70000 }, 2);
  assert.equal(fit.impossible, true, '1x is still over the edge');

  // The readout must not promise a file: it says so and offers no size.
  const readout = scale.exportSizeFor(640, 70000, 2);
  assert.ok(readout);
  assert.equal(readout.impossible, true);

  // And the exporter refuses before rasterizing, with an error the panel can
  // word for the user -- rather than the browser's zero-byte blob.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();
  await withMountedCard(EXPORT_THREAD, async (card) => {
    const element = card as any;
    const realClone = element.cloneNode.bind(element);
    element.cloneNode = (deep?: boolean) => {
      const copy = realClone(deep);
      Object.defineProperty(copy, 'offsetWidth', { value: 640, configurable: true });
      Object.defineProperty(copy, 'offsetHeight', { value: 70000, configurable: true });
      return copy;
    };
    try {
      await assert.rejects(
        () => engine.renderCardToBlob(card),
        (err: any) => err?.code === 'too-tall'
      );
    } finally {
      element.cloneNode = realClone;
    }
  });
  assert.equal(stub.rasterizerCalls.length, 0, 'nothing was handed to the rasterizer');

  const html = await renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
    config: CARD_CONFIG,
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    exportSize: { ...readout },
  });
  assert.match(html, /taller than the canvas limit/, 'the hint explains why');
  assert.ok(!html.includes('Exports at'), 'and quotes no size');
  assert.match(html, /btn-primary[^>]*disabled/, 'with nothing to click');
});

test('F34.5: the preview quotes the reduced size when the canvas limit bites', async () => {
  const html = await renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
    config: CARD_CONFIG,
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    exportSize: { width: 1037, height: 64800, scale: 1.62, reduced: true },
  });
  assert.match(html, /1\.62×/, 'the readout has to admit the reduction');
  // The seeded config is en-US, so the hint is the English template.
  assert.match(html, /Exports at/, 'and still be the size hint');
});

test('F34.6: the preview does not claim a reduction when there is none', async () => {
  // The wiring is what matters: the readout must come from the same function
  // the exporter calls, not from arithmetic written in the panel. This is the
  // function App feeds with the measured card.
  const scale = await loadModule('/src/content/engine/scale.ts');
  assert.deepEqual(
    scale.exportSizeFor(640, 40000, 2),
    // 65199, not 65200: the rasterizer sizes the canvas with `Math.floor`, and
    // the readout has to name the pixel count the file actually has.
    { width: 1043, height: 65199, scale: 1.63, reduced: true, impossible: false },
    'a tall card is quoted at the size the engine will produce'
  );
  assert.equal(scale.exportSizeFor(640, 0, 2), null, 'and nothing is quoted before the card is measured');

  const html = await renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
    config: CARD_CONFIG,
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    exportSize: { width: 1280, height: 1920, scale: 2, reduced: false },
  });
  assert.match(html, /1280/);
  // The rendered config is pinned to en-US, so the negative has to be asserted
  // in English: a Chinese string cannot appear either way, and a hint that
  // always used the reduced template would slip through.
  assert.ok(!html.includes('canvas limit'), 'an ordinary export must not carry a caveat');
  assert.ok(!html.includes('reduced to'), 'nor quote a scale it never applied');
});

// -------------------------------------------------------------
// F35: Degraded exports are reported, not dressed as clean ones
// -------------------------------------------------------------

test('F35.1: a partly-failed image fetch is counted per picture, not per URL', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;

  // The fixture matters as much as the assertion: it has to contain a URL used
  // by more than one <img>, or per-URL and per-picture counting produce the same
  // number and the test locks nothing. A two-post thread repeats the avatar.
  const avatarUrl = 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg';
  const repeatedAvatar: ThreadData = {
    author: { name: 'Ada', handle: '@ada', avatarUrl },
    isSingle: false,
    targetTweetIndex: 0,
    tweets: [
      {
        id: '91001',
        url: 'https://x.com/ada/status/91001',
        author: { name: 'Ada', handle: '@ada', avatarUrl },
        text: 'first',
        timestamp: '2026-10-02T10:00:00.000Z',
        isThreadPart: true,
        media: [{ type: 'image', url: 'https://pbs.twimg.com/media/two.jpg' }],
      },
      {
        id: '91002',
        url: 'https://x.com/ada/status/91002',
        author: { name: 'Ada', handle: '@ada', avatarUrl },
        text: 'second',
        timestamp: '2026-10-02T10:05:00.000Z',
        media: [{ type: 'image', url: 'https://pbs.twimg.com/media/ok.jpg' }],
      },
    ],
  };

  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message?.type !== 'FETCH_IMAGE_BASE64') return;
    sendResponse(
      String(message.url).includes('ok.jpg')
        ? { success: true, dataUrl: 'data:image/jpeg;base64,OK' }
        : { success: false, error: 'HTTP 404' }
    );
    return false;
  });
  scope.chrome = chromeMock;

  try {
    let report: any = null;
    await withMountedCard(repeatedAvatar, async (card) => {
      await engine.renderCardToBlob(card, { report: (next: unknown) => { report = next; } });
    });

    assert.ok(report, 'the export did not report anything');
    const avatar = report.imageFailures.find((failure: any) => failure.url === avatarUrl);
    assert.ok(avatar, 'the repeated avatar was not reported at all');
    assert.equal(avatar.occurrences, 2, 'the same URL on two posts is two grey squares');
    assert.equal(report.imageFailures.length, 2, 'the avatar and one photo failed, the ok photo did not');
    assert.equal(report.failedImageCount, 3, 'two avatars plus one photo');
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

test('F35.2: an export that succeeds with grey squares says so, and offers a retry', async () => {
  await withContainerEnv(async ({ openCardModal, flushEffects }) => {
    let calls = 0;
    const outcomes = [
      // Clean first, so the timer it schedules is pending when the warning
      // arrives. Without the clear at the top of `handleExport` that timer
      // fires 2.5s later and wipes the warning, leaving a retry button with no
      // text beside it.
      { success: true, method: 'clipboard', filename: 'a.png' },
      { success: true, method: 'clipboard', filename: 'a.png', degradedImageCount: 2 },
      { success: true, method: 'clipboard', filename: 'a.png' },
    ];
    const container = openCardModal(EXPORT_THREAD, async () => {
      const outcome = outcomes[calls++];
      return outcome as any;
    });
    await flushEffects();

    (container.shadow.querySelector('.export-actions .btn-primary') as any).click();
    for (let i = 0; i < 40; i++) {
      await flushEffects();
      const button = container.shadow.querySelector('.export-actions .btn-primary') as any;
      if (container.shadow.querySelector('.status-message') && !button.disabled) break;
    }
    assert.equal(calls, 1);

    // The second export starts inside the first one's 2.5s window.
    (container.shadow.querySelector('.export-actions .btn-primary') as any).click();
    for (let i = 0; i < 40; i++) {
      await flushEffects();
      if (container.shadow.querySelector('.status-message')?.className.includes('is-warning')) break;
    }
    assert.equal(calls, 2, 'the second click ran a second export');

    const status = container.shadow.querySelector('.status-message') as any;
    assert.ok(status, 'a degraded export said nothing');
    assert.match(status.textContent, /2/);
    assert.ok(!status.className.includes('is-error'), 'the file exists, so this is not an error');
    assert.ok(status.className.includes('is-warning'), 'but it is not a clean success either');

    const retry = container.shadow.querySelector('.status-retry') as any;
    assert.ok(retry, 'a degraded export is worth another attempt');

    // Outlive the success message's 2.5s timer. Clearing a warning while the
    // button it belongs to is still there is how it reads as noise rather than
    // as something to act on.
    await new Promise((resolve) => setTimeout(resolve, 2700));
    await flushEffects();
    assert.ok(
      container.shadow.querySelector('.status-message')?.className.includes('is-warning'),
      'the warning has to stay until the next export'
    );

    (container.shadow.querySelector('.status-retry') as any).click();
    // A clean result says nothing under the buttons: the tick on the button that
    // was pressed is the whole confirmation. So this waits for that tick rather
    // than for a sentence -- and for the sentence to be gone.
    for (let i = 0; i < 40; i++) {
      await flushEffects();
      if (
        !container.shadow.querySelector('.status-message') &&
        container.shadow.querySelector('.export-actions .btn-primary .lucide-check')
      ) {
        break;
      }
    }

    assert.equal(calls, 3, 'the retry re-ran the export rather than reusing the first result');
    assert.ok(!container.shadow.querySelector('.status-retry'), 'a clean export leaves nothing to retry');
    assert.ok(
      !container.shadow.querySelector('.status-message'),
      'a clean export said something, when the button already answered it'
    );
    assert.ok(
      container.shadow.querySelector('.export-actions .btn-primary .lucide-check'),
      'the button that was pressed never confirmed that it worked'
    );
  });
});

test('F35.3: an image with no picture in it is rejected instead of announced as a copy', async () => {
  const engine = await exportEngine();

  // The shape the shipped scale (2) produces: `toBlob` yields null, the
  // `toDataURL` fallback gives `data:,`, and the dpi pass rebuilds it into a
  // 54-byte `image/png` with no signature. A `size === 0` test misses this one
  // entirely, which is how an unallocatable canvas was announced as a copy.
  const stub = await rasterizer();
  stub.resetRasterizer();
  stub.failNextRasterizationWithEmptyBlob();
  await withMountedCard(EXPORT_THREAD, async (card) => {
    await assert.rejects(
      () => engine.renderCardToBlob(card),
      (err: any) => err?.code === 'empty-blob'
    );
  });
  assert.equal(stub.rasterizerCalls.length, 1, 'the card was rasterized once, not retried');

  // And the other shape: at scale 1 the dpi pass is skipped, so the fallback
  // decodes to nothing at all.
  stub.resetRasterizer();
  stub.failNextRasterizationWithEmptyBlob(0);
  await withMountedCard(EXPORT_THREAD, async (card) => {
    await assert.rejects(
      () => engine.renderCardToBlob(card, { scale: 1 }),
      (err: any) => err?.code === 'empty-blob'
    );
  });
});

test('F35.4: an empty image reaches the user as actionable text with a retry', async () => {
  const stub = await rasterizer();
  stub.resetRasterizer();
  stub.failNextRasterizationWithEmptyBlob();
  const engine = await exportEngine();

  await withContainerEnv(async ({ openCardModal, flushEffects }) => {
    const container = openCardModal(EXPORT_THREAD, (target: HTMLElement, action: string) =>
      engine.exportCard(target, { action })
    );
    await flushEffects();

    (container.shadow.querySelector('.export-actions .btn-primary') as any).click();
    // Same reason as F24.7: the empty blob is only reported after the export
    // has finished deciding it is empty, which is the export's clock.
    await waitFor(() => {
      const shown = container.shadow.querySelector('.status-message');
      return !!shown && shown.className.includes('is-error');
    }, 'the empty image was never reported');

    const status = container.shadow.querySelector('.status-message') as any;
    assert.ok(status, 'the empty image was reported as nothing at all');
    // Not the panel's own locale: it follows the machine when a test does not
    // pin it, so an exact zh-CN comparison would pass here and fail on CI.
    assert.equal(
      status.textContent,
      TRANSLATIONS[resolveLocale(DEFAULT_CARD_CONFIG.locale)].exportEmpty
    );
    assert.ok(status.className.includes('is-error'));
    assert.ok(container.shadow.querySelector('.status-retry'), 'an empty image is worth one more try');
  });
});

test('F35.5: a mounting failure still restores the live card', async () => {
  // The copy is mounted inside a try/finally now; before that, a throw between
  // the image rewrite and the rasterizer left data URLs on the live preview.
  const engine = await exportEngine();

  await withMountedCard(EXPORT_THREAD, async (card) => {
    const before = imageSources(card);
    const scope = globalThis as Record<string, unknown>;
    const savedDocument = scope.document;
    const doc = scope.document as DomDocument;
    const realCreate = doc.createElement.bind(doc);
    (doc as any).createElement = (tag: string) => {
      if (tag === 'div') throw new Error('mount exploded');
      return realCreate(tag);
    };

    try {
      await assert.rejects(() => engine.renderCardToBlob(card), /mount exploded/);
    } finally {
      (doc as any).createElement = realCreate;
      scope.document = savedDocument;
    }

    assert.deepEqual(imageSources(card), before, 'the live card was left holding placeholders');
  });
});

test('F35.6: a failed image is counted by the fetch result, not by matching the placeholder', async () => {
  // The reverse of F35.1: a picture whose bytes happen to equal the placeholder
  // is still a success. A detector that compared pixels would call it broken.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;

  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message?.type !== 'FETCH_IMAGE_BASE64') return;
    sendResponse({ success: true, dataUrl: engine.FALLBACK_PLACEHOLDER_DATA_URL });
    return false;
  });
  scope.chrome = chromeMock;

  try {
    let report: any = null;
    await withMountedCard(EXPORT_THREAD, async (card) => {
      await engine.renderCardToBlob(card, { report: (next: unknown) => { report = next; } });
    });
    assert.deepEqual(report.imageFailures, [], 'a successful fetch was mistaken for a failure');
    assert.equal(report.failedImageCount, 0);
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

test('F35.7: exportCard carries the engine report into the outcome the panel reads', async () => {
  // F35.1/F35.6 drive `renderCardToBlob` and read the raw report; F35.2 stubs
  // `onExport`. Neither reaches the merge that is the only thing populating
  // `degradedImageCount` / `scaleReduced` on a real export -- so the panel's
  // warning branch could go dark with every test still green.
  const stub = await rasterizer();
  stub.resetRasterizer();
  const engine = await exportEngine();
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;

  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message?.type !== 'FETCH_IMAGE_BASE64') return;
    sendResponse(
      String(message.url).includes('ok.jpg')
        ? { success: true, dataUrl: 'data:image/jpeg;base64,OK' }
        : { success: false, error: 'HTTP 404' }
    );
    return false;
  });
  scope.chrome = chromeMock;

  try {
    let outcome: any = null;
    await withMountedCard(EXPORT_THREAD, async (card) => {
      const element = card as any;
      const realClone = element.cloneNode.bind(element);
      element.cloneNode = (deep?: boolean) => {
        const copy = realClone(deep);
        Object.defineProperty(copy, 'offsetWidth', { value: 640, configurable: true });
        Object.defineProperty(copy, 'offsetHeight', { value: 40000, configurable: true });
        return copy;
      };
      try {
        // A download needs no gesture and no clipboard, so the only thing under
        // test here is the report merge.
        await withClipboard('none', async () => {
          outcome = await engine.exportCard(card, { action: 'download', filename: 'x.png' });
        });
      } finally {
        element.cloneNode = realClone;
      }
    });

    assert.ok(outcome, 'the export produced nothing');
    assert.equal(outcome.success, true, 'the file was delivered; degradation is not failure');
    assert.equal(outcome.method, 'download');
    assert.equal(outcome.degradedImageCount, 3, 'two photos plus the avatar');
    assert.deepEqual(
      outcome.degradedImages.map((failure: any) => failure.url).sort(),
      [
        'https://pbs.twimg.com/media/one.jpg',
        'https://pbs.twimg.com/media/two.jpg',
        'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
      ].sort(),
      'the failed URLs are carried through, not just counted'
    );
    assert.equal(outcome.requestedScale, 2);
    assert.equal(outcome.appliedScale, 1.63, 'floor(65535 / 40000 * 100) / 100');
    assert.equal(outcome.scaleReduced, true);
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

// -------------------------------------------------------------
// F36: The canvas the card is exported on
// -------------------------------------------------------------
//
// The mat is an outer element the card is mounted on, and it is the export
// target. Its whole geometry is CSS -- a `min-height` floor per ratio -- so
// these tests read the two things the shim can actually answer: the markup the
// card renders, and the stylesheet it renders against. There is no layout
// engine here, so a claim about a pixel is a claim about the rule that would
// produce it.

/** The opening tag of the exported element — the mat the card is mounted on. */
function matTag(html: string): string {
  const at = html.indexOf('<div id="post-to-card-export-target"');
  assert.ok(at >= 0, `the export target is not in the rendered markup: ${html.slice(0, 60)}`);
  return html.slice(at, html.indexOf('>', at) + 1);
}

test('F36.1: an untouched canvas exports exactly the card, with no ring and no paint', async () => {
  const tag = matTag(await renderCard({ data: THREAD }));

  assert.match(tag, /data-canvas-ratio="auto"/);
  // Both defaults are "off", and off has to mean the mat contributes nothing at
  // all. This is the one regression that would reach every existing user: a mat
  // that padded or painted by default would repaint the PNG they already had.
  //
  // Asserted as the two things that decide the box -- zero padding and no floor
  // -- rather than as a measured `offsetWidth`. `tests/env/browser.ts` has no
  // layout engine, so a measured box here would be the shim's answer, not the
  // browser's. The measurement itself was checked in the dev harness (mat
  // 640x1305 == card 640x1305 with both defaults, and 736x(card+96) with 4:5);
  // what this test can lock is that nothing else is asked of the mat.
  assert.match(tag, /--mat-pad:0px/, `the default mat must not pad the picture: ${tag}`);
  assert.ok(!tag.includes('--mat-bg'), `the default mat must not paint: ${tag}`);
});

test('F36.2: either canvas control alone is enough to turn the ring on', async () => {
  const shapes = [
    { canvasRatio: '1:1' as const },
    { canvasBackground: 'paper' as const },
  ];
  for (const config of shapes) {
    const tag = matTag(await renderCard({ data: THREAD, config }));
    assert.match(
      tag,
      /--mat-pad:48px/,
      `${Object.keys(config)[0]} has to make room for the card to sit in: ${tag}`
    );
  }
});

test('F36.3: card.css floors every canvas ratio at the exact ratio, outer edge to outer edge', () => {
  // Read from the sheet rather than from a second copy of the arithmetic in the
  // test: a table re-derived here would agree with itself while the sheet it
  // ships alongside drifted. `border-box` plus the *outer* width in the
  // numerator is what makes the floor exact -- the padding is part of the
  // picture, so it has to be part of the ratio.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  for (const ratio of CANVAS_RATIO_OPTIONS) {
    if (ratio === 'auto') {
      assert.ok(
        !css.includes(`[data-canvas-ratio="${ratio}"]`),
        'Auto is the absence of a floor, so it must have no rule of its own'
      );
      continue;
    }

    const block = new RegExp(`\\[data-canvas-ratio="${ratio}"\\]\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(block, `card.css declares no floor for the ${ratio} canvas`);

    // The numerator has to be the *outer* width, padding included: the ring is
    // part of the picture, so leaving it out would make every ratio wrong by
    // 2 x 48px. It is also written as `--card-width` rather than 640px so the
    // card's own width and the four floors cannot drift apart; `border-box`
    // (asserted below) is the other half of the ratio being exact.
    assert.match(
      block![1],
      /var\(--card-width\)\s*\+\s*2\s*\*\s*var\(--mat-pad/,
      `${ratio} computes its floor from the card's width alone, not the picture's`
    );

    const divisor = /\/\s*([\d.]+)\s*\)/.exec(block![1]);
    assert.ok(divisor, `${ratio} declares a floor with no ratio in it: ${block![1]}`);

    const [w, h] = ratio.split(':').map(Number);
    const declared = Number(divisor![1]);
    const expected = w / h;
    assert.ok(
      Math.abs(declared - expected) < 1e-3,
      `${ratio} floors at ${declared} but the ratio is ${expected}`
    );
  }

  assert.match(
    css,
    /\.ptc-mat\s*\{[^}]*box-sizing:\s*border-box/s,
    'without border-box the padding would sit outside the ratio the floor computes'
  );
  assert.match(
    css,
    /\.ptc-mat\s*\{[^}]*min-height:\s*var\(--mat-min-height/s,
    'the per-ratio value has to be the floor, never a fixed height'
  );
});

test('F36.4: the floor is a floor, so no canvas can ever crop a post', async () => {
  // `min-height` and nothing else. A fixed height would clip a card taller than
  // the canvas, which is the one thing this feature must never do; the same
  // reasoning F19.4 already applies to the card's own aspect ratio.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const block = /\.ptc-mat\s*\{([^}]*)\}/s.exec(css);
  assert.ok(block, 'card.css has no .ptc-mat block');

  assert.ok(
    !/(^|;|\s)height:/.test(block![1]),
    `the mat must not carry a fixed height: ${block![1]}`
  );
  assert.match(block![1], /overflow:\s*visible/, 'and must not clip what overflows it');
});

test('F36.5: Follow-theme resolves to the material it is sitting in, not a copy of it', () => {
  for (const theme of THEME_ORDER) {
    assert.equal(
      resolveCanvasBackground('theme', theme),
      THEMES[theme].tokens.canvas,
      `${theme}'s canvas is the token the material already declares`
    );
  }

  assert.equal(resolveCanvasBackground('none', 'minimal'), '', 'None paints nothing at all');
  assert.match(resolveCanvasBackground('lagoon', 'minimal'), /^linear-gradient\(/, 'and a gradient is a gradient');
});

test('F36.6: every canvas id in the picker is a real entry, and unknown ids degrade to the defaults', () => {
  assert.deepEqual(
    [...CANVAS_BACKGROUND_ORDER].sort(),
    Object.keys(CANVAS_BACKGROUNDS).sort(),
    'the order list and the table must not be able to disagree'
  );
  assert.equal(new Set(CANVAS_BACKGROUND_ORDER).size, CANVAS_BACKGROUND_ORDER.length, 'and no id twice');

  // The fallbacks have to *be* the defaults. A sanitizer that answered with a
  // different value would come back not-null, so the `??` in
  // `normalizeStoredConfig` would keep it -- the shape of the bug that once
  // rewrote a saved radius on every load.
  assert.equal(sanitizeCanvasRatio('21:9'), DEFAULT_CARD_CONFIG.canvasRatio);
  assert.equal(sanitizeCanvasRatio(undefined), DEFAULT_CARD_CONFIG.canvasRatio);
  assert.equal(sanitizeCanvasBackground('plaid'), DEFAULT_CARD_CONFIG.canvasBackground);
  assert.equal(sanitizeCanvasBackground(undefined), DEFAULT_CARD_CONFIG.canvasBackground);
  assert.equal(sanitizeCanvasRatio('4:5'), '4:5', 'and a real choice survives');
  assert.equal(sanitizeCanvasBackground('lagoon'), 'lagoon');
  // Retired ids have to degrade the same way an unknown one does: `stone`,
  // `linen` and `dusk` were real choices once, so they are sitting in saved
  // preferences right now.
  for (const retired of ['stone', 'linen', 'dusk']) {
    assert.equal(sanitizeCanvasBackground(retired), DEFAULT_CARD_CONFIG.canvasBackground, retired);
  }
});

test('F36.7: the chosen paint reaches the exported element itself', async () => {
  const tag = matTag(await renderCard({ data: THREAD, config: { canvasBackground: 'lagoon' } }));

  // Inline, not from a class: the exporter clones this element and rasterizes
  // it, and a paint that only existed in the sheet would depend on the clone
  // carrying the sheet. Every other colour on the card is injected the same way.
  assert.match(tag, /--mat-bg:linear-gradient\(135deg/, `the paint is not on the export target: ${tag}`);
});

test('F36.8: the readability warning fires past the line, and not at it', async () => {
  const { isLongCard, LONG_CARD_RATIO } = await loadModule('/src/content/engine/scale.ts');

  assert.equal(LONG_CARD_RATIO, 4, 'the line moved; the copy below it was written for this one');
  assert.equal(isLongCard({ width: 640, height: 640 * LONG_CARD_RATIO }), false, 'exactly at it is not past it');
  assert.equal(isLongCard({ width: 640, height: 640 * LONG_CARD_RATIO + 1 }), true);
  // Before the card is measured the box is zero, and a warning about a picture
  // that does not exist yet is noise on the first frame of every export.
  assert.equal(isLongCard({ width: 0, height: 0 }), false);
  assert.equal(isLongCard({ width: 0, height: 90000 }), false);
});

test('F36.9: the panel says so beside the size, and only when the picture is long', async () => {
  const render = (exportSize: Record<string, number | boolean>) =>
    renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
      config: CARD_CONFIG,
      onChange: () => {},
      onExportCopy: () => {},
      onExportDownload: () => {},
      exportSize,
    });

  const long = await render({ width: 1280, height: 1280 * 4 + 2, scale: 2, reduced: false, impossible: false });
  assert.match(long, /very tall/, 'a 4:1 picture is announced as one');
  assert.match(long, /Exports at/, 'and still quotes the size it is talking about');

  const short = await render({ width: 1280, height: 1920, scale: 2, reduced: false, impossible: false });
  assert.ok(!short.includes('very tall'), 'an ordinary card must not be warned about');
});

test('F36.10: a shape with no paint says the ring is transparent', async () => {
  const render = (config: Partial<CardConfig>) =>
    renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
      config: { ...CARD_CONFIG, ...config },
      onChange: () => {},
      onExportCopy: () => {},
      onExportDownload: () => {},
    });

  // A shape alone reserves a ring and paints nothing in it. That is a
  // legitimate export for anyone compositing later, but it is not the finished
  // picture the shape picker implies, so the panel has to say so -- and stop
  // saying it the moment a background is chosen.
  assert.match(
    await render({ canvasRatio: '4:5', canvasBackground: 'none' }),
    /transparent/,
    'a shaped but unpainted canvas has to be explained'
  );
  assert.ok(
    !(await render({ canvasRatio: '4:5', canvasBackground: 'paper' })).includes('transparent'),
    'and the explanation has to go away once there is paint in the ring'
  );
  assert.ok(
    !(await render({ canvasRatio: 'auto', canvasBackground: 'none' })).includes('transparent'),
    'the default has no ring, so it has nothing to explain'
  );
});

test('F36.11: every background the picker offers has a label in every language', () => {
  // The picker no longer keeps its own id->label map; it derives `canvasBg_<id>`
  // from the dictionary the way the theme grid derives `theme_<id>`. A missing
  // key would silently fall back to the table's English name, which is exactly
  // the kind of drift this assertion exists to catch.
  for (const locale of SUPPORTED_LOCALES) {
    for (const id of CANVAS_BACKGROUND_ORDER) {
      const key = `canvasBg_${id}` as keyof (typeof TRANSLATIONS)[typeof locale];
      const label = TRANSLATIONS[locale][key];
      assert.equal(typeof label, 'string', `${locale} has no canvasBg_${id}`);
      assert.ok((label as string).length > 0, `${locale}'s canvasBg_${id} is empty`);
    }
  }
});

test('F36.12: the card shadow is opt-in, needs a canvas, and never eats the theme shadow', async () => {
  const shadowOf = async (config: Partial<CardConfig>) =>
    cardRootStyle(await renderCard({ data: THREAD, config }));

  assert.ok(
    !(await shadowOf({ canvasBackground: 'lagoon' })).includes('16px 40px'),
    'a canvas on its own does not lift the card'
  );
  assert.ok(
    !(await shadowOf({ canvasShadow: true })).includes('16px 40px'),
    'with no canvas the shadow would be clipped, so it must not be drawn'
  );

  const on = await shadowOf({ canvasBackground: 'lagoon', canvasShadow: true });
  assert.match(on, /0 16px 40px -8px rgba\(0, 0, 0, 0\.34\)/, 'the lift reaches the exported card');

  // Joining `none` into the list would make the whole declaration invalid and
  // drop the material's own shadow with it, so the two have to coexist.
  const glass = await shadowOf({ theme: 'glass', canvasBackground: 'lagoon', canvasShadow: true });
  assert.match(glass, /0 8px 32px/, "the material's shadow is still there");
  assert.match(glass, /0 16px 40px -8px/, 'and the mat shadow is added beside it');
});

test('F36.13: the shadow switch is offered only when there is a canvas to fall on', async () => {
  const render = (config: Partial<CardConfig>) =>
    renderComponent('/src/content/ui/Controls.tsx', 'Controls', {
      config: { ...CARD_CONFIG, ...config },
      onChange: () => {},
      onExportCopy: () => {},
      onExportDownload: () => {},
    });

  assert.ok(
    !(await render({ canvasBackground: 'none', canvasShadow: true })).includes('Card shadow'),
    'a switch that visibly does nothing is worse than no switch'
  );
  assert.match(
    await render({ canvasBackground: 'lagoon' }),
    /Card shadow/,
    'and it is offered as soon as a canvas is on'
  );
});

test('F36.14: the canvas is a first-screen section, not a disclosure item', async () => {
  // The canvas is the largest group in the panel and the one thing this round
  // added. Behind the disclosure -- whose own button sat below the fold -- it
  // cost a scroll, a tap and another scroll to find. It follows the theme
  // because "follow the theme" is literally one of its background options.
  const html = await renderControls();
  const at = (needle: string) => html.indexOf(needle);

  assert.match(
    html,
    /<section class="control-section">\s*<span class="control-label"><span>Output Canvas<\/span><\/span>/,
    'the canvas leads with its own top-level heading'
  );
  assert.ok(
    at('<span>Theme</span>') < at('<span>Output Canvas</span>'),
    'it sits after the theme it can follow'
  );
  assert.ok(
    at('<span>Output Canvas</span>') < at('class="more-body"'),
    'and ahead of the disclosure rather than inside it'
  );
});

// -------------------------------------------------------------
// F26 continued: the refusal keeps its reason
// -------------------------------------------------------------

test('F26.6: a refusal keeps its reason without turning a download into a failure', async () => {
  await withContainerEnv(async () => {
    const engine = await exportEngine();
    const cases: Array<[ClipboardFailureMode, string]> = [
      ['unfocused', 'unfocused-or-gesture'],
      ['gesture_expired', 'unfocused-or-gesture'],
      ['permission_denied', 'permission'],
    ];

    for (const [mode, expected] of cases) {
      let result: any = null;
      await withClipboard(mode, async () => {
        result = await engine.exportBlobWithFallback(pngBlob(), 'copy', 'x.png');
      });
      assert.equal(result.success, true, `${mode} still produced a file`);
      assert.equal(result.method, 'download');
      assert.equal(result.clipboardFailure, expected, `${mode} lost its reason`);
      assert.ok(result.clipboardError, 'the underlying message is kept for logs');
    }
  });
});

test('F26.7: an absent clipboard is unsupported, and a bare NotAllowedError is not called a permission problem', async () => {
  await withContainerEnv(async () => {
    const engine = await exportEngine();

    // `withClipboard` installs a working clipboard, so the unsupported case is
    // the absence of one -- which is what the extension meets on an old browser.
    let missing: any = null;
    await withClipboard('none', async () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
      delete (globalThis.navigator as { clipboard?: unknown }).clipboard;
      try {
        missing = await engine.exportBlobWithFallback(pngBlob(), 'copy');
      } finally {
        if (descriptor) Object.defineProperty(globalThis.navigator, 'clipboard', descriptor);
      }
    });
    assert.equal(missing.clipboardFailure, 'unsupported');
    assert.equal(missing.success, true, 'the fallback still delivered the file');

    const bare = engine.classifyClipboardFailure(
      Object.assign(new Error('The request is not allowed.'), { name: 'NotAllowedError' })
    );
    assert.equal(bare.reason, 'other', 'the name alone does not say which of three causes it was');

    assert.equal(engine.classifyClipboardFailure(undefined).reason, 'other');
    assert.equal(engine.classifyClipboardFailure('boom').reason, 'other');
  });
});

test('F26.8: an explicit download never claims a clipboard problem', async () => {
  await withContainerEnv(async () => {
    const engine = await exportEngine();
    let result: any = null;
    await withClipboard('permission_denied', async () => {
      result = await engine.exportBlobWithFallback(pngBlob(), 'download', 'x.png');
    });
    assert.equal(result.method, 'download');
    assert.equal(result.clipboardFailure, undefined, 'the user asked for a download; nothing was refused');
  });
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

test('F27.5: stack mode gives every picture its full height, in rules that exist', async () => {
  // The three selectors the card can arrive at stack with: the planner's
  // `data-layout`, the class from `media-layout-*`, and the target's own
  // attribute. Each has to answer, because the card writes more than one of them
  // and a rule that names only one leaves the other two on the grid's shape.
  const sheet = cssSheet(path.resolve(__dirname, '../../src/content/styles/card.css'));
  const grid = '.post-to-card-target .media-grid[data-layout="stack"]';
  const cell = `${grid} .media-item`;

  // A rule for each selector actually exists -- read as selectors, not as
  // substrings, so a mention in prose is not an answer.
  for (const selector of [grid, '.post-to-card-target .media-grid.media-layout-stack', cell]) {
    assert.ok(
      sheet.some((r) => r.selectors.includes(selector)),
      `stack mode needs a rule for ${selector}`
    );
  }

  // And the card names stack the way those rules expect, in which order? The
  // markup is the half that says which selectors ever fire.
  const html = await renderCard({ config: { mediaLayout: 'stack' } });
  assert.match(html, /class="[^"]*\bmedia-grid\b[^"]*\bmedia-layout-stack\b/, 'the card marks its grid for the stack rules');
  assert.match(html, /class="[^"]*\bmedia-item\b[^"]*\bmedia-layout-stack\b/, 'and every cell with it');

  // The grid drops the shape the grid mode gives it. Without these the stack is
  // clipped to a 2- or 3-picture aspect ratio however tall its pictures are.
  // The stack rule is the one that wins the cascade for the last of these: the
  // grid-mode rules state a cap, and a stack that leaves the cap standing is
  // still a capped grid. So the stack's own answer has to be the one on top,
  // which is what reading the sheet in order and taking the last match means.
  const stack = sheet.find((r) => r.selectors.includes(grid))!;
  assert.ok(stack.declares('flex-direction', 'column'), 'the stack is a column, one picture below the next');
  assert.equal(stack.declares('aspect-ratio', 'unset'), true, 'the stack takes its height from its pictures');
  const capFor = (): string | undefined => {
    // Every rule that could apply to the stack grid, in cascade order: the
    // selector the stack rule uses, and the plain grid-mode rules it outranks.
    const applying = sheet.filter((r) =>
      r.selectors.some((s) => s === grid || /^\.media-grid\[data-layout="grid"\]/.test(s))
    );
    const last = applying.reverse().find((r) => r.declarations.some((d) => d.startsWith('max-height:')));
    return last?.declarations.find((d) => d.startsWith('max-height:'));
  };
  assert.equal(
    capFor(),
    'max-height: unset',
    `no grid-mode cap may win over the stack; the applied cap is "${capFor()}"`
  );

  // And each cell is unconstrained in turn: the per-count rules state
  // `height: 100%` on `.media-item`, which inside a column would stack to
  // nothing. `object-fit: contain` is how 完整展示 reaches the cell in this mode.
  const item = sheet.filter((r) => r.selectors.includes(cell));
  assert.ok(
    item.some((r) => r.declares('max-height', 'unset') && r.declares('aspect-ratio', 'unset')),
    'each stacked cell drops the grid\'s cap and shape'
  );
  assert.ok(
    item.some((r) => r.declares('object-fit', 'contain')),
    'stack mode shows the whole picture rather than cropping it'
  );
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

/** The fixed-shape grid: a crop wants a box to crop into. */
const AUTO_GRID = { aspectRatio: 'auto' as const, mediaLayout: 'grid' as const, imageFit: 'cover' as const };

/** 完整展示 in the auto ratio: every cell is its picture's own rectangle. */
const CONTAIN_GRID = { ...AUTO_GRID, imageFit: 'contain' as const };

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

test('F28.4: card.css arranges top-hero, left-hero and the 2-picture layouts the planner names', () => {
  const sheet = cssSheet(path.resolve(__dirname, '../../src/content/styles/card.css'));
  /** The declarations of the first rule whose selector list contains `selector`. */
  const rule = (selector: string): CssRule => {
    const found = sheet.find((r) => r.selectors.includes(selector));
    assert.ok(found, `card.css needs a rule for ${selector}`);
    return found;
  };
  const grid = (count: number, layout: string): string =>
    `${'.media-grid[data-layout="grid"]'}[data-count="${count}"][data-grid-layout="${layout}"]`;

  // The hero weights are not restated here. They live in `geometry.ts` and reach
  // the sheet as `--grid-top-hero` / `--grid-left-hero`, which `Card.tsx` injects
  // from `GRID_TRACKS`; a test asserting `1.4fr` in the file would pin the
  // fallback, not the weight, and would pass after the planner's arithmetic had
  // stopped matching. What the sheet must do is consume the property.
  const topHero = rule(grid(3, 'top-hero'));
  assert.ok(
    topHero.declares('grid-template-rows', 'var(--grid-top-hero') &&
      topHero.declares('grid-template-rows', '1fr)'),
    'the hero row weighs against the row under it, and takes its weight from the property'
  );
  assert.equal(
    topHero.declares('grid-template-columns', '1fr) minmax(0, 1fr)'),
    true,
    'two equal columns: the hero spans both, the other two share them'
  );

  // Top hero: the first picture takes the width, the other two sit under it.
  const topFirst = rule(`${grid(3, 'top-hero')} .media-item:first-child`);
  assert.equal(topFirst.declares('grid-column', 'span 2'), true, 'the wide hero spans both columns');
  assert.equal(topFirst.declares('grid-row', '1'), true, 'on the first row');
  assert.equal(rule(`${grid(3, 'top-hero')} .media-item:nth-child(2)`).declares('grid-column', '1'), true, 'the pair below starts in column 1');
  assert.equal(rule(`${grid(3, 'top-hero')} .media-item:nth-child(3)`).declares('grid-column', '2'), true, 'and continues in column 2');

  // Left hero: the tall picture takes a column and both rows.
  const leftHero = rule(grid(3, 'left-hero'));
  assert.ok(
    leftHero.declares('grid-template-columns', 'var(--grid-left-hero') &&
      leftHero.declares('grid-template-columns', 'minmax(0, 1fr)'),
    'the hero column weighs against the pair beside it, from the property'
  );
  const leftFirst = rule(`${grid(3, 'left-hero')} .media-item:first-child`);
  assert.equal(leftFirst.declares('grid-row', 'span 2'), true, 'the tall hero spans both rows');
  assert.equal(leftFirst.declares('grid-column', '1'), true, 'in the first column');
  assert.equal(rule(`${grid(3, 'left-hero')} .media-item:nth-child(2)`).declares('grid-row', '1'), true, 'the pair beside it stacks from the top');

  // The two-picture arrangements the planner names, and the share of the grid
  // each takes: wide pictures stack, tall ones stand side by side.
  const stacked = rule(grid(2, 'stacked'));
  assert.deepEqual(stacked.declarations.filter((d) => /^(grid-template-)?columns?:/.test(d)), ['grid-template-columns: minmax(0, 1fr)']);
  assert.deepEqual(stacked.declarations.filter((d) => /^(grid-template-)?rows?:/.test(d)), ['grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)']);
  const portrait = rule(grid(2, 'portrait-columns'));
  assert.equal(portrait.declares('grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)'), true, 'a tall pair stands side by side');

  // The three-picture default is 4:3, which is where the planner starts before
  // a hero layout takes over.
  assert.equal(rule('.media-grid[data-layout="grid"][data-count="3"]').declares('aspect-ratio', '4 / 3'), true, 'default 3-up is 4:3');

  // The gutter is the material's, so a test of the grid's gutter belongs to the
  // grid's own rule rather than to whichever rule happens to say `gap: 4px`.
  assert.ok(
    rule('.media-grid').declares('gap', 'var(--media-gap'),
    'the grid gutter comes from the material, not a fixed step'
  );
});

test('F28.5: Dual portrait images calculate dynamic combined aspect-ratio (r0 + r1) in Auto mode', () => {
  // Two 9:19.5 phone screenshots side by side: the grid is as wide as the two
  // are tall, so the tall pair fills it without dead space.
  const plan = planMediaGrid([photo(0.46), photo(0.46)], AUTO_GRID);
  assert.equal(plan.layout, 'portrait-columns');
  assert.equal(plan.aspectRatio, '0.92');
});

test('F28.7: 完整展示 plans a cell for each picture and states no grid shape', async () => {
  // The plan, the card and the stylesheet have to agree on one thing: in
  // 完整展示 every cell is its picture's own rectangle. The plan supplies each
  // cell's width, the card writes it, and card.css lays the cells out as lines.
  const plan = planMediaGrid([photo(1.778), photo(0.8)], CONTAIN_GRID);
  assert.equal(plan.aspectRatio, undefined, 'a packed grid takes its height from its pictures');
  assert.ok(plan.slots, '完整展示 plans a place for every picture');
  assert.equal(plan.slots!.length, 2);

  const html = await renderCard({
    data: {
      id: '92001',
      url: 'https://x.com/ada/status/92001',
      author: { name: 'Ada', handle: '@ada' },
      text: 'two pictures',
      timestamp: '2026-10-14T04:29:00.000Z',
      media: [
        { type: 'image', url: 'https://pbs.twimg.com/media/wide.jpg', aspectRatio: 1.778 },
        { type: 'image', url: 'https://pbs.twimg.com/media/tall.jpg', aspectRatio: 0.8 },
      ],
    } satisfies TweetData,
    config: { imageFit: 'contain', aspectRatio: 'auto', mediaLayout: 'grid' },
  });

  const gridTag = /<div class="media-grid[^>]*>/.exec(html)?.[0];
  assert.ok(gridTag, 'the card renders a media grid');
  assert.ok(!gridTag!.includes('aspect-ratio'), 'the grid states no shape of its own');
  for (const slot of plan.slots!) {
    assert.ok(html.includes(slot.width), `the card must write each planned cell width: ${slot.width}`);
  }

  // The stylesheet gives those widths a line to live on, and drops the fixed
  // grid shape the cover path keeps.
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('[data-fit="contain"][data-ratio="auto"]'), 'the packed grid has its own rules');
  assert.ok(cssContent.includes('flex-wrap: wrap;'), 'cells of one line stay on that line');
});

test('F28.8: the lone-picture 3:4 floor stays on cover and is gone from 完整展示', async () => {
  // A 9:16 video poster. Under cover the card has no picture shape to grow to,
  // so it crops the poster to 3:4 and stays bounded; under 完整展示 the card
  // grows to the picture, which is the promise that mode makes.
  const tall = {
    id: '92002',
    url: 'https://x.com/ada/status/92002',
    author: { name: 'Ada', handle: '@ada' },
    text: 'one tall picture',
    timestamp: '2026-10-14T04:29:00.000Z',
    media: [{ type: 'image', url: 'https://pbs.twimg.com/media/tall.jpg', aspectRatio: 0.5625 }],
  } satisfies TweetData;

  const cover = await renderCard({
    data: tall,
    config: { imageFit: 'cover', aspectRatio: 'auto', mediaLayout: 'grid' },
  });
  assert.ok(cover.includes('aspect-ratio:0.75'), 'cover still floors the lone picture at 3:4');
  assert.ok(cover.includes('object-fit:cover'), 'and crops the picture to that box');

  const contain = await renderCard({
    data: tall,
    config: { imageFit: 'contain', aspectRatio: 'auto', mediaLayout: 'grid' },
  });
  assert.ok(contain.includes('aspect-ratio:0.5625'), '完整展示 keeps the picture\'s own shape');
  assert.ok(!contain.includes('object-fit:cover'), '完整展示 never crops');
});

test('F28.6: 3-image layout uses left-hero for square/portrait (ratio < 1.2) with 1.6fr:1fr columns and dynamic ratio', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('minmax(0, var(--grid-left-hero, 1.6fr)) minmax(0, 1fr)'), 'Left hero must allocate 1.6fr to 1fr column width');

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

test('F29.1b: a player marked only by its aria-label is the container the card reads', () => {
  // Of the four ways production names a video container, this is the one whose
  // attribute value contains a space. The selector engine used to split members
  // on whitespace, so it read `div[aria-label="Embedded` — no closing bracket,
  // no match — and the `<video>` element itself became the container. The
  // duration lives on the player, beside the poster, so the card lost it: the
  // frame rendered with no `1:42` on it.
  const tweet = extractTweetData(createDomElement(VIDEO_ARIA_LABEL_ONLY_HTML) as unknown as Element);
  assert.equal(tweet?.media?.[0]?.type, 'video', 'the post is a video');
  assert.equal(
    tweet?.media?.[0]?.duration,
    '1:42',
    'and the duration beside the poster is read off the player that holds it'
  );
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

test('F29.4: the video card carries an opaque pill and no scrim or progress line', async () => {
  // The markup says what the card puts on the poster; the sheet says what the
  // pill is. Both halves are read off the card that would be exported rather
  // than off the source, so the badge cannot be "styled" by a selector the card
  // never writes and cannot be dropped by a selector that goes away.
  const html = await renderCard({ data: VIDEO_TWEET });
  assert.match(html, /class="[^"]*\bmedia-video-item\b[^"]*"/, 'the video cell is the one the stylesheet frames');

  const badge = html.match(/<[^>]*class="[^"]*\bvideo-indicator-badge\b[^"]*"[^>]*>/);
  assert.ok(badge, 'the play badge is drawn on the poster');
  assert.ok(/video-badge-pill/.test(html), 'and its pill is the element the sheet styles');

  const sheet = cssSheet(path.resolve(__dirname, '../../src/content/styles/card.css'));

  // The two surfaces the badge used to need, and must not come back: a bottom
  // gradient to sit against, and a progress line that claimed a duration the
  // card does not know. Neither is styled, and neither is rendered.
  for (const retired of ['.video-scrim-overlay', '.video-progress-track']) {
    assert.ok(
      !sheet.some((r) => r.selectors.some((s) => s.includes(retired))),
      `${retired} must not be styled: the badge is opaque and the card knows no playback position`
    );
    assert.ok(!html.includes(retired.slice(1)), `${retired} must not be rendered either`);
  }

  const pill = sheet.find((r) => r.selectors.includes('.media-video-item .video-badge-pill'));
  assert.ok(pill, 'the pill has a rule of its own');
  // Glass is the thing the materials ban, and only the pill sits on exported
  // pixels; the thread's exclude button may stay frosted because it is marked
  // `data-html2canvas-ignore` and never reaches the raster.
  assert.equal(pill.declares('backdrop-filter', ''), false, 'the pill is flat: no blur on exported pixels');
  // Opaque, not a wash: the poster changes from post to post, so a translucent
  // badge would print differently on each one and vanish on a bright frame.
  const background = pill.declarations.find((d) => d.startsWith('background:'));
  assert.ok(background, 'the pill states its own fill');
  const alpha = background.match(/rgba?\([^)]*,\s*([\d.]+)\)/) ?? background.match(/\/\s*([\d.]+)\s*\)/);
  assert.ok(alpha, `the pill's fill must state an alpha this test can read, got "${background}"`);
  assert.ok(Number(alpha[1]) >= 0.8, `the pill is opaque on the poster, got alpha ${alpha[1]}`);
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
test('F30.15: the action-bar button ships on by default', () => {
  // The stored-value half lives in tier 2.76, beside the storage mock. The
  // storage key's literal is deliberately not pinned: what matters is that the
  // popup and the content script spell it the same, which `tier_hygiene` 2
  // already checks, so a coordinated rename stays allowed.
  assert.equal(DEFAULT_CARD_CONFIG.showActionBarButton, true);
});

test('F30.16: the controls offer the action-bar toggle, labelled in the active language', async () => {
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


/**
 * The popup's own copy table.
 *
 * It lives in `src/content/popupCopy.ts` now, so the test reads the module
 * rather than the shipped file — the same words the popup shows, without
 * restating them, so a rewording stays allowed and the assertion is still
 * about what the popup actually shows.
 */
function popupCopy(key: string, locale: string): string {
  const copy = POPUP_COPY[locale as keyof typeof POPUP_COPY];
  assert.ok(copy, `there is no ${locale} copy`);
  const value = (copy as unknown as Record<string, string>)[key];
  assert.ok(value !== undefined, `the popup has no ${locale} copy for ${key}`);
  return value;
}

/**
 * Loads the real popup against a document holding its markup, then clicks the
 * quick-trigger button with `chrome.tabs.sendMessage` answering `outcome`.
 *
 * The popup is a build entry of its own now, and it is the one shipped file
 * nothing else loaded: `node --check` only parsed it, and no test drove it, so
 * its three send outcomes could collapse into one branch without failing
 * anything. It goes through the SSR pipeline the way `index.ts` does — with a
 * distinct query per load, since the module cache would otherwise make the
 * second load a no-op.
 *
 * The locale comes from the popup itself (`documentElement.lang`, which it
 * writes from the browser's language) rather than being assumed: the copy table
 * is per locale, and a test that hard-coded `en-US` would fail on a machine
 * whose browser is not English.
 */
let popupLoads = 0;

function popupMarkup(): string {
  return `
    <span id="toggle-title"></span><span id="toggle-desc"></span><span id="tip-text"></span>
    <input id="toggle-button" type="checkbox"><span id="btn-text"></span>
    <button id="btn-trigger-now"></button><div id="status-text"></div>`;
}

async function withPopup(
  outcome: SendOutcome,
  body: (env: {
    status: () => string;
    closed: () => boolean;
    locale: string;
    sent: () => unknown;
    /** The node the popup paints a given string into, by its id. */
    text: (id: string) => string;
    /** Whether the button-hiding checkbox ended up ticked. */
    checked: () => boolean;
    /** The preference the popup left in storage, read back through the API. */
    storedPrefs: () => Promise<Record<string, unknown>>;
    /** Lets the popup's own deferred work (its status timer, its close) run. */
    settle: (ms: number) => Promise<void>;
  }) => Promise<void>,
  options: {
    /** What `chrome.storage.local` already holds when the popup loads. */
    prefs?: Record<string, unknown>;
    /** What the browser reports as its language. */
    language?: string;
    /** What `chrome.tabs` looks like: one tab, none, or no API at all. */
    tabs?: 'one' | 'none' | 'absent';
    /** What the user does to the popup. Defaults to pressing the trigger. */
    interact?: (doc: DomDocument) => void;
  } = {}
): Promise<void> {
  const scope = globalThis as Record<string, unknown>;
  const saved = {
    document: scope.document,
    chrome: scope.chrome,
    window: scope.window,
  };
  // Node defines `navigator` as a getter-only accessor, so the language has to
  // go in through the descriptor rather than by assignment.
  const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const doc = new DomDocument();
  doc.body.innerHTML = popupMarkup();

  const chromeMock = createChromeMock();
  chromeMock.tabs.outcome = outcome;
  if (options.tabs === 'none') chromeMock.tabs.queryReturnsNone = true;
  if (options.tabs === 'absent') delete (chromeMock as unknown as { tabs?: unknown }).tabs;
  // Seeded through the same API the popup reads, rather than by reaching into
  // the mock, so the popup sees exactly what a returning user's profile holds.
  if (options.prefs) await chromeMock.storage.local.set({ post_to_card_user_prefs: options.prefs });

  let didClose = false;

  scope.document = doc;
  scope.chrome = chromeMock;
  scope.window = { close: () => { didClose = true; } };
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: options.language ?? 'en-US' },
    configurable: true,
    writable: true,
  });

  const savedLog = console.log;
  console.log = () => {};
  try {
    popupLoads++;
    await loadModule(`/src/content/popup.ts?load=${popupLoads}`);
    (options.interact ?? ((d: DomDocument) => d.getElementById('btn-trigger-now')!.click()))(doc);
    await body({
      status: () => doc.getElementById('status-text')!.textContent,
      closed: () => didClose,
      locale: doc.documentElement.lang,
      sent: () => (options.tabs === 'absent' ? [] : chromeMock.tabs.sent),
      text: (id) => doc.getElementById(id)!.textContent,
      checked: () => Boolean((doc.getElementById('toggle-button') as unknown as { checked?: boolean }).checked),
      storedPrefs: async () => {
        const items = await chromeMock.storage.local.get('post_to_card_user_prefs');
        return (items?.post_to_card_user_prefs ?? {}) as Record<string, unknown>;
      },
      settle: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
  } finally {
    console.log = savedLog;
    scope.document = saved.document;
    scope.chrome = saved.chrome;
    scope.window = saved.window;
    if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator);
    else delete scope.navigator;
  }
}

test('F30.7: the popup tells a missing receiver apart from a receiver that found no tweet', async () => {
  // The two are different problems with different fixes -- "open X" versus
  // "hover a tweet" -- and the manifest grants neither "tabs" nor "activeTab",
  // so `activeTab.url` cannot tell them apart. Only the send can: Chrome sets
  // `runtime.lastError` when there is no content script to receive at all.
  await withPopup({ kind: 'no-receiver' }, ({ status, closed, locale }) => {
    assert.equal(
      status(),
      popupCopy('notOnX', locale),
      'a send with no receiver is the tab not being X, not a missing hover'
    );
    assert.equal(closed(), false, 'the popup stays open when nothing was opened');
  });

  await withPopup({ kind: 'response', response: { success: false } }, ({ status, closed, locale }) => {
    assert.equal(
      status(),
      popupCopy('hoverFirst', locale),
      'a receiver that has no tweet under the pointer asks for a hover instead'
    );
    assert.equal(closed(), false);
  });

  await withPopup({ kind: 'response', response: { success: true } }, async ({ status, closed, locale, settle }) => {
    assert.equal(status(), popupCopy('cardOpened', locale));
    assert.equal(closed(), false, 'the popup lingers for a moment so the message is readable');
    await settle(450);
    // The popup gets out of the way once the card is open, which is the point
    // of the button. Waited for rather than asserted immediately: the close is
    // on a 400ms timer, and asserting before it fires would be asserting the
    // absence of the behaviour.
    assert.equal(closed(), true, 'a card that opened closes the popup');
  });
});

test('F30.8: the popup asks the content script for the active tab, with the trigger message', async () => {
  // The send is the thing that decides all three outcomes above, so what it
  // carries is part of the contract: the content script answers
  // `TRIGGER_ACTIVE_CARD` and nothing else, and it is addressed to the tab the
  // query returned rather than to the extension.
  await withPopup({ kind: 'response', response: { success: false } }, ({ sent }) => {
    assert.deepEqual(
      sent(),
      [{ tabId: 1, message: { type: 'TRIGGER_ACTIVE_CARD' } }],
      'the popup must ask the active tab for its card, once'
    );
  });
});

test('F30.9: the popup paints the stored preference over the browser default', async () => {
  // Both branches of the read the popup does on load were unreachable from a
  // test: `withPopup` never seeded storage, so the checkbox was `true` whether
  // the popup honoured the stored value or hard-coded it, and the locale block
  // no-opped. A returning user who had hidden the button got it ticked back, and
  // nothing could fail on it.
  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ checked, locale, text }) => {
      assert.equal(checked(), false, 'a stored "off" leaves the box unticked');
      assert.equal(locale, 'zh-CN', 'and a stored locale beats the browser language');
      assert.equal(
        text('toggle-title'),
        popupCopy('toggleTitle', 'zh-CN'),
        'the whole panel is repainted in the stored language, not only its lang attribute'
      );
    },
    { prefs: { showActionBarButton: false, locale: 'zh-CN' }, language: 'en-US' }
  );

  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ checked, locale }) => {
      assert.equal(checked(), true, 'an explicit "on" leaves the box ticked');
      assert.equal(locale, 'en-US', 'and a stored locale the popup does not know is ignored');
    },
    { prefs: { showActionBarButton: true, locale: 'klingon' }, language: 'en-US' }
  );
});

test('F30.10: the popup reads its language off the browser when storage has none', async () => {
  // The locale table is shared with `src/content/i18n.ts` through the bundle
  // now, so what this drives is the popup's own use of it: the browser's tag
  // has to reach `document.documentElement.lang` and the inline nodes before
  // storage answers, or the popup opens in the default language and then
  // visibly changes.
  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ locale, text }) => {
      assert.equal(locale, 'zh-CN', 'a Chinese browser gets the Chinese popup');
      assert.equal(text('btn-text'), popupCopy('trigger', 'zh-CN'));
    },
    { language: 'zh-CN', prefs: {} }
  );

  // A language the build has a dictionary for, reached by a regional tag: the
  // picker stores ids, but the browser reports `de-DE`, and the two have to
  // land on the same panel.
  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ locale, text }) => {
      assert.equal(locale, 'de', 'a German browser gets the German popup');
      assert.equal(text('btn-text'), popupCopy('trigger', 'de'));
    },
    { language: 'de-DE', prefs: {} }
  );

  // And a language the build has no dictionary for still lands somewhere
  // readable rather than on an empty table lookup.
  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ locale, text }) => {
      assert.equal(locale, 'en-US', 'a language with no dictionary gets English');
      assert.equal(text('btn-text'), popupCopy('trigger', 'en-US'));
    },
    { language: 'nl-NL', prefs: {} }
  );
});

test('F30.11: the toggle writes the preference back and says so', async () => {
  // The change handler is the only writer of `showActionBarButton`, and it was
  // outside every tier: no test dispatched a change on the checkbox, so both the
  // stored value and the status string could have been wrong without a failure.
  await withPopup(
    { kind: 'response', response: { success: false } },
    async ({ status, storedPrefs }) => {
      assert.equal(status(), popupCopy('buttonHidden', 'en-US'), 'turning it off says so');
      assert.equal(
        (await storedPrefs()).showActionBarButton,
        false,
        'and the preference is written to the key the content script reads, not only painted'
      );
    },
    {
      prefs: { showActionBarButton: true },
      interact: (doc) => {
        const box = doc.getElementById('toggle-button') as unknown as { checked: boolean };
        box.checked = false;
        box.dispatchEvent({ type: 'change', preventDefault: () => {} });
      },
    }
  );

  await withPopup(
    { kind: 'response', response: { success: false } },
    async ({ status, storedPrefs }) => {
      assert.equal(status(), popupCopy('buttonEnabled', 'en-US'), 'turning it back on says so');
      assert.equal((await storedPrefs()).showActionBarButton, true);
    },
    {
      prefs: { showActionBarButton: false },
      interact: (doc) => {
        const box = doc.getElementById('toggle-button') as unknown as { checked: boolean };
        box.checked = true;
        box.dispatchEvent({ type: 'change', preventDefault: () => {} });
      },
    }
  );
});

test('F30.13: the open panel follows a preference changed outside it, and does not undo it', async () => {
  // The panel read the stored preferences once, on mount, and never listened.
  // A card that was already open therefore could not be told about the popup's
  // toggle — and the panel's next click wrote its own stale copy back whole,
  // putting the old value back in storage and in every other tab. The injected
  // triggers followed the popup (Tier 2.63); the card did not, so F30's
  // multi-tab live sync held for one of its two readers.
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;
  const chromeMock = createChromeMock();
  const write = (fields: Record<string, unknown>) =>
    chromeMock.storage.local.set({ post_to_card_user_prefs: fields });
  // The locale is seeded rather than left to the default: the panel is found by
  // its labels below, and `detectDefaultLocale` answers off the machine's own
  // `navigator.language`, which would make this test read differently on a
  // different machine.
  await write({ theme: 'gallery', blurAuthor: false, showActionBarButton: false, locale: 'en-US' });
  scope.chrome = chromeMock;

  try {
    await withContainerEnv(async ({ openCardModal, flushEffects }) => {
      const container = openCardModal(CONTAINER_THREAD);
      await flushEffects();

      const card = () => container.shadow.querySelector('.post-to-card-target') as any;
      assert.equal(card().getAttribute('data-theme'), 'gallery', 'the mount reads what storage holds');

      // Another context — the popup, or a panel in a second tab — moves a
      // preference this card is showing. The blur toggle is left alone so the
      // panel's own next edit is a distinct change rather than a round trip.
      await write({ theme: 'terminal', blurAuthor: false, showActionBarButton: true, locale: 'en-US' });
      await flushEffects();

      assert.equal(
        card().getAttribute('data-theme'),
        'terminal',
        'the open card has to follow a change it did not make'
      );

      const switches = [...(container.mountPoint.querySelectorAll('.toggle-item') as any)] as any[];
      const privacy = switches.find((node) =>
        node.textContent.includes(TRANSLATIONS['en-US'].blurAuthor)
      );
      assert.ok(
        privacy,
        `the privacy switch was not found among ${switches.length} toggles`
      );
      privacy.click();

      const stored = await chromeMock.storage.local.get('post_to_card_user_prefs');
      assert.equal(
        stored.post_to_card_user_prefs.theme,
        'terminal',
        'the panel must save the preference it was told about, not the one it read at mount'
      );
      assert.equal(
        stored.post_to_card_user_prefs.blurAuthor,
        true,
        'and the edit the user just made, beside it'
      );
    });
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

test('F30.14: a change that beats the panel\'s own read is not undone by it', async () => {
  // The mount has two sources for the same value and they can arrive in either
  // order. A change landing while the read is still in flight reaches the panel
  // first, and the read then answers with the snapshot it took when it was asked
  // for -- the value from before the change. Applying that afterwards puts the
  // old value back, and the panel's next edit writes it down as the user's own,
  // which is the very defect the subscription was added to remove. F30.13 writes
  // before the mount, so it never reaches this ordering.
  //
  // The read is delayed to open the window the race needs. The real API always
  // has one -- it answers in a later task -- and the mock answered in the same
  // one, so the ordering was not expressible at all before this.
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;
  const chromeMock = createChromeMock();
  const write = (fields: Record<string, unknown>) =>
    chromeMock.storage.local.set({ post_to_card_user_prefs: fields });
  // Seeded for the same reason F30.13 seeds it: the panel is found by its label
  // below, and the default locale comes off the machine's `navigator.language`.
  await write({ theme: 'gallery', blurAuthor: false, showActionBarButton: false, locale: 'en-US' });
  scope.chrome = chromeMock;
  chromeMock.storage.local.readDelayMs = 120;

  try {
    await withContainerEnv(async ({ openCardModal, flushEffects }) => {
      const container = openCardModal(CONTAINER_THREAD);
      // Past the 35ms the effects are deferred by, so the read is in flight, and
      // short of the 120ms it takes to answer.
      await flushEffects();

      await write({ theme: 'terminal', blurAuthor: false, showActionBarButton: true, locale: 'en-US' });

      // Long enough for the read to have answered.
      await flushEffects();
      await flushEffects();

      const card = container.shadow.querySelector('.post-to-card-target') as any;
      assert.equal(
        card.getAttribute('data-theme'),
        'terminal',
        'the change that beat the read is the one the panel must be showing'
      );

      // The panel has to be *holding* the newer value, not the snapshot: its
      // next write carries whatever it holds, so one more edit is what would
      // make a reverted preference permanent.
      const switches = [...(container.mountPoint.querySelectorAll('.toggle-item') as any)] as any[];
      const privacy = switches.find((node) =>
        node.textContent.includes(TRANSLATIONS['en-US'].blurAuthor)
      );
      assert.ok(privacy, `the privacy switch was not found among ${switches.length} toggles`);
      privacy.click();

      const stored = await chromeMock.storage.local.get('post_to_card_user_prefs');
      assert.equal(
        stored.post_to_card_user_prefs.theme,
        'terminal',
        'the panel must save the preference it was told about, not the one its read returned'
      );
      assert.equal(stored.post_to_card_user_prefs.blurAuthor, true, 'and the edit the user just made');
    });
  } finally {
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

test('F30.12: a popup with no active tab says so instead of doing nothing', async () => {
  // `query` answering an empty list is the reachable half of the guard; the
  // `chrome.tabs` guard is defensive, but a popup that stays silent on either
  // looks identical to one that worked.
  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ status }) => {
      assert.equal(status(), popupCopy('noActiveTab', 'en-US'), 'no tab is its own message');
    },
    { tabs: 'none' }
  );

  await withPopup(
    { kind: 'response', response: { success: false } },
    ({ status }) => {
      assert.equal(status(), popupCopy('noTabAccess', 'en-US'), 'no tabs API is another');
    },
    { tabs: 'absent' }
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

test('F32.5: every language names the truncated state', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(TRANSLATIONS[locale].truncatedContent, `${locale} has the notice copy`);
  }
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
    // The sender is this extension, which is what `chrome.tabs.sendMessage`
    // from the popup reports. A sender-less call is another extension's message
    // and is refused, which is the assertion right below this one.
    listener({ type: 'TRIGGER_ACTIVE_CARD' } as never, { id: chrome.runtime.id } as never, (value) => {
      response = value as { success?: boolean };
    });

    assert.deepEqual(response, { success: true },
      'the popup is told whether a card opened, and the post on screen is the one it opens');
    assert.ok(doc.querySelector('post-to-card-container'), 'and the card really opened');
  });
});

test('F31.4b: a message from outside this extension is refused, not acted on', async () => {
  // `onMessage` only carries messages from this extension's own contexts, so
  // this is a wrong-sender bug being made visible rather than an attack. The
  // refusal is worth pinning anyway: the listener used to answer whatever
  // arrived, which meant a mistyped sender check would have looked correct.
  await withEntryEnv({ before: withOnePost }, async ({ doc, chrome }) => {
    const listener = chrome.runtime.listeners[0];
    assert.ok(listener, 'the entry never listened for extension messages');

    let response: unknown = 'nothing answered';
    listener({ type: 'TRIGGER_ACTIVE_CARD' } as never, { id: 'some-other-extension' } as never, (value) => {
      response = value;
    });

    assert.equal(response, 'nothing answered', 'another extension must not be able to open a card');
    assert.equal(doc.querySelector('post-to-card-container'), null, 'and no card was opened');
  });
});

test('F31.5b: the second deferred scan covers a post the first one could not see', async () => {
  // Two scans, and the entry runs them for a reason: X hydrates a deep-linked
  // feed in stages, and a post that lands after the first scan has no other
  // way in here. F31.5 only proves the 500ms pass works — it appends the post
  // at startup and waits 600ms — so deleting the 1500ms pass left the suite
  // green. This one appends *after* the first scan has run.
  await withEntryEnv({}, async ({ doc }) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(doc.querySelector('[data-post-to-card-btn="true"]'), null,
      'the first scan has already run and found nothing');

    doc.body.appendChild(createDomElement(SINGLE_TWEET_HTML));
    await new Promise((resolve) => setTimeout(resolve, 900));

    assert.ok(doc.querySelector('[data-post-to-card-btn="true"]'),
      'the later scan is what covers a post arriving after the first one');
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
export function runTier1() {
  return run();
}
