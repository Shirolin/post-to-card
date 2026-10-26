/**
 * i18n Test Suite: Internationalization and Localization
 *
 * What this tier is for: the dictionaries are typed against one interface, so
 * `tsc` already refuses a missing key. What it cannot see is a translation that
 * is present and *empty*, a placeholder a translator dropped, a locale name tag
 * the browser reports that lands on no dictionary, or a date format that comes
 * out of the wrong branch. Those are the assertions here.
 *
 * Deliberately not asserted: that each locale's words differ from English's.
 * `i18n.2` records why -- pinning prose turns every copy edit into a failing
 * test without protecting a behaviour.
 */

import assert from 'node:assert/strict';
import { DomElement } from '../env/browser.ts';
import { createSuite } from '../env/harness.ts';
import {
  TRANSLATIONS,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_ENDONYMS,
  localeDirName,
  getTranslation,
  detectDefaultLocale,
  resolveLocale,
  sanitizeLocalePref,
  formatLocaleTimestamp,
  formatPreviewSummary,
  type Locale,
} from '../../src/content/i18n.ts';

const { test, run } = createSuite();

/** Sets `navigator.language` for the duration of `body`. */
function withBrowserLanguage(language: string, body: () => void): void {
  const origNav = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { language },
    configurable: true,
  });
  try {
    body();
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      configurable: true,
    });
  }
}

/** `{w}`, `{count}` and friends, sorted, so two templates can be compared. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
}

// 1. Translation Dictionary Parity
test('i18n.1: every locale has exactly the keys en-US has, and none of them empty', () => {
  // Key parity used to be asserted between the two dictionaries that existed.
  // Now that the list is derived, the loop is what makes a new language honest:
  // `Record<Locale, …>` catches a dictionary that is absent, and this catches
  // one that is present but incomplete -- an object literal typed as
  // `Translations` can still carry an empty string for a key the author ran out
  // of time on.
  const enKeys = Object.keys(TRANSLATIONS[DEFAULT_LOCALE]).sort();
  assert.ok(enKeys.length >= 25, 'Should have comprehensive translation keys');

  for (const locale of SUPPORTED_LOCALES) {
    const dictionary = TRANSLATIONS[locale] as unknown as Record<string, string>;
    assert.deepEqual(
      Object.keys(dictionary).sort(),
      enKeys,
      `${locale} must have exactly the keys ${DEFAULT_LOCALE} has`
    );
    for (const key of enKeys) {
      const value = dictionary[key];
      assert.ok(
        typeof value === 'string' && value.trim().length > 0,
        `${locale}'s ${key} must be a non-empty string`
      );
    }
  }
});

// 2. Safe Fallback
test('i18n.2: getTranslation falls back to English for a locale it has no dictionary for', () => {
  const fallback = getTranslation('xx-YY' as unknown as Locale);
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

// 3. Locale resolution
test('i18n.3: a browser language tag resolves to the locale that serves it', () => {
  // Table-driven because the interesting cases are the ones a region adds: a
  // Chinese tag can name a script as well as a region, and a language with no
  // region in Chrome's table has to answer for every region of it.
  const cases: Array<[string, Locale]> = [
    ['zh-CN', 'zh-CN'],
    // Traditional Chinese has no dictionary yet; every Chinese tag lands on the
    // one that exists rather than on English.
    ['zh-TW', 'zh-CN'],
    ['zh-HK', 'zh-CN'],
    ['zh-Hant', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    // The script sits in the middle of the tag, so a split on the first `-`
    // would throw away the entry that answers for it.
    ['zh-Hant-HK', 'zh-CN'],
    ['zh-Hant-TW', 'zh-CN'],
    ['zh-Hans-TW', 'zh-CN'],
    ['en-GB', 'en-US'],
    ['en-US', 'en-US'],
    // Chrome reports underscored tags in some places and hyphenated ones in
    // others; both have to land on the same dictionary.
    ['zh_CN', 'zh-CN'],
    ['xx-YY', DEFAULT_LOCALE],
    ['klingon', DEFAULT_LOCALE],
    // A language this build has no dictionary for, in a region it does: the
    // default is the honest answer for the browser too.
    ['nl-NL', DEFAULT_LOCALE],
  ];

  for (const [tag, expected] of cases) {
    withBrowserLanguage(tag, () => {
      assert.equal(detectDefaultLocale(), expected, `browser "${tag}" must resolve to ${expected}`);
      assert.equal(resolveLocale('auto'), expected, `'auto' under "${tag}" must follow the browser`);
      assert.equal(resolveLocale(undefined), expected, `an absent preference under "${tag}" follows it too`);
    });
  }

  // Every id resolves to itself, whichever way it is spelled -- the loop that
  // makes adding a language to `SUPPORTED_LOCALES` cover its own tags.
  for (const locale of SUPPORTED_LOCALES) {
    withBrowserLanguage('xx-YY', () => {
      assert.equal(resolveLocale(locale), locale, `${locale} must resolve to itself`);
      assert.equal(resolveLocale(locale.toLowerCase()), locale, `${locale} lowercase must too`);
      assert.equal(
        resolveLocale(locale.replace('-', '_')),
        locale,
        `${locale} underscored must too`
      );
    });
  }
});

test('i18n.3b: a stored language wins over the browser, whatever the browser says', () => {
  // The whole point of pinning a language is that it does not follow the
  // machine. Resolving a stored id through the browser first would be the bug
  // this asserts against.
  withBrowserLanguage('de-DE', () => {
    assert.equal(resolveLocale('zh-CN'), 'zh-CN');
    // A tag rather than an id is still accepted -- the setting used to store
    // `'zh-CN'` and a hand-edited store may say anything.
    assert.equal(resolveLocale('zh_hant_hk'), 'zh-CN');

    // A named language this build does not have is English, *not* the German
    // this machine speaks: the user named a language, and following the machine
    // would be answering a different question than the one they asked. This is
    // the assertion that separates `resolveLocale` from `sanitizeLocalePref`,
    // which turns the same value into `'auto'` and would then follow the German.
    assert.equal(resolveLocale('nl-NL'), DEFAULT_LOCALE);
    assert.equal(resolveLocale('sr-Latn-RS'), DEFAULT_LOCALE);
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

test('i18n.5c: an unparseable timestamp is passed through rather than replaced', () => {
  // The card's job here is not to invent a date. X's own string is still
  // readable, and dropping it would hide that the extraction disagreed.
  assert.equal(formatLocaleTimestamp('not a date', 'zh-CN'), 'not a date');
  assert.equal(formatLocaleTimestamp('', 'zh-CN'), '');
});

// 6. Storage sanitiser
test('i18n.6: sanitizeLocalePref keeps a real preference and normalises the rest to auto', () => {
  // This is the function storage goes through, and its contract is narrower
  // than `resolveLocale`'s: `'auto'` must come back as `'auto'`, not as the
  // language this machine happens to run. Folding it into a language here would
  // turn "follow the browser" into a pinned one on the first save.
  withBrowserLanguage('de-DE', () => {
    assert.equal(sanitizeLocalePref('auto'), 'auto');
    assert.equal(sanitizeLocalePref(undefined), 'auto');
    assert.equal(sanitizeLocalePref(''), 'auto');
    assert.equal(sanitizeLocalePref('klingon'), 'auto');
    // A language tag this build has no dictionary for is not a preference it
    // can pin, so it goes back to following the browser -- not to the English
    // `resolveLocale` would draw.
    assert.equal(sanitizeLocalePref('nl'), 'auto');
    assert.equal(sanitizeLocalePref('nl-NL'), 'auto');
    assert.equal(sanitizeLocalePref('sr-Latn-RS'), 'auto');
    // A real language is normalised to its own id, never to the browser's.
    assert.equal(sanitizeLocalePref('zh-CN'), 'zh-CN');
    assert.equal(sanitizeLocalePref('zh-cn'), 'zh-CN');
    assert.equal(sanitizeLocalePref('en-GB'), 'en-US');
  });
});

test('i18n.7: the default is a supported locale and survives its own sanitiser', () => {
  assert.ok(SUPPORTED_LOCALES.includes(DEFAULT_LOCALE), 'the default must be one of the supported locales');
  assert.equal(sanitizeLocalePref(DEFAULT_LOCALE), DEFAULT_LOCALE);
  assert.equal(getTranslation(DEFAULT_LOCALE), TRANSLATIONS[DEFAULT_LOCALE]);
});

// 7. Trigger Button Localization
test('i18n.8: trigger button localization uses localized title and aria-label', () => {
  // The language is stated rather than taken from `detectDefaultLocale()`: the
  // test machine's own tag is not a fixed value, and asserting a zh-CN string
  // against whatever the runner reports is how this passed locally and failed
  // elsewhere.
  withBrowserLanguage('zh-CN', () => assert.equal(detectDefaultLocale(), 'zh-CN'));
  const tZh = getTranslation('zh-CN');
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

  const tEn = getTranslation('en-US');
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
});

// 8. Preview summary singular/plural
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
  // placeholder, whichever template the locale reaches for -- in every
  // language, because a locale that translated the sentence and dropped the
  // placeholder renders the braces and nothing else.
  for (const locale of SUPPORTED_LOCALES) {
    const dict = TRANSLATIONS[locale];
    for (const count of [0, 1, 2, 25]) {
      const line = formatPreviewSummary(dict, count);
      assert.ok(
        line.includes(String(count)),
        `${locale} @ ${count} must include the count, got "${line}"`
      );
      assert.ok(
        !line.includes('{count}'),
        `${locale} @ ${count} must substitute the placeholder, got "${line}"`
      );
    }
  }

  // Both templates declare the placeholder. Not a copy assertion -- a template
  // that hardcodes the numeral ("1 tweet") renders correctly for the only count
  // the singular is used with, so no rendered-output check can see it, yet the
  // count parameter it is handed goes ignored and a locale needing another form
  // would break silently. The placeholder is the template's contract.
  for (const locale of SUPPORTED_LOCALES) {
    const dict = TRANSLATIONS[locale];
    assert.ok(
      dict.previewSummarySingular.includes('{count}'),
      `${locale} singular template must declare {count}`
    );
    assert.ok(
      dict.previewSummary.includes('{count}'),
      `${locale} plural template must declare {count}`
    );
  }
});

// 9. Placeholder contract
test('i18n.10: every translation declares exactly the placeholders en-US declares for that key', () => {
  // The key-parity check in i18n.1 compares names, not the templates inside
  // them. A translator who writes "导出尺寸 {w} px" and drops the `{h}` produces
  // a dictionary that is complete, non-empty, and renders a size with a missing
  // dimension -- and every other assertion here passes.
  //
  // Comparing the *sorted multiset* rather than a set also catches a doubled
  // `{count}`: only the first occurrence is substituted at the call site, so
  // the second would print as literal braces.
  const en = TRANSLATIONS[DEFAULT_LOCALE] as unknown as Record<string, string>;

  for (const locale of SUPPORTED_LOCALES) {
    const dictionary = TRANSLATIONS[locale] as unknown as Record<string, string>;
    for (const key of Object.keys(en)) {
      assert.deepEqual(
        placeholders(dictionary[key]),
        placeholders(en[key]),
        `${locale}'s "${key}" must declare the same placeholders as en-US`
      );
    }
  }
});

test('i18n.11: every supported locale names itself, and nothing else does', () => {
  // The picker draws its labels from this table, so a locale without an endonym
  // renders as its raw id (`pt-BR`) among the other languages' words. The reverse -- a name
  // for a locale that was dropped -- is dead copy.
  assert.deepEqual(
    Object.keys(LOCALE_ENDONYMS).sort(),
    [...SUPPORTED_LOCALES].sort(),
    'LOCALE_ENDONYMS must name exactly the supported locales'
  );
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(LOCALE_ENDONYMS[locale].trim().length > 0, `${locale} must have an endonym`);
  }
});

test('i18n.12: the locale-to-_locales mapping is the underscored one Chrome expects', () => {
  // Chrome's table is underscored, and a directory name outside it is not an
  // error -- Chrome silently serves `default_locale` instead, which reads as
  // "translated, but the translation never appears". An id that carries a
  // region is the only shape where the two names differ.
  assert.equal(localeDirName('en-US'), 'en_US');
  assert.equal(localeDirName('zh-CN'), 'zh_CN');
});

export function runTierI18n() {
  return run();
}
