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
import { TRANSLATIONS } from '../../src/content/i18n.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

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

export async function runTierHygiene(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      const elapsed = Date.now() - start;
      results.push({ name: t.name, passed: true, durationMs: elapsed });
      passed++;
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      results.push({ name: t.name, passed: false, error: errorMsg, durationMs: elapsed });
      failed++;
    }
  }

  return { total: tests.length, passed, failed, results };
}
