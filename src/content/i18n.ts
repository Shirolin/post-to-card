/**
 * Lightweight, zero-dependency i18n module for Post-to-Card.
 *
 * The words live in `./locales/<id>.ts`, one dictionary per language, each
 * annotated with the `Translations` interface so `tsc` refuses a missing or
 * mistyped key. This module owns everything else about a locale: the list of
 * them, what each one is called in its own language, how a browser's language
 * tag is turned into one of them, and the two formatters that are not plain
 * lookups.
 *
 * Chrome's own `_locales` tree is a second, separate catalogue -- the manifest
 * cannot read TypeScript -- and `localeDirName` below is the single mapping
 * between the two naming schemes.
 */

import type { Locale, LocalePreference } from '../types/card.ts';
import type { Translations } from './locales/types.ts';
import { enUS } from './locales/en-US.ts';
import { zhCN } from './locales/zh-CN.ts';
import { zhTW } from './locales/zh-TW.ts';
import { ja } from './locales/ja.ts';
import { ko } from './locales/ko.ts';
import { de } from './locales/de.ts';
import { fr } from './locales/fr.ts';
import { es } from './locales/es.ts';
import { it } from './locales/it.ts';
import { ptBR } from './locales/pt-BR.ts';
import { ru } from './locales/ru.ts';
import { tr } from './locales/tr.ts';
import { uk } from './locales/uk.ts';
import { id } from './locales/id.ts';

export type { Translations } from './locales/types.ts';
// Re-exported rather than declared again: `types/card.ts` owns the union, and a
// second declaration here was how the two drifted. Callers that think of a
// locale as an i18n concern can keep importing it from this module.
export type { Locale, LocalePreference } from '../types/card.ts';

/**
 * The languages the interface, the card and the popup are drawn in.
 *
 * The ids are BCP-47, and a region is carried only where the region changes the
 * words: Chrome's own locale table has `zh_CN`, `zh_TW` and `pt_BR` but a bare
 * `de`, `fr`, `ja` and so on. `localeDirName` maps this list onto that one.
 */
export const SUPPORTED_LOCALES: readonly Locale[] = [
  'en-US',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'it',
  'pt-BR',
  'ru',
  'tr',
  'uk',
  'id',
];

/** The language every unresolvable preference and every missing key falls back to. */
export const DEFAULT_LOCALE: Locale = 'en-US';

/**
 * What each language calls itself, for the picker.
 *
 * Deliberately not in the dictionaries: an endonym is the same string in all
 * fourteen of them, and a reader looking for Japanese should be able to find
 * 日本語 whatever language the panel is currently in. That is also why
 * `i18n.11` requires every supported locale to have one.
 */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  'pt-BR': 'Português',
  ru: 'Русский',
  tr: 'Türkçe',
  uk: 'Українська',
  id: 'Bahasa Indonesia',
};

/**
 * The dictionaries, keyed by locale.
 *
 * `Record<Locale, …>` rather than an object literal with a comment: a locale
 * added to `SUPPORTED_LOCALES` without a dictionary here, or a dictionary for a
 * locale that is not in the list, is a type error.
 */
export const TRANSLATIONS: Record<Locale, Translations> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  de,
  fr,
  es,
  it,
  'pt-BR': ptBR,
  ru,
  tr,
  uk,
  id,
};

/**
 * The `_locales` subdirectory Chrome expects for a locale.
 *
 * Chrome's table is underscored (`zh_CN`, `pt_BR`) and its directory names have
 * to match it exactly. A name outside that table is not an error: Chrome falls
 * back to `default_locale` silently, so a hyphenated directory or a `de_DE`
 * reads as "translated, but the translation never appears". `hygiene.10` holds
 * the allowed list, and `hygiene.11` checks the manifest agrees with this one.
 */
export function localeDirName(locale: Locale): string {
  return locale.replace(/-/g, '_');
}

/**
 * Every language tag a browser might report, mapped to the locale that serves it.
 *
 * A region whose words differ from the base language gets its own entry; every
 * other region reaches its language by prefix. Built from `SUPPORTED_LOCALES`
 * plus the aliases, so a locale added to the list is reachable by its own tag
 * without a second edit.
 */
const TAG_ALIASES: Record<string, Locale> = {
  // Chinese splits by script, not by country: `zh-Hant` and `zh-HK` are
  // Traditional whatever their region says.
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  'zh-tw': 'zh-TW',
  zh: 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-sg': 'zh-CN',
  // Portuguese is served in Brazilian spelling; `pt-PT` has no dictionary of
  // its own and is closer to `pt-BR` than to English.
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  // English is the default, and a British or Australian tag is the same words.
  en: 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-US',
  'en-au': 'en-US',
  'en-ca': 'en-US',
  // Indonesian was tagged `in` before 1989 and some browsers still report it.
  in: 'id',
};

const TAGS: Map<string, Locale> = (() => {
  const tags = new Map<string, Locale>();
  for (const [tag, locale] of Object.entries(TAG_ALIASES)) tags.set(tag, locale);
  for (const locale of SUPPORTED_LOCALES) tags.set(locale.toLowerCase(), locale);
  return tags;
})();

/**
 * The language tag's own shape: a language subtag and up to three more of
 * letters, digits or hyphens, all one to eight long. Deliberately loose —
 * `fr`, `zh-Hant-HK`, `es-419` and `sr-Latn-RS` all pass — because its only job
 * is to tell a language tag from a piece of junk before the tag is looked up.
 */
const LANGUAGE_TAG = /^[a-zA-Z]{2,3}([-_][a-zA-Z0-9]{2,8})*$/;

/**
 * The locale a language tag names, or `null` if this build has no dictionary
 * for it.
 *
 * Exact tag first, then the longest prefix of it the table names. Prefix rather
 * than base language because the script can come before the region:
 * `zh-Hant-HK` has to reach `zh-TW` through `zh-Hant`, and splitting on the
 * first `-` would hand it to `zh` and print Simplified Chinese. Null rather
 * than the default, because the two callers below want different things from a
 * miss: one wants the browser's answer, the other wants to know to leave the
 * preference alone.
 */
function localeForTag(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase().replace(/_/g, '-');
  const exact = TAGS.get(normalized);
  if (exact) return exact;

  // `de-AT`, `fr-CA`, `en-NZ`: the region does not change the words, so the
  // entry that has no region answers for every region of it.
  const parts = normalized.split('-');
  for (let end = parts.length - 1; end > 0; end--) {
    const prefix = TAGS.get(parts.slice(0, end).join('-'));
    if (prefix) return prefix;
  }

  return null;
}

/**
 * The user's language as the browser reports it, resolved to a supported locale.
 *
 * The starting point for an `'auto'` preference and for the popup's first
 * paint, before storage has answered. A browser speaking a language this build
 * does not have gets English, which is the manifest's `default_locale` and
 * therefore the language the rest of the install already speaks.
 */
export function detectDefaultLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return localeForTag(navigator.language) ?? DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

/**
 * Turns a stored preference into the concrete locale to draw with.
 *
 * `'auto'`, an absent value and a value that is not a language tag at all mean
 * follow the browser — the only route to `navigator.language`, and what an
 * upgrade needs no migration for: `'zh-CN'` and `'en-US'` are still exact ids.
 *
 * A value that *is* a tag but names no language in this build (`nl-NL`) gets
 * English rather than the browser's answer. The user named a language; the
 * nearest honest reading of that is the default, not the machine's.
 */
export function resolveLocale(preference?: string): Locale {
  if (!preference || preference === 'auto') return detectDefaultLocale();
  if (!LANGUAGE_TAG.test(preference.trim())) return detectDefaultLocale();
  return localeForTag(preference) ?? DEFAULT_LOCALE;
}

/**
 * Normalises whatever storage held into a preference this build understands.
 *
 * Unlike `resolveLocale`, this keeps `'auto'` as `'auto'`: a preference read
 * back and written out again must not turn into a pinned language just because
 * it was read on a German machine. It also keeps a language it does not have as
 * `'auto'` rather than resolving it — storage should record what the user chose,
 * and "Dutch, which this build does not have" is not a choice it can pin.
 */
export function sanitizeLocalePref(val?: string): LocalePreference {
  if (val === 'auto') return 'auto';
  if (typeof val === 'string' && LANGUAGE_TAG.test(val.trim())) {
    const locale = localeForTag(val);
    if (locale) return locale;
  }
  return 'auto';
}

/**
 * The dictionary for a locale, falling back to English.
 *
 * Falls back rather than throwing because a stored preference is user data: an
 * id from a future build must not blank the panel.
 */
export function getTranslation(locale: Locale = DEFAULT_LOCALE): Translations {
  return TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
}

/**
 * The modal header's summary line for a given post count.
 *
 * Lives here rather than at the call site because the singular/plural choice is
 * a property of the templates: English marks the count, and a caller that
 * picked the plural for a one-post card printed "1 tweets". Keeping the
 * selection beside the two templates also keeps the `{count}` placeholder's
 * contract in one place, and makes the choice testable without rendering.
 *
 * Takes the resolved dictionary rather than a locale: every caller already has
 * one in hand (the card's UI resolves it once per render), and a second
 * `resolveLocale` here would be a second derivation of the same value.
 */
export function formatPreviewSummary(t: Translations, count: number): string {
  const template = count === 1 ? t.previewSummarySingular : t.previewSummary;
  return template.replace('{count}', String(count));
}

/**
 * Formats a tweet timestamp for the card.
 *
 * Simplified Chinese and English are spelled out rather than handed to `Intl`:
 * both were chosen deliberately (`2026年9月30日 14:35` and `2:35 PM · Sep 30,
 * 2026`), both are pinned by a test, and `Intl`'s idea of either differs by
 * platform. Every other language has no such decision behind it, so it gets
 * `Intl`'s own medium date and short time -- the alternative is twelve
 * hand-written formats, each a chance to be wrong for a region.
 */
export function formatLocaleTimestamp(timestampStr: string, locale: Locale): string {
  if (!timestampStr) return '';
  const d = new Date(timestampStr);
  if (Number.isNaN(d.getTime())) return timestampStr;

  if (locale === 'zh-CN') {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  }

  if (locale === 'en-US') {
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${timePart} · ${datePart}`;
  }

  // A locale whose data this engine does not carry (an old browser, a stripped
  // ICU build) throws here; the raw X string is still readable, and is what the
  // card printed before any of this existed.
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return timestampStr;
  }
}
