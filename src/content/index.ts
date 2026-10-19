/**
 * Post-to-Card Content Script Entry Point.
 * Manifest V3 Content Script executed on Twitter/X pages.
 * Fully integrates Twitter adapter, Shadow DOM container, and export engine.
 */

import { initTwitterInjection, resolveThread } from './adapter/index.ts';
import { openCardModal } from './container/element.ts';
import { createExportHandler } from './exportHandler.ts';
import { initGraphQLBridge } from './graphql/bridge.ts';

function initContentScript(): void {
  try {
    console.log('[Post-to-Card] Content script active on Twitter/X');

    // Must be installed before the page issues its own GraphQL calls.
    initGraphQLBridge();

    const controller = initTwitterInjection((article: Element) => {
      const threadData = resolveThread(article);

      openCardModal(threadData, createExportHandler(threadData));
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
