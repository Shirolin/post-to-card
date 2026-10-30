/**
 * Loads the built extension into a real Chrome and reports what only a browser can
 * confirm: that the manifest parses, the MV3 worker boots, storage works, and the
 * content script initialises on the origin the manifest matches.
 *
 * Zero dependencies on purpose. Node 24 ships a global `WebSocket`, which is the
 * only reason a CDP client fits in a file this size. Run it with plain `node` --
 * nothing here needs the Vite harness.
 *
 *   node dev/verify-extension.mjs                    # default checks
 *   node dev/verify-extension.mjs --url https://x.com/
 *   node dev/verify-extension.mjs --keep-open        # leave the browser up
 *
 * Three environment facts, each learned the hard way, are worth keeping in mind
 * before changing anything here:
 *
 *   1. `--load-extension` is dead. Chrome removed the command-line switch for
 *      security, and the `--disable-features=DisableLoadExtensionCommandLineSwitch`
 *      bypass went with it. `Extensions.loadUnpacked` over CDP is the replacement,
 *      and it needs no extra launch flag.
 *   2. Headed, not headless. Headless Chrome is identified by its UA and x.com
 *      answers `403`, so the tab lands on `chrome-error://chromewebdata/` and the
 *      content script never runs. A headless flag here produces a clean-looking
 *      run that verified nothing.
 *   3. The debug port is not free. A browser may already hold 9222 -- MCP-managed
 *      browsers often do -- and a second Chrome then fails to bind *silently*:
 *      no error, no `DevToolsActivePort` file, just a fetch that never connects.
 *      Pick a free port rather than assuming the default.
 *
 * What this cannot do: exercise the extractor. Logged out, x.com serves a ~41KB
 * client-rendered shell with zero `data-testid`, so there is no tweet markup to
 * read. For that, sample real markup offline per
 * `docs/real-dom-sampling-checklist.md` -- one `article` outerHTML per scenario.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
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

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const failures = [];
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(label);
  return ok;
}

/** Ask the OS for a port nobody is holding, rather than assuming 9222 is free. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
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
  console.error(`No Chrome found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}\nSet CHROME_PATH.`);
  process.exit(1);
}
if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error(`${DIST}/manifest.json is missing. Run \`npm run build\` first -- loading a stale or absent bundle is how you verify nothing.`);
  process.exit(1);
}

const port = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'ptc-verify-'));
console.log(`chrome    ${chrome}`);
console.log(`extension ${DIST}`);
console.log(`debug     127.0.0.1:${port} (probed free)\n`);

const proc = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let cdp;
try {
  cdp = await Cdp.connect(await waitForBrowser(port));
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  console.log('load');
  const { id: extId } = await cdp.send('Extensions.loadUnpacked', { path: DIST });
  check('unpacked build accepted', !!extId, extId);

  let sw = null;
  for (let i = 0; i < 30 && !sw; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    sw = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(extId));
    if (!sw) await sleep(300);
  }
  if (!check('MV3 service worker target exists', !!sw)) {
    console.log('\nnothing else can be trusted without a booted worker');
  } else {
    const swSession = await cdp.attach(sw.targetId);
    const workerLogs = [];
    cdp.on((msg) => {
      if (msg.sessionId !== swSession) return;
      if (msg.method === 'Runtime.exceptionThrown') {
        workerLogs.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      }
    });

    const manifest = JSON.parse(await cdp.eval(swSession, 'JSON.stringify(chrome.runtime.getManifest())'));
    console.log('\nmanifest as the worker reads it');
    check('name', manifest.name === 'Post-to-Card', manifest.name);
    check('manifest_version 3', manifest.manifest_version === 3);
    check('permissions are exactly clipboardWrite + storage',
      JSON.stringify([...manifest.permissions].sort()) === JSON.stringify(['clipboardWrite', 'storage']),
      JSON.stringify(manifest.permissions));
    check('content script matches the X origins',
      (manifest.content_scripts?.[0]?.matches || []).every((m) => /twitter\.com|x\.com/.test(m)),
      JSON.stringify(manifest.content_scripts?.[0]?.matches));

    const roundtrip = await cdp.eval(swSession,
      `(async () => { await chrome.storage.local.set({ __v: 1 }); const g = await chrome.storage.local.get('__v');
         await chrome.storage.local.remove('__v'); return g.__v === 1; })()`);
    check('chrome.storage.local roundtrip', roundtrip === true);

    await sleep(800);
    check('worker logged no exceptions', workerLogs.length === 0, workerLogs.join(' | ').slice(0, 200));
  }

  const url = opt('--url', null);
  if (url) {
    console.log(`\nvisit ${url}`);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const page = await cdp.attach(targetId);
    const entries = [];
    cdp.on((msg) => {
      if (msg.sessionId !== page) return;
      if (msg.method === 'Runtime.consoleAPICalled') {
        entries.push({
          ours: /chrome-extension:\/\//.test(msg.params.stackTrace?.callFrames?.[0]?.url || ''),
          kind: msg.params.type,
          text: (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120),
        });
      } else if (msg.method === 'Runtime.exceptionThrown') {
        entries.push({ ours: true, kind: 'EXCEPTION', text: String(msg.params.exceptionDetails.exception?.description || '').slice(0, 160) });
      }
    });

    await cdp.send('Page.enable', {}, page);
    await cdp.send('Page.navigate', { url }, page);
    await sleep(9000);

    const where = await cdp.eval(page, 'location.href');
    const landed = check('page loaded (not chrome-error)', !where.startsWith('chrome-error'), where);
    if (landed) {
      const probe = JSON.parse(await cdp.eval(page, `JSON.stringify({
        host: location.host,
        active: document.documentElement.getAttribute('data-post-to-card') === 'true',
        hostElement: !!document.querySelector('post-to-card-container'),
        tweets: document.querySelectorAll('article[data-testid="tweet"]').length,
      })`));
      console.log(`        host=${probe.host} tweets in DOM=${probe.tweets}`);
      // The entry marks <html> rather than logging: a console line here would
      // print into every X user's console on every page load, which is what
      // this check used to require of it.
      check('content script announced itself', probe.active === true);
    } else {
      console.log('        Headless Chrome gets a 403 from x.com. Run headed.');
    }

    console.log('\nconsole, split by owner');
    const ours = entries.filter((e) => e.ours);
    const theirs = entries.filter((e) => !e.ours);
    console.log(`  from this extension (${ours.length}):`);
    ours.forEach((e) => console.log(`    [${e.kind}] ${e.text}`));
    console.log(`  from the page itself (${theirs.length}) -- not ours, listed only so it is not mistaken for a regression:`);
    theirs.forEach((e) => console.log(`    [${e.kind}] ${e.text}`));
    check('extension threw nothing on the page', !entries.some((e) => e.ours && e.kind === 'EXCEPTION'));
  }
} finally {
  if (!flag('--keep-open')) {
    cdp?.close();
    proc.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  } else {
    console.log(`\n--keep-open: Chrome is still running on port ${port}, profile ${profile}`);
  }
}

console.log(failures.length ? `\n${failures.length} check(s) failed: ${failures.join(', ')}` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
