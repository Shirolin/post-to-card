/**
 * Measures the preview's loading motion in a browser that actually draws.
 *
 * The browser panel this repository is developed in never runs a render loop:
 * `requestAnimationFrame` does not fire, CSS transitions stay at their start
 * value and `ResizeObserver` callbacks are not delivered. Every animation in the
 * preview therefore *looks* broken there, and the tier tests have no layout
 * engine at all — so "does the card move, and by how much" had no home until
 * this script.
 *
 * It serves `dev/probe-motion.html` through the harness's own Vite config (the
 * page mounts the real `App`/`Card`), drives one gesture per mode, samples every
 * frame, and asserts on the numbers rather than on a screenshot. `docs/
 * loading-states.md` explains what each animation is for.
 *
 * Not in `npm test`: these are timings, and a loaded machine or a browser that
 * ignores the emulated preference would report a false failure. It is a review
 * tool, run before touching `App.tsx`'s fit/FLIP or `Card.tsx`'s picture path.
 *
 *   node dev/verify-motion.mjs
 *
 * Headed when there is a display (watch it happen), headless otherwise.
 * `PTC_HEADED=1` / `PTC_HEADED=0` overrides.
 */

import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer as createViteServer } from 'vite';

const REPO = fileURLToPath(new URL('..', import.meta.url));

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

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
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === undefined) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
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

  async attach(targetId) {
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    await this.send('Runtime.enable', {}, sessionId);
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
  // Chrome 156 binds the DevTools socket to IPv6 loopback on some machines, so
  // both hosts are probed; whichever answers is the one to connect on.
  for (let i = 0; i < 60; i++) {
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const res = await fetch(`http://${host}:${port}/json/version`);
        if (res.ok) return (await res.json()).webSocketDebuggerUrl;
      } catch { /* not listening yet */ }
    }
    await sleep(300);
  }
  throw new Error(`nothing came up on 127.0.0.1:${port}`);
}

/** `matrix(a, b, c, d, tx, ty)` -> { a, tx, ty }; `none` -> identity. */
function matrix(value) {
  if (!value || value === 'none' || value === '-') return { a: 1, tx: 0, ty: 0 };
  const parts = value.replace(/^matrix\(|\)$/g, '').split(',').map((n) => Number.parseFloat(n));
  if (parts.length === 6) return { a: parts[0], tx: parts[4], ty: parts[5] };
  const scale = value.match(/scale\(([-\d.]+)\)/);
  return { a: scale ? Number.parseFloat(scale[1]) : 1, tx: 0, ty: 0 };
}

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error(`No Chrome found. Looked in:\n  ${CHROME_CANDIDATES.join('\n')}\nSet CHROME_PATH.`);
  process.exit(1);
}

// A picture that stalls (never answers) and one that 404s, on loopback: the two
// waiting states, without depending on what this machine's network does with a
// documentary address.
const picPort = await freePort();
const picServer = createHttpServer((req, res) => {
  if (req.url === '/missing.jpg') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('no');
    return;
  }
  // /stall.jpg: deliberately never answers, so the cell stays in its wait state.
});
await new Promise((resolve) => picServer.listen(picPort, '127.0.0.1', resolve));

const vitePort = await freePort();
const vite = await createViteServer({
  configFile: join(REPO, 'dev/vite.harness.config.ts'),
  server: { host: '127.0.0.1', port: vitePort, strictPort: true },
  logLevel: 'warn',
});
await vite.listen();

const debugPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'ptc-motion-'));
const headedByFlag = process.env.PTC_HEADED;
const headed =
  headedByFlag === undefined
    ? process.platform === 'win32' || process.platform === 'darwin' || !!process.env.DISPLAY
    : headedByFlag === '1';

console.log(`chrome    ${chrome}${headed ? '' : ' (headless)'}`);
console.log(`page      http://127.0.0.1:${vitePort}/probe-motion.html`);
console.log(`pictures  http://127.0.0.1:${picPort}/ (stall + 404)\n`);

const proc = spawn(chrome, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  ...(headed ? [] : ['--headless=new']),
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1200,900',
  'about:blank',
], { stdio: 'ignore' });

let cdp;
const cleanup = async () => {
  cdp?.close();
  try { proc.kill(); } catch { /* already gone */ }
  try { await vite.close(); } catch { /* already closed */ }
  try { picServer.close(); } catch { /* already closed */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* in use */ }
};

try {
  cdp = await Cdp.connect(await waitForBrowser(debugPort));
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  const runMode = async (query) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const tab = await cdp.attach(targetId);
    await cdp.send('Page.enable', {}, tab);
    // This machine reports "reduce animations" at the OS level, and the dialog's
    // global rule flattens every duration to 0.01ms under it -- correct
    // behaviour, useless for measuring motion. The preference is faked instead.
    await cdp.send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] },
      tab
    );
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/probe-motion.html?${query}` }, tab);

    let probe = null;
    for (let i = 0; i < 100; i++) {
      await sleep(250);
      probe = await cdp.eval(tab, 'window.__motionProbe');
      if (probe) break;
    }
    const reduced = await cdp.eval(
      tab,
      'matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "no-preference"'
    );
    await cdp.send('Target.closeTarget', { targetId });
    if (!probe) throw new Error('the probe never finished; a page error is in the log');
    if (probe.error) throw new Error(probe.error);
    return { probe, reduced };
  };

  console.log('post reorder (three posts, one removed)');
  {
    const { probe, reduced } = await runMode('mode=flip');
    check('the machine really is running the animations', reduced === 'no-preference', reduced);
    check('three posts to start with', probe.before.posts.length === 3, String(probe.before.posts.length));
    check('two posts after excluding one', probe.atCommit.posts.length === 2, String(probe.atCommit.posts.length));

    const displaced = probe.atCommit.posts
      .map((p) => ({ ...p, shift: matrix(p.transform).ty }))
      .filter((p) => p.shift > 1);
    check(
      'the surviving post starts where it was, not where it now is',
      displaced.length === 1,
      displaced.map((p) => `${p.id} +${Math.round(p.shift)}px`).join(', ')
    );
    check('the list is clipped while posts travel', probe.atCommit.listOverflow === 'hidden', probe.atCommit.listOverflow);

    const startShift = displaced[0]?.shift ?? 0;
    const midPost = probe.samples.some((s) => {
      const shift = Math.max(...s.posts.map((p) => matrix(p.transform).ty));
      return shift > 0.5 && shift < startShift * 0.9;
    });
    check('the displaced post is seen in flight', midPost, `${Math.round(startShift)}px start`);

    const startScale = probe.atCommit.scaleTransform;
    const midScale = probe.samples
      .map((s) => matrix(s.scaleTransform).a)
      .filter((a) => a > 0.05 && a < 0.995);
    check('the card re-fits as an animation, not a jump', midScale.length > 0,
      startScale === '-' ? 'scale only after the re-fit' : midScale.slice(0, 4).join(' → '));
    check(
      'the scale is replayed from the card top centre',
      probe.samples.some((s) => s.scaleOrigin.startsWith('50%')) || probe.atCommit.scaleOrigin.startsWith('50%'),
      probe.atCommit.scaleOrigin || probe.samples.find((s) => s.scaleOrigin)?.scaleOrigin || ''
    );

    check(
      'everything lands exactly where the layout put it',
      probe.settled.posts.every((p) => p.transform === '-') && probe.settled.scaleTransform === '-',
      probe.settled.posts.map((p) => p.transform).join(', ')
    );
    check('the clip is released afterwards', probe.settled.listOverflow === '', `"${probe.settled.listOverflow}"`);
    check(
      'the card re-fitted to its new height',
      probe.settled.zoom > probe.before.zoom,
      `${probe.before.zoom} → ${probe.settled.zoom}`
    );
  }

  console.log('\npictures: waiting, arriving, failing');
  {
    const { probe, reduced } = await runMode(
      `mode=picture&slow=${encodeURIComponent(`http://127.0.0.1:${picPort}/stall.jpg`)}&missing=${encodeURIComponent(`http://127.0.0.1:${picPort}/missing.jpg`)}`
    );
    check('the machine really is running the animations', reduced === 'no-preference', reduced);

    const waiting = probe.waiting.filter((v) => typeof v === 'number');
    check('the waiting cell breathes', Math.min(...waiting) < 0.7 && Math.max(...waiting) > 0.9,
      `${Math.min(...waiting)} … ${Math.max(...waiting)}`);

    check('a failed chain stops the breathing', probe.failureClass.includes('is-picture-missing'), probe.failureClass);
    const failing = probe.failing.filter((v) => typeof v === 'number');
    check('the failed cell holds still', Math.max(...failing) - Math.min(...failing) < 0.02,
      `${Math.min(...failing)} … ${Math.max(...failing)}`);

    const fade = probe.fade.filter((v) => typeof v === 'number');
    const mid = fade.filter((v) => v > 0.05 && v < 0.95);
    check('the picture dissolves in rather than cutting', mid.length > 0,
      mid.slice(0, 4).join(' → '));
    check('the placeholder ends hidden', fade.at(-1) === 0, String(fade.at(-1)));
    check('and the cell knows its picture arrived', probe.loadedClass.includes('is-picture-loaded'), probe.loadedClass);
  }
} catch (err) {
  console.error(`\nverification threw: ${err && err.message ? err.message : err}`);
  failures.push('run');
} finally {
  await cleanup();
}

console.log(
  failures.length === 0
    ? '\nVERDICT: APPROVE. Every animation moved the way docs/loading-states.md says it should.'
    : `\nVERDICT: ${failures.length} check(s) failed: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
