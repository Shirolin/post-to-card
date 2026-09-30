/**
 * Post-to-Card Content Script Entry Point.
 * Manifest V3 Content Script executed on Twitter/X pages.
 * Fully integrates Twitter adapter, Shadow DOM container, and export engine.
 */

import type { Locale } from '../types/card';
import type { ThreadData } from '../types/tweet';
import { initTwitterInjection } from './adapter/injection';
import { openCardModal } from './container/element';
import { exportCardFlow } from './engine';

function handleCardExport(
  target: HTMLElement,
  scale: number,
  action?: 'copy' | 'download',
  locale?: Locale
): Promise<void> {
  const chosenAction: 'copy' | 'download' = action || 'copy';
  return exportCardFlow(target, scale, chosenAction, undefined, undefined, locale).then(() => {});
}

function initContentScript(): void {
  try {
    console.log('[Post-to-Card] Content script active on Twitter/X');
    const controller = initTwitterInjection((threadData: ThreadData) => {
      openCardModal(threadData, async (target: HTMLElement, scale: number, action?: 'copy' | 'download', locale?: Locale) => {
        await handleCardExport(target, scale, action, locale);
      });
    });

    // Supplementary scans for dynamic SPA feed hydration
    setTimeout(() => controller.injectAll(), 500);
    setTimeout(() => controller.injectAll(), 1500);

    // Listen for extension messages (e.g. from popup or background)
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'TRIGGER_ACTIVE_CARD') {
          const success = controller.triggerActiveTweet();
          sendResponse({ success });
          return false;
        }
        return false;
      });
    }
  } catch (err) {
    console.error('[Post-to-Card] Initialization error:', err);
  }
}

if (typeof window !== 'undefined') {
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript);
  } else {
    initContentScript();
  }
}
