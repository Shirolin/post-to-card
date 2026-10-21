/**
 * i18n Test Suite: Internationalization and Localization
 * Verifies key parity between zh-CN and en-US, safe fallbacks,
 * date/time formatting, and locale-aware UI texts.
 */

import assert from 'node:assert/strict';
import { DomElement } from '../env/browser.ts';
import { createSuite } from '../env/harness.ts';
import {
  TRANSLATIONS,
  getTranslation,
  detectDefaultLocale,
  sanitizeLocale,
  formatLocaleTimestamp,
  formatPreviewSummary,
  type Locale,
} from '../../src/content/i18n.ts';
import { CANVAS_BACKGROUND_ORDER } from '../../src/content/ui/themes.ts';

const { test, run } = createSuite();

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

test('i18n.1b: every canvas background has a label in every language', () => {
  // The canvas backgrounds are named by id, and the dictionary's keys follow
  // that naming. The panel falls back to the table's English name for a key a
  // dictionary lacks — so a background added to the table but not to the
  // dictionary would show an English name inside a Chinese panel, quietly.
  // The ids live in one place now; this is what keeps the names in step.
  for (const id of CANVAS_BACKGROUND_ORDER) {
    const key = `canvasBg_${id}`;
    for (const locale of ['zh-CN', 'en-US'] as const) {
      const dictionary = TRANSLATIONS[locale];
      const label = dictionary[key as keyof typeof dictionary];
      assert.ok(
        typeof label === 'string' && label.length > 0,
        `${locale} must name the "${id}" background (key ${key})`
      );
    }
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
  // the plural template alone read "1 tweets" in the header. The selection
  // lives in `formatPreviewSummary`, so this exercises the real path the header
  // takes -- not a re-implementation of it.
  //
  // Deliberately not pinning the phrases: i18n.2 records why an exact-string
  // assertion fails on every copy edit without protecting behaviour. What has
  // to hold is the shape.
  const en = getTranslation('en-US');
  const zh = getTranslation('zh-CN');

  assert.equal(formatPreviewSummary(en, 1), '1 tweet');
  assert.equal(formatPreviewSummary(en, 3), '3 tweets');
  assert.equal(formatPreviewSummary(zh, 1), '共 1 条推文');
  assert.equal(formatPreviewSummary(zh, 3), '共 3 条推文');

  // English inflects: the two counts must not share wording. This is the whole
  // defect -- one template serving both.
  const one = formatPreviewSummary(en, 1);
  const many = formatPreviewSummary(en, 3);
  assert.notEqual(one, many, 'en-US must not print the plural wording for a count of one');
  assert.ok(one.endsWith('tweet'), 'the English singular must read as a singular');
  assert.ok(!one.endsWith('tweets'), 'the English singular must not read as a plural');

  // A count of zero or two still has to interpolate rather than print the
  // placeholder, whichever template the locale reaches for.
  for (const [label, dict] of [['zh-CN', zh], ['en-US', en]] as const) {
    for (const count of [0, 2, 25]) {
      const line = formatPreviewSummary(dict, count);
      assert.ok(
        line.includes(String(count)),
        `${label} @ ${count} must include the count, got "${line}"`
      );
      assert.ok(
        !line.includes('{count}'),
        `${label} @ ${count} must substitute the placeholder, got "${line}"`
      );
    }
  }

  // Both templates declare the placeholder. Not a copy assertion -- a template
  // that hardcodes the numeral ("1 tweet") renders correctly for the only count
  // the singular is used with, so no rendered-output check can see it, yet the
  // count parameter it is handed goes ignored and a locale needing another form
  // would break silently. The placeholder is the template's contract.
  for (const [label, dict] of [['zh-CN', zh], ['en-US', en]] as const) {
    assert.ok(
      dict.previewSummarySingular.includes('{count}'),
      `${label} singular template must declare {count}`
    );
    assert.ok(
      dict.previewSummary.includes('{count}'),
      `${label} plural template must declare {count}`
    );
  }
});

export function runTierI18n() {
  return run();
}
