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
import { DEFAULT_CARD_CONFIG } from '../src/content/ui/themes';
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

function reportToLightDom(lines: string[]): void {
  const pre = document.createElement('pre');
  pre.id = 'a11y-report';
  pre.style.cssText =
    'position:fixed;left:0;top:0;z-index:99999;background:#000;color:#0f0;padding:12px;font:12px/1.5 monospace;white-space:pre-wrap;max-width:100vw';
  pre.textContent = lines.join('\n');
  document.body.appendChild(pre);
}

const isAudit = params.get('a11y') === '1';

if (isAudit) {
  // Mount the real modal first, then audit the focus trap it produced.
  render(h(App, { threadData, onClose: () => {} }), container.mountPoint);
  const waitForDialog = (attemptsLeft: number) => {
    if (container.shadow?.querySelector('#post-to-card-dialog')) {
      runFocusTrapAudit();
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
    config: DEFAULT_CARD_CONFIG,
    onChange: () => {},
    onExportCopy: () => {},
    onExportDownload: () => {},
    threadData,
  });
  if (params.get('panel') === '1') {
    render(h('div', { class: 'panel-only ptc-scope' }, panel), document.body);
  } else {
    render(
      h('div', { class: 'bare-root ptc-scope' }, [
        h('div', { class: 'bare-stage' }, h(Card, { data: threadData, config: DEFAULT_CARD_CONFIG })),
        panel,
      ]),
      document.body
    );
  }
} else {
  render(h(App, { threadData, onClose: () => {} }), container.mountPoint);
}
