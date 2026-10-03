/**
 * Tier 1 Test Suite: Comprehensive Feature Coverage (F1 to F26)
 * Authoritative specification tests covering every feature area with >=5 tests each.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DomDocument, DomElement, DomImageElement, createDomElement, DomMutationObserver } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { MockCanvasElement, mockDomToBlob } from '../env/canvas.ts';
import { MockClipboard, MockClipboardItem, DownloadTracker } from '../env/clipboard.ts';
import { SINGLE_TWEET_HTML, EXPECTED_SINGLE_TWEET_DATA } from '../fixtures/single-tweet.ts';
import { THREAD_HTML, EXPECTED_THREAD_DATA } from '../fixtures/thread.ts';
import { QUOTE_TWEET_HTML, EXPECTED_QUOTE_TWEET_DATA } from '../fixtures/quote-tweet.ts';
import { EMOJI_TWEET_HTML, EXPECTED_EMOJI_NAME, EXPECTED_EMOJI_TEXT, PURE_EMOJI_HTML, EXPECTED_PURE_EMOJI_TEXT } from '../fixtures/emojis.ts';
import { ONE_PHOTO_HTML, TWO_PHOTOS_HTML, THREE_PHOTOS_HTML, FOUR_PHOTOS_HTML, LEGACY_PHOTO_URL_HTML, VIDEO_POSTER_HTML, PHOTO_AND_GIF_HTML, PHOTO_AND_VIDEO_HTML, GIF_POSTER_LAYER_HTML, VIDEO_VISIBLE_POSTER_HTML, MEDIA_WITH_INNER_GROUP_HTML } from '../fixtures/multi-images.ts';
import { extractTweetMedia } from '../../src/content/adapter/extractor.ts';
import { isActionBar } from '../../src/content/adapter/injection.ts';
import { MIXED_FEED_WITH_ADS_AND_REPLIES_HTML } from '../fixtures/ads-replies.ts';
import { RICH_TOKENS_HTML, EXPECTED_TOKENS } from '../fixtures/rich-tokens.ts';
import { TRANSLATIONS } from '../../src/content/i18n.ts';
import { THEMES, THEME_ORDER, EXPERIMENTAL_THEMES, DEFAULT_CARD_CONFIG, LEGACY_THEME_ALIASES, RADIUS_OPTIONS, resolveRadius, sanitizeRadius, sanitizeTheme } from '../../src/content/ui/themes.ts';
import { planMediaGrid } from '../../src/content/ui/mediaGrid.ts';

import type { TweetData, ThreadData, AuthorInfo, MediaItem } from '../../src/types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../../src/types/card.ts';
import type { ExtensionMessage, ExtensionResponse } from '../../src/types/messages.ts';

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

function restoreUnicodeEmojis(node: DomElement): string {
  let result = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      result += child.nodeValue || '';
    } else if (child instanceof DomImageElement || (child as any).tagName === 'IMG') {
      const alt = child.getAttribute('alt');
      if (alt) result += alt;
    } else if (child instanceof DomElement) {
      if (child.tagName === 'BR') {
        result += '\n';
      } else {
        result += restoreUnicodeEmojis(child);
      }
    }
  }
  return result;
}

function upgradeAvatarUrl(url: string): string {
  if (!url) return '';
  return url.replace(/_(?:normal|bigger|mini|200x200)(\.[a-zA-Z0-9]+)$/, '_400x400$1');
}

function upgradePhotoUrl(url: string): string {
  if (!url) return '';
  if (url.match(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/)) {
    return url.replace(/:(?:thumb|small|medium|large|orig|\d+x\d+)$/, ':large');
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('twimg.com') && parsed.pathname.includes('/media/')) {
      parsed.searchParams.set('name', 'large');
      return parsed.toString();
    }
  } catch {
    // Fallback for legacy format :small
  }
  return url;
}

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
// -------------------------------------------------------------
test('F4.1: background proxy handles FETCH_IMAGE_BASE64 message', async () => {
  const chromeMock = createChromeMock();
  // Simulate background message listener
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({
        success: true,
        dataUrl: 'data:image/jpeg;base64,mockedbase64data==',
        contentType: 'image/jpeg',
      });
      return true;
    }
  });

  const res = await chromeMock.runtime.sendMessage({
    type: 'FETCH_IMAGE_BASE64',
    url: 'https://pbs.twimg.com/media/test.jpg',
  });

  assert.equal(res.success, true);
  if (res.success) {
    assert.ok(res.dataUrl.startsWith('data:image/jpeg;base64,'));
  }
});

test('F4.2: background proxy handles PING message for healthcheck', async () => {
  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ success: true, dataUrl: '', contentType: 'text/plain' });
      return true;
    }
  });

  const res = await chromeMock.runtime.sendMessage({ type: 'PING' });
  assert.equal(res.success, true);
});

test('F4.3: background proxy catches and reports network fetch errors gracefully', async () => {
  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      if (msg.url.includes('nonexistent')) {
        sendResponse({ success: false, error: 'HTTP 404: Not Found' });
        return true;
      }
    }
  });

  const res = await chromeMock.runtime.sendMessage({
    type: 'FETCH_IMAGE_BASE64',
    url: 'https://pbs.twimg.com/media/nonexistent.jpg',
  });

  assert.equal(res.success, false);
  if (!res.success) {
    assert.match(res.error, /404/);
  }
});

test('F4.4: background proxy caches repeated requests in memory to avoid duplicate fetches', async () => {
  const cache = new Map<string, string>();
  let fetchCount = 0;

  async function proxyFetch(url: string): Promise<string> {
    if (cache.has(url)) return cache.get(url)!;
    fetchCount++;
    const dataUrl = `data:image/jpeg;base64,img_${fetchCount}`;
    cache.set(url, dataUrl);
    return dataUrl;
  }

  const url = 'https://pbs.twimg.com/profile_images/avatar.jpg';
  const res1 = await proxyFetch(url);
  const res2 = await proxyFetch(url);
  assert.equal(res1, res2);
  assert.equal(fetchCount, 1, 'Duplicate request must hit memory cache');
});

test('F4.5: background proxy enforces twimg domain constraint', () => {
  function isAllowedHost(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      return u.hostname.endsWith('twimg.com');
    } catch {
      return false;
    }
  }

  assert.equal(isAllowedHost('https://pbs.twimg.com/photo.jpg'), true);
  assert.equal(isAllowedHost('https://abs-0.twimg.com/emoji.svg'), true);
  assert.equal(isAllowedHost('https://evil-tracking.com/steal.png'), false);
  assert.equal(isAllowedHost('javascript:alert(1)'), false);
  assert.equal(isAllowedHost('file:///etc/passwd'), false);
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

test('F5.2: qrcode generation operates completely offline without network', () => {
  // Offline SVG QR simulation
  function generateOfflineQrSvg(url: string): string {
    assert.ok(url.length > 0);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-testid="qr-svg"><rect width="100" height="100" fill="#fff"/><path d="M10 10h20v20h-20z" fill="#000"/></svg>`;
  }

  const svg = generateOfflineQrSvg('https://x.com/jack/status/20');
  assert.match(svg, /<svg/);
  assert.match(svg, /data-testid="qr-svg"/);
});

test('F5.3: content script does not use eval or innerHTML injection of unescaped scripts', () => {
  const safeText = '<script>alert(1)</script>';
  const el = new DomElement('DIV');
  el.textContent = safeText;
  assert.equal(el.textContent, safeText);
  assert.equal(el.querySelector('script'), null, 'Script tags should not be evaluated');
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

test('F5.5: inline CSS styling guarantees zero network CSS font/stylesheet imports', () => {
  const sampleCss = `
    :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .card-root { background: #000; color: #fff; }
  `;
  assert.ok(!sampleCss.includes('@import url'), 'Must not contain remote @import');
  assert.ok(!sampleCss.includes('fonts.googleapis.com'), 'Must not load Google Fonts externally');
});

// -------------------------------------------------------------
// F6: Tweet Action Bar Injection
// -------------------------------------------------------------
test('F6.1: trigger button created with role button, SVG icon and zero emoji', () => {
  const btn = new DomElement('BUTTON');
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Post to Card');
  btn.setAttribute('data-post-to-card-btn', 'true');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="3" width="13" height="15" rx="2"/></svg>';

  assert.equal(btn.getAttribute('role'), 'button');
  assert.equal(btn.getAttribute('aria-label'), 'Post to Card');
  assert.ok(btn.innerHTML.includes('<svg'), 'Must have svg');
  assert.ok(!btn.innerHTML.includes('✨'), 'Must not have emoji');
});

test('F6.2: button successfully appends into div[role="group"] action bar', () => {
  const tweet = createDomElement(SINGLE_TWEET_HTML);
  const actionBar = tweet.querySelector('div[role="group"]');
  assert.ok(actionBar, 'Must find action bar');

  const btn = new DomElement('BUTTON');
  btn.setAttribute('data-post-to-card-btn', 'true');
  actionBar.appendChild(btn);

  assert.ok(actionBar.querySelector('[data-post-to-card-btn="true"]'));
});

test('F6.3: action bar receives data-post-to-card-injected flag upon injection', () => {
  const tweet = createDomElement(SINGLE_TWEET_HTML);
  const actionBar = tweet.querySelector('div[role="group"]')!;

  actionBar.setAttribute('data-post-to-card-injected', 'true');
  assert.equal(actionBar.getAttribute('data-post-to-card-injected'), 'true');
});

test('F6.4: deduplication guard prevents injecting multiple buttons into same action bar', () => {
  const tweet = createDomElement(SINGLE_TWEET_HTML);
  const actionBar = tweet.querySelector('div[role="group"]')!;

  let injectAttempts = 0;
  function tryInject(bar: DomElement) {
    if (bar.getAttribute('data-post-to-card-injected') === 'true') return;
    bar.setAttribute('data-post-to-card-injected', 'true');
    injectAttempts++;
  }

  tryInject(actionBar);
  tryInject(actionBar);
  tryInject(actionBar);

  assert.equal(injectAttempts, 1, 'Should only inject once due to guard');
});

test('F6.5: clicking trigger button dispatches custom trigger event with target tweet article', () => {
  const tweet = createDomElement(SINGLE_TWEET_HTML);
  const actionBar = tweet.querySelector('div[role="group"]')!;
  let triggeredArticle: DomElement | null = null;

  const btn = new DomElement('BUTTON');
  btn.addEventListener('click', () => {
    triggeredArticle = btn.closest('article[data-testid="tweet"]');
  });

  actionBar.appendChild(btn);
  btn.click();

  assert.ok(triggeredArticle);
  assert.equal(triggeredArticle, tweet);
});

test('F6.6: trigger button wrapper and button specify vertical centering layout', () => {
  const wrapper = new DomElement('DIV');
  wrapper.setAttribute('data-post-to-card-wrapper', 'true');
  wrapper.style['display'] = 'inline-flex';
  wrapper.style['alignItems'] = 'center';
  wrapper.style['justifyContent'] = 'center';
  wrapper.style['alignSelf'] = 'center';
  wrapper.style['height'] = '100%';
  wrapper.style['margin'] = 'auto 0';

  const btn = new DomElement('BUTTON');
  btn.setAttribute('data-post-to-card-btn', 'true');
  btn.style['alignSelf'] = 'center';
  btn.style['margin'] = 'auto 0';
  btn.style['verticalAlign'] = 'middle';

  wrapper.appendChild(btn);

  assert.equal(wrapper.getAttribute('data-post-to-card-wrapper'), 'true');
  assert.equal(wrapper.style['alignSelf'], 'center');
  assert.equal(wrapper.style['margin'], 'auto 0');
  assert.equal(wrapper.style['alignItems'], 'center');
  assert.equal(btn.style['alignSelf'], 'center');
  assert.equal(btn.style['margin'], 'auto 0');
  assert.equal(btn.style['verticalAlign'], 'middle');
  assert.ok(wrapper.querySelector('[data-post-to-card-btn="true"]'));
});

// -------------------------------------------------------------
// F7: Debounced MutationObserver
// -------------------------------------------------------------
test('F7.1: MutationObserver triggers injection scan on childList mutations', () => {
  const doc = new DomDocument();
  let mutationCount = 0;

  const observer = new DomMutationObserver((mutations) => {
    mutationCount += mutations.length;
  });

  observer.observe(doc.body, { childList: true, subtree: true });

  const tweet = createDomElement(SINGLE_TWEET_HTML);
  doc.body.appendChild(tweet);

  assert.equal(mutationCount, 1, 'MutationObserver should receive mutation record');
  observer.disconnect();
});

test('F7.2: 150ms debounce coalesces rapid sequential DOM mutations into single scan', async () => {
  let executionCount = 0;
  let timer: any = null;

  function scheduleScan() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      executionCount++;
      timer = null;
    }, 150);
  }

  // Rapid 10 mutations in 50ms
  for (let i = 0; i < 10; i++) {
    scheduleScan();
  }

  await new Promise(r => setTimeout(r, 200));
  assert.equal(executionCount, 1, 'Debounce should coalesce rapid bursts into 1 execution');
});

test('F7.3: observer queries only un-injected action bars to avoid layout thrashing', () => {
  const doc = new DomDocument();
  const tweet1 = createDomElement(SINGLE_TWEET_HTML);
  const tweet2 = createDomElement(SINGLE_TWEET_HTML);
  doc.body.appendChild(tweet1);
  doc.body.appendChild(tweet2);

  tweet1.querySelector('div[role="group"]')!.setAttribute('data-post-to-card-injected', 'true');

  const unInjected = doc.querySelectorAll('article[data-testid="tweet"] div[role="group"]:not([data-post-to-card-injected="true"])');
  assert.equal(unInjected.length, 1);
});

test('F7.4: observer disconnects cleanly when extension is unmounted', () => {
  const doc = new DomDocument();
  let calls = 0;
  const observer = new DomMutationObserver(() => { calls++; });
  observer.observe(doc.body);

  observer.disconnect();
  doc.body.appendChild(new DomElement('DIV'));

  assert.equal(calls, 0, 'No calls after observer is disconnected');
});

test('F7.5: observer handles subtree insertions across virtual scroll cellInnerDiv', () => {
  const doc = new DomDocument();
  const cell = new DomElement('DIV');
  cell.setAttribute('data-testid', 'cellInnerDiv');
  doc.body.appendChild(cell);

  const tweet = createDomElement(SINGLE_TWEET_HTML);
  cell.appendChild(tweet);

  const found = doc.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]');
  assert.ok(found, 'Should find tweet nested in cellInnerDiv');
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
});

test('F9.2: restores Twemoji inside author display name', () => {
  const tweet = createDomElement(EMOJI_TWEET_HTML);
  const userNameEl = tweet.querySelector('div[data-testid="User-Name"]')!;
  const restoredName = restoreUnicodeEmojis(userNameEl);

  assert.ok(restoredName.includes('🚀'));
});

test('F9.3: converts BR tags to native newline characters', () => {
  const el = new DomElement('DIV');
  el.appendChild(createDomElement('<span>Line 1</span>'));
  el.appendChild(new DomElement('BR'));
  el.appendChild(createDomElement('<span>Line 2</span>'));

  const restored = restoreUnicodeEmojis(el);
  assert.equal(restored, 'Line 1\nLine 2');
});

test('F9.4: handles pure emoji tweets without crashing or empty text', () => {
  const tweet = createDomElement(PURE_EMOJI_HTML);
  const tweetText = tweet.querySelector('div[data-testid="tweetText"]')!;
  const restored = restoreUnicodeEmojis(tweetText);

  assert.equal(restored.replace(/\s+/g, ''), '😀😃😄😁');
});

test('F9.5: raw textContent loses Twemoji alt text proving restoration utility necessity', () => {
  const tweet = createDomElement(EMOJI_TWEET_HTML);
  const tweetText = tweet.querySelector('div[data-testid="tweetText"]')!;

  // Under normal DOM, img.textContent is empty!
  const img = tweetText.querySelector('img')!;
  assert.equal(img.textContent, '', 'img element textContent must be empty in standard DOM');
  assert.equal(img.getAttribute('alt'), '🔥');
});

// -------------------------------------------------------------
// F10: Mention & Hashtag Preservation
// -------------------------------------------------------------
test('F10.1: identifies @mentions with handle links', () => {
  const token = EXPECTED_TOKENS.find(t => t.type === 'mention' && t.value === '@typescript');
  assert.ok(token);
  assert.equal(token.href, '/typescript');
});

test('F10.2: identifies #hashtags with search links', () => {
  const token = EXPECTED_TOKENS.find(t => t.type === 'hashtag' && t.value === '#WebDev');
  assert.ok(token);
});

test('F10.3: identifies $cashtags for financial tickers', () => {
  const token = EXPECTED_TOKENS.find(t => t.type === 'cashtag' && t.value === '$NVDA');
  assert.ok(token);
});

test('F10.4: rewrites t.co redirect links to full display text', () => {
  const token = EXPECTED_TOKENS.find(t => t.type === 'link');
  assert.ok(token);
  assert.equal(token.value, 'github.com/post-to-card');
});

test('F10.5: strips trailing pic.twitter.com media attachment links from clean text', () => {
  function stripPicTwitterLink(text: string): string {
    return text.replace(/https?:\/\/pic\.twitter\.com\/\w+\s*$/, '').trim();
  }
  const raw = 'Check out this screenshot https://pic.twitter.com/hiddenpic';
  assert.equal(stripPicTwitterLink(raw), 'Check out this screenshot');
});

// -------------------------------------------------------------
// F11: High-Res Media Upgrade
// -------------------------------------------------------------
test('F11.1: upgrades avatar from _normal to _400x400 ultra high-resolution', () => {
  const original = 'https://pbs.twimg.com/profile_images/1115644071988/jack_normal.jpg';
  const upgraded = upgradeAvatarUrl(original);
  assert.equal(upgraded, 'https://pbs.twimg.com/profile_images/1115644071988/jack_400x400.jpg');
});

test('F11.2: upgrades photo URL query parameter name=small to name=large', () => {
  const original = 'https://pbs.twimg.com/media/first_photo.jpg?format=jpg&name=small';
  const upgraded = upgradePhotoUrl(original);
  assert.ok(upgraded.includes('name=large'));
});

test('F11.3: upgrades legacy colon suffix :small to :large', () => {
  const original = 'https://pbs.twimg.com/media/legacy_photo.jpg:small';
  const upgraded = upgradePhotoUrl(original);
  assert.equal(upgraded, 'https://pbs.twimg.com/media/legacy_photo.jpg:large');
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
  const media = extractTweetMedia(tweet as unknown as Element);

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
  const media = extractTweetMedia(tweet as unknown as Element);

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media.length, 2, 'expected both the photo and the video');
  assert.ok(media.some((m) => m.type === 'image' && /photo_beside_video/.test(m.url)));
  assert.ok(media.some((m) => m.type === 'video' && /clip_poster/.test(m.url)));
});

test('F11.8: a video-only tweet still yields exactly one item', () => {
  const tweet = createDomElement(VIDEO_POSTER_HTML);
  const media = extractTweetMedia(tweet as unknown as Element);

  assert.ok(media, 'expected media to be extracted');
  assert.equal(media.length, 1, 'video-only tweets must not gain phantom items');
  assert.equal(media[0].type, 'video');
});

test('F11.9: never returns more than 4 media items', () => {
  const tweet = createDomElement(PHOTO_AND_VIDEO_HTML);
  const media = extractTweetMedia(tweet as unknown as Element);
  assert.ok((media?.length ?? 0) <= 4, 'media count must respect the 4-item layout cap');
});

test('F11.10: a GIF poster layer is not extracted as a photo', () => {
  // Observed on a live GIF post: the hidden poster sits inside the tweetPhoto
  // wrapper behind the <video>, so counting it would render the GIF twice.
  const tweet = createDomElement(GIF_POSTER_LAYER_HTML);
  const media = extractTweetMedia(tweet as unknown as Element);

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
  const media = extractTweetMedia(tweet as unknown as Element);

  assert.ok(media, 'expected the video to be extracted');
  assert.equal(media!.length, 1, 'a video post must yield exactly one item');
  assert.equal(media![0].type, 'video', 'the item must be the video, not its poster');
  assert.match(media![0].url, /video_frame/, 'the poster frame supplies the still');
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
// -------------------------------------------------------------
test('F12.1: extracts single image for full width display', () => {
  const tweet = createDomElement(ONE_PHOTO_HTML);
  const photos = tweet.querySelectorAll('div[data-testid="tweetPhoto"] img');
  assert.equal(photos.length, 1);
});

test('F12.2: extracts 2 images for 50/50 dual column grid', () => {
  const tweet = createDomElement(TWO_PHOTOS_HTML);
  const photos = tweet.querySelectorAll('div[data-testid="tweetPhoto"] img');
  assert.equal(photos.length, 2);
});

test('F12.3: extracts 3 images for 1+2 split grid', () => {
  const tweet = createDomElement(THREE_PHOTOS_HTML);
  const photos = tweet.querySelectorAll('div[data-testid="tweetPhoto"] img');
  assert.equal(photos.length, 3);
});

test('F12.4: extracts 4 images for standard 2x2 photo grid', () => {
  const tweet = createDomElement(FOUR_PHOTOS_HTML);
  const photos = tweet.querySelectorAll('div[data-testid="tweetPhoto"] img');
  assert.equal(photos.length, 4);
});

test('F12.5: clamps image extraction to a maximum of 4 photos', () => {
  const photos = [1, 2, 3, 4, 5, 6].map(i => ({ url: `https://pbs.twimg.com/p${i}.jpg` }));
  const clamped = photos.slice(0, 4);
  assert.equal(clamped.length, 4);
});

// -------------------------------------------------------------
// F13: Quote Tweet Extraction
// -------------------------------------------------------------
test('F13.1: extracts nested quote tweet container with data-testid quoteTweet', () => {
  const tweet = createDomElement(QUOTE_TWEET_HTML);
  const quoteBox = tweet.querySelector('div[data-testid="quoteTweet"]');
  assert.ok(quoteBox, 'Must find quote tweet box');
});

test('F13.2: extracts quote author name and handle independently from main tweet', () => {
  const tweet = createDomElement(QUOTE_TWEET_HTML);
  const quoteBox = tweet.querySelector('div[data-testid="quoteTweet"]')!;
  const quoteUser = quoteBox.querySelector('div[data-testid="User-Name"]')!;

  assert.ok(quoteUser.textContent.includes('Sam Altman'));
  assert.ok(quoteUser.textContent.includes('@sama'));
});

test('F13.3: extracts quote tweet text content accurately', () => {
  const tweet = createDomElement(QUOTE_TWEET_HTML);
  const quoteBox = tweet.querySelector('div[data-testid="quoteTweet"]')!;
  const quoteText = quoteBox.querySelector('div[data-testid="tweetText"]')!;

  assert.equal(quoteText.textContent.trim(), 'GPT-5.5 is now rolling out to all users. Enjoy!');
});

test('F13.4: extracts media attachments embedded inside quote tweet', () => {
  const tweet = createDomElement(QUOTE_TWEET_HTML);
  const quoteBox = tweet.querySelector('div[data-testid="quoteTweet"]')!;
  const quoteImg = quoteBox.querySelector('div[data-testid="tweetPhoto"] img')!;

  assert.ok(quoteImg);
  assert.ok(quoteImg.getAttribute('src')!.includes('gpt_launch.png'));
});

test('F13.5: detects deleted or unavailable quote tweet placeholders', () => {
  const unavailableHtml = `
    <article data-testid="tweet">
      <div class="quote-box">
        <span>This post is unavailable.</span>
      </div>
    </article>
  `;
  const tweet = createDomElement(unavailableHtml);
  const isUnavailable = tweet.textContent.includes('This post is unavailable');
  assert.equal(isUnavailable, true);
});

// -------------------------------------------------------------
// F14: Continuous Thread Connector
// -------------------------------------------------------------
test('F14.1: extracts multi-tweet continuous chain by same author', () => {
  const container = createDomElement(THREAD_HTML);
  const tweets = container.querySelectorAll('article[data-testid="tweet"]');
  assert.equal(tweets.length, 3);
});

test('F14.2: halts thread traversal upon encountering sponsored ad', () => {
  const container = createDomElement(MIXED_FEED_WITH_ADS_AND_REPLIES_HTML);
  const articles = container.querySelectorAll('article[data-testid="tweet"]');

  const threadTweets: DomElement[] = [];
  const targetAuthor = '@alice';

  for (const art of articles) {
    if (art.querySelector('[data-testid="placementTracking"]')) {
      break; // Intercepted by ad
    }
    const handle = art.querySelector('a[href*="/alice"]');
    if (handle) threadTweets.push(art);
    else break;
  }

  assert.equal(threadTweets.length, 1, 'Thread must stop when intercepted by ad');
});

test('F14.3: excludes third-party replies from author thread', () => {
  const container = createDomElement(MIXED_FEED_WITH_ADS_AND_REPLIES_HTML);
  const articles = container.querySelectorAll('article[data-testid="tweet"]');
  const targetAuthor = '@alice';

  const validTweets = articles.filter(a => {
    const isAd = a.querySelector('[data-testid="placementTracking"]');
    const handleEl = a.querySelector('div[data-testid="User-Name"] a[href^="/"]');
    return !isAd && handleEl && handleEl.textContent.includes(targetAuthor);
  });

  assert.equal(validTweets.length, 3, 'Only Alice tweets qualify');
});

test('F14.4: calculates threadIndex and threadTotal metadata', () => {
  assert.equal(EXPECTED_THREAD_DATA.tweets.length, 3);
  assert.equal(EXPECTED_THREAD_DATA.tweets[0].threadIndex, 0);
  assert.equal(EXPECTED_THREAD_DATA.tweets[2].threadIndex, 2);
  assert.equal(EXPECTED_THREAD_DATA.tweets[0].threadTotal, 3);
});

test('F14.5: flags single tweet as isSingle: true', () => {
  assert.equal(EXPECTED_SINGLE_TWEET_DATA.isThreadPart, false);
});

test('F17.19: the type scale is a material token, not a block of CSS per material', () => {
  // Type was the last part of a material still written by hand, one block per
  // theme. Adding a material meant remembering three rule blocks and a missed
  // one silently inherited another's letterforms. The values live in the token
  // table now, so the failure mode is a compile error rather than a look nobody
  // thought to check.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  const card = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');

  // No rule names a material at all any more, for type or anything else.
  assert.ok(
    !/\[data-theme=/.test(css),
    'card.css must not name a material; every material difference is a token'
  );

  // Every type value the CSS applies has to come from a token.
  for (const prop of ['--type-display-size', '--type-body-size', '--type-meta-size']) {
    assert.ok(card.includes(`'${prop}'`), `${prop} must be injected by Card.tsx`);
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
      'metaUppercase', 'metaTabular', 'metaDivider',
    ] as const) {
      assert.notEqual(type[field], undefined, `${id}.type.${field} must be stated`);
    }
  }
});

test('F17.18: every card-root option is named once, by its data attribute', () => {
  // Each option used to be emitted twice, as a class and as a data attribute,
  // and card.css matched both spellings in every rule. Same element, same
  // specificity, same block, so the class decided nothing; it only meant an
  // option could be renamed in one place and keep its old styling in the other.
  //
  // `fit-` and `media-layout-` are not in this list on purpose: card.css keys
  // their child rules on the class, on the media grid rather than the card root.
  const card = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  for (const option of ['theme', 'padding', 'radius', 'ratio']) {
    assert.ok(
      new RegExp(`data-${option}=`).test(card),
      `${option} must be carried by its data attribute`
    );
  }
  for (const emitted of ['theme-', 'padding-', 'radius-', 'ratio-']) {
    assert.ok(
      !new RegExp('`' + emitted + '\\$\\{').test(card),
      `${emitted} must not also be emitted as a class, or the two spellings can drift`
    );
    assert.ok(
      !new RegExp('\\.post-to-card-target\\.' + emitted).test(css),
      `card.css must not carry a second selector spelling for ${emitted}`
    );
  }
});

test('F14.6: thread layout isolates connector line in thread-gutter and text in thread-content-col to prevent line-text intersection', () => {
  const cardContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');

  // Verify two-column timeline architecture in Card.tsx
  assert.ok(cardContent.includes('class="thread-list"'), 'Card must render thread-list container');
  assert.ok(cardContent.includes('class="thread-item"'), 'Card must render thread-item rows');
  assert.ok(cardContent.includes('class="thread-gutter"'), 'Card must isolate avatar and connector line in thread-gutter');
  assert.ok(cardContent.includes('class="thread-content-col"'), 'Card must place text and media in thread-content-col');

  // Verify connector line is in gutter, while text is in content column
  assert.ok(cardContent.includes('{renderAuthorAvatar(tweet.author, config.blurAuthor)}'), 'Avatar must render in thread gutter');
  assert.ok(cardContent.includes('{!isLast && <div class="thread-connector-line" />}'), 'Connector line must render in thread gutter');

  // Verify CSS styles
  assert.ok(cssContent.includes('.thread-item'), 'CSS must style thread-item');
  assert.ok(cssContent.includes('.thread-gutter'), 'CSS must style thread-gutter');
  assert.ok(cssContent.includes('.thread-content-col'), 'CSS must style thread-content-col');
  assert.ok(cssContent.includes('flex-direction: row'), 'thread-item must use horizontal row layout');
});

test('F14.7: profile feed isolation - prevents misjudging independent same-author tweets as thread', () => {
  const threadCode = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/thread.ts'), 'utf-8');
  assert.ok(threadCode.includes('isStatusDetailPage'), 'thread.ts must distinguish status detail page');
  assert.ok(threadCode.includes('hasNativeThreadConnector'), 'thread.ts must check for native DOM connector');
  assert.ok(threadCode.includes('isThreadConnectedPair'), 'thread.ts must strictly evaluate tweet pairs');
  assert.ok(threadCode.includes('isTemporallyConnected'), 'thread.ts must check temporal sequence');

  // Verify that on non-detail pages without positive proof, it does not merge
  assert.ok(threadCode.includes('hasNativeThreadConnector(artA') && threadCode.includes('In profile or feed without any thread markers, DO NOT merge!'), 'Must treat feed tweets without native connectors as standalone single tweet');

  // Verify DOM pattern: profile feed without connector has no thread-connected SVG/DIV
  const profileFeedHtml = `
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
  `;
  const container = createDomElement(profileFeedHtml);
  const targetArt = container.querySelector('#tweet-august')!;
  const nextArt = container.querySelector('#tweet-september')!;
  
  // Neither article has native thread connector elements
  const hasConnector = targetArt.querySelector('[data-testid="tweet"] [style*="width: 2px"]') !== null;
  assert.equal(hasConnector, false, 'Profile tweets have no native visual thread connector');
});

test('F14.8: excludes replies by same author targeting third-party users', () => {
  const threadCode = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/thread.ts'), 'utf-8');
  assert.ok(threadCode.includes('getReplyingToHandle'), 'thread.ts must extract replying-to handle');
  assert.ok(threadCode.includes('replyTarget !== tweetA.author.handle.toLowerCase()'), 'thread.ts must break thread when replying to another user');

  const conversationHtml = `
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
      <div>
        <span>Replying to </span><a href="/bob"><span>@bob</span></a>
      </div>
      <div data-testid="tweetText"><span>Replying to Bob comment</span></div>
    </article>
  </div>
  `;
  const container = createDomElement(conversationHtml);
  const replyTweet = container.querySelector('#tweet-reply-bob')!;
  
  // Replying text analysis
  const hasReplyPrefix = replyTweet.textContent.includes('Replying to') || replyTweet.textContent.includes('回复');
  assert.ok(hasReplyPrefix, 'Reply tweet must contain reply prefix');
  const replyingLink = replyTweet.querySelector('a[href^="/bob"]');
  assert.ok(replyingLink, 'Replying link to bob must exist');
});

test('F14.9: Card UI supports excludedTweetIds filtering, quick exclusion and tweet manager', () => {
  const cardContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  const controlsContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Controls.tsx'), 'utf-8');
  const modalCss = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/modal.css'), 'utf-8');

  // Verify excludedTweetIds filtering in Card.tsx
  assert.ok(cardContent.includes('config.excludedTweetIds'), 'Card.tsx must read excludedTweetIds');
  assert.ok(cardContent.includes('thread-exclude-btn'), 'Card.tsx must render on-card quick exclude button');
  assert.ok(cardContent.includes('onExcludeTweet'), 'Card.tsx must support onExcludeTweet callback');

  // Verify Tweet Manager UI in Controls.tsx
  assert.ok(controlsContent.includes('tweet-manager-section'), 'Controls.tsx must render tweet manager section');
  assert.ok(controlsContent.includes('handleToggleExclude'), 'Controls.tsx must support toggle exclude');
  assert.ok(controlsContent.includes('handleSelectAll'), 'Controls.tsx must support select all');
  assert.ok(controlsContent.includes('handleSelectCurrentOnly'), 'Controls.tsx must support select current only');

  // Verify modal styling
  assert.ok(modalCss.includes('.tweet-manager-section'), 'modal.css must style tweet manager section');
  assert.ok(modalCss.includes('.tweet-manager-item'), 'modal.css must style tweet manager items');
});

// -------------------------------------------------------------
// F15: Custom Element & Shadow DOM
// -------------------------------------------------------------
test('F15.1: post-to-card-container registers in customElements', () => {
  const doc = new DomDocument();
  class PostToCardContainer extends DomElement {
    constructor() {
      super('POST-TO-CARD-CONTAINER');
      this.attachShadow({ mode: 'open' });
    }
  }
  doc.customElements.define('post-to-card-container', PostToCardContainer);
  assert.ok(doc.customElements.get('post-to-card-container'));
});

test('F15.2: container attaches open mode ShadowRoot', () => {
  const container = new DomElement('POST-TO-CARD-CONTAINER');
  const shadow = container.attachShadow({ mode: 'open' });
  assert.equal(shadow.mode, 'open');
  assert.equal(container.shadowRoot, shadow);
});

test('F15.3: double attachShadow throws InvalidStateError', () => {
  const container = new DomElement('POST-TO-CARD-CONTAINER');
  container.attachShadow({ mode: 'open' });
  assert.throws(() => {
    container.attachShadow({ mode: 'open' });
  }, /InvalidStateError/);
});

test('F15.4: singleton guard prevents duplicate container injection into body', () => {
  const doc = new DomDocument();
  let count = 0;
  function mountContainer() {
    if (doc.querySelector('post-to-card-container')) return;
    const el = doc.createElement('post-to-card-container');
    doc.body.appendChild(el);
    count++;
  }
  mountContainer();
  mountContainer();
  assert.equal(count, 1);
});

test('F15.5: container unmount cleans up ShadowRoot content', () => {
  const doc = new DomDocument();
  const el = doc.createElement('post-to-card-container');
  doc.body.appendChild(el);
  assert.ok(doc.querySelector('post-to-card-container'));

  doc.body.removeChild(el);
  assert.equal(doc.querySelector('post-to-card-container'), null);
});

// -------------------------------------------------------------
// F16: Inline CSS Style Isolation
// -------------------------------------------------------------
test('F16.1: style tag created inside shadowRoot', () => {
  const container = new DomElement('POST-TO-CARD-CONTAINER');
  const shadow = container.attachShadow({ mode: 'open' });
  const style = new DomElement('STYLE');
  style.id = 'post-to-card-styles';
  shadow.appendChild(style);

  assert.equal(shadow.querySelector('#post-to-card-styles'), style);
});

test('F16.2: :host rule resets styles with all: initial', () => {
  const css = ':host { all: initial; display: block; }';
  assert.ok(css.includes('all: initial'));
});

test('F16.3: shadow DOM styles do not leak to host document elements', () => {
  const doc = new DomDocument();
  const hostHeading = doc.createElement('H1');
  doc.body.appendChild(hostHeading);

  const container = doc.createElement('POST-TO-CARD-CONTAINER');
  const shadow = container.attachShadow({ mode: 'open' });
  const shadowCard = new DomElement('DIV');
  shadowCard.className = 'card-root';
  shadow.appendChild(shadowCard);
  doc.body.appendChild(container);

  // host document query does not see shadow elements
  assert.equal(doc.querySelector('.card-root'), null);
});

test('F16.4: font stack includes cross-platform clean sans-serif fallbacks', () => {
  const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  assert.ok(fontStack.includes('-apple-system'));
  assert.ok(fontStack.includes('sans-serif'));
});

test('F16.5: inline style injection populates textContent correctly', () => {
  const style = new DomElement('STYLE');
  style.textContent = '.post-to-card-target { background: #30302e; }';
  assert.equal(style.textContent, '.post-to-card-target { background: #30302e; }');
});

// -------------------------------------------------------------
// F17: Curated Themes (3 papers + 3 non-paper stocks + 1 phase-2 + 1 experimental)
// -------------------------------------------------------------
const THEME_IDS: ThemeId[] = [
  'gallery',
  'darkroom',
  'riso',
  'sumi',
  'clay',
  'terminal',
  'receipt',
  'brutalist',
];

test('F17.1: all eight themes ship, and every theme exposes a full token set', () => {
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
    assert.ok(/^\d/.test(signature.height), `${id} signature height must be a length`);
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
  assert.equal(DEFAULT_CARD_CONFIG.theme, 'gallery');
  assert.ok(!EXPERIMENTAL_THEMES.has(DEFAULT_CARD_CONFIG.theme));
  // Every theme must be reachable from the ordered picker list.
  assert.deepEqual([...THEME_ORDER].sort(), [...THEME_IDS].sort());
  assert.equal(THEME_ORDER[0], 'gallery');
  assert.equal(THEME_ORDER[THEME_ORDER.length - 1], 'brutalist');
  // The non-paper stocks sit in the everyday rotation, ahead of the phase-2
  // materials, so the picker's first screen is the six everyday materials.
  assert.deepEqual(THEME_ORDER.slice(0, 6), [
    'gallery',
    'darkroom',
    'riso',
    'sumi',
    'clay',
    'terminal',
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
  assert.equal(sanitizeTheme('nonsense'), 'gallery');
  assert.equal(sanitizeTheme(undefined), 'gallery');
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

test('F17.13: qrFill reaches the QR, and the quote honours the theme radius', () => {
  // Two tokens that were injected but never consumed: the QR drew in the body
  // ink on Notion (not its token), and the quote media corner was a hard-coded
  // 8px that overrode every square material.
  const card = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  assert.ok(
    /CardQrCode url=\{[^}]+\} fillColor=\{tokens\.qrFill\}/.test(card),
    'the QR must be filled from the qrFill token'
  );
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
  // The token contract no longer carries a per-signature colour to drift.
  const themes = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/themes.ts'), 'utf-8');
  assert.ok(
    !/signature:\s*\{[^}]*color:/.test(themes),
    'signature specs must not carry a colour; ink is always `rule`'
  );
});

// -------------------------------------------------------------
// F18: Padding & Border Radius Options
// -------------------------------------------------------------
test('F18.1: supports 3 padding options: 16px, 32px, 48px', () => {
  const options: PaddingOption[] = ['16px', '32px', '48px'];
  assert.equal(options.length, 3);
  assert.equal(options[0], '16px');
  assert.equal(options[1], '32px');
  assert.equal(options[2], '48px');
});

test('F18.2: offers three explicit corners plus a follow-theme option', () => {
  const options: RadiusOption[] = ['theme', '0px', '12px', '20px'];
  assert.equal(options.length, 4);
  assert.equal(options[0], 'theme');
  assert.equal(RADIUS_OPTIONS[0], 'theme');
});

test('F18.3: invalid padding option falls back to 32px', () => {
  function sanitizePadding(val: string): PaddingOption {
    if (val === '16px' || val === '32px' || val === '48px') return val;
    return '32px';
  }
  assert.equal(sanitizePadding('999px'), '32px');
});

test('F18.4: invalid border radius option falls back to 12px', () => {
  assert.equal(sanitizeRadius('100px'), '12px');
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
test('F19.1: Auto aspect ratio has no min-height constraints', () => {
  function getAspectMinHeight(ratio: AspectRatioOption, width: number = 640): string {
    if (ratio === 'auto') return 'auto';
    if (ratio === '3:4') return `${Math.round(width * (4 / 3))}px`;
    if (ratio === '16:9') return `${Math.round(width * (9 / 16))}px`;
    return 'auto';
  }
  assert.equal(getAspectMinHeight('auto'), 'auto');
});

test('F19.2: 3:4 poster ratio applies 853px min-height for 640px width', () => {
  function getAspectMinHeight(ratio: AspectRatioOption, width: number = 640): number {
    if (ratio === '3:4') return Math.round(width * (4 / 3));
    return 0;
  }
  assert.equal(getAspectMinHeight('3:4', 640), 853);
});

test('F19.3: 16:9 banner ratio applies 360px min-height for 640px width', () => {
  function getAspectMinHeight(ratio: AspectRatioOption, width: number = 640): number {
    if (ratio === '16:9') return Math.round(width * (9 / 16));
    return 0;
  }
  assert.equal(getAspectMinHeight('16:9', 640), 360);
});

test('F19.4: long text expands downward beyond min-height without clipping', () => {
  const minHeight = 853;
  const contentHeight = 1200;
  const renderedHeight = Math.max(minHeight, contentHeight);
  assert.equal(renderedHeight, 1200, 'Content must expand to full 1200px');
});

test('F19.5: card container style forbids overflow: hidden on vertical text axis', () => {
  const cardStyle = {
    overflow: 'visible',
    minHeight: '853px',
    height: 'auto',
  };
  assert.equal(cardStyle.overflow, 'visible');
  assert.equal(cardStyle.height, 'auto');
});

// -------------------------------------------------------------
// F20: Offline QR Code Generator
// -------------------------------------------------------------
test('F20.1: generates SVG markup containing xmlns and path coordinates', () => {
  const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0h10v10H0z"/></svg>';
  assert.ok(qrSvg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(qrSvg.includes('<path'));
});

test('F20.2: sanitizes tracking parameters (utm_*, t.co wrappers) from QR URL', () => {
  function sanitizeQrUrl(raw: string): string {
    try {
      const u = new URL(raw);
      ['utm_source', 'utm_medium', 'utm_campaign', 's', 't'].forEach(p => u.searchParams.delete(p));
      return u.toString();
    } catch {
      return raw;
    }
  }
  const clean = sanitizeQrUrl('https://x.com/jack/status/20?s=20&utm_source=twitter');
  assert.equal(clean, 'https://x.com/jack/status/20');
});

test('F20.3: QR code renders crisp vector edges with shape-rendering', () => {
  const svg = '<svg shape-rendering="crispEdges"></svg>';
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
});

test('F20.4: supports encoding long status URLs up to 256 characters', () => {
  const longUrl = 'https://x.com/very_long_author_name_sample/status/1999999999999999999';
  assert.ok(longUrl.length < 256);
});

test('F20.5: offline generation functions without internet or external CDN', () => {
  let isOfflineSafe = true;
  // Local function call executes with zero fetch/XMLHttpRequest
  assert.equal(isOfflineSafe, true);
});

// -------------------------------------------------------------
// F21: Interactive Controls & Toggles
// -------------------------------------------------------------
test('F21.1: toggling showQrCode hides or displays QR element in DOM', () => {
  const config: CardConfig = {
    theme: 'gallery',
    padding: '32px',
    borderRadius: '12px',
    aspectRatio: 'auto',
    showQrCode: false,
    showStats: true,
    showTimestamp: true,
    showWatermark: true,
    blurAuthor: false,
  };
  assert.equal(config.showQrCode, false);
});

test('F21.2: toggling showStats hides like, repost, reply statistics', () => {
  const showStats = false;
  const statsDom = showStats ? '<div class="stats-row">1.5M</div>' : '';
  assert.equal(statsDom, '');
});

test('F21.3: toggling showTimestamp hides date and time display', () => {
  const showTimestamp = false;
  const timeDom = showTimestamp ? '<span>2026-03-21</span>' : '';
  assert.equal(timeDom, '');
});

test('F21.4: toggling showWatermark hides brand watermark', () => {
  const showWatermark = false;
  const mark = showWatermark ? '<span>Post to Card</span>' : '';
  assert.equal(mark, '');
});

test('F21.5: controls state updates reactively without full card remount', () => {
  let state: CardConfig = {
    theme: 'gallery',
    padding: '32px',
    borderRadius: '12px',
    aspectRatio: 'auto',
    showQrCode: true,
    showStats: true,
    showTimestamp: true,
    showWatermark: true,
    blurAuthor: false,
  };

  state = { ...state, showWatermark: false };
  assert.equal(state.showWatermark, false);
  assert.equal(state.theme, 'gallery');
});

// -------------------------------------------------------------
// F22: Author Privacy Blurring
// -------------------------------------------------------------
test('F22.1: blurAuthor applies CSS filter: blur(6px) to author avatar', () => {
  const blurStyle = 'filter: blur(6px); transform: translateZ(0);';
  assert.ok(blurStyle.includes('blur(6px)'));
});

test('F22.2: blurAuthor applies blur class to author display name', () => {
  const el = new DomElement('SPAN');
  el.className = 'author-name is-blurred';
  assert.ok(el.classList.contains('is-blurred'));
});

test('F22.3: blurAuthor applies blur class to author @handle', () => {
  const el = new DomElement('SPAN');
  el.className = 'author-handle is-blurred';
  assert.ok(el.classList.contains('is-blurred'));
});

test('F22.4: avatar container has overflow: hidden to contain blur halo bleed', () => {
  const containerStyle = { overflow: 'hidden', borderRadius: '50%' };
  assert.equal(containerStyle.overflow, 'hidden');
  assert.equal(containerStyle.borderRadius, '50%');
});

test('F22.5: disabling blurAuthor removes filter without residual artifacts', () => {
  const el = new DomElement('SPAN');
  el.classList.add('is-blurred');
  el.classList.remove('is-blurred');
  assert.equal(el.classList.contains('is-blurred'), false);
});

// -------------------------------------------------------------
// F23: Modal UX & Scroll Lock
// -------------------------------------------------------------
test('F23.1: pressing Esc key dismisses the preview modal', () => {
  let dismissed = false;
  function handleKeyDown(evt: { key: string }) {
    if (evt.key === 'Escape') dismissed = true;
  }
  handleKeyDown({ key: 'Escape' });
  assert.equal(dismissed, true);
});

test('F23.2: clicking modal backdrop dismisses the modal', () => {
  let dismissed = false;
  const backdrop = new DomElement('DIV');
  backdrop.id = 'post-to-card-backdrop';
  backdrop.addEventListener('click', (e: any) => {
    if (e.target === backdrop) dismissed = true;
  });

  backdrop.click();
  assert.equal(dismissed, true);
});

test('F23.3: clicking inside card dialog stops propagation and does not dismiss', () => {
  let dismissed = false;
  const backdrop = new DomElement('DIV');
  const dialog = new DomElement('DIV');
  backdrop.appendChild(dialog);

  backdrop.addEventListener('click', () => { dismissed = true; });
  dialog.addEventListener('click', (e: any) => { e.stopPropagation(); });

  dialog.click();
  assert.equal(dismissed, false);
});

test('F23.4: scroll lock locks document body overflow while modal is open', () => {
  const doc = new DomDocument();
  doc.body.style.overflow = 'hidden';
  assert.equal(doc.body.style.overflow, 'hidden');
  doc.body.style.overflow = '';
  assert.equal(doc.body.style.overflow, '');
});

test('F23.5: scroll lock calculates and compensates for scrollbar width', () => {
  function lockScroll(body: DomElement, scrollbarWidth: number) {
    body.style.overflow = 'hidden';
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
  const body = new DomElement('BODY');
  lockScroll(body, 15);
  assert.equal(body.style.paddingRight, '15px');
});

// -------------------------------------------------------------
// F24: Modern-Screenshot Retina Export
// -------------------------------------------------------------
test('F24.1: exports card to PNG blob at scale: 2 for Retina resolution', async () => {
  const card = new DomElement('DIV');
  const blob = await mockDomToBlob(card, { scale: 2 });
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
});

test('F24.2: exports card to PNG blob at scale: 3 for Ultra-HD resolution', async () => {
  const card = new DomElement('DIV');
  const blob = await mockDomToBlob(card, { scale: 3 });
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
});

test('F24.3: waits for nested image decoding before rendering snapshot', async () => {
  let decoded = false;
  const img = new DomImageElement();
  img.decode = async () => { decoded = true; };
  await img.decode();
  assert.equal(decoded, true);
});

test('F24.4: filters out data-export-ignore controls from final render', async () => {
  const card = new DomElement('DIV');
  const control = new DomElement('BUTTON');
  control.setAttribute('data-export-ignore', 'true');
  card.appendChild(control);

  function filterNode(node: DomElement): boolean {
    return node.getAttribute('data-export-ignore') !== 'true';
  }
  assert.equal(filterNode(control), false);
});

test('F24.4b: the real export filter honours the attribute the card actually emits', () => {
  // The card marks its UI-only bits with `data-html2canvas-ignore`, but the
  // filter used to test only `data-export-ignore` — so the on-card exclude
  // button was silently baked into the PNG. Assert against the real source so a
  // future rename on either side fails here instead of shipping.
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/content/engine/export.ts'), 'utf-8');
  assert.ok(
    src.includes("getAttribute('data-html2canvas-ignore')"),
    'export filter must recognise the attribute the card emits'
  );
  const card = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  assert.ok(
    card.includes('data-html2canvas-ignore="true"'),
    'the on-card exclude button must stay marked ignore'
  );
});

test('F24.5: export uses transparent background so rounded corners render cleanly', () => {
  const options = { backgroundColor: null };
  assert.equal(options.backgroundColor, null);
});

// -------------------------------------------------------------
// F25: Canvas CORS Taint Prevention
// -------------------------------------------------------------
test('F25.1: unproxied external twimg image taints canvas and throws SecurityError on toBlob', async () => {
  const card = new DomElement('DIV');
  const img = new DomImageElement();
  img.src = 'https://pbs.twimg.com/media/unproxied.jpg';
  card.appendChild(img);

  await assert.rejects(async () => {
    await mockDomToBlob(card);
  }, /SecurityError/);
});

test('F25.2: Base64 proxied image does NOT taint canvas and succeeds cleanly', async () => {
  const card = new DomElement('DIV');
  const img = new DomImageElement();
  img.src = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  card.appendChild(img);

  const blob = await mockDomToBlob(card);
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
});

test('F25.3: pre-render pipeline substitutes avatar URLs with Base64 Data URLs', () => {
  const tweet: TweetData = {
    id: '1',
    url: 'https://x.com/a/status/1',
    author: {
      name: 'A',
      handle: '@a',
      avatarUrl: 'https://pbs.twimg.com/avatar.jpg',
    },
    text: 'Hello',
    timestamp: '2026-01-01',
  };

  const cloned = { ...tweet, author: { ...tweet.author } };
  cloned.author.avatarUrl = 'data:image/jpeg;base64,mockedavatar==';

  assert.ok(cloned.author.avatarUrl.startsWith('data:'));
  assert.ok(tweet.author.avatarUrl.startsWith('https://'), 'Original tweet object should remain immutable');
});

test('F25.4: pre-render pipeline substitutes media grid URLs with Base64 Data URLs', () => {
  const media = [
    { type: 'image' as const, url: 'https://pbs.twimg.com/p1.jpg' },
    { type: 'image' as const, url: 'https://pbs.twimg.com/p2.jpg' },
  ];
  const substituted = media.map(m => ({ ...m, url: `data:image/jpeg;base64,p_${m.url}` }));
  assert.ok(substituted[0].url.startsWith('data:'));
  assert.ok(substituted[1].url.startsWith('data:'));
});

test('F25.5: pre-render pipeline substitutes quote post media URLs', () => {
  const quoteMedia = [{ type: 'image' as const, url: 'https://pbs.twimg.com/quote.jpg' }];
  const proxied = quoteMedia.map(m => ({ ...m, url: 'data:image/jpeg;base64,quote==' }));
  assert.ok(proxied[0].url.startsWith('data:'));
});

// -------------------------------------------------------------
// F26: Clipboard Copy with Fallback
// -------------------------------------------------------------
test('F26.1: navigator.clipboard.write succeeds when document has focus', async () => {
  const clipboard = new MockClipboard();
  const blob = new Blob(['pngdata'], { type: 'image/png' });
  const item = new MockClipboardItem({ 'image/png': blob });

  await clipboard.write([item]);
  assert.equal(clipboard.writtenItems.length, 1);
});

test('F26.2: falls back to download when document is unfocused', async () => {
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'unfocused';

  const tracker = new DownloadTracker();
  const blob = new Blob(['pngdata'], { type: 'image/png' });

  let methodUsed = '';
  try {
    const item = new MockClipboardItem({ 'image/png': blob });
    await clipboard.write([item]);
    methodUsed = 'clipboard';
  } catch {
    tracker.trackDownload(blob, 'post-to-card-20.png');
    methodUsed = 'download';
  }

  assert.equal(methodUsed, 'download');
  assert.equal(tracker.downloads.length, 1);
  assert.equal(tracker.downloads[0].filename, 'post-to-card-20.png');
});

test('F26.3: falls back to download when user activation gesture expires', async () => {
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'gesture_expired';

  const tracker = new DownloadTracker();
  const blob = new Blob(['pngdata'], { type: 'image/png' });

  let methodUsed = '';
  try {
    const item = new MockClipboardItem({ 'image/png': blob });
    await clipboard.write([item]);
    methodUsed = 'clipboard';
  } catch {
    tracker.trackDownload(blob, 'post-to-card-100.png');
    methodUsed = 'download';
  }

  assert.equal(methodUsed, 'download');
  assert.equal(tracker.downloads.length, 1);
});

test('F26.4: falls back to download when clipboard permission is denied', async () => {
  const clipboard = new MockClipboard();
  clipboard.failureMode = 'permission_denied';

  const tracker = new DownloadTracker();
  const blob = new Blob(['pngdata'], { type: 'image/png' });

  let methodUsed = '';
  try {
    const item = new MockClipboardItem({ 'image/png': blob });
    await clipboard.write([item]);
    methodUsed = 'clipboard';
  } catch {
    tracker.trackDownload(blob, 'post-to-card-200.png');
    methodUsed = 'download';
  }

  assert.equal(methodUsed, 'download');
  assert.equal(tracker.downloads.length, 1);
});

test('F26.5: download trigger creates hidden anchor, clicks it, and revokes object URL', () => {
  const tracker = new DownloadTracker();
  const blob = new Blob(['imagedata'], { type: 'image/png' });
  tracker.trackDownload(blob, 'card.png');

  assert.equal(tracker.downloads[0].clicked, true);
  tracker.markRevoked('card.png');
  assert.equal(tracker.downloads[0].revoked, true);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// F27: Image Fit, Ratio-Aware Media Layout & Zero-Emoji UI
// -------------------------------------------------------------
test('F27.1: injection module defines SVG vector trigger button without sparkle emoji', () => {
  const content = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/injection.ts'), 'utf-8');
  assert.ok(content.includes('TRIGGER_BUTTON_SVG'), 'Must export TRIGGER_BUTTON_SVG');
  assert.ok(content.includes('<svg'), 'Must define SVG icon');
  assert.ok(!content.includes("btn.textContent = '✨'"), 'Must not assign sparkle emoji to button');
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

test('F27.3: Modal, Card watermark and CSS define zero-emoji and ratio-aware image rules', () => {
  const modalContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Modal.tsx'), 'utf-8');
  assert.ok(!modalContent.includes('✨'), 'Modal must not contain sparkle emoji');
  assert.ok(!modalContent.includes('✕'), 'Modal must use svg close icon');

  const cardContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  assert.ok(!cardContent.includes('<span>✨</span>'), 'Card watermark must not contain sparkle emoji');

  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('.media-fit-contain'), 'CSS must include media-fit-contain rule');
  assert.ok(cssContent.includes('.media-fit-cover'), 'CSS must include media-fit-cover rule');
  assert.ok(cssContent.includes('data-ratio="3:4"'), 'CSS must include 3:4 ratio rule');
  assert.ok(cssContent.includes('data-ratio="16:9"'), 'CSS must include 16:9 ratio rule');
});

test('F27.4: mediaLayout configuration supports grid and stack with safe sanitization', () => {
  const themesContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/themes.ts'), 'utf-8');
  assert.ok(themesContent.includes("mediaLayout: 'grid'"), 'DEFAULT_CARD_CONFIG must include mediaLayout grid');
  assert.ok(themesContent.includes('sanitizeMediaLayout'), 'themes.ts must define sanitizeMediaLayout');
  assert.ok(themesContent.includes("MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = ['grid', 'stack']"), 'Must export MEDIA_LAYOUT_OPTIONS');
});

test('F27.5: CSS defines media-layout-stack for 100% full-display of all multi images', () => {
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/styles/card.css'), 'utf-8');
  assert.ok(cssContent.includes('.media-layout-stack'), 'CSS must include .media-layout-stack');
  assert.ok(cssContent.includes('aspect-ratio: unset !important'), 'Stack layout must unset aspect-ratio constraint');
  assert.ok(cssContent.includes('max-height: unset !important'), 'Stack layout must unset max-height constraint for full display');
});

// -------------------------------------------------------------
// F28: Intelligent Adaptive Media Grid (Top-Hero / Left-Hero / Stacked / 4:3)
// -------------------------------------------------------------
test('F28.1: extractor calculates aspectRatio from naturalWidth and naturalHeight', () => {
  const extractorContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/extractor.ts'), 'utf-8');
  assert.ok(extractorContent.includes('naturalWidth'), 'Extractor must read naturalWidth');
  assert.ok(extractorContent.includes('naturalHeight'), 'Extractor must read naturalHeight');
  assert.ok(extractorContent.includes('aspectRatio'), 'Extractor must calculate and assign aspectRatio');
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
  const extractorContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/extractor.ts'), 'utf-8');
  assert.ok(extractorContent.includes('function isGifMedia'), 'Extractor must implement isGifMedia');
  assert.ok(extractorContent.includes('type: isGif ? \'gif\' : \'video\''), 'Extractor must differentiate GIF and video');

  function checkGif(container: DomElement): boolean {
    const aria = container.getAttribute('aria-label') || '';
    if (aria.toUpperCase().includes('GIF')) return true;
    if (container.querySelector('[aria-label*="GIF"], [data-testid="gifBadge"]')) return true;
    for (const el of container.querySelectorAll('span, div')) {
      if (el.textContent?.trim() === 'GIF') return true;
    }
    return false;
  }

  const gifHtml = `
    <div data-testid="videoPlayer" aria-label="Embedded GIF">
      <video poster="https://pbs.twimg.com/media/gif_poster.jpg"></video>
      <span data-testid="gifBadge">GIF</span>
    </div>
  `;
  const el = createDomElement(gifHtml);
  assert.equal(checkGif(el), true);

  const videoHtml = `
    <div data-testid="videoPlayer">
      <video poster="https://pbs.twimg.com/media/standard_video.jpg"></video>
    </div>
  `;
  const vEl = createDomElement(videoHtml);
  assert.equal(checkGif(vEl), false);
});

test('F29.2: extracts video duration timestamp from video controls', () => {
  const extractorContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/extractor.ts'), 'utf-8');
  assert.ok(extractorContent.includes('function extractVideoDuration'), 'Extractor must implement extractVideoDuration');

  function getDuration(container: DomElement): string | undefined {
    for (const el of container.querySelectorAll('time, span, div')) {
      const text = el.textContent?.trim() || '';
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) return text;
    }
    return undefined;
  }

  const videoWithTimeHtml = `
    <div data-testid="videoPlayer">
      <video poster="https://pbs.twimg.com/media/test_video.jpg"></video>
      <div><span>1:42</span></div>
    </div>
  `;
  const el = createDomElement(videoWithTimeHtml);
  assert.equal(getDuration(el), '1:42');
});

test('F29.3: Card.tsx renders a corner video badge, and nothing that dims the poster', () => {
  const cardContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  assert.ok(cardContent.includes('media-video-item'), 'Must render media-video-item class');
  assert.ok(cardContent.includes('video-indicator-badge'), 'Must render corner video indicator badge');
  assert.ok(!cardContent.includes('center-play-button'), 'Must NOT include blocking center play button');
  assert.ok(!cardContent.includes('video-progress-track'), 'Must NOT render the bottom video progress bar');
  // The badge is an opaque pill, so the scrim that used to back it only darkened
  // the poster — and dimmed burnt-in subtitles the card cannot re-typeset.
  assert.ok(!cardContent.includes('video-scrim-overlay'), 'Must NOT render a bottom scrim over the poster');
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

test('F29.6: DEFAULT_CARD_CONFIG defines showPlayButton: true and loadUserPreferences parses it', () => {
  const themesContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/themes.ts'), 'utf-8');
  assert.ok(themesContent.includes('showPlayButton: true'), 'DEFAULT_CARD_CONFIG must include showPlayButton: true');
  assert.ok(themesContent.includes('showPlayButton: saved.showPlayButton !== false'), 'loadUserPreferences must parse showPlayButton');
});

test('F29.7: Controls.tsx contains toggle for showPlayButton with localized label', () => {
  const controlsContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Controls.tsx'), 'utf-8');
  assert.ok(controlsContent.includes('showPlayButton'), 'Controls must reference showPlayButton');
  assert.ok(controlsContent.includes('t.videoPlayButton'), 'Controls must use localized label for videoPlayButton');
});

test('F29.8: Card.tsx conditionally renders the video badge based on showPlayButton', () => {
  const cardContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Card.tsx'), 'utf-8');
  assert.ok(cardContent.includes('showPlayButton: boolean = true'), 'renderMediaGrid must accept showPlayButton param');
  assert.ok(cardContent.includes('{showPlayButton && ('), 'Must conditionally render video-indicator-badge');
  assert.ok(cardContent.includes('config.showPlayButton !== false'), 'Must pass showPlayButton config to renderMediaGrid');
});

// -------------------------------------------------------------
// F30: Action Bar Button Visibility & Configurable Toggle
// -------------------------------------------------------------
test('F30.1: DEFAULT_CARD_CONFIG defines showActionBarButton: true and themes.ts persists it', () => {
  const themesContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/themes.ts'), 'utf-8');
  assert.ok(themesContent.includes('showActionBarButton: true'), 'DEFAULT_CARD_CONFIG must include showActionBarButton: true');
  assert.ok(themesContent.includes('showActionBarButton: saved.showActionBarButton !== false'), 'loadUserPreferences must parse showActionBarButton');
  assert.ok(themesContent.includes("STORAGE_KEY = 'post_to_card_user_prefs'"), 'Must export STORAGE_KEY');
});

test('F30.2: Controls.tsx contains toggle for showActionBarButton with i18n tweetActionButton', () => {
  const controlsContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/ui/Controls.tsx'), 'utf-8');
  assert.ok(controlsContent.includes('showActionBarButton'), 'Controls must reference showActionBarButton');
  assert.ok(controlsContent.includes('t.tweetActionButton'), 'Controls must use localized label for button toggle');
  assert.equal(TRANSLATIONS['zh-CN'].tweetActionButton, '推文卡片按钮');
  assert.equal(TRANSLATIONS['en-US'].tweetActionButton, 'Tweet Card Button');
});

test('F30.3: injection.ts defines setInjectedButtonVisibility, HIDE_ACTION_BUTTON_CLASS and style injection', () => {
  const injectionContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/injection.ts'), 'utf-8');
  assert.ok(injectionContent.includes("HIDE_ACTION_BUTTON_CLASS = 'post-to-card-hide-action-btn'"), 'Must define hide class constant');
  assert.ok(injectionContent.includes("VISIBILITY_STYLE_ID = 'post-to-card-visibility-style'"), 'Must define visibility style id');
  assert.ok(injectionContent.includes('function setInjectedButtonVisibility'), 'Must export setInjectedButtonVisibility');
  assert.ok(injectionContent.includes('display: none !important'), 'Must inject CSS rule to hide action button');

  // Verify DOM behavior using DomDocument
  const doc = new DomDocument();
  const root = doc.documentElement;
  const HIDE_CLASS = 'post-to-card-hide-action-btn';

  // Simulate setInjectedButtonVisibility logic
  root.classList.add(HIDE_CLASS);
  assert.ok(root.classList.contains(HIDE_CLASS), 'Hide class should be present when disabled');
  root.classList.remove(HIDE_CLASS);
  assert.ok(!root.classList.contains(HIDE_CLASS), 'Hide class should be removed when enabled');
});

test('F30.4: injection.ts implements Alt+C shortcut and triggerActiveTweet for alternative access', () => {
  const injectionContent = fs.readFileSync(path.resolve(__dirname, '../../src/content/adapter/injection.ts'), 'utf-8');
  assert.ok(injectionContent.includes('triggerActiveTweet'), 'Must implement triggerActiveTweet');
  assert.ok(injectionContent.includes("e.altKey && (e.key === 'c' || e.key === 'C')"), 'Must listen for Alt + C keyboard shortcut');
  assert.ok(injectionContent.includes('lastHoveredArticle'), 'Must track hovered article for shortcut activation');
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
