/**
 * Post-to-Card Content Script Entry Point.
 * Manifest V3 Content Script executed on Twitter/X pages.
 * Fully integrates Twitter adapter, Shadow DOM container, and export engine.
 */

import { initTwitterInjection, resolveThread } from './adapter/index.ts';
import { openCardModal } from './container/element.ts';
import { createExportHandler } from './exportHandler.ts';
import { initGraphQLBridge } from './graphql/bridge.ts';
import { loadUserPreferences } from './prefs.ts';

/**
 * `preferHighResolution`, as a promise the export can await without blocking.
 *
 * Read once when the card opens rather than per click: the export button's click
 * has to claim the clipboard in the same tick, and a storage round trip does not
 * fit inside a gesture. A read that fails is a user who has not turned the
 * setting on.
 */
function readpreferHighResolution(): Promise<boolean> {
  const preferences = loadUserPreferences().then((saved) => saved.preferHighResolution === true);
  preferences.catch(() => {});
  return preferences.catch(() => false);
}

/**
 * The mark that says this script ran, for the verifier and for a person with
 * devtools open.
 *
 * It used to be a `console.log`. That prints into the page's console on every X
 * page load for every user of the extension, which is noise nobody asked for;
 * one attribute on `<html>` says the same thing to the only readers who want it.
 * The visibility class `injection.ts` puts on the same element is the precedent
 * -- this is not a new kind of footprint.
 */
export const ACTIVE_ATTR = 'data-post-to-card';

function initContentScript(): void {
  try {
    document.documentElement.setAttribute(ACTIVE_ATTR, 'true');

    // Must be installed before the page issues its own GraphQL calls.
    initGraphQLBridge();

    const controller = initTwitterInjection((article: Element) => {
      const threadData = resolveThread(article);

      openCardModal(
        threadData,
        createExportHandler(threadData, { preferHighResolution: readpreferHighResolution() })
      );
    });

    // Supplementary scans for dynamic SPA feed hydration
    setTimeout(() => controller.injectAll(), 500);
    setTimeout(() => controller.injectAll(), 1500);

    // Listen for extension messages (e.g. from popup or background)
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Only this extension's own contexts may open a card on this page. The
        // check is a bug-catcher rather than a defence -- `onMessage` does not
        // carry other extensions' messages -- but it is the same one line at
        // both ends of the channel, so neither can drift into trusting a sender
        // the other does not.
        if (sender?.id !== chrome.runtime.id) return false;
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
