/**
 * User Preferences storage module.
 *
 * Owns the persistence seam for User Preferences (see GLOSSARY.md): the
 * storage key, load/save, and the live-sync subscription. Pure token tables
 * stay in `ui/themes.ts` and the card's own options in `ui/options.ts`; this
 * module imports them but the reverse never happens, so the DOM adapter can
 * depend on storage without depending on UI tokens.
 */

import type { CardConfig } from '../types/card.ts';
import { sanitizeLocalePref } from './i18n.ts';
import { normalizeOverrides } from './authorPrivacy.ts';
import { DEFAULT_CARD_CONFIG, sanitizeTheme } from './ui/themes.ts';
import {
  ASPECT_RATIO,
  CANVAS_BACKGROUND,
  CANVAS_RATIO,
  IMAGE_FIT,
  MEDIA_LAYOUT,
  PADDING,
  RADIUS,
  optionValue,
} from './ui/options.ts';

export const STORAGE_KEY = 'post_to_card_user_prefs';

/**
 * The last complete configuration this context has seen.
 *
 * The preview's first frame needs *something* before the read answers; the
 * shipped defaults are the wrong something for anyone who has chosen a theme or
 * a language (and for anyone with reduced motion, where the dialog has no fade
 * to hide the correction). This is only a seed for that frame: the read still
 * answers, and anything whose height the answer can move -- the hint strip, the
 * card's fit -- waits for the read itself (see `App`'s `preferencesLoaded`).
 *
 * Every reader and writer refreshes it, including the triggers' own read at
 * page load (`adapter/injection.ts`), so a card opened later on the same page
 * already knows what the user chose.
 */
let lastKnown: CardConfig | null = null;

/** The last answer this context saw, or null before the first one. */
export function lastKnownPreferences(): CardConfig | null {
  return lastKnown;
}

/**
 * What is in storage, as a complete and validated configuration.
 *
 * Both readers of the key go through here: the one-off load, and the live-sync
 * subscription, which used to hand its subscriber the stored object raw. That
 * object can be *partial* — the popup's toggle writes nothing but
 * `showActionBarButton` — so a subscriber that took it for a whole `CardConfig`
 * would have read `theme` out of it and found nothing.
 *
 * Stored keys this build does not know are carried through: an upgrade that
 * drops a field should not take a config's other keys down with it.
 */
function normalizeStoredConfig(saved: Record<string, any> | null | undefined): CardConfig {
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_CARD_CONFIG };
  }

  return {
    ...DEFAULT_CARD_CONFIG,
    ...saved,
    theme: sanitizeTheme(saved.theme),
    // The card's own options, each of which answers the shipped default for a
    // value that was never set and for one that is not a value the card
    // offers. A missing value and an invalid one are the same case, so the
    // merge above cannot protect them and does not have to: every option says
    // what it is when it is not saying something else.
    padding: optionValue(PADDING, saved.padding),
    borderRadius: optionValue(RADIUS, saved.borderRadius),
    aspectRatio: optionValue(ASPECT_RATIO, saved.aspectRatio),
    imageFit: optionValue(IMAGE_FIT, saved.imageFit),
    mediaLayout: optionValue(MEDIA_LAYOUT, saved.mediaLayout),
    canvasRatio: optionValue(CANVAS_RATIO, saved.canvasRatio),
    canvasBackground: optionValue(CANVAS_BACKGROUND, saved.canvasBackground),
    // Default-off, so anything but a literal `true` is off. The spread above
    // would take `"false"` -- a string from a hand-edited store -- as truthy.
    canvasShadow: saved.canvasShadow === true,
    // Same rule: a preference nobody turned on is off, including when the
    // store holds the string "false".
    preferHighResolution: saved.preferHighResolution === true,
    // A store written before this existed has neither field. Both then answer
    // "every post follows the switch" and "the hint has not been dismissed",
    // which is what the upgrade shows: no card looks any different than it did.
    // `blurAuthor` itself is left to the spread above -- it stays the user's
    // value, and is now only the default each post falls back to.
    authorBlurOverrides: normalizeOverrides(saved.authorBlurOverrides),
    authorBlurHintDismissed: saved.authorBlurHintDismissed === true,
    showActionBarButton: saved.showActionBarButton !== false,
    showPlayButton: saved.showPlayButton !== false,
    // Stored as a preference, not as the language it currently resolves to:
    // `'auto'` has to survive a read/write cycle unchanged, or a German machine
    // would turn "follow the browser" into a pinned German the first time the
    // config is saved.
    locale: sanitizeLocalePref(saved.locale),
  };
}

export async function loadUserPreferences(): Promise<CardConfig> {
  const config = await new Promise<CardConfig>((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        if (chrome.runtime?.lastError) {
          resolve({ ...DEFAULT_CARD_CONFIG });
          return;
        }
        resolve(normalizeStoredConfig(res?.[STORAGE_KEY]));
      });
    } else {
      resolve({ ...DEFAULT_CARD_CONFIG });
    }
  });
  lastKnown = config;
  return config;
}

export async function saveUserPreferences(config: CardConfig): Promise<void> {
  // The user's own edit is the newest answer this context has, so the next
  // opening starts from it even if a later read has not happened yet.
  lastKnown = config;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: config });
  }
}

/**
 * Subscribes to cross-context preference changes (e.g. multi-tab live sync).
 * The payload is a complete configuration, exactly as `loadUserPreferences`
 * would hand one over. Returns an unsubscribe function. A no-op unsubscribe is
 * returned where the extension storage API is unavailable.
 */
export function subscribePreferences(cb: (prefs: CardConfig) => void): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
      const next = normalizeStoredConfig(changes[STORAGE_KEY].newValue as Record<string, any>);
      // Another context's answer, so the next opening starts from it too.
      lastKnown = next;
      cb(next);
    }
  };
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handler as unknown as (changes: object, area: string) => void);
    return () => {
      chrome.storage.onChanged.removeListener(handler as unknown as (changes: object, area: string) => void);
    };
  }
  return () => {};
}
