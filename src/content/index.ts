/**
 * Post-to-Card Content Script Entry Point.
 * Manifest V3 Content Script executed on Twitter/X pages.
 * Fully integrates Twitter adapter, Shadow DOM container, and export engine.
 */

import type { ThreadData } from '../types/tweet.ts';
import { initTwitterInjection } from './adapter/injection.ts';
import { openCardModal } from './container/element.ts';
import { exportCard, type ExportAction, type ExportOutcome } from './engine/index.ts';
import { initGraphQLBridge, lookupFromGraphQL, applyDomTranslation } from './graphql/bridge.ts';
import { extractTweetId } from './adapter/extractor.ts';

// The outcome travels back to the modal untouched. It used to be discarded
// here, which is how a card the clipboard had refused came to be announced as
// copied.
function handleCardExport(
  target: HTMLElement,
  action: ExportAction
): Promise<ExportOutcome> {
  return exportCard(target, { action });
}

/**
 * Resolves the data for a card, preferring the structured GraphQL channel.
 *
 * GraphQL wins when it produced at least one tweet, because thread membership,
 * reply targets and retweet relationships come straight from X rather than
 * being inferred from the rendered page. Anything short of that — no payload
 * captured, unparseable body, or an empty result set — falls through to the DOM
 * adapter. X swallows failed GraphQL calls, so an empty result is treated as a
 * miss rather than as a legitimately empty tweet.
 */
function resolveThreadData(domThread: ThreadData, article?: Element): ThreadData {
  const fromGraphQL = lookupFromGraphQL(article ? extractTweetId(article) : undefined);

  if (fromGraphQL.thread) {
    for (const tweet of fromGraphQL.thread.tweets) {
      tweet.diagnostics = {
        ...tweet.diagnostics,
        source: 'graphql',
        operationName: fromGraphQL.operationName,
        queryId: fromGraphQL.queryId,
      };
    }
    // A translation exists only in the page, so the visible body has to win
    // even when GraphQL supplies the structure.
    applyDomTranslation(fromGraphQL.thread, domThread);
    return fromGraphQL.thread;
  }

  for (const tweet of domThread.tweets) {
    tweet.diagnostics = { ...tweet.diagnostics, source: 'dom' };
  }
  return domThread;
}

function initContentScript(): void {
  try {
    console.log('[Post-to-Card] Content script active on Twitter/X');

    // Must be installed before the page issues its own GraphQL calls.
    initGraphQLBridge();

    const controller = initTwitterInjection((domThread: ThreadData, article?: Element) => {
      const threadData = resolveThreadData(domThread, article);

      openCardModal(threadData, handleCardExport);
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
