/**
 * Dev-only UI harness.
 * Mounts the real Shadow DOM + Preact App against in-memory fixtures so the
 * modal can be inspected and polished without a live Twitter session.
 *
 * Run: pnpm vite --config dev/vite.harness.config.ts
 */

import { render, h } from 'preact';
import type { ThreadData } from '../src/types/tweet';
import '../src/content/container/element';
import { App } from '../src/content/ui/App';
import { Card } from '../src/content/ui/Card';
import { Controls } from '../src/content/ui/Controls';
import { DEFAULT_CARD_CONFIG, sanitizeTheme } from '../src/content/ui/themes';
import { CANVAS_BACKGROUND, CANVAS_RATIO, RADIUS, optionValue } from '../src/content/ui/options';
import modalCss from '../src/content/styles/modal.css?inline';
import cardCss from '../src/content/styles/card.css?inline';
import { sanitizeLocalePref } from '../src/content/i18n';

const svg = (inner: string, w = 400, hgt = 300) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">${inner}</svg>`
  )}`;

const avatar = svg(
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="155" r="68" fill="rgba(255,255,255,.85)"/><path d="M60 400c0-90 63-140 140-140s140 50 140 140z" fill="rgba(255,255,255,.85)"/>`,
  400,
  400
);

const photo1 = svg(
  `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="800" height="500" fill="url(#a)"/><circle cx="640" cy="120" r="70" fill="rgba(255,255,255,.55)"/><path d="M0 380l220-190 180 150 140-110 260 210v60H0z" fill="rgba(15,23,42,.55)"/>`,
  800,
  500
);
const photo2 = svg(
  `<rect width="500" height="620" fill="#1e1b4b"/><circle cx="250" cy="250" r="140" fill="none" stroke="#a78bfa" stroke-width="10"/><rect x="120" y="430" width="260" height="18" rx="9" fill="#a78bfa"/><rect x="170" y="480" width="160" height="18" rx="9" fill="#6366f1"/>`,
  500,
  620
);
const photo3 = svg(
  `<rect width="800" height="520" fill="#052e16"/><path d="M0 420l200-160 150 110 190-140 260 200v90H0z" fill="#16a34a"/><circle cx="180" cy="120" r="46" fill="#fde68a"/>`,
  800,
  520
);

/** 16:9 video poster with a bright sky and a burned-in subtitle band. */
const videoPoster = svg(
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5f0"/><stop offset="1" stop-color="#dcecf7"/></linearGradient></defs>
   <rect width="1280" height="720" fill="url(#sky)"/>
   <ellipse cx="240" cy="140" rx="150" ry="52" fill="#ffffff" opacity=".75"/>
   <ellipse cx="900" cy="230" rx="200" ry="60" fill="#ffffff" opacity=".6"/>
   <path d="M0 470l260-150 210 130 250-170 300 190 260-90v340H0z" fill="#5c7f9c"/>
   <path d="M0 560l300-110 280 120 320-90 380 110v130H0z" fill="#3c5a72"/>
   <text x="640" y="662" font-family="sans-serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">М? О, в чём дело, отброс сомняний?</text>`,
  1280,
  720
);

const author = {
  name: 'Ada Nakamura',
  handle: '@ada_builds',
  avatarUrl: avatar,
  verified: true,
};

const threadData: ThreadData = {
  author,
  isSingle: false,
  targetTweetIndex: 1,
  tweets: [
    {
      id: '1001',
      url: 'https://x.com/ada_builds/status/1001',
      author,
      timestamp: '2026-09-14T10:00:00.000Z',
      // Token-only on purpose: exercises the snippet's fallback to the tokens.
      text: '',
      richTokens: [
        { type: 'text', value: 'Thread: we rebuilt our card renderer from scratch. 🧵\n\n' },
        { type: 'hashtag', value: '#design' },
        { type: 'text', value: ' ' },
        { type: 'mention', value: '@ada_builds' },
        { type: 'text', value: ' pulled in the ' },
        { type: 'link', value: 'shadow DOM spec', href: 'https://example.com' },
        { type: 'text', value: ' and everything downstream.' },
      ],
      stats: { replies: '128', reposts: '1.4K', likes: '12.7K', views: '482K' },
      media: [
        { type: 'image', url: photo1, aspectRatio: 1.6 },
      ],
      isThreadPart: true,
      threadIndex: 0,
      threadTotal: 3,
    },
    {
      id: '1002',
      url: 'https://x.com/ada_builds/status/1002',
      author,
      timestamp: '2026-09-14T10:05:00.000Z',
      text: '2/3 The whole control panel now lives in one isolated shadow root — zero CSS bleed from the host page, zero reflow jank while scrolling.',
      richTokens: [
        { type: 'text', value: '2/3 The whole control panel now lives in one isolated shadow root — zero CSS bleed from the host page, zero reflow jank while scrolling.' },
      ],
      stats: { replies: '64', reposts: '902', likes: '8.1K', views: '301K' },
      media: [
        { type: 'image', url: photo2, aspectRatio: 0.806 },
        { type: 'image', url: photo3, aspectRatio: 1.538 },
      ],
      isThreadPart: true,
      threadIndex: 1,
      threadTotal: 3,
    },
    {
      id: '1003',
      url: 'https://x.com/ada_builds/status/1003',
      author,
      timestamp: '2026-09-14T10:11:00.000Z',
      text: '',
      richTokens: [
        { type: 'text', value: '3/3 Export runs offline at 2x retina through a service-worker CORS proxy, so screenshots never hit ' },
        { type: 'text', value: 'SecurityError' },
        { type: 'text', value: ' again. Ship it 🚀' },
      ],
      stats: { replies: '31', reposts: '1.1K', likes: '9.4K', views: '377K' },
      quotePost: {
        author: { name: 'Grace Hopper', handle: '@amazing_grace', avatarUrl: avatar, verified: true },
        text: 'The most damaging phrase in the language is "we have always done it this way".',
        timestamp: '2026-09-13T18:20:00.000Z',
        url: 'https://x.com/amazing_grace/status/999',
      },
      isThreadPart: true,
      threadIndex: 2,
      threadTotal: 3,
    },
  ],
};

/**
 * A single post that quotes another. Mirrors the real case — a media post
 * quoting a longer text post — and exists so the quote card's presentation can
 * be reviewed on its own (?quote=1).
 */
const quoteThreadData: ThreadData = {
  author: { name: 'Ada Nakamura', handle: '@ada_builds', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '2001',
      url: 'https://x.com/ada_builds/status/2001',
      author: { name: 'Ada Nakamura', handle: '@ada_builds', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-02T02:57:00.000Z',
      text: 'Tried Cloudflare\'s decision model "clef-flash" and cleared Mario. ~130ms at RTX5090, and running it locally is the real win.',
      media: [{ type: 'image', url: photo1, aspectRatio: 1.6 }],
      stats: { replies: '0', reposts: '37', likes: '243', views: '3' },
      quotePost: {
        author: { name: 'Grace Hopper', handle: '@amazing_grace', avatarUrl: avatar, verified: true },
        text: 'Cloudflare released an open-weight decision model with a Jev API-compatible interface. The base models are clef: Qwen3.8-27B and clef-flash: Qwen3.5-9B, both fine-tuned on top of those.',
        timestamp: '2026-10-02T07:10:00.000Z',
        url: 'https://x.com/amazing_grace/status/1999',
      },
    },
  ],
};

/**
 * A single post that X is showing translated. Exists so the "translated from"
 * notice can be reviewed on its own (?translated=1).
 */
const translatedThreadData: ThreadData = {
  author: { name: 'Wilker', handle: '@wilkerverso', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '3001',
      url: 'https://x.com/wilkerverso/status/3001',
      author: { name: 'Wilker', handle: '@wilkerverso', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-02T09:24:00.000Z',
      text: '大概是我目前最喜欢的游戏战斗！\n\n演出很美，Trokka很美，她的招式很美，竞技场也很美！\n\n挨揍了？\n当然他妈的揍了！',
      translatedFrom: '翻译自 葡萄牙语',
      media: [{ type: 'image', url: photo1, aspectRatio: 1.6 }],
      stats: { replies: '14', reposts: '6', likes: '192', views: '4.6万' },
    },
  ],
};

/**
 * A post with a Chinese display name, handle and body. The two serif themes
 * set a Song face for the author line, and CJK glyph fallback is the one part
 * of the type stack a Latin-only fixture cannot review (?cjk=1).
 */
const cjkThreadData: ThreadData = {
  author: { name: '沈亦航', handle: '@yi_hang', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '4001',
      url: 'https://x.com/yi_hang/status/4001',
      author: { name: '沈亦航', handle: '@yi_hang', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-02T09:24:00.000Z',
      text: '把卡片从「换渐变皮肤」改成「纸张材料 + 字阶 + 一条签名装饰」，默认就好看多了。',
      stats: { replies: '12', reposts: '88', likes: '1.2K', views: '3.1万' },
      quotePost: {
        author: { name: '林晚舟', handle: '@wanzhou', avatarUrl: avatar, verified: true },
        text: '排版不是装饰，是把优先级说出来。',
        timestamp: '2026-10-01T12:00:00.000Z',
        url: 'https://x.com/wanzhou/status/4000',
      },
    },
  ],
};

/**
 * A video post with burnt-in subtitles.
 *
 * Every other fixture uses still images, which left the video poster, the play
 * badge and the bottom scrim unreviewable in any theme (?video=1). The subtitle
 * band matters most: it is the case where the scrim and the badge sit on top of
 * text the card cannot re-typeset.
 */
const videoThreadData: ThreadData = {
  author: { name: 'Yuito Kisaragi', handle: '@yuito_0917', avatarUrl: avatar },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '5001',
      url: 'https://x.com/yuito_0917/status/5001',
      author: { name: 'Yuito Kisaragi', handle: '@yuito_0917', avatarUrl: avatar },
      timestamp: '2026-10-02T09:15:00.000Z',
      text: '',
      richTokens: [
        { type: 'text', value: 'ロシア語を話すヤニねこ、大家さんの声優さんが凄すぎる' },
        { type: 'text', value: '\n' },
        { type: 'hashtag', value: '#ヤニねこ' },
        { type: 'text', value: ' ' },
        { type: 'link', value: 'https://t.co/ShtaNmzn5y', href: 'https://t.co/ShtaNmzn5y' },
      ],
      media: [
        { type: 'video', url: videoPoster, aspectRatio: 1.777, duration: '2:38' },
      ],
      stats: { replies: '55', reposts: '518', likes: '4.4K', views: '654.6K' },
    },
  ],
};

/**
 * A multi-paragraph post whose line breaks sit next to inline elements.
 *
 * X splits the body around every link, mention and emoji, so a paragraph break
 * between two of them lives in a whitespace-only text node. That is the shape
 * that got flattened to a single paragraph, twice (?wrap=1). Every paragraph
 * here ends on an inline element on purpose.
 */
const wrappedThreadData: ThreadData = {
  author: { name: '沈亦航', handle: '@yi_hang', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '6001',
      url: 'https://x.com/yi_hang/status/6001',
      author: { name: '沈亦航', handle: '@yi_hang', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-02T09:24:00.000Z',
      text: '',
      richTokens: [
        { type: 'text', value: '第一段以一个链接结束 ' },
        { type: 'link', value: 'example.com', href: 'https://example.com' },
        { type: 'text', value: '\n\n' },
        { type: 'text', value: '第二段以一个提及结束 ' },
        { type: 'mention', value: '@someone' },
        { type: 'text', value: '\n\n' },
        { type: 'text', value: '第三段以一个 emoji 结束 🧵' },
        { type: 'text', value: '\n\n' },
        { type: 'text', value: '第四段。' },
      ],
      stats: { replies: '12', reposts: '88', likes: '1.2K', views: '3.1万' },
    },
  ],
};

/**
 * A long-form post carrying an X article.
 *
 * Mirrors the real case: a short post pointing at an article, whose cover is a
 * 5:2 banner. Exists so the article block — cover, kicker, title and lead — can
 * be reviewed on its own and across every material (?article=1), which is the
 * only place the layout can be seen, since the test DOM has no layout engine.
 *
 * The cover is deliberately wide and short. It is the shape most likely to
 * expose a mismatched mount, and it is the shape the real article uses.
 */
const articleCover = svg(
  `<defs><linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
   <rect width="1344" height="538" fill="url(#ac)"/>
   <circle cx="1120" cy="150" r="120" fill="rgba(255,255,255,.22)"/>
   <path d="M0 400l260-160 210 130 250-170 300 190 324-120v268H0z" fill="rgba(15,23,42,.5)"/>`,
  1344,
  538
);

const articleThreadData: ThreadData = {
  author: { name: 'Kevin Le Guillou', handle: '@kevinleguillou', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '7001',
      url: 'https://x.com/kevinleguillou/status/7001',
      author: { name: 'Kevin Le Guillou', handle: '@kevinleguillou', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-08T21:19:52.000Z',
      text: 'Here is the promised write up, it explains how I made the recent videos, how to structure your work, and good ideas I picked up along the way.',
      stats: { replies: '2', reposts: '14', likes: '153', bookmarks: '105', views: '15.9K' },
      article: {
        title: 'Anime Harry Potter',
        openingLine: 'This is a writeup for those that wanted to know how I made the videos.',
        cover: { type: 'image', url: articleCover, aspectRatio: 2.498 },
      },
    },
  ],
};

/**
 * A post X truncated for the timeline, carrying its "Show more" control.
 *
 * The DOM only ever holds the preview; the rest of the body is in X's GraphQL
 * `note_tweet` field, so the card cannot print it. Exists so the ellipsis and
 * the "content truncated" notice can be reviewed on their own (?truncated=1).
 */
const truncatedThreadData: ThreadData = {
  author: { name: 'Arena', handle: '@arena', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '8001',
      url: 'https://x.com/arena/status/8001',
      author: { name: 'Arena', handle: '@arena', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-09T08:12:00.000Z',
      text: '@AnthropicAI 的 Claude Haiku 5.5（高配版）的真实世界结果已出炉。\n\n在 Code Arena: WebDev 中以 1587 分首次登上 #30 榜单，此版本略微位于帕累托前沿之外，但仍提供强劲的成本效率。它与 GPT-6 Luna 的价格相同，为每 1M 输入/输出令牌 $0.10/$0.50，同时得分高出 6 分。\n\n与其他 Claude',
      truncated: true,
      stats: { replies: '13', reposts: '8', likes: '279', views: '2.4万' },
      media: [{ type: 'image', url: photo1, aspectRatio: 1.6 }],
    },
  ],
};

/**
 * A post quoting a post that itself quotes a third — the reported case.
 *
 * Mirrors the real one: the outer quote carries a short bilingual body, the
 * inner carries a longer multi-paragraph English body. Exists so the nested
 * panel's depth can be reviewed on its own (?nested=1), which is the only place
 * the two-level hierarchy is visible: the test DOM has no layout engine, so
 * `color-mix` and indentation cannot be judged there.
 *
 * The inner quote deliberately has no avatar-independent marker of its own: it
 * must read as a deeper level from surface and spacing alone.
 */
const nestedQuoteThreadData: ThreadData = {
  author: { name: 'gKev1n', handle: '@GKev1n', avatarUrl: avatar, verified: true },
  isSingle: true,
  targetTweetIndex: 0,
  tweets: [
    {
      id: '9001',
      url: 'https://x.com/GKev1n/status/9001',
      author: { name: 'gKev1n', handle: '@GKev1n', avatarUrl: avatar, verified: true },
      timestamp: '2026-10-14T04:29:00.000Z',
      text: '这把赚大发了，开通 Devin 的有福了！Gemini 4 Argon 目前多了一种访问方式，第一种，开通 Google AI Ultra，99$。第二种，开通 Devin，20$。\n\n还好这几天用 Devin 调用 Opus 5.5 省着点用了，哈哈哈，剩下的可以试 Gemini Argon 了！',
      stats: { replies: '4', reposts: '0', likes: '15', views: '3K' },
      quotePost: {
        author: { name: 'Devin Developers', handle: '@devindevelopers', avatarUrl: avatar, verified: true },
        text: 'Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。',
        timestamp: '2026-10-14T00:24:00.000Z',
        url: 'https://x.com/devindevelopers/status/9002',
        quotePost: {
          author: { name: 'Cognition', handle: '@cognition', avatarUrl: avatar, verified: true },
          text: 'Gemini 4 Argon is now available in Devin Desktop and CLI.\n\nOn FrontierCode 1.1, Gemini 4 Argon scores 60.5%, making it the highest performing Gemini model on the leaderboard.\n\nThrough October 27th it is available at 75% off for Devin users.',
          timestamp: '2026-10-14T00:22:00.000Z',
          url: 'https://x.com/cognition/status/9003',
          // The deepest post's own picture. It used to be missing from the card
          // because this fixture carried none, so nothing exercised it. Keep it:
          // the automated tests lock the extraction and the rendering, but this
          // fixture is the only way to *see* the deepest picture on a card, and
          // a harness that cannot show the case is not a harness for it.
          media: [{ type: 'image', url: photo1, aspectRatio: 1.6 }],
        },
      },
    },
  ],
};

const container = document.querySelector('post-to-card-container') as HTMLElement & {
  shadow: ShadowRoot;
  mountPoint: HTMLDivElement;
};
const styleEl = document.createElement('style');
styleEl.textContent = [modalCss, cardCss].join('\n\n');
container.shadow.appendChild(styleEl);
container.mountPoint = document.createElement('div');
container.shadow.appendChild(container.mountPoint);

// ?bare=1 renders the panels into the light DOM so tooling that cannot pierce
// Shadow DOM can scroll and inspect them.
const params = new URLSearchParams(location.search);

/**
 * Optional overrides so a single card state can be inspected without clicking
 * through the panel: ?theme=riso&ratio=3:4&padding=48px&radius=20px&bg=paper&canvas=4:5
 *
 * These apply in every mode, not just `bare`. `bare` renders the panel and card on
 * their own; `modal=1` and the default mount the real modal, so
 * `?modal=1&theme=terminal&ratio=3:4&locale=en-US` reaches a review state in the
 * actual component tree rather than a stripped-down one.
 *
 * That matters because the modal's layout is the one thing this repo cannot test:
 * `tests/env/browser.ts` is a hand-written DOM with no layout engine, so no
 * viewport-dependent regression in `modal.css` can be caught by the suite. The
 * browser harness is the only place it can be checked, so the state under review
 * has to be reachable by URL -- otherwise checking it means clicking through the
 * panel by hand every time.
 *
 * The theme goes through the same sanitizer as stored preferences, so a retired
 * id in a bookmarked URL still resolves to its replacement paper.
 */
const harnessConfig = { ...DEFAULT_CARD_CONFIG } as typeof DEFAULT_CARD_CONFIG;

/**
 * ?export=degraded|fallback|clean|empty makes the harness answer the export the
 * way the engine would in that situation.
 *
 * The panel's outcome lines, warning tint and retry button only exist after an
 * export resolves, and the real engine cannot produce a degraded image in this
 * harness (its photos are inline SVG, so the proxy never fails). Without this
 * the one state worth reviewing could only be reached by editing the code under
 * review.
 *
 * `clean` is here for the opposite reason: a clean success says nothing at all
 * -- it is a tick on the button -- so the state with the least text is the one
 * hardest to reach by hand.
 */
const exportScenario = params.get('export');
const harnessOnExport = exportScenario
  ? async (target: HTMLElement, action: 'copy' | 'download') => {
      // The engine measures the card; this stand-in has no layout of its own.
      void target;
      if (exportScenario === 'empty') {
        const { ExportRenderError } = await import('../src/content/engine/index.ts');
        throw new ExportRenderError('empty-blob', 'rasterizer returned an empty image');
      }
      // Each scenario carries one kind of bad news, and the copy path really
      // copies: a degraded image is not a clipboard failure, and mixing the two
      // would make the line under review unreadable.
      const filename = 'post-to-card_ada_builds_2026-10-19.png';
      if (exportScenario === 'clean') {
        return {
          success: true,
          method: action === 'copy' ? ('clipboard' as const) : ('download' as const),
          filename,
        };
      }
      if (exportScenario === 'degraded') {
        return {
          success: true,
          method: action === 'copy' ? ('clipboard' as const) : ('download' as const),
          filename,
          degradedImageCount: 2,
          degradedImages: [{ url: 'https://pbs.twimg.com/media/x.jpg', occurrences: 2 }],
          requestedScale: 2,
          appliedScale: 1.63,
          scaleReduced: true,
        };
      }
      return action === 'copy'
        ? {
            success: true,
            method: 'download' as const,
            filename,
            clipboardFailure: 'permission' as const,
            clipboardError: 'NotAllowedError',
          }
        : { success: true, method: 'download' as const, filename };
    }
  : undefined;

if (params.get('theme')) harnessConfig.theme = sanitizeTheme(params.get('theme'));
if (params.get('ratio')) harnessConfig.aspectRatio = params.get('ratio') as typeof harnessConfig.aspectRatio;
if (params.get('padding')) harnessConfig.padding = params.get('padding') as typeof harnessConfig.padding;
if (params.get('radius')) harnessConfig.borderRadius = optionValue(RADIUS, params.get('radius'));
if (params.get('fit')) harnessConfig.imageFit = params.get('fit') as typeof harnessConfig.imageFit;
if (params.get('layout')) harnessConfig.mediaLayout = params.get('layout') as typeof harnessConfig.mediaLayout;
// ?canvas=1:1 / ?bg=paper / ?shadow=1 — the mat, for eyeballing one shape, one
// paint or the lift without walking the panel. The first two go through the
// real option table so a typo lands on the default rather than rendering a mat
// no user could reach.
if (params.get('canvas')) harnessConfig.canvasRatio = optionValue(CANVAS_RATIO, params.get('canvas'));
if (params.get('bg')) harnessConfig.canvasBackground = optionValue(CANVAS_BACKGROUND, params.get('bg'));
if (params.get('shadow') === '1') harnessConfig.canvasShadow = true;
// A locale the build does not have (`?locale=klingon`) resolves to `'auto'`,
// which is the same degradation a hand-edited store gets -- rather than a cast
// that would put an id in the config no component can draw.
if (params.get('locale')) harnessConfig.locale = sanitizeLocalePref(params.get('locale')!);
// ?no=qr,stats,time,wm,watermark turns the corresponding card footer pieces off.
const offParts = new Set((params.get('no') || '').split(',').filter(Boolean));
if (offParts.has('qr')) harnessConfig.showQrCode = false;
if (offParts.has('stats')) harnessConfig.showStats = false;
if (offParts.has('time') || offParts.has('timestamp')) harnessConfig.showTimestamp = false;
if (offParts.has('wm') || offParts.has('watermark')) harnessConfig.showWatermark = false;

/**
 * A single image in each of the three grid shapes, so a material's media
 * rhythm can be reviewed without a live thread. ?grid=3 is the left/right hero
 * case where a wrong corner or gutter is most obvious.
 */
const gridThreadData = (count: 2 | 3 | 4): ThreadData => {
  const pool = [photo1, photo2, photo3, photo1];
  const ratios = [1.6, 0.806, 1.538, 1.6];
  return {
    author,
    isSingle: true,
    targetTweetIndex: 0,
    tweets: [
      {
        id: `grid-${count}`,
        url: `https://x.com/ada_builds/status/grid${count}`,
        author,
        timestamp: '2026-09-14T10:05:00.000Z',
        text: `${count} images, one post — the grid is where a material's gutter and corner show.`,
        stats: { replies: '64', reposts: '902', likes: '8.1K', views: '301K' },
        media: Array.from({ length: count }, (_, i) => ({
          type: 'image' as const,
          url: pool[i],
          aspectRatio: ratios[i],
        })),
      },
    ],
  };
};

/**
 * The fixture each `?<key>=1` selects, in priority order. A map rather than a
 * nested ternary: each new fixture used to add another level, and a fixture now
 * only has to be dropped in here. `?grid=N` is built rather than listed.
 */
const FIXTURE_BY_PARAM: Record<string, ThreadData> = {
  quote: quoteThreadData,
  nested: nestedQuoteThreadData,
  article: articleThreadData,
  translated: translatedThreadData,
  truncated: truncatedThreadData,
  video: videoThreadData,
  cjk: cjkThreadData,
  wrap: wrappedThreadData,
};

// ?quote=1 swaps in a single post that quotes another, so the quote card's
// presentation can be reviewed on its own; ?translated=1 a post X is showing
// translated, to review the "translated from" notice; and so on.
function selectThreadData(): ThreadData {
  for (const [key, data] of Object.entries(FIXTURE_BY_PARAM)) {
    if (params.get(key) === '1') return data;
  }
  const grid = params.get('grid');
  if (grid) return gridThreadData(Math.min(4, Math.max(2, Number(grid))) as 2 | 3 | 4);
  return threadData;
}

const activeThreadData = selectThreadData();

/**
 * ?a11y=1 runs a scripted focus-trap check against the live modal and writes
 * the outcome into a light-DOM element so it can be read without piercing the
 * shadow root.
 */
async function runFocusTrapAudit(): Promise<void> {
  const host = document.querySelector('post-to-card-container') as HTMLElement;
  const root = host.shadowRoot;
  const dialog = root?.querySelector('#post-to-card-dialog') as HTMLElement | null;
  const report: string[] = [];

  const activeLabel = () => {
    const deep = root?.activeElement as HTMLElement | null;
    if (!deep) return 'none';
    if (deep === dialog) return 'DIALOG';
    return `${deep.tagName.toLowerCase()}.${deep.className || '(no-class)'}`;
  };

  report.push(`initial focus inside shadow: ${activeLabel()}`);
  report.push(`document.activeElement is shadow host: ${document.activeElement === host}`);
  report.push(`dialog has tabindex attr: ${dialog?.getAttribute('tabindex')}`);
  report.push(`dialog isConnected: ${dialog?.isConnected}`);

  if (!dialog) {
    report.push('FATAL: dialog not found');
    reportToLightDom(report);
    return;
  }

  // Manually replicate the intended initial-focus behaviour to confirm the
  // element itself is focusable (rules out a CSS/attribute problem).
  dialog.focus();
  report.push(`after manual focus() call: ${activeLabel()}`);

  const focusables = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
  report.push(`focusable count: ${focusables.length}`);
  report.push(`first: ${focusables[0]?.className}`);
  report.push(`last: ${focusables[focusables.length - 1]?.className}`);

  const pressTab = (shift: boolean) => {
    const ev = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ev);
  };

  // Walk forward well past the end of the list; focus must never leave.
  let escaped = false;
  for (let i = 0; i < focusables.length + 4; i++) {
    pressTab(false);
    const deep = root?.activeElement as HTMLElement | null;
    if (!deep || !dialog.contains(deep)) {
      escaped = true;
      report.push(`ESCAPED FORWARD at iteration ${i}: ${activeLabel()}`);
      break;
    }
  }
  if (!escaped) report.push('forward Tab: stayed inside dialog');

  let escapedBack = false;
  for (let i = 0; i < focusables.length + 4; i++) {
    pressTab(true);
    const deep = root?.activeElement as HTMLElement | null;
    if (!deep || !dialog.contains(deep)) {
      escapedBack = true;
      report.push(`ESCAPED BACKWARD at iteration ${i}: ${activeLabel()}`);
      break;
    }
  }
  if (!escapedBack) report.push('backward Tab: stayed inside dialog');

  report.push(`RESULT: ${!escaped && !escapedBack ? 'PASS' : 'FAIL'}`);
  reportToLightDom(report);
}

/**
 * Preact flushes renders in a microtask, but the extra tick lets the DOM settle
 * before the audit reads it back. A timer is used rather than
 * requestAnimationFrame, which is suspended in a background tab.
 */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 32));

/**
 * ?a11y=radio verifies the roving-tabindex contract on the segmented controls:
 * only the checked radio is tabbable, and arrow keys move both selection and
 * focus within the group.
 *
 * The "More" disclosure is opened first, because the widest radio group in the
 * panel -- the fifteen-language picker -- lives inside it. Skipping collapsed
 * groups is what made this audit report success while never having looked at
 * the one group whose size made it worth auditing.
 */
async function runRadioGroupAudit(): Promise<void> {
  const host = document.querySelector('post-to-card-container') as HTMLElement;
  const root = host.shadowRoot;
  const dialog = root?.querySelector('#post-to-card-dialog') as HTMLElement | null;
  const report: string[] = [];

  if (!dialog) {
    reportToLightDom(['FATAL: dialog not found']);
    return;
  }

  for (const toggle of Array.from(dialog.querySelectorAll<HTMLElement>('.more-toggle'))) {
    if (toggle.getAttribute('aria-expanded') === 'false') toggle.click();
  }
  // Let the click's render land before the groups are collected, or the audit
  // runs against the markup that was there with the body still closed.
  await nextFrame();
  await nextFrame();

  const groups = Array.from(dialog.querySelectorAll<HTMLElement>('[role="radiogroup"]'));
  report.push(`radiogroups found: ${groups.length}`);

  // Sanity check: confirm programmatic focus works in this tab at all, so a
  // "focus did not move" result can be attributed to the widget rather than
  // to the harness running in an unfocused tab.
  const probe = groups[0]?.querySelector<HTMLButtonElement>('[role="radio"]');
  probe?.focus();
  await nextFrame();
  report.push(`focus probe (direct .focus()): ${root?.activeElement === probe}`);

  for (const group of groups) {
    if (group.closest('[hidden]')) {
      report.push(`group "${group.getAttribute('aria-label')}": skipped (collapsed)`);
      continue;
    }

    const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    if (radios.length === 0) continue;

    const tabbable = radios.filter((r) => r.tabIndex === 0);
    report.push(
      `group "${group.getAttribute('aria-label')}": ${radios.length} radios, ${tabbable.length} tabbable`
    );

    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    if (checked.length !== 1) {
      report.push(`  FAIL: expected exactly 1 aria-checked radio, found ${checked.length}`);
      continue;
    }
    const checkedIndex = radios.indexOf(checked[0]);

    // A radio can be checked but unavailable: the zoom picker keeps the user's
    // choice selected while the window is too narrow to render at that scale.
    // The tab stop then belongs to the lowest enabled radio, so the requirement
    // is one tabbable radio that is actually focusable -- not that it is also
    // the checked one.
    if (tabbable.length !== 1) {
      report.push(`  FAIL: expected exactly 1 tabbable radio, found ${tabbable.length}`);
    } else if (tabbable[0].disabled) {
      report.push('  FAIL: the tab stop is disabled and cannot take focus');
    }
    if (!checked[0].disabled && radios[checkedIndex].tabIndex !== 0) {
      report.push('  FAIL: an enabled checked radio is not the tab stop');
    }

    // Arrow keys must land on the next enabled radio, since a disabled one
    // cannot hold focus.
    const enabledIndexes = radios
      .map((r, i) => (r.disabled ? -1 : i))
      .filter((i) => i >= 0);
    const expected = enabledIndexes[(enabledIndexes.indexOf(checkedIndex) + 1) % enabledIndexes.length];
    radios[checkedIndex].focus();
    radios[checkedIndex].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    );
    const syncActive = root?.activeElement as HTMLButtonElement | null;
    report.push(`  sync focus index: ${syncActive ? radios.indexOf(syncActive) : -1}`);
    await nextFrame();

    const nowChecked = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    const active = root?.activeElement as HTMLElement | null;
    const activeIndex = active ? radios.indexOf(active as HTMLButtonElement) : -1;
    const activeDesc = active
      ? active === dialog
        ? 'DIALOG'
        : `${active.tagName.toLowerCase()}.${active.className || '(no-class)'}`
      : 'none';
    report.push(`  ArrowRight -> checked index ${nowChecked} (expected ${expected})`);
    report.push(`  focus index: ${activeIndex} (same node: ${active === radios[expected]})`);
    report.push(`  focus holder after render: ${activeDesc}`);
    report.push(`  tabbable after move: ${radios.filter((r) => r.tabIndex === 0).length}`);

    // Restore the original selection so the audit does not mutate state.
    radios[checkedIndex].click();
    await nextFrame();
  }

  report.push('RESULT: done');
  reportToLightDom(report);
}

function reportToLightDom(lines: string[]): void {
  const pre = document.createElement('pre');
  pre.id = 'a11y-report';
  pre.style.cssText =
    'position:fixed;left:0;top:0;z-index:99999;background:#000;color:#0f0;padding:12px;font:12px/1.5 monospace;white-space:pre-wrap;max-width:100vw';
  pre.textContent = lines.join('\n');
  document.body.appendChild(pre);
}

const auditMode = params.get('a11y');

if (auditMode === '1' || auditMode === 'radio') {
  // Mount the real modal first, then audit the focus trap it produced.
  render(
    h(App, {
      threadData: activeThreadData,
      onClose: () => {},
      initialConfig: harnessConfig,
      onExport: harnessOnExport,
    }),
    container.mountPoint
  );
  const waitForDialog = (attemptsLeft: number) => {
    if (container.shadow?.querySelector('#post-to-card-dialog')) {
      if (auditMode === 'radio') {
        runRadioGroupAudit();
      } else {
        runFocusTrapAudit();
      }
      return;
    }
    if (attemptsLeft <= 0) {
      reportToLightDom(['FATAL: dialog never mounted']);
      return;
    }
    setTimeout(() => waitForDialog(attemptsLeft - 1), 100);
  };
  waitForDialog(50);
} else if (params.get('bare') === '1') {
  container.remove();
  document.body.style.background = '#0b0c0e';
  document.head.appendChild(styleEl);
  const panel = h(Controls, {
    config: harnessConfig,
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    threadData: activeThreadData,
  });
  if (params.get('panel') === '1') {
    render(h('div', { class: 'panel-only ptc-scope' }, panel), document.body);
  } else {
    render(
      h('div', { class: 'bare-root ptc-scope' }, [
        h('div', { class: 'bare-stage' }, h(Card, { data: activeThreadData, config: harnessConfig })),
        panel,
      ]),
      document.body
    );
  }
} else if (params.get('modal') === '1') {
  // Light-DOM modal shell: `:host` cannot match here, but the `.ptc-scope`
  // mirror supplies the tokens so the full backdrop/dialog layout stays
  // inspectable with devtools (Shadow DOM otherwise hides it).
  container.remove();
  document.head.appendChild(styleEl);
  render(
    h(
      'div',
      { class: 'ptc-scope' },
      h(App, {
        threadData: activeThreadData,
        onClose: () => {},
        initialConfig: harnessConfig,
        onExport: harnessOnExport,
      })
    ),
    document.body
  );
} else {
  render(
    h(App, {
      threadData: activeThreadData,
      onClose: () => {},
      initialConfig: harnessConfig,
      onExport: harnessOnExport,
    }),
    container.mountPoint
  );
}
