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

import { DomElement, DomDocument, DomImageElement, DomShadowRoot } from '../env/browser.ts';
import { createChromeMock } from '../env/chrome.ts';
import { cardRenderer, loadModule } from '../env/render.ts';
import { createSuite } from '../env/harness.ts';

import {
  THEMES,
  THEME_ORDER,
  resolveRadius,
  DEFAULT_CARD_CONFIG,
} from '../../src/content/ui/themes.ts';
import { PADDING, RADIUS } from '../../src/content/ui/options.ts';
import { aspectMinHeight, CARD_WIDTH } from '../../src/content/ui/geometry.ts';
import { prepareCardImages } from '../../src/content/engine/export.ts';
import { isAllowedHost } from '../../src/background/proxy.ts';
import { loadUserPreferences, saveUserPreferences, subscribePreferences, lastKnownPreferences } from '../../src/content/prefs.ts';
import { TRANSLATIONS } from '../../src/content/i18n.ts';

import type { TweetData, ThreadData } from '../../src/types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, CanvasRatioOption, CanvasBackgroundId } from '../../src/types/card.ts';
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

/**
 * The card's own root element, as rendered — attributes and inline style.
 *
 * Found by its class rather than taken as the first tag: the outermost element
 * is now the mat the card is mounted on, and the mat carries the export id and
 * an inline style of its own, so "the first tag" would answer with the picture
 * instead of the card.
 */
function rootTag(html: string): string {
  const at = html.indexOf('<div class="post-to-card-target');
  assert.ok(at >= 0, `the card root is not in the rendered markup: ${html.slice(0, 60)}`);
  const end = html.indexOf('>', at);
  return html.slice(at, end + 1);
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
  for (const padding of PADDING.values) {
    const html = await renderCard({ config: { padding } });
    assert.equal(attribute(rootTag(html), 'data-padding'), padding);
    assert.ok(
      styleAttr(html).includes(`padding:${padding}`),
      `${padding} did not reach the root's inline padding`
    );
  }
});

test('Tier 3.3: every radius option resolves through resolveRadius and lands on the card and the media', async () => {
  for (const borderRadius of RADIUS.values) {
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
    for (const padding of PADDING.values) {
      for (const borderRadius of RADIUS.values) {
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

  const expected = THEME_ORDER.length * PADDING.values.length * RADIUS.values.length;
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
  const floor = aspectMinHeight('3:4', CARD_WIDTH);
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
  const floor = aspectMinHeight('16:9', CARD_WIDTH);
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
    const preparation = await prepareCardImages(card as unknown as HTMLElement);
    images.forEach((img, i) => {
      assert.ok(img.src.startsWith('data:image/jpeg;base64,proxied_'), `image ${i} was left un-proxied: ${img.src}`);
    });

    preparation.restore();
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
      canvasRatio: '21:9' as CanvasRatioOption,
      canvasBackground: 'plaid' as CanvasBackgroundId,
    };

    await saveUserPreferences(saved);
    const restored = await loadUserPreferences();

    assert.equal(restored.theme, 'darkroom', 'a retired theme id must map to a live material, not reset');
    assert.equal(restored.padding, DEFAULT_CARD_CONFIG.padding, 'an unknown padding must fall back to the default');
    assert.equal(
      restored.borderRadius,
      DEFAULT_CARD_CONFIG.borderRadius,
      'an unknown radius must fall back to the default'
    );
    assert.equal(restored.aspectRatio, '3:4', 'a valid choice must survive the round trip');
    assert.equal(restored.showStats, false);
    assert.equal(restored.blurAuthor, true);

    // The canvas pair is the newest, and an option whose fallback differs from
    // `DEFAULT_CARD_CONFIG` is the exact shape of the bug that once rewrote a
    // saved radius on every load. Asserting both the fallback and the survival
    // pins that pairing, not just the field.
    assert.equal(restored.canvasRatio, DEFAULT_CARD_CONFIG.canvasRatio);
    assert.equal(restored.canvasBackground, DEFAULT_CARD_CONFIG.canvasBackground);

    await saveUserPreferences({ ...DEFAULT_CARD_CONFIG, canvasRatio: '4:5', canvasBackground: 'plum' });
    assert.equal((await loadUserPreferences()).canvasRatio, '4:5');
    assert.equal((await loadUserPreferences()).canvasBackground, 'plum');

    // The locale's default is `'auto'` -- "follow the browser" -- and the field
    // is the one in this table whose default is not a language. What has to
    // survive a save/load round trip is the *preference*, not a resolution of
    // it: writing `'auto'` and reading back a concrete language would pin what
    // the user asked to keep following.
    assert.equal(
      (await loadUserPreferences()).locale,
      'auto',
      'the shipped default must stay "follow the browser" across a load'
    );

    for (const pinned of ['zh-TW', 'ja', 'pt-BR'] as const) {
      await saveUserPreferences({ ...DEFAULT_CARD_CONFIG, locale: pinned });
      assert.equal(
        (await loadUserPreferences()).locale,
        pinned,
        `a stored locale (${pinned}) must survive, not be replaced by the machine default`
      );
    }

    // An unrecognised value is the user's data too, but there is nothing to
    // draw it with: it degrades to following the browser rather than to English,
    // which is what it meant before it was corrupted.
    await saveUserPreferences({ ...DEFAULT_CARD_CONFIG, locale: 'klingon' as Locale });
    assert.equal(
      (await loadUserPreferences()).locale,
      'auto',
      'an unrecognised preference degrades to "follow the browser"'
    );

    // And the restored config is one the card can actually render.
    const html = await renderCard({ config: restored });
    assert.equal(attribute(rootTag(html), 'data-theme'), 'darkroom');
  } finally {
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  }
});

// -------------------------------------------------------------
// Interaction 7: Per-post author privacy, driven through the real modal
//
// The card's avatar is a control, and everything about it -- the override that
// gets stored, the row chip that clears it, the hint bar -- lives in the mount,
// not in the renderer. So these drive `openCardModal` and read the shadow root
// and the store, rather than rendering a string and asserting it back.
// -------------------------------------------------------------

/** A two-post thread with two different authors, so the two can be told apart. */
const PRIVACY_THREAD: ThreadData = {
  author: { name: 'first author', handle: '@first' },
  isSingle: false,
  targetTweetIndex: 0,
  tweets: [
    { id: '94001', url: 'https://x.com/first/status/94001', author: { name: 'first author', handle: '@first' }, text: 'one' },
    { id: '94002', url: 'https://x.com/second/status/94002', author: { name: 'second author', handle: '@second' }, text: 'two' },
  ],
};

/**
 * Runs `body` with the fake storage in place and the modal open on `thread`.
 *
 * The modal's DOM lives in the test shim (`DomElement`), which is not
 * `HTMLElement`; the shim has the two methods these tests press and read, and a
 * cast is the ordinary price of querying it.
 */
async function withPrivacyModal(
  thread: ThreadData,
  config: Record<string, unknown>,
  body: (env: {
    shadow: any;
    stored: () => Promise<Record<string, any>>;
    cards: () => any[];
  }) => Promise<void>,
  options: {
    /**
     * How long the stored read takes to answer, in ms. Zero answers in the same
     * task, which is what every other test wants; a slow answer is how a test
     * inspects the frame before the preferences exist.
     */
    readDelayMs?: number;
    /** The window the modal is laid out in. 1200 is the wide default. */
    innerWidth?: number;
  } = {}
): Promise<void> {
  const { readDelayMs = 0, innerWidth = 1200 } = options;
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;
  const chromeMock = createChromeMock();
  await chromeMock.storage.local.set({
    post_to_card_user_prefs: { ...BASE_CONFIG, ...config },
  });
  chromeMock.storage.local.readDelayMs = readDelayMs;
  scope.chrome = chromeMock;

  const any = (globalThis as Record<string, any>);
  const saved = {
    document: any.document,
    window: any.window,
    HTMLElement: any.HTMLElement,
    customElements: any.customElements,
    ShadowRoot: any.ShadowRoot,
  };
  const doc = new DomDocument();
  any.document = doc;
  any.HTMLElement = DomElement;
  any.customElements = doc.customElements;
  any.ShadowRoot = DomShadowRoot;
  any.window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    location: { origin: 'https://x.com', pathname: '/' },
    innerWidth,
    scrollY: 0,
    scrollTo() {},
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0' },
  };

  let closeCardModal: (() => void) | null = null;
  try {
    const { openCardModal: open, closeCardModal: close } = await loadModule('/src/content/container/element.ts');
    closeCardModal = close;
    const container = open(thread);
    // The mount reads its preferences from storage in a later task.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const shadow = container.shadow as any;
    await body({
      shadow,
      stored: async () => (await chromeMock.storage.local.get('post_to_card_user_prefs')).post_to_card_user_prefs,
      cards: () => [
        ...(Array.from(shadow.querySelectorAll('.author-avatar')) as any[]),
        ...(Array.from(shadow.querySelectorAll('.quote-avatar')) as any[]),
      ],
    });
  } finally {
    // The dialog holds a scroll lock for as long as it is mounted, and the lock
    // is module state shared with every later mount -- a card left open here
    // would make the next test's lock a no-op.
    closeCardModal?.();
    any.document = saved.document;
    any.window = saved.window;
    any.HTMLElement = saved.HTMLElement;
    any.customElements = saved.customElements;
    any.ShadowRoot = saved.ShadowRoot;
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
}

/** The portrait of a post, a quoted one included. */
function portraitOf(cards: any[], name: string): any {
  return cards.find((node) => {
    const image = node.tagName === 'IMG' ? node : node.querySelector('img');
    return image?.getAttribute('alt') === name;
  });
}

/** Lets Preact flush the render an event started. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));

test('Tier 3.11: an avatar is a switch for one post, and the override follows the click', async () => {
  await withPrivacyModal(PRIVACY_THREAD, { blurAuthor: false }, async ({ cards, stored }) => {
    const first = portraitOf(cards(), 'first author');
    const second = portraitOf(cards(), 'second author');
    assert.ok(first && second, 'both posts have a portrait to click');
    assert.equal(first.tagName, 'BUTTON', 'the portrait is the control');
    assert.equal(first.getAttribute('aria-pressed'), 'false');
    assert.equal(second.getAttribute('aria-pressed'), 'false');

    first.click();
    await settle();

    assert.equal((await stored()).authorBlurOverrides['94001'], 'blur', 'the click was written down for that post');
    assert.equal(portraitOf(cards(), 'first author').getAttribute('aria-pressed'), 'true');
    assert.equal(portraitOf(cards(), 'first author').className.includes('is-blurred'), true,
      'and the card draws that author hidden');
    assert.equal(portraitOf(cards(), 'second author').getAttribute('aria-pressed'), 'false',
      'while the other post is untouched');
    assert.ok(!portraitOf(cards(), 'second author').className.includes('is-blurred'));

    // The label describes what the click will do, from the state on screen.
    assert.equal(
      portraitOf(cards(), 'first author').getAttribute('aria-label'),
      TRANSLATIONS['en-US'].authorBlurToggleOff,
      'a hidden author gets the "show" label'
    );

    // The second click is the opposite of what is on screen, written as an
    // override too -- not a return to "follow", so the answer is the same
    // whenever the global switch moves.
    portraitOf(cards(), 'first author').click();
    await settle();
    assert.equal((await stored()).authorBlurOverrides['94001'], 'clear',
      'clicking again states "shown" rather than dropping the entry');
    assert.equal(portraitOf(cards(), 'first author').getAttribute('aria-pressed'), 'false');
    assert.ok(!portraitOf(cards(), 'first author').className.includes('is-blurred'));
  });
});

test('Tier 3.12: the row chip drops the override, and "follow global" honors the switch', async () => {
  await withPrivacyModal(
    PRIVACY_THREAD,
    { blurAuthor: true, authorBlurOverrides: { '94001': 'clear' } },
    async ({ shadow, cards, stored }) => {
      // Loaded from storage: the first post is sharp although the switch is on.
      assert.equal(portraitOf(cards(), 'first author').getAttribute('aria-pressed'), 'false');
      assert.equal(portraitOf(cards(), 'second author').getAttribute('aria-pressed'), 'true');

      // The row's chip appears only for the post that has an override.
      const chips = Array.from(shadow.querySelectorAll('.tweet-manager-follow')) as any[];
      const visible = chips.filter((chip) => !chip.hasAttribute('hidden'));
      assert.equal(visible.length, 1, 'exactly one post has something to go back to');

      // "Follow global" must mean the switch, not "everything sharp": with the
      // switch on, pressing it leaves both authors hidden. Computing it from
      // what was on screen would have sharpened the card one post at a time.
      const hintAction = shadow.querySelector('.author-blur-hint-action') as any;
      assert.ok(hintAction, 'the hint bar offers the way back');
      hintAction.click();
      await settle();

      assert.deepEqual(await stored().then((s: any) => s.authorBlurOverrides), { '94001': 'blur' },
        'the override is held to the switch rather than dropped from a stale reading of the screen');
      const after = cards();
      assert.equal(portraitOf(after, 'first author').getAttribute('aria-pressed'), 'true',
        'the author the switch says is hidden stays hidden');
      assert.equal(portraitOf(after, 'second author').getAttribute('aria-pressed'), 'true');
    }
  );
});

test('Tier 3.13: the row chip itself returns one post to the switch', async () => {
  await withPrivacyModal(
    PRIVACY_THREAD,
    { blurAuthor: false, authorBlurOverrides: { '94002': 'blur' } },
    async ({ shadow, cards, stored }) => {
      assert.equal(portraitOf(cards(), 'second author').getAttribute('aria-pressed'), 'true');

      const chip = (Array.from(shadow.querySelectorAll('.tweet-manager-follow')) as any[])
        .find((node) => !node.hasAttribute('hidden'));
      assert.ok(chip, 'the overridden post has a way back on its own row');
      chip.click();
      await settle();

      assert.deepEqual(await stored().then((s: any) => s.authorBlurOverrides), {},
        'the override is gone, not merely flipped');
      assert.equal(portraitOf(cards(), 'second author').getAttribute('aria-pressed'), 'false');
    }
  );
});

test('Tier 3.14: the hint is dismissed once and remembered', async () => {
  await withPrivacyModal(PRIVACY_THREAD, { authorBlurHintDismissed: false }, async ({ shadow, stored }) => {
    const hint = shadow.querySelector('.author-blur-hint');
    assert.ok(hint, 'the one-time hint is shown on a card that has not dismissed it');
    assert.ok(hint.textContent.includes(TRANSLATIONS['en-US'].authorBlurHint),
      'and says what it is for');

    (hint.querySelector('.author-blur-hint-dismiss') as any).click();
    await settle();

    assert.equal((await stored()).authorBlurHintDismissed, true, 'the dismissal is remembered');
    assert.equal(shadow.querySelector('.author-blur-hint'), null, 'and the bar is gone');
  });
});

test('Tier 3.15: a quoted author is its own switch, and a deeper one is not', async () => {
  const thread: ThreadData = {
    author: { name: 'outer author', handle: '@outer' },
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [{
      id: '96001',
      author: { name: 'outer author', handle: '@outer' },
      text: 'outer',
      quotePost: {
        author: { name: 'quoted author', handle: '@quoted' },
        text: 'quoted',
        quotePost: { author: { name: 'deeper author', handle: '@deeper' }, text: 'deeper' },
      },
    }],
  };
  await withPrivacyModal(thread, { blurAuthor: false }, async ({ cards, stored }) => {
    const quoted = portraitOf(cards(), 'quoted author');
    const deeper = portraitOf(cards(), 'deeper author');
    assert.ok(quoted && deeper, 'both quoted panels are on the card');
    // The portrait is an `<img>`; its button is the parent that wraps it.
    assert.equal(quoted.parentElement?.tagName, 'BUTTON',
      'the first quoted author can be hidden on its own');
    assert.equal(deeper.parentElement?.getAttribute('class')?.split(' ').includes('author-privacy-toggle'), false,
      'the author a quoted post itself quotes has no place of its own to be clicked');

    const post = portraitOf(cards(), 'outer author');
    assert.ok(post);
    const quotedButton = quoted.parentElement as any;
    assert.equal(quotedButton.tagName, 'BUTTON');
    quotedButton.click();
    await settle();

    // `aria-pressed` on a real element reflects a boolean; the shim has none, so
    // what is read is the state the click wrote -- the quoted author is hidden.
    // Read through the cards again: Preact may have replaced the node it wrote to.
    const quotedAfter = portraitOf(cards(), 'quoted author');
    assert.equal(quotedAfter.className.includes('is-blurred'), true,
      'the click landed on the quoted author\'s own switch');
    assert.equal(portraitOf(cards(), 'deeper author').className.includes('is-blurred'), false,
      'the deeper author is not what the quoted panel answered for');
    // Session state, not a preference: a quoted post has no id, so an override
    // written against it must not outlive this opening.
    assert.deepEqual((await stored()).authorBlurOverrides, {},
      'nothing about a quoted author reaches the store');
  });
});

test('Tier 3.16: the quoted author\'s panel row really returns it to the global switch', async () => {
  // The chip says "follow global", so it has to *leave the author following the
  // switch*. It used to call the avatar's flip, which only ever writes the two
  // explicit modes -- so pressing it flipped the quoted author between hidden
  // and shown and the default was unreachable. With the switch off, "follow"
  // means clear, and the row it came from disappears with the override.
  const thread: ThreadData = {
    author: { name: 'outer author', handle: '@outer' },
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [{
      id: '96010',
      author: { name: 'outer author', handle: '@outer' },
      text: 'outer',
      quotePost: { author: { name: 'quoted author', handle: '@quoted' }, text: 'quoted' },
    }],
  };

  await withPrivacyModal(thread, { blurAuthor: false }, async ({ cards, shadow }) => {
    (portraitOf(cards(), 'quoted author').parentElement as any).click();
    await settle();
    const hidden = portraitOf(cards(), 'quoted author');
    assert.equal(hidden.className.includes('is-blurred'), true, 'the quoted author is hidden');
    const quoteRow = () =>
      (Array.from(shadow.querySelectorAll('.author-privacy-list .author-privacy-row')) as any[]).find(
        (node) => node.querySelector('.author-privacy-name')?.textContent === 'quoted author'
      );
    const row = quoteRow();
    assert.ok(row, 'the override is listed in the privacy group, so it can be undone there');
    const chip = row.querySelector('.author-privacy-chip') as any;
    assert.equal(chip.textContent, TRANSLATIONS['en-US'].authorFollowGlobal);

    chip.click();
    await settle();

    assert.equal(portraitOf(cards(), 'quoted author').className.includes('is-blurred'), false,
      'following the switch (off) shows the author again');
    assert.equal(quoteRow() === undefined, true, 'and with no override left there is no row to undo');
  });
});

test('Tier 3.17: the hint waits for the stored answer instead of flashing the default', async () => {
  // The report: reopening a card whose hint was dismissed still drew the strip
  // for a frame -- from the shipped default -- and then took it away, resizing
  // the preview under the user. A read answered in the same task has no frame
  // to inspect, so this one is slow enough that the modal is queried while the
  // answer is in flight.
  await withPrivacyModal(
    PRIVACY_THREAD,
    { authorBlurHintDismissed: false },
    async ({ shadow }) => {
      // `assert.ok`, not `assert.equal(node, null)`: on failure the latter asks
      // Node to inspect the shim's whole DOM tree for the message.
      assert.ok(!shadow.querySelector('.author-blur-hint'),
        'nothing preference-shaped is drawn while the answer is in flight');
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.ok(shadow.querySelector('.author-blur-hint'),
        'and the strip arrives once the answer says it was not dismissed');
    },
    { readDelayMs: 200 }
  );
});

test('Tier 3.18: the zoom row is hidden from the first frame on a stage too narrow to keep it', async () => {
  // The row's visibility needs the measured stage width, which arrives a frame
  // after mount. On a window narrower than the smallest fixed level that frame
  // used to draw the row and then remove it. The shim never measures, so what is
  // read here is exactly the unmeasured first frame.
  await withPrivacyModal(
    PRIVACY_THREAD,
    { authorBlurHintDismissed: true },
    async ({ shadow }) => {
      assert.ok(shadow.querySelector('.preview-toolbar')?.hasAttribute('hidden'),
        'a window narrower than the smallest fixed level does not draw the row');
    },
    { innerWidth: 320 }
  );
  await withPrivacyModal(
    PRIVACY_THREAD,
    { authorBlurHintDismissed: true },
    async ({ shadow }) => {
      assert.equal(shadow.querySelector('.preview-toolbar')?.hasAttribute('hidden'), false,
        'a window wide enough keeps it from the first frame, so its height never appears late');
    },
    { innerWidth: 1200 }
  );
});

test('Tier 3.19: the last answer seeds the next first frame, from every writer', async () => {
  // The seed exists for the frame before the read: on a reopen (or under
  // reduced motion, where there is no entrance fade) the theme, language and
  // panel must not be painted from the shipped defaults and corrected. Every
  // writer has to move it, or a later card starts from an answer the user has
  // already changed.
  const scope = globalThis as Record<string, unknown>;
  const savedChrome = scope.chrome;
  const chromeMock = createChromeMock();
  scope.chrome = chromeMock;
  try {
    await chromeMock.storage.local.set({
      post_to_card_user_prefs: { ...BASE_CONFIG, theme: 'terminal' },
    });
    const loaded = await loadUserPreferences();
    assert.equal(lastKnownPreferences()?.theme, 'terminal', 'a read becomes the seed');

    await saveUserPreferences({ ...loaded, theme: 'paper' });
    assert.equal(lastKnownPreferences()?.theme, 'paper', 'a local edit is the newest seed');

    const unsubscribe = subscribePreferences(() => {});
    await chromeMock.storage.local.set({
      post_to_card_user_prefs: { ...loaded, theme: 'darkroom' },
    });
    unsubscribe();
    assert.equal(lastKnownPreferences()?.theme, 'darkroom',
      'a change from another context updates it too');
  } finally {
    // Leave the module with the same answer a fresh context would have, so the
    // seed cannot leak into the tests that mount a card after this one.
    await saveUserPreferences({ ...DEFAULT_CARD_CONFIG });
    if (savedChrome !== undefined) scope.chrome = savedChrome;
    else delete scope.chrome;
  }
});

// -------------------------------------------------------------
// Test Execution Runner for Tier 3
// -------------------------------------------------------------
export function runTier3() {
  return run();
}
