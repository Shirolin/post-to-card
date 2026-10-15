/**
 * Tier 3 Test Suite: Cross-Feature Interactions
 *
 * Every claim here runs through the shipped module it names: the real `Card`, the
 * real token resolvers, the real export bridge, the real preference store. The
 * previous revision built its own objects and asserted them back, so no production
 * regression could fail it — the kind of pass-through facade TEST_INFRA.md's
 * zero-tautology rule forbids. The combinations are where features meet, so the
 * card is the only thing that can answer what a combination renders.
 */

import assert from 'node:assert/strict';

import { DomElement, DomImageElement } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { cardRenderer } from '../env/render.ts';
import { createSuite } from '../env/harness.ts';

import {
  THEMES,
  THEME_ORDER,
  PADDING_OPTIONS,
  RADIUS_OPTIONS,
  resolveRadius,
  getAspectMinHeight,
  DEFAULT_CARD_CONFIG,
} from '../../src/content/ui/themes.ts';
import { replaceCardImagesWithBase64 } from '../../src/content/engine/export.ts';
import { isAllowedHost } from '../../src/background/proxy.ts';
import { loadUserPreferences, saveUserPreferences } from '../../src/content/prefs.ts';

import type { TweetData, ThreadData } from '../../src/types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption } from '../../src/types/card.ts';
import type { Locale } from '../../src/content/i18n.ts';

const { test, run } = createSuite();

// -------------------------------------------------------------
// The card under test
// -------------------------------------------------------------

/** Production's default with the theme swapped for the one this tier's claims
 * are about, and the locale pinned so the copy does not follow the machine. */
const BASE_CONFIG: CardConfig = { ...DEFAULT_CARD_CONFIG, theme: 'gallery', locale: 'en-US' };

const TWEET: TweetData = {
  id: '30001',
  url: 'https://x.com/ada/status/30001',
  author: {
    name: 'Ada 🚀',
    handle: '@ada',
    avatarUrl: 'https://pbs.twimg.com/profile_images/1/avatar_400x400.jpg',
    verified: true,
  },
  text: 'Thread 1/2: breaking down the architecture 🔥✨',
  timestamp: '2026-07-20T14:00:00.000Z',
  stats: { replies: '120', reposts: '450', likes: '3.2K', views: '150K' },
  media: [1, 2, 3, 4].map((n) => ({
    type: 'image' as const,
    url: `https://pbs.twimg.com/media/shot_${n}.jpg?name=large`,
  })),
};

const renderCard = cardRenderer(BASE_CONFIG, TWEET);

/** The card's own root element, as rendered — attributes and inline style. */
function rootTag(html: string): string {
  const end = html.indexOf('>');
  assert.ok(end > 0 && html.startsWith('<div'), `card markup does not start with an element: ${html.slice(0, 60)}`);
  return html.slice(0, end + 1);
}

function styleAttr(html: string): string {
  // Anchored on the whitespace so it cannot match `data-quote-style="outlined"`,
  // which also ends in `style="`.
  const match = /\sstyle="([^"]*)"/.exec(rootTag(html));
  assert.ok(match, 'the card root carries no style attribute');
  return match![1];
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

// -------------------------------------------------------------
// Interaction 1: Combinatorial Matrix of Themes, Padding, Radius, and Ratios
// -------------------------------------------------------------

test('Tier 3.1: every material renders its own data-theme and injects that material\'s accent', async () => {
  assert.ok(THEME_ORDER.length >= 11, 'the resident material set shrank unexpectedly');

  for (const theme of THEME_ORDER) {
    const html = await renderCard({ config: { theme } });
    assert.equal(
      attribute(rootTag(html), 'data-theme'),
      theme,
      `Card must carry data-theme="${theme}" — card.css keys on the attribute, not a class`
    );
    assert.ok(
      styleAttr(html).includes(`--accent:${THEMES[theme].tokens.accent}`),
      `${theme} rendered without its own accent token (${THEMES[theme].tokens.accent})`
    );
  }
});

test('Tier 3.2: every padding option reaches the root as both attribute and inline padding', async () => {
  for (const padding of PADDING_OPTIONS) {
    const html = await renderCard({ config: { padding } });
    assert.equal(attribute(rootTag(html), 'data-padding'), padding);
    assert.ok(
      styleAttr(html).includes(`padding:${padding}`),
      `${padding} did not reach the root's inline padding`
    );
  }
});

test('Tier 3.3: every radius option resolves through resolveRadius and lands on the card and the media', async () => {
  for (const borderRadius of RADIUS_OPTIONS) {
    const theme: ThemeId = 'gallery';
    const expected = resolveRadius(borderRadius, theme);
    const html = await renderCard({ config: { borderRadius, theme } });
    const style = styleAttr(html);

    assert.equal(attribute(rootTag(html), 'data-radius'), borderRadius);
    assert.ok(
      style.includes(`border-radius:${expected.card}`),
      `${borderRadius} rendered border-radius ${expected.card} was expected, style was: ${style.slice(0, 80)}`
    );
    assert.ok(
      style.includes(`--media-radius:${expected.media}`),
      `${borderRadius} left --media-radius off the media step resolveRadius returns (${expected.media})`
    );
  }
});

test('Tier 3.4: the full material x padding x radius matrix renders every combination', async () => {
  const rendered: string[] = [];

  for (const theme of THEME_ORDER) {
    for (const padding of PADDING_OPTIONS) {
      for (const borderRadius of RADIUS_OPTIONS) {
        const html = await renderCard({ config: { theme, padding, borderRadius } });
        const tag = rootTag(html);

        assert.equal(attribute(tag, 'data-theme'), theme, `${theme}/${padding}/${borderRadius}: wrong data-theme`);
        assert.equal(attribute(tag, 'data-padding'), padding, `${theme}/${padding}/${borderRadius}: wrong data-padding`);
        assert.equal(attribute(tag, 'data-radius'), borderRadius, `${theme}/${padding}/${borderRadius}: wrong data-radius`);

        // The combination has to survive to the style, not only to the attribute.
        const style = styleAttr(html);
        const radius = resolveRadius(borderRadius, theme);
        assert.ok(style.includes(`padding:${padding}`), `${theme}/${padding}/${borderRadius}: padding lost`);
        assert.ok(style.includes(`border-radius:${radius.card}`), `${theme}/${padding}/${borderRadius}: radius lost`);

        rendered.push(tag);
      }
    }
  }

  const expected = THEME_ORDER.length * PADDING_OPTIONS.length * RADIUS_OPTIONS.length;
  assert.equal(rendered.length, expected);
});

// -------------------------------------------------------------
// Interaction 2: Mega-Card Composite (Thread + Quote + Media + Emojis)
// -------------------------------------------------------------

const QUOTE: NonNullable<TweetData['quotePost']> = {
  author: {
    name: 'Bo',
    handle: '@bo',
    avatarUrl: 'https://pbs.twimg.com/profile_images/2/bo_400x400.jpg',
  },
  text: 'Original benchmark results: 99.8% accuracy.',
  timestamp: '2026-07-20T12:00:00.000Z',
  media: [{ type: 'image', url: 'https://pbs.twimg.com/media/quoted.jpg?name=large' }],
};

const MEGA_THREAD: ThreadData = {
  author: TWEET.author,
  tweets: [
    { ...TWEET, quotePost: QUOTE, isThreadPart: true, threadIndex: 0, threadTotal: 2 },
    {
      ...TWEET,
      id: '30002',
      url: 'https://x.com/ada/status/30002',
      text: 'Thread 2/2: the follow-up',
      media: [TWEET.media![0]],
      isThreadPart: true,
      threadIndex: 1,
      threadTotal: 2,
    },
  ],
  isSingle: false,
  targetTweetIndex: 0,
};

test('Tier 3.5: a thread carrying a quote, a four-photo grid and emoji renders every part at once', async () => {
  const html = await renderCard({ data: MEGA_THREAD });

  // 4 photos + the quote's 1 + the second post's 1.
  assert.equal((html.match(/class="media-box"/g) || []).length, 6, 'media boxes went missing');
  assert.equal((html.match(/class="quote-card"/g) || []).length, 1, 'the quote box went missing');
  assert.equal(
    (html.match(/class="thread-connector-line"/g) || []).length,
    1,
    'a two-post thread draws exactly one connector'
  );
  assert.ok(html.includes('🔥') && html.includes('✨'), 'emoji did not survive into the markup');
  assert.ok(html.includes('Original benchmark results'), 'the quote body went missing');
});

// -------------------------------------------------------------
// Interaction 3: QR Code with Author Blur and Custom Theme
// -------------------------------------------------------------

test('Tier 3.6: the privacy blur lands on the author block only, never on the QR code', async () => {
  const html = await renderCard({ config: { blurAuthor: true, showQrCode: true, theme: 'darkroom' } });

  const blurred = [...html.matchAll(/class="([^"]*\bis-blurred\b[^"]*)"/g)].map((m) => m[1]);
  assert.ok(blurred.length >= 3, 'blurring the author left nothing blurred');

  // The blur is only ever allowed to land on the author's own elements, so the
  // QR — which is not one of them — cannot inherit it. Asserting the allow-list
  // rather than a coordinate keeps this true however the footer is rearranged.
  const blurrable = ['author-header', 'author-avatar', 'author-avatar-img', 'author-name', 'author-handle'];
  for (const classes of blurred) {
    const names = classes.split(/\s+/);
    assert.ok(
      names.some((n) => blurrable.includes(n)),
      `the privacy blur landed on "${classes}", which is not part of the author block`
    );
  }

  assert.ok(html.includes('class="card-qr-container'), 'the QR code did not render');
  assert.ok(html.includes('card-qr-svg'), 'the QR code rendered without its vector');
});

// -------------------------------------------------------------
// Interaction 4: Downward Fluid Expansion Across Ratios
// -------------------------------------------------------------

test('Tier 3.7: 3:4 sets a min-height floor and leaves the card free to grow past it', async () => {
  const floor = getAspectMinHeight('3:4', 640);
  assert.equal(floor, '853px');

  const html = await renderCard({ config: { aspectRatio: '3:4' }, data: MEGA_THREAD });
  const style = styleAttr(html);

  assert.equal(attribute(rootTag(html), 'data-ratio'), '3:4');
  assert.ok(style.includes(`min-height:${floor}`), 'the 3:4 floor did not reach the card');
  // A floor, not a fixed height: a long thread has to expand rather than clip.
  assert.ok(style.includes('height:auto'), 'the card was given a fixed height, which would clip long text');
  assert.ok(style.includes('overflow:visible'), 'the card clips its own overflow');
});

test('Tier 3.8: 16:9 sets its own floor and keeps the same freedom to expand', async () => {
  const floor = getAspectMinHeight('16:9', 640);
  assert.equal(floor, '360px');

  const html = await renderCard({ config: { aspectRatio: '16:9' }, data: MEGA_THREAD });
  const style = styleAttr(html);

  assert.equal(attribute(rootTag(html), 'data-ratio'), '16:9');
  assert.ok(style.includes(`min-height:${floor}`));
  assert.ok(style.includes('height:auto'));
  assert.ok(style.includes('overflow:visible'));
});

// -------------------------------------------------------------
// Interaction 5: The card's own images are all proxyable
// -------------------------------------------------------------

test('Tier 3.9: every image the card paints is one the background proxy is allowed to fetch', async () => {
  const html = await renderCard({ data: MEGA_THREAD });
  const srcs =[...html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1]);

  assert.ok(srcs.length >= 6, `expected the card to paint its avatars and media, saw ${srcs.length} images`);

  // The chain this covers: the extractor upgrades a twimg URL, the card paints it,
  // the export bridge asks the background to fetch it, and `isAllowedHost` decides.
  // A media host the extractor starts emitting but the proxy does not allow fails
  // here rather than at export time on a real page.
  const remote = srcs.filter((src) => !src.startsWith('data:') && !src.startsWith('blob:'));
  assert.ok(remote.length >= 6, 'the card fell back to placeholders for images it should have painted');
  for (const src of remote) {
    assert.ok(isAllowedHost(src), `the card painted ${src}, which the background proxy would refuse to fetch`);
  }

  // And the bridge really does clean them: same DOM, real replacement.
  const card = new DomElement('DIV');
  const images = remote.map((src) => {
    const img = new DomImageElement();
    img.src = src;
    card.appendChild(img);
    return img;
  });

  const chromeMock = createChromeMock();
  chromeMock.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
    if (msg.type === 'FETCH_IMAGE_BASE64') {
      sendResponse({ success: true, dataUrl: `data:image/jpeg;base64,proxied_${Buffer.from(msg.url).toString('base64')}`, contentType: 'image/jpeg' });
      return true;
    }
  });

  const originalChrome = (globalThis as Record<string, unknown>).chrome;
  (globalThis as Record<string, unknown>).chrome = chromeMock;
  try {
    const restore = await replaceCardImagesWithBase64(card as unknown as HTMLElement);
    images.forEach((img, i) => {
      assert.ok(img.src.startsWith('data:image/jpeg;base64,proxied_'), `image ${i} was left un-proxied: ${img.src}`);
    });

    restore();
    images.forEach((img, i) => assert.equal(img.src, remote[i], `image ${i} was not restored`));
  } finally {
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  }
});

// -------------------------------------------------------------
// Interaction 6: User Preferences Persistence & Modal Rehydration
// -------------------------------------------------------------

test('Tier 3.10: preferences saved through the store come back sanitized on the next launch', async () => {
  const chromeMock = createChromeMock();
  const originalChrome = (globalThis as Record<string, unknown>).chrome;
  (globalThis as Record<string, unknown>).chrome = chromeMock;

  try {
    // A stored value can be anything an older build wrote, so the round trip is
    // also where the sanitizers are exercised — an unvalidated theme id would
    // reach `THEMES[id].tokens` and take the card down.
    const saved: CardConfig = {
      ...BASE_CONFIG,
      theme: 'oled-black' as ThemeId,
      padding: '999px' as PaddingOption,
      borderRadius: '7px' as RadiusOption,
      aspectRatio: '3:4',
      showStats: false,
      blurAuthor: true,
    };

    await saveUserPreferences(saved);
    const restored = await loadUserPreferences();

    assert.equal(restored.theme, 'darkroom', 'a retired theme id must map to a live material, not reset');
    assert.equal(restored.padding, '32px', 'an unknown padding must fall back to the default');
    assert.equal(restored.borderRadius, '12px', 'an unknown radius must fall back to the default');
    assert.equal(restored.aspectRatio, '3:4', 'a valid choice must survive the round trip');
    assert.equal(restored.showStats, false);
    assert.equal(restored.blurAuthor, true);

    // The locale is the one field whose default is not a constant: it follows
    // the machine's language, so a test that saved a fixed value could agree
    // with a mutation that ignored the stored one. Both directions are pinned
    // against whatever this machine's default turns out to be.
    const otherLocale: Locale = DEFAULT_CARD_CONFIG.locale === 'zh-CN' ? 'en-US' : 'zh-CN';
    await saveUserPreferences({ ...DEFAULT_CARD_CONFIG, locale: otherLocale });
    assert.equal(
      (await loadUserPreferences()).locale,
      otherLocale,
      'a stored locale must survive, not be replaced by the machine default'
    );

    await saveUserPreferences({ ...DEFAULT_CARD_CONFIG, locale: 'klingon' as Locale });
    assert.equal(
      (await loadUserPreferences()).locale,
      DEFAULT_CARD_CONFIG.locale,
      'and an unrecognised one degrades to the default'
    );

    // And the restored config is one the card can actually render.
    const html = await renderCard({ config: restored });
    assert.equal(attribute(rootTag(html), 'data-theme'), 'darkroom');
  } finally {
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  }
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 3
// -------------------------------------------------------------
export function runTier3() {
  return run();
}
