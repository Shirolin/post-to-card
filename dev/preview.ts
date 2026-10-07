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
import { DEFAULT_CARD_CONFIG, sanitizeRadius, sanitizeTheme } from '../src/content/ui/themes';
import modalCss from '../src/content/styles/modal.css?inline';
import cardCss from '../src/content/styles/card.css?inline';

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
 * through the panel: ?theme=riso&ratio=3:4&padding=48px&radius=20px
 *
 * The theme goes through the same sanitizer as stored preferences, so a retired
 * id in a bookmarked URL still resolves to its replacement paper.
 */
const harnessConfig = { ...DEFAULT_CARD_CONFIG } as typeof DEFAULT_CARD_CONFIG;
if (params.get('theme')) harnessConfig.theme = sanitizeTheme(params.get('theme'));
if (params.get('ratio')) harnessConfig.aspectRatio = params.get('ratio') as typeof harnessConfig.aspectRatio;
if (params.get('padding')) harnessConfig.padding = params.get('padding') as typeof harnessConfig.padding;
if (params.get('radius')) harnessConfig.borderRadius = sanitizeRadius(params.get('radius')!);
if (params.get('fit')) harnessConfig.imageFit = params.get('fit') as typeof harnessConfig.imageFit;
if (params.get('layout')) harnessConfig.mediaLayout = params.get('layout') as typeof harnessConfig.mediaLayout;
if (params.get('locale')) harnessConfig.locale = params.get('locale') as typeof harnessConfig.locale;
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

// ?quote=1 swaps in a single post that quotes another, so the quote card's
// presentation can be reviewed on its own. ?translated=1 swaps in a post X is
// showing translated, to review the "translated from" notice.
const activeThreadData =
  params.get('quote') === '1'
    ? quoteThreadData
    : params.get('translated') === '1'
      ? translatedThreadData
      : params.get('video') === '1'
        ? videoThreadData
        : params.get('cjk') === '1'
          ? cjkThreadData
          : params.get('wrap') === '1'
            ? wrappedThreadData
            : params.get('grid')
              ? gridThreadData(Math.min(4, Math.max(2, Number(params.get('grid')))) as 2 | 3 | 4)
              : threadData;

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
 * focus within the group. Controls inside the collapsed "More" section are
 * skipped, since a hidden element is not reachable by keyboard anyway.
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
  render(h(App, { threadData: activeThreadData, onClose: () => {} }), container.mountPoint);
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
    h('div', { class: 'ptc-scope' }, h(App, { threadData: activeThreadData, onClose: () => {} })),
    document.body
  );
} else {
  render(h(App, { threadData: activeThreadData, onClose: () => {} }), container.mountPoint);
}
