/**
 * User Preferences storage module.
 *
 * Owns the persistence seam for User Preferences (see GLOSSARY.md): the
 * storage key, load/save, and the live-sync subscription. Pure token tables
 * and sanitizers stay in `ui/themes.ts`; this module imports them but the
 * reverse never happens, so the DOM adapter can depend on storage without
 * depending on UI tokens.
 */

import type { CardConfig } from '../types/card.ts';
import { sanitizeLocale } from './i18n.ts';
import {
  DEFAULT_CARD_CONFIG,
  sanitizeCanvasBackground,
  sanitizeCanvasRatio,
  sanitizeImageFit,
  sanitizeMediaLayout,
  sanitizePadding,
  sanitizeRadius,
  sanitizeTheme,
} from './ui/themes.ts';

export const STORAGE_KEY = 'post_to_card_user_prefs';

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
    padding: sanitizePadding(saved.padding),
    // `??` is load-bearing here, and only here: `sanitizeRadius` answers '12px'
    // for an absent value while the shipped default is 'theme', so borderRadius
    // is the one field the merge above cannot protect. Without it, a fresh
    // profile whose first write came from the popup's toggle — the only writer
    // that stores a partial object — pins every card to 12px, and the panel then
    // carries that 12px into each later save.
    borderRadius: sanitizeRadius(saved.borderRadius ?? DEFAULT_CARD_CONFIG.borderRadius),
    imageFit: sanitizeImageFit(saved.imageFit),
    mediaLayout: sanitizeMediaLayout(saved.mediaLayout),
    canvasRatio: sanitizeCanvasRatio(saved.canvasRatio),
    canvasBackground: sanitizeCanvasBackground(saved.canvasBackground),
    // Default-off, so anything but a literal `true` is off. The spread above
    // would take `"false"` -- a string from a hand-edited store -- as truthy.
    canvasShadow: saved.canvasShadow === true,
    showActionBarButton: saved.showActionBarButton !== false,
    showPlayButton: saved.showPlayButton !== false,
    locale: sanitizeLocale(saved.locale),
  };
}

export async function loadUserPreferences(): Promise<CardConfig> {
  return new Promise((resolve) => {
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
}

export async function saveUserPreferences(config: CardConfig): Promise<void> {
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
      cb(normalizeStoredConfig(changes[STORAGE_KEY].newValue as Record<string, any>));
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
