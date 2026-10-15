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
 *   hygiene.2  `STORAGE_KEY` is hand-written in two files that cannot import each
 *              other; a rename in one would desync them silently
 *   hygiene.3  the popup's locale list is hand-duplicated for the same reason, and
 *              a third locale added to i18n.ts would leave the popup behind
 *
 * This is deliberately not a linter. It covers the two shapes that actually recurred
 * and stays dependency-free, so it runs in the existing `npm test` gate. Note what
 * is *already* covered and therefore absent here: `Translations` is an interface, so
 * tsc already rejects a mistyped i18n key (verified by mutation), and `npm run
 * typecheck` parses `public/`, which tsconfig's `include` does not cover.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSuite } from '../env/harness.ts';
import { TRANSLATIONS } from '../../src/content/i18n.ts';

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

// 2. The storage key is declared in two files that cannot import each other:
// `public/popup.js` is plain script loaded by a <script> tag, `src/content/prefs.ts`
// is bundled. Both spell it out. They agree today; nothing kept them agreeing.
test('hygiene.2: STORAGE_KEY is spelled identically in the popup and in prefs.ts', () => {
  const popup = readFileSync(join(REPO_ROOT, 'public', 'popup.js'), 'utf8');
  const prefs = readFileSync(join(REPO_ROOT, 'src', 'content', 'prefs.ts'), 'utf8');

  const keyOf = (src: string) => (src.match(/STORAGE_KEY\s*=\s*'([^']+)'/) || [])[1];
  const fromPopup = keyOf(popup);
  const fromPrefs = keyOf(prefs);

  assert.ok(fromPopup, 'could not find a STORAGE_KEY literal in public/popup.js');
  assert.ok(fromPrefs, 'could not find a STORAGE_KEY literal in src/content/prefs.ts');
  assert.equal(
    fromPopup,
    fromPrefs,
    `storage key drifted: popup.js says "${fromPopup}", prefs.ts says "${fromPrefs}"`
  );
});

// 3. Same duplication, one level up: the supported locales. popup.js carries its own
// copy keyed by locale id, and its own comment warns that a third locale means
// editing both files. This enforces that warning instead of trusting it.
test('hygiene.3: the popup supports exactly the locales i18n.ts declares', () => {
  const popup = readFileSync(join(REPO_ROOT, 'public', 'popup.js'), 'utf8');

  // Every locale in the bundle must have a hand-written copy block in the popup.
  const missing: string[] = [];
  for (const locale of Object.keys(TRANSLATIONS)) {
    if (!popup.includes(`'${locale}':`)) missing.push(locale);
  }
  assert.deepEqual(missing, [], `popup.js has no copy for: ${missing.join(', ')}`);

  // And the popup must not carry a locale the bundle dropped, or it ships dead copy.
  const popupLocales = [...popup.matchAll(/^\s{2}'([a-z]{2}-[A-Z]{2})':\s*\{/gm)].map((m) => m[1]);
  assert.ok(
    popupLocales.length > 0,
    'found no locale blocks in popup.js -- if COPY was reformatted, update this test rather than delete it'
  );
  const declared = Object.keys(TRANSLATIONS).sort();
  assert.deepEqual(
    popupLocales.slice().sort(),
    declared,
    'popup.js locale blocks and i18n.ts locales have diverged'
  );
});

// 4. Dead imports in the files tsc cannot see.
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

// 5. A tab's `url` is only present when the extension holds the "tabs" permission
// or host permission for that page (developer.chrome.com/docs/extensions/reference/api/tabs).
//
// The popup's quick-trigger button gated on `activeTab.url` while manifest.json
// granted neither "tabs" nor "activeTab" and no x.com host permission, so `url` was
// undefined on every page: the gate rejected all tabs, including X, and the button
// could never reach the content script. Nothing saw it -- `node --check` only parses
// popup.js, and no test drives the popup. The reachability question belongs to the
// send, whose `chrome.runtime.lastError` says whether a receiver exists at all.
test('hygiene.5: the popup reads no tab property the manifest cannot grant', () => {
  const popup = readFileSync(join(REPO_ROOT, 'public', 'popup.js'), 'utf8');
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
    `public/popup.js reads ${reads.join(', ')} but manifest.json declares neither "tabs" nor "activeTab", so the value is always undefined. Decide from chrome.runtime.lastError instead.`
  );
});

export function runTierHygiene() {
  return run();
}
