/**
 * Repository Hygiene Test Suite
 *
 * Mechanical invariants that no amount of review reliably catches, because each one
 * is a single character-level slip in a file nobody is reading closely.
 *
 * Every rule here was added after it was actually broken in a session, not
 * speculatively. Each maps to a concrete mistake:
 *
 *   hygiene.1  a `const current_level` slipped into App.tsx next to camelCase
 *              throughout, and was caught by eye rather than by a tool
 *   hygiene.2  `STORAGE_KEY` was hand-written in two files that could not import
 *              each other; a rename in one would desync them silently
 *   hygiene.3  the popup's locale list was hand-duplicated for the same reason,
 *              and a third locale added to i18n.ts would leave the popup behind
 *   hygiene.4  the popup's markup shipped the Chinese strings inline while the
 *              script rewrote them from a table, and nothing kept the two in
 *              step — so the user read a sentence and watched it change
 *
 * This is deliberately not a linter. It covers the shapes that actually recurred
 * and stays dependency-free, so it runs in the existing `npm test` gate. Note what
 * is *already* covered and therefore absent here: `Translations` is an interface, so
 * tsc already rejects a mistyped i18n key (verified by mutation).
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSuite } from '../env/harness.ts';
import { TRANSLATIONS } from '../../src/content/i18n.ts';
import { POPUP_COPY } from '../../src/content/popupCopy.ts';

const { test, run } = createSuite();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.scratch', '.openchamber', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// 1. Identifier naming
//
// Only the lower kind of snake_case is a violation. `STORAGE_KEY` and
// `FIXED_ZOOM_LEVELS` are the file's own convention for module constants, and
// `__filename` / `__dirname` are Node's. Flagging those would train the reader to
// ignore the rule.
const SNAKE_BEFORE_LOWER = /_(?=[a-z])/;
const DECLARATION = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;

test('hygiene.1: declared identifiers use camelCase, not lower snake_case', () => {
  const roots = ['src', 'tests', 'dev'];
  const violations: string[] = [];

  for (const root of roots) {
    for (const file of walk(join(REPO_ROOT, root))) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        // Prose about naming is not a violation, and a `#id` in a comment is not code.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const m of line.matchAll(DECLARATION)) {
          const name = m[1];
          if (name.startsWith('__')) continue;
          if (SNAKE_BEFORE_LOWER.test(name)) {
            violations.push(`${relative(REPO_ROOT, file)}:${i + 1}  ${name}`);
          }
        }
      });
    }
  }

  assert.deepEqual(
    violations,
    [],
    `lower snake_case declarations found; use camelCase (ALL_CAPS module constants stay allowed):\n  ${violations.join('\n  ')}`
  );
});

// 2. The popup is a build entry now, so it imports the storage key rather than
// spelling it out. A second spelling would be a silent desync again, so the
// rule became: there is only one.
test('hygiene.2: the storage key is declared once, and the popup imports it', () => {
  const popup = readFileSync(join(REPO_ROOT, 'src', 'content', 'popup.ts'), 'utf8');
  const prefs = readFileSync(join(REPO_ROOT, 'src', 'content', 'prefs.ts'), 'utf8');

  const keyOf = (src: string) => (src.match(/STORAGE_KEY\s*=\s*'([^']+)'/) || [])[1];
  const fromPrefs = keyOf(prefs);

  assert.ok(fromPrefs, 'could not find a STORAGE_KEY literal in src/content/prefs.ts');
  assert.equal(
    keyOf(popup),
    undefined,
    'the popup must not spell the key out; it imports it from prefs.ts'
  );
  assert.ok(
    popup.includes("import { STORAGE_KEY } from './prefs.ts'"),
    'the popup must import the key from the module that owns it'
  );
});

// 3. Same duplication, one level up: the supported locales. The popup's copy
// lives in `src/content/popupCopy.ts` now and is keyed by the same locale type,
// so the two cannot diverge — but the rule is still worth stating, because a
// locale added to one and not the other would leave the popup showing the
// browser's default for a preference the modal had already written.
test('hygiene.3: the popup supports exactly the locales i18n.ts declares', () => {
  const popupCopy = readFileSync(join(REPO_ROOT, 'src', 'content', 'popupCopy.ts'), 'utf8');

  // Every locale in the bundle must have a copy block in the popup.
  const missing: string[] = [];
  for (const locale of Object.keys(TRANSLATIONS)) {
    if (!popupCopy.includes(`'${locale}':`)) missing.push(locale);
  }
  assert.deepEqual(missing, [], `popupCopy.ts has no copy for: ${missing.join(', ')}`);

  // And the popup must not carry a locale the bundle dropped, or it ships dead copy.
  const popupLocales = [...popupCopy.matchAll(/^\s{2}'([a-z]{2}-[A-Z]{2})':\s*\{/gm)].map((m) => m[1]);
  assert.ok(
    popupLocales.length > 0,
    'found no locale blocks in popupCopy.ts -- if POPUP_COPY was reformatted, update this test rather than delete it'
  );
  const declared = Object.keys(TRANSLATIONS).sort();
  assert.deepEqual(
    popupLocales.slice().sort(),
    declared,
    'popupCopy.ts locale blocks and i18n.ts locales have diverged'
  );
});

// 4. The popup's markup ships the Chinese strings inline, because the popup
// paints before its script runs. The script then rewrites them from the copy
// table — so the two spellings have to agree, or the user reads one sentence
// and then watches it change.
//
// Nothing kept them agreeing: the markup is HTML, the copy is TypeScript, and
// a test that read the source of both would have pinned the prose rather than
// the words. So the words themselves are compared.
test('hygiene.4: the popup’s inline Chinese matches the copy the script writes', () => {
  const html = readFileSync(join(REPO_ROOT, 'public', 'popup.html'), 'utf8');
  const copy = POPUP_COPY['zh-CN'];

  // The markup's own text for a node, tags and whitespace removed.
  //
  // The element's content is read by tag balance rather than by the next
  // `</`: the tip carries `<kbd>` elements inside it, and a naive match would
  // stop at the first of them and read half a sentence.
  const markupText = (id: string): string | null => {
    // The whole opening tag, so the element's name is known: the tip carries
    // `<kbd>` elements inside it, and a naive match would stop at the first of
    // them and read half a sentence.
    const open = html.match(new RegExp(`<([a-zA-Z]+)[^>]*id="${id}"[^>]*>`));
    if (!open || open.index === undefined) return null;
    const start = open.index + open[0].length;
    const end = html.indexOf(`</${open[1]}>`, start);
    if (end < 0) return null;
    return html.slice(start, end).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };

  // The plain words of a copy line: the markup cannot carry the markup inside
  // the tip (the <kbd> elements are the point of it), so the tags are dropped
  // from both sides before they are compared.
  const plain = (text: string): string => text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  const pairs: Array<[string, string]> = [
    ['toggle-title', copy.toggleTitle],
    ['toggle-desc', copy.toggleDesc],
    ['tip-text', copy.tip],
    ['btn-text', copy.trigger],
  ];

  for (const [id, expected] of pairs) {
    const actual = markupText(id);
    assert.ok(actual !== null, `popup.html has no node with id="${id}"`);
    assert.equal(
      plain(actual),
      plain(expected),
      `popup.html's "${id}" and POPUP_COPY's Chinese disagree: "${plain(actual)}" against "${plain(expected)}"`
    );
  }
});

// 5. Dead imports in the files tsc cannot see.
//
// `tests/tiers/**` and `tests/tier5_adversarial.ts` are in no tsconfig (see
// tsconfig.test-support.json for why: the shim's `DomElement` is not an
// `Element`), so `noUnusedLocals` never reaches them. knip cannot stand in: it
// reports unused *exports*, and an import that nothing reads still reads as a
// use of the exported name. An import left behind by a refactor therefore
// survives build and lint together -- which is how `THREAD_HTML` sat unused in
// `tier_resolver.test.ts` after the test that read it moved to another fixture.
//
// Only the count of a binding's occurrences outside the import block is read, so
// a name mentioned in a comment counts as used: this under-reports, and an
// under-reporting check is the one that can run unattended.
const IMPORT_STATEMENT =
  /^import\s+(?:type\s+)?(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\}|\*\s+as\s+([\w$]+)|([\w$]+))\s+from\s+[^;]+;?/gm;

function importedBindings(src: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(IMPORT_STATEMENT)) {
    if (m[1]) names.push(m[1]);
    if (m[3]) names.push(m[3]);
    if (m[4]) names.push(m[4]);
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '');
        if (!cleaned) continue;
        names.push(cleaned.split(/\s+as\s+/).pop()!.trim());
      }
    }
  }
  return names;
}

test('hygiene.4: no test file imports a name it never reads', () => {
  const violations: string[] = [];

  for (const root of ['tests']) {
    for (const file of walk(join(REPO_ROOT, root))) {
      const src = readFileSync(file, 'utf8');
      const body = src.replace(IMPORT_STATEMENT, '');
      for (const name of importedBindings(src)) {
        const escaped = name.replace(/\$/g, '\\$');
        if (!new RegExp(`\\b${escaped}\\b`).test(body)) {
          violations.push(`${relative(REPO_ROOT, file)}  ${name}`);
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `imports nothing reads (drop them):\n  ${violations.join('\n  ')}`
  );
});

// 6. A tab's `url` is only present when the extension holds the "tabs" permission
// or host permission for that page (developer.chrome.com/docs/extensions/reference/api/tabs).
//
// The popup's quick-trigger button gated on `activeTab.url` while manifest.json
// granted neither "tabs" nor "activeTab" and no x.com host permission, so `url` was
// undefined on every page: the gate rejected all tabs, including X, and the button
// could never reach the content script. Nothing saw it -- the popup was a plain
// script that `node --check` only parsed, and no test drove it. The reachability
// question belongs to the send, whose `chrome.runtime.lastError` says whether a
// receiver exists at all.
test('hygiene.6: the popup reads no tab property the manifest cannot grant', () => {
  const popup = readFileSync(join(REPO_ROOT, 'src', 'content', 'popup.ts'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'manifest.json'), 'utf8')) as {
    permissions?: string[];
  };

  const permissions = manifest.permissions || [];
  if (permissions.includes('tabs') || permissions.includes('activeTab')) return;

  // Comments are stripped first: this file's own explanation of the bug names the
  // property, and prose about a violation is not a violation.
  const code = popup
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  const reads = [
    ...code.matchAll(/\b(?:activeTab|tab|tabs\[0\])\.(url|pendingUrl|title|favIconUrl)\b/g),
  ].map((m) => m[0]);

  assert.deepEqual(
    reads,
    [],
    `src/content/popup.ts reads ${reads.join(', ')} but manifest.json declares neither "tabs" nor "activeTab", so the value is always undefined. Decide from chrome.runtime.lastError instead.`
  );
});

export function runTierHygiene() {
  return run();
}
