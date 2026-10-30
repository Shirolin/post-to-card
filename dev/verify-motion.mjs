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
 * page mounts the real `App`/`Card`), drives three exclusion gestures, a ratio
 * switch, a picture session and a round of author blurs, samples every frame,
 * and asserts on the numbers rather than on how a screenshot looks.
 * `docs/loading-states.md` explains what each animation is for.
 *
 * Not in `npm test`: these are timings, and a loaded machine or a browser that
 * ignores the emulated preference would report a false failure. It is a review
 * tool, run before touching `App.tsx`'s fit/FLIP, `Card.tsx`'s picture path or
 * the author blur.
 *
 *   node dev/verify-motion.mjs
 *
 * Headless by default -- a window another window covers is a window Chrome may
 * stop drawing, which turns "the animation did not run" into a false failure.
 * `PTC_HEADED=1` opens one, for watching the motion happen.
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
  // `startsWith`, not equality: the probe appends a query string to the same
  // path to force a second request, and a 404 that becomes a stall would make
  // the "a real failure still marks the cell" check pass for the wrong reason.
  if (req.url && req.url.startsWith('/missing')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('no');
    return;
  }
  // A picture whose small variant is gone while the full one never answers: the
  // stand-in's own failure path, which is not the picture failing. Keyed on the
  // query, because that is the only thing `getPhotoPreviewUrl` changes.
  if (req.url && req.url.includes('name=small')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('no');
    return;
  }
  // Anything else: deliberately never answers, so the cell stays in its wait state.
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
// Headless by default: this is a check, and a window that another window covers
// is a window Chrome may stop drawing -- which turns "the animation did not run"
// into a flaky verdict. `PTC_HEADED=1` opens it, for watching the motion happen.
const headed = headedByFlag === '1';

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

  /**
   * Opens the probe page and waits for it to answer.
   *
   * `keepOpen` leaves the tab alive: a mode whose measurement has to happen
   * *between* two states of the page (a screenshot before a click and after it)
   * needs the page to outlive this call.
   */
  const runMode = async (query, reducedMotion = 'no-preference', keepOpen = false) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const tab = await cdp.attach(targetId);
    await cdp.send('Page.enable', {}, tab);
    // A tab the browser considers hidden does not get frames, and this probe is
    // made of frames.
    await cdp.send('Page.bringToFront', {}, tab);
    // This machine reports "reduce animations" at the OS level, and the dialog's
    // global rule flattens every duration to 0.01ms under it -- correct
    // behaviour, useless for measuring motion. Every mode that measures travel
    // therefore fakes `no-preference`; the spinner mode is the one that needs
    // the real preference, because its whole question is what the ring does
    // *under* it.
    await cdp.send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: reducedMotion }] },
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
    const pageLog = probe ? '' : await cdp.eval(tab, 'document.querySelector("#out")?.textContent || ""');
    if (!keepOpen) await cdp.send('Target.closeTarget', { targetId });
    if (!probe) throw new Error(`the probe never finished. Last page log:\n${pageLog}`);
    if (probe.error) throw new Error(probe.error);
    return { probe, reduced, targetId, session: tab };
  };

  console.log('post reorder: three posts, one removed, down to one, then back');
  {
    const { probe, reduced } = await runMode('mode=flip');
    check('the machine really is running the animations', reduced === 'no-preference', reduced);

    const a = probe.a;
    check('three posts to start with', a.before.posts.length === 3, String(a.before.posts.length));
    check('two posts after excluding one', a.atCommit.posts.length === 2, String(a.atCommit.posts.length));

    const displaced = a.atCommit.posts
      .map((p) => ({ ...p, shift: matrix(p.transform).ty }))
      .filter((p) => p.shift > 1);
    check(
      'the surviving post starts where it was, not where it now is',
      displaced.length === 1,
      displaced.map((p) => `${p.id} +${Math.round(p.shift)}px`).join(', ')
    );
    check(
      'a post that stays keeps its own DOM, not a neighbour’s',
      a.before.posts.find((p) => p.id === 't3')?.tag ===
        a.settled.posts.find((p) => p.id === 't3')?.tag,
      `t3 ${a.before.posts.find((p) => p.id === 't3')?.tag} → ${a.settled.posts.find((p) => p.id === 't3')?.tag}`
    );
    check('the list is clipped while posts travel', a.atCommit.listOverflow === 'hidden', a.atCommit.listOverflow);

    const startShift = displaced[0]?.shift ?? 0;
    const midPost = a.samples.some((s) => {
      const shift = Math.max(...s.posts.map((p) => matrix(p.transform).ty));
      return shift > 0.5 && shift < startShift * 0.9;
    });
    check('the displaced post is seen in flight', midPost, `${Math.round(startShift)}px start`);

    const midScale = a.samples
      .map((s) => matrix(s.scaleTransform).a)
      .filter((v) => v > 0.05 && v < 0.995);
    check('the card re-fits as an animation, not a jump', midScale.length > 0, midScale.slice(0, 4).join(' → '));
    check(
      'the scale is replayed from the card top centre',
      [...a.samples, a.atCommit].some((s) => s.scaleOrigin.startsWith('50%')),
      a.atCommit.scaleOrigin || a.samples.find((s) => s.scaleOrigin)?.scaleOrigin || ''
    );

    check(
      'everything lands exactly where the layout put it',
      a.settled.posts.every((p) => p.transform === '-') && a.settled.scaleTransform === '-',
      a.settled.posts.map((p) => p.transform).join(', ')
    );
    check('the clip is released afterwards', a.settled.listOverflow === '', `"${a.settled.listOverflow}"`);
    check(
      'the card re-fitted to its new height',
      a.settled.zoom > a.before.zoom,
      `${a.before.zoom} → ${a.settled.zoom}`
    );
    check(
      'and is shorter by the post it lost',
      a.settled.height < a.before.height,
      `${a.before.height} → ${a.settled.height}`
    );

    // 2 → 1: the card becomes one post, which is a different tree. There is
    // nothing inside it to move, and the card itself must still re-fit.
    const b = probe.b;
    check('a one-post card draws no posts to move', b.settled.posts.length === 0, String(b.settled.posts.length));
    check('and it is the single-post layout', b.settled.single === true, String(b.settled.single));
    check(
      'nothing inside it is displaced or faded',
      [b.atCommit.singleStyle, b.settled.singleStyle].every(
        (s) => s && s.transform === '-' && s.opacity === '1.00'
      ),
      JSON.stringify([b.atCommit.singleStyle, b.settled.singleStyle])
    );
    const bMid = b.samples
      .map((s) => matrix(s.scaleTransform).a)
      .filter((v) => v > 0.05 && v < 0.995);
    check(
      'but the card itself still re-fits, as an animation',
      bMid.length > 0 && b.settled.zoom !== b.before.zoom,
      `${b.before.zoom} → ${b.settled.zoom} via ${bMid.slice(0, 3).join(' → ')}`
    );

    // 1 → 2: only the post that came back is new. Decided by which posts were
    // on the card, not by which ones were measured -- the old card measured none.
    const c = probe.c;
    const stayed = c.atCommit.posts.find((p) => p.id === 't1');
    // Which post comes back is the panel's business; what matters is that the
    // one that was already on the card is not treated as new, and the other is.
    const fading = c.atCommit.posts.filter((p) => Number(p.opacity) <= 0.05);
    check('the restored post comes back', c.atCommit.posts.length === 2, String(c.atCommit.posts.length));
    check(
      'the post that was already on the card does not fade',
      Number(stayed?.opacity) >= 0.95,
      String(stayed?.opacity)
    );
    check(
      'only the post that returned fades in',
      fading.length === 1 && fading[0].id !== 't1',
      c.atCommit.posts.map((p) => `${p.id}:${p.opacity}`).join(', ')
    );
    check(
      'and both end fully opaque',
      c.settled.posts.every((p) => Number(p.opacity) >= 0.99),
      c.settled.posts.map((p) => p.opacity).join(', ')
    );
  }

  console.log('\nratio switch: 3:4 to 16:9, one layout and one refit');
  {
    const { probe, reduced } = await runMode('mode=ratio');
    check('the machine really is running the animations', reduced === 'no-preference', reduced);

    check('the click landed on the card’s own ratio', probe.settled.ratio === '16:9', probe.settled.ratio);
    check(
      'and the card really changed shape',
      probe.settled.height < probe.before.height,
      `${probe.before.height} → ${probe.settled.height}`
    );

    // The proof that the removed transitions are gone: these two were what they
    // drove, and both moved frame by frame under the old sheet. `margin-top` is
    // the grid's, `itemMaxHeight` is the picture's cap; either one transitioning
    // is a layout property animating inside the measured card.
    const animated = ['marginTop', 'itemMaxHeight']
      .map((key) => ({ key, values: [...new Set(probe.samples.map((s) => s.layout?.[key]))] }))
      .filter((entry) => entry.values.length > 1);
    check(
      'the switch leaves no layout property animating',
      animated.length === 0,
      animated.length
        ? animated.map((e) => `${e.key}: ${e.values.slice(0, 4).join(' → ')}`).join('; ')
        : 'margin-top and the picture cap each hold one value'
    );

    const heights = probe.samples.map((s) => s.height);
    let changingFrames = 0;
    for (let i = 1; i < heights.length; i++) if (heights[i] !== heights[i - 1]) changingFrames++;
    check(
      'the measured height arrives in one layout, not a transition',
      changingFrames <= 2,
      `${changingFrames} changing frames of ${heights.length}`
    );

    // And the effect: one new height means one new zoom, rather than a fit
    // re-derived per frame and a scale replay restarted per frame.
    const zooms = new Set(probe.samples.map((s) => s.zoom));
    check(
      'so the fit is derived once, not once per frame',
      zooms.size <= 2,
      `${zooms.size} distinct zooms: ${[...zooms].join(', ')}`
    );

    // A ratio the user picked is a command, not a consequence: the card is the
    // new shape on the next frame, with no scale replay. `docs/loading-states.md`
    // draws the line at "the button says the card is 100% now"; the ratio
    // control says the same thing about the shape.
    const mid = probe.samples
      .map((s) => matrix(s.scaleTransform).a)
      .filter((v) => v > 0.05 && v < 0.995);
    check('the picked shape is applied, not animated into', mid.length === 0, mid.slice(0, 4).join(' → ') || 'no intermediate scales');
    check(
      'and the card is at its own scale on the commit frame',
      matrix(probe.atCommit.scaleTransform).a === 1 || probe.atCommit.scaleTransform === '-',
      probe.atCommit.scaleTransform
    );
  }

  console.log('\npictures: waiting, arriving, failing');
  {
    // `preview` carries a hostname Chrome resolves to loopback and that the
    // product's own rule accepts as an X picture (`*.localhost` is loopback by
    // spec; the label is what `isTwimgPhoto` looks for), so the stand-in is
    // derived and then 404s while the picture itself never answers. A plain
    // `127.0.0.1` address would derive no stand-in at all, and the real
    // `pbs.twimg.com` would be upgraded to HTTPS before it ever reached us.
    const { probe, reduced } = await runMode(
      `mode=picture&slow=${encodeURIComponent(`http://127.0.0.1:${picPort}/stall.jpg`)}&missing=${encodeURIComponent(`http://127.0.0.1:${picPort}/missing.jpg`)}&preview=${encodeURIComponent(`http://pbs.twimg.com.localhost:${picPort}/media/full.jpg`)}`
    );
    check('the machine really is running the animations', reduced === 'no-preference', reduced);

    // The sweep's colour has to be a step off the recess it lies on, in one
    // direction, on every material. Mixing toward `--surface` could not promise
    // that: it is the darker of the two on the dark materials and equal to the
    // recess on glass. Read from the painted pixel rather than the colour
    // string, so the check survives any syntax that paints the same thing.
    const luminance = ([r, g, b]) => {
      const f = (c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const sheen = (probe.sheenReport || []).map((s) => {
      const recess = luminance(s.recess);
      const lifted = s.lifted ? luminance(s.lifted) : recess;
      return {
        theme: s.theme,
        lift: lifted > recess,
        ratio: (Math.max(recess, lifted) + 0.05) / (Math.min(recess, lifted) + 0.05),
      };
    });
    // Not merely brighter: a lift and nothing more. The white-mix fallback also
    // brightens, but on a dark recess it is a splash (2.7:1), which is the same
    // failure in the other direction -- the highlight stops reading as the
    // material lit. The band holds both ends.
    const flat = sheen.filter((s) => !s.lift || s.ratio < 1.03 || s.ratio > 1.6);
    check(
      'the sweep lifts every material’s recess by a step, not a splash',
      sheen.length === 12 && flat.length === 0,
      flat.length
        ? flat.map((s) => `${s.theme || '?'} ${s.ratio.toFixed(2)}`).join(', ')
        : `${sheen.length} materials, ${Math.min(...sheen.map((s) => s.ratio)).toFixed(2)}–${Math.max(...sheen.map((s) => s.ratio)).toFixed(2)}:1`
    );

    const waiting = probe.waiting.filter((v) => typeof v === 'string' && v);
    const swept = new Set(waiting).size;
    check('the waiting cell sweeps its highlight', swept >= 4, `${swept} distinct transforms`);

    check('a failed chain stops the sweep', probe.failureClass.includes('is-picture-missing'), probe.failureClass);
    const failing = probe.failing.filter((v) => typeof v === 'string' && v);
    check('the failed cell holds still', new Set(failing).size === 1, `${new Set(failing).size} distinct transforms`);
    check(
      'a failed cell marks the picture as not coming',
      probe.missingIcon === 1,
      String(probe.missingIcon)
    );

    // The stand-in is the picture's second request. When only it fails, the
    // picture is still coming: the sweep has to stop (nothing left to announce)
    // while the cell keeps waiting rather than claiming a failure.
    check(
      'a small variant that fails stops the sweep',
      probe.previewFailed.length > 0 && new Set(probe.previewFailed).size === 1,
      `${probe.previewFailed.length} readings, ${new Set(probe.previewFailed).size} distinct`
    );
    check(
      'without calling the picture failed',
      !probe.previewFailClass.includes('is-picture-missing'),
      probe.previewFailClass
    );
    check(
      'and without showing the missing mark',
      probe.previewFailIcon === 0,
      String(probe.previewFailIcon)
    );

    const fade = probe.fade.filter((v) => typeof v === 'number');
    const mid = fade.filter((v) => v > 0.05 && v < 0.95);
    check('the picture dissolves in rather than cutting', mid.length > 0,
      mid.slice(0, 4).join(' → '));
    check('the placeholder ends hidden', fade.at(-1) === 0, String(fade.at(-1)));
    check('and the cell knows its picture arrived', probe.loadedClass.includes('is-picture-loaded'), probe.loadedClass);

    const swap = probe.exportSwap;
    check(
      'the export really swapped the source',
      swap.duringSwap.isDataUrl && swap.duringSwap.marked,
      JSON.stringify(swap.duringSwap)
    );
    check(
      "and the card did not take the stand-in for the picture",
      swap.duringSwap.loaded === false,
      swap.class
    );
    check(
      'nor remembered as the picture’s shape',
      Number.parseFloat(swap.ratioAfterRealLoad) > 1.4,
      `a real 1.6 picture left the box at "${swap.ratioAfterRealLoad}"`
    );
    check('the mark is gone once the sources are put back', swap.afterSwap.marked === false);
    check('the original source is back', swap.afterSwap.srcRestored === true);
    check('and the cell is still waiting', swap.afterSwap.loaded === false, swap.class);

    check(
      'an error the exporter caused does not stop the sweep',
      probe.exportError.missingWhileMarked === false,
      `is-picture-missing while marked: ${probe.exportError.missingWhileMarked}`
    );
    check(
      'while a real failure still does',
      probe.exportError.missingAfter === true,
      `is-picture-missing after: ${probe.exportError.missingAfter}`
    );
  }

  console.log('\nthe author blur: does it survive the portrait box?');
  {
    const { probe, reduced, targetId, session } = await runMode('mode=blur', 'no-preference', true);
    check('the machine really is running the animations', reduced === 'no-preference', reduced);
    check('the avatars decoded before they were measured',
      Array.isArray(probe.loaded) && probe.loaded.length === 3 && probe.loaded.every(Boolean),
      JSON.stringify(probe.loaded));

    // A screenshot per portrait, before and after that post's author is taken
    // back to sharp. `__sharpness` decodes each one in the page and answers how
    // many levels a neighbouring pixel differs by -- the pixels, not the
    // `filter` declaration, because a dropped blur still leaves the declaration
    // in place.
    const readAll = async (rects) => {
      const values = [];
      for (const rect of rects) {
        const shot = await cdp.send(
          'Page.captureScreenshot',
          { format: 'png', clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } },
          session
        );
        values.push(await cdp.eval(session, `window.__sharpness(${JSON.stringify(`data:image/png;base64,${shot.data}`)})`));
      }
      return values;
    };

    const tab = { session, targetId };
    const blurred = await readAll(probe.before.rects);
    await cdp.eval(session, 'window.__unblurFirst()');
    await sleep(250);
    const sharp = await readAll(probe.before.rects);
    const after = await cdp.eval(session, 'window.__after()');
    await cdp.send('Target.closeTarget', { targetId });

    // The first post's author is the one that was cleared; the other two keep
    // their blur.
    check(
      'the class reached the pixels: a blurred author is drawn softened',
      sharp[0] > blurred[0] * 1.15,
      `neighbour difference ${blurred[0].toFixed(2)} blurred vs ${sharp[0].toFixed(2)} sharp`
    );
    // The other two keep their blur. They are the control for "measured the same
    // thing twice", and since all three portraits are the same picture they can
    // also be compared against the *sharp* reading: a portrait that was never
    // blurred would sit at that number, not far below it.
    check(
      'and only the post that was cleared changed',
      [1, 2].every((i) => Math.abs(sharp[i] - blurred[i]) < blurred[0] * 0.15) &&
        [1, 2].every((i) => blurred[i] < sharp[0] * 0.5) &&
        !after.classes[0].includes('is-blurred') &&
        after.classes[1].includes('is-blurred') &&
        after.classes[2].includes('is-blurred'),
      `${blurred.map((v, i) => `${v.toFixed(2)}→${sharp[i].toFixed(2)}`).join(' / ')} | ${after.classes.join(' , ')}`
    );
  }

  // Both preferences, because the failure this covers only exists under one of
  // them: the dialog's blanket rule runs once at 0.01ms, so a ring that inherits
  // it holds its first frame forever and reads as stopped rather than busy.
  for (const preference of ['no-preference', 'reduce']) {
    console.log(`\nthe wait ring: ${preference}`);
    const { probe } = await runMode('mode=spinner', preference);
    check(
      'the emulated preference is the one measured',
      probe.reduced === (preference === 'reduce'),
      String(probe.reduced)
    );
    check('the ring was on screen to sample', probe.frames > 10, `${probe.frames} frames`);
    check(
      'it runs one animation, and it repeats',
      probe.names.length === 1 && probe.names[0].includes('infinite'),
      probe.names.join(' | ')
    );
    // A moving ring changes either its angle or its brightness; a frozen one
    // holds exactly one value for every frame, which is how the bug read.
    check(
      'and it is still moving',
      new Set(probe.opacity).size > 1 || probe.names[0].includes('ptc-spin'),
      `${new Set(probe.opacity).size} distinct opacities`
    );
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
