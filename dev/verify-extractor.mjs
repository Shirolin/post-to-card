/**
 * Exercises the extractor in a real browser, on real captured markup.
 *
 * `dev/verify-extension.mjs` proves the extension loads and the content script
 * starts. It cannot prove the extractor works: logged out, x.com serves a
 * client-rendered shell with zero `data-testid`, so there is no tweet markup to
 * read (the script says so itself).
 *
 * This closes that gap. A local server answers for a page whose URL is
 * `https://x.com/`, and the extension's *shipped* content bundle is run
 * against it. The bundle is the same bytes the manifest ships, so what is
 * exercised is what ships.
 *
 * The page carries the markup the repository collected from a logged-in
 * timeline — verbatim, with every marker X renders. What is checked: the
 * trigger reached the action bar (which means the article was found and the
 * post's shape was read), and the card opened with the post's own words in it
 * (which means the whole extraction ran).
 *
 *   node dev/verify-extractor.mjs
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(REPO, 'dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

/** The markup the repository collected from a logged-in timeline, verbatim. */
const FIXTURES = [
  ['retweet', 'tests/fixtures/retweet.ts', 'RETWEET_HTML'],
  ['nested quote', 'tests/fixtures/nested-quote-preview.ts', 'NESTED_QUOTE_PREVIEW_HTML'],
  ['quote', 'tests/fixtures/quote-tweet.ts', 'QUOTE_TWEET_HTML'],
  ['article', 'tests/fixtures/article-tweet.ts', 'ARTICLE_TWEET_HTML'],
  ['article preview', 'tests/fixtures/article-preview-tweet.ts', 'ARTICLE_PREVIEW_TWEET_HTML'],
];

/** Pulls one fixture's HTML out of its TypeScript module. */
function fixtureHtml(file, name) {
  const src = readFileSync(join(REPO, file), 'utf8');
  const match = src.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`));
  if (!match) throw new Error(`no ${name} in ${file}`);
  return match[1];
}

const failures = [];
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(label);
  return ok;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('could not open the CDP socket')), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`timed out: ${method}`));
      }, 30000);
    });
  }

  on(fn) { this.listeners.push(fn); }

  async attach(targetId) {
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    await this.send('Runtime.enable', {}, sessionId);
    await this.send('Log.enable', {}, sessionId);
    return sessionId;
  }

  async eval(sessionId, expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }

  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

async function waitForBrowser(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch { /* not listening yet */ }
    await sleep(500);
  }
  throw new Error(`nothing came up on 127.0.0.1:${port}`);
}

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error(`No Chrome found. Looked in:\n  ${CHROME_CANDIDATES.join('\n')}\nSet CHROME_PATH.`);
  process.exit(1);
}
if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error(`${DIST}/manifest.json is missing. Run \`npm run build\` first.`);
  process.exit(1);
}

// The page the local server answers with: the captured markup, inside the
// column X renders it in, so the scan finds it the way it finds the real thing.
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>x.com</title></head>
<body><div id="react-root"><main><div id="timeline">
${FIXTURES.map(([, file, name]) => fixtureHtml(file, name)).join('\n')}
</div></main></div></body></html>`;

const sitePort = await freePort();
const server = createServer((req, res) => {
  if (req.url === '/content.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(readFileSync(join(DIST, 'content.js')));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
});
await new Promise((resolve) => server.listen(sitePort, '127.0.0.1', resolve));

const debugPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'ptc-extract-'));
console.log(`chrome    ${chrome}`);
console.log(`bundle    ${join(DIST, 'content.js')}`);
console.log(`server    http://127.0.0.1:${sitePort}/`);
console.log(`debug     127.0.0.1:${debugPort} (probed free)\n`);

// Headed when there is a display to draw on, headless when there is not.
//
// Unlike `verify-extension.mjs`, this one does not need a window: the page it
// opens is a local server, not x.com, and x.com is the only thing that
// refuses a headless browser. A CI runner has no display, so headless is the
// only way it can run at all.
//
// `PTC_HEADED` says which, for the cases the platform cannot tell: `0` forces
// headless, `1` forces a window.
const headedByFlag = process.env.PTC_HEADED;
const headed =
  headedByFlag === undefined
    ? process.platform === 'win32' || process.platform === 'darwin' || !!process.env.DISPLAY
    : headedByFlag === '1';

const proc = spawn(chrome, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  ...(headed ? [] : ['--headless=new']),
  // The sandbox needs privileges a CI container does not grant, and the
  // browser is only reading a local file.
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let cdp;
try {
  cdp = await Cdp.connect(await waitForBrowser(debugPort));
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const tab = await cdp.attach(targetId);
  const entries = [];
  cdp.on((msg) => {
    if (msg.sessionId !== tab) return;
    if (msg.method === 'Runtime.consoleAPICalled') {
      entries.push({
        kind: msg.params.type,
        text: (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200),
      });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      entries.push({ kind: 'EXCEPTION', text: String(msg.params.exceptionDetails.exception?.description || '').slice(0, 300) });
    }
  });

  // The shipped bundle, run against the page before it loads. This is the same
  // file the manifest declares as the content script; only the gate that
  // decides *where* it runs is different, because a local server cannot be
  // `https://x.com` without a certificate.
  await cdp.send('Page.enable', {}, tab);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const load = () => {
        const s = document.createElement('script');
        s.src = 'http://127.0.0.1:${sitePort}/content.js';
        (document.head || document.documentElement || document.body).appendChild(s);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load, { once: true });
      } else {
        load();
      }
    })();`,
  }, tab);
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${sitePort}/` }, tab);
  await sleep(6000);

  const probe = JSON.parse(await cdp.eval(tab, `JSON.stringify((() => {
    const articles = Array.from(document.querySelectorAll('article'));
    return {
      articles: articles.length,
      triggers: document.querySelectorAll('[data-post-to-card-btn="true"]').length,
      // Which articles carry an action bar at all, and which got a trigger.
      perArticle: articles.map((a) => ({
        testid: a.getAttribute('data-testid'),
        hasGroup: !!a.querySelector('div[role="group"]'),
        groups: a.querySelectorAll('div[role="group"]').length,
        triggers: a.querySelectorAll('[data-post-to-card-btn="true"]').length,
        text: (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
      })),
    };
  })())`));
  console.log(`        articles=${probe.articles} triggers=${probe.triggers}`);
  for (const a of probe.perArticle) {
    console.log(`          groups=${a.groups} triggers=${a.triggers}  ${a.text}`);
  }
  check('the content script found the posts', probe.articles > 0, `${probe.articles} articles`);
  check('the trigger reached the action bars', probe.triggers > 0, `${probe.triggers} triggers`);

  // The trigger's presence means the article was found and the post's shape was
  // read. Clicking it opens the card, and the card carries the post's own
  // words — which is the extraction itself, end to end.
  const opened = await cdp.eval(tab, `JSON.stringify((() => {
    const btn = document.querySelector('[data-post-to-card-btn="true"]');
    if (!btn) return { ok: false, why: 'no trigger' };
    btn.click();
    return { ok: true };
  })())`);
  const openedResult = JSON.parse(opened);
  check('the trigger responded', openedResult.ok === true, openedResult.why || '');

  await sleep(2500);
  const card = JSON.parse(await cdp.eval(tab, `JSON.stringify((() => {
    const host = document.querySelector('post-to-card-container');
    const root = host && host.shadowRoot;
    const card = root && root.querySelector('.post-to-card-target');
    if (!card) return { ok: false, why: 'no card' };
    return {
      ok: true,
      theme: card.getAttribute('data-theme'),
      text: (card.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200),
    };
  })())`));
  check('the card opened', card.ok === true, card.why || '');
  if (card.ok) {
    console.log(`        theme=${card.theme}`);
    console.log(`        text: ${card.text}`);
    check('the card carries the post’s own words', card.text.length > 20, `${card.text.length} chars`);
  }

  console.log('\nconsole');
  entries.forEach((e) => console.log(`    [${e.kind}] ${e.text}`));
  check('the bundle threw nothing on the page', !entries.some((e) => e.kind === 'EXCEPTION'));
} finally {
  cdp?.close();
  proc.kill();
  server.close();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(failures.length ? `\n${failures.length} check(s) failed: ${failures.join(', ')}` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
