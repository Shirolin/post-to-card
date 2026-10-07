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
  sanitizeImageFit,
  sanitizeMediaLayout,
  sanitizePadding,
  sanitizeRadius,
  sanitizeTheme,
} from './ui/themes.ts';

export const STORAGE_KEY = 'post_to_card_user_prefs';

export async function loadUserPreferences(): Promise<CardConfig> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        if (chrome.runtime?.lastError) {
          resolve(DEFAULT_CARD_CONFIG);
          return;
        }
        const saved = res?.[STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          resolve({
            ...DEFAULT_CARD_CONFIG,
            ...saved,
            theme: sanitizeTheme(saved.theme),
            padding: sanitizePadding(saved.padding),
            borderRadius: sanitizeRadius(saved.borderRadius),
            imageFit: sanitizeImageFit(saved.imageFit),
            mediaLayout: sanitizeMediaLayout(saved.mediaLayout),
            showActionBarButton: saved.showActionBarButton !== false,
            showPlayButton: saved.showPlayButton !== false,
            locale: sanitizeLocale(saved.locale),
          });
        } else {
          resolve(DEFAULT_CARD_CONFIG);
        }
      });
    } else {
      resolve(DEFAULT_CARD_CONFIG);
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
 * Returns an unsubscribe function. A no-op unsubscribe is returned where the
 * extension storage API is unavailable.
 */
export function subscribePreferences(cb: (prefs: CardConfig) => void): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
      cb(changes[STORAGE_KEY].newValue as CardConfig);
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
