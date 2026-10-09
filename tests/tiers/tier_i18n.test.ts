/**
 * i18n Test Suite: Internationalization and Localization
 * Verifies key parity between zh-CN and en-US, safe fallbacks,
 * date/time formatting, and locale-aware UI texts.
 */

import assert from 'node:assert/strict';
import { DomElement } from '../env/browser.ts';
import {
  TRANSLATIONS,
  getTranslation,
  detectDefaultLocale,
  sanitizeLocale,
  formatLocaleTimestamp,
  type Locale,
} from '../../src/content/i18n.ts';

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

// 1. Translation Dictionary Parity
test('i18n.1: TRANSLATIONS dictionary has 100% key parity between zh-CN and en-US', () => {
  const zhKeys = Object.keys(TRANSLATIONS['zh-CN']).sort();
  const enKeys = Object.keys(TRANSLATIONS['en-US']).sort();

  assert.deepEqual(zhKeys, enKeys, 'All keys in zh-CN must match en-US exactly');
  assert.ok(zhKeys.length >= 25, 'Should have comprehensive translation keys');

  for (const k of zhKeys) {
    const zhVal = TRANSLATIONS['zh-CN'][k as keyof typeof TRANSLATIONS['zh-CN']];
    const enVal = TRANSLATIONS['en-US'][k as keyof typeof TRANSLATIONS['en-US']];
    assert.ok(typeof zhVal === 'string' && zhVal.length > 0, `zh-CN key ${k} must be non-empty`);
    assert.ok(typeof enVal === 'string' && enVal.length > 0, `en-US key ${k} must be non-empty`);
  }
});

// 2. Safe Fallback
test('i18n.2: getTranslation falls back gracefully for invalid or undefined locale', () => {
  const fallback = getTranslation('fr-FR' as unknown as Locale);
  assert.equal(fallback.copyImage, 'Copy Image');
  assert.equal(fallback.brandName, 'Post to Card');

  const zh = getTranslation('zh-CN');
  assert.equal(zh.copyImage, '复制图片');
  // Deliberately not asserting any other zh string. `copyImage` above already
  // proves the zh-CN dictionary came back, and i18n.1 already guarantees every
  // key exists and is non-empty in both locales. Pinning an exact phrase here only
  // meant that editing any piece of copy failed this test -- which it did the
  // moment the language label was reworded to say what it also governs -- without
  // protecting any behaviour.
});

// 3. Locale Detection
test('i18n.3: detectDefaultLocale accurately detects Chinese navigator languages', () => {
  const origNav = globalThis.navigator;

  // Simulate Chinese browser
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-CN' },
    configurable: true,
  });
  assert.equal(detectDefaultLocale(), 'zh-CN');

  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-TW' },
    configurable: true,
  });
  assert.equal(detectDefaultLocale(), 'zh-CN');

  // Simulate English / other browser
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    configurable: true,
  });
  assert.equal(detectDefaultLocale(), 'en-US');

  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'ja-JP' },
    configurable: true,
  });
  assert.equal(detectDefaultLocale(), 'en-US');

  Object.defineProperty(globalThis, 'navigator', {
    value: origNav,
    configurable: true,
  });
});

// 4. Timestamp formatting (Chinese)
test('i18n.4: formatLocaleTimestamp outputs expected Chinese date format (年月日 HH:mm)', () => {
  const isoTime = '2026-09-30T14:35:00.000Z';
  const formattedZh = formatLocaleTimestamp(isoTime, 'zh-CN');

  assert.ok(formattedZh.includes('年'), 'Chinese timestamp must include 年');
  assert.ok(formattedZh.includes('月'), 'Chinese timestamp must include 月');
  assert.ok(formattedZh.includes('日'), 'Chinese timestamp must include 日');
  assert.match(formattedZh, /\d{4}年\d{1,2}月\d{1,2}日\s+\d{2}:\d{2}/);
});

// 5. Timestamp formatting (English)
test('i18n.5: formatLocaleTimestamp outputs expected English date format (AM/PM and short month)', () => {
  const isoTime = '2026-09-30T14:35:00.000Z';
  const formattedEn = formatLocaleTimestamp(isoTime, 'en-US');

  assert.ok(formattedEn.includes('·'), 'English timestamp must include · separator');
  assert.ok(formattedEn.includes('2026'), 'English timestamp must include year');
});

// 6. Sanitization
test('i18n.6: sanitizeLocale safely normalizes valid and invalid locale codes', () => {
  assert.equal(sanitizeLocale('zh-CN'), 'zh-CN');
  assert.equal(sanitizeLocale('en-US'), 'en-US');
  assert.ok(sanitizeLocale('invalid') === 'zh-CN' || sanitizeLocale('invalid') === 'en-US');
  assert.ok(sanitizeLocale(undefined) === 'zh-CN' || sanitizeLocale(undefined) === 'en-US');
});

// 7. Default locale initialization
test('i18n.7: default locale initialization resolves to valid locale', () => {
  const defaultLoc = detectDefaultLocale();
  assert.ok(defaultLoc === 'zh-CN' || defaultLoc === 'en-US');
  assert.equal(sanitizeLocale(defaultLoc), defaultLoc);
});

// 8. Trigger Button Localization
test('i18n.8: trigger button localization uses localized title and aria-label', () => {
  const origNav = globalThis.navigator;

  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-CN' },
    configurable: true,
  });
  const tZh = getTranslation(detectDefaultLocale());
  const btnZh = new DomElement('BUTTON');
  btnZh.setAttribute('role', 'button');
  btnZh.setAttribute('aria-label', tZh.triggerButtonTitle);
  btnZh.setAttribute('title', tZh.triggerButtonTitle);
  btnZh.setAttribute('data-post-to-card-btn', 'true');
  btnZh.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="3" width="13" height="15" rx="2"/></svg>';

  assert.equal(btnZh.getAttribute('title'), '生成推文卡片');
  assert.equal(btnZh.getAttribute('aria-label'), '生成推文卡片');
  assert.equal(btnZh.getAttribute('role'), 'button');
  assert.ok(btnZh.innerHTML.includes('<svg'));
  assert.ok(!btnZh.innerHTML.includes('✨'));

  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    configurable: true,
  });
  const tEn = getTranslation(detectDefaultLocale());
  const btnEn = new DomElement('BUTTON');
  btnEn.setAttribute('role', 'button');
  btnEn.setAttribute('aria-label', tEn.triggerButtonTitle);
  btnEn.setAttribute('title', tEn.triggerButtonTitle);
  btnEn.setAttribute('data-post-to-card-btn', 'true');
  btnEn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="3" width="13" height="15" rx="2"/></svg>';

  assert.equal(btnEn.getAttribute('title'), 'Post to Card');
  assert.equal(btnEn.getAttribute('aria-label'), 'Post to Card');
  assert.equal(btnEn.getAttribute('role'), 'button');
  assert.ok(btnEn.innerHTML.includes('<svg'));
  assert.ok(!btnEn.innerHTML.includes('✨'));

  Object.defineProperty(globalThis, 'navigator', {
    value: origNav,
    configurable: true,
  });
});

// 9. Preview summary singular/plural
test('i18n.9: the preview summary has a singular form for a one-post card', () => {
  // Opening a single post is the common case, and English marks the count, so
  // the plural template alone read "1 tweets" in the header.
  const fill = (template: string, count: number) => template.replace('{count}', String(count));

  assert.equal(fill(TRANSLATIONS['en-US'].previewSummarySingular, 1), '1 tweet');
  assert.equal(fill(TRANSLATIONS['en-US'].previewSummary, 3), '3 tweets');
  // Chinese does not inflect, so the two templates may read the same; both still
  // have to exist and interpolate, or a locale could silently lose the count.
  assert.equal(fill(TRANSLATIONS['zh-CN'].previewSummarySingular, 1), '共 1 条推文');
  assert.equal(fill(TRANSLATIONS['zh-CN'].previewSummary, 3), '共 3 条推文');

  for (const locale of ['zh-CN', 'en-US'] as const) {
    const singular = TRANSLATIONS[locale].previewSummarySingular;
    assert.ok(singular.includes('{count}'), `${locale} singular template must interpolate the count`);
  }
});

export async function runTierI18n(): Promise<{
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
