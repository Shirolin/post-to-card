/**
 * Twitter/X Action Bar Button Injection and DOM Lifecycle Manager.
 * Injects a sleek "✨" trigger button into tweet action bars (`div[role="group"]`),
 * guards against duplicate injections, uses a 150ms debounced MutationObserver
 * to handle virtual scrolling, and hooks SPA route navigation.
 */

import type { ThreadData } from '../../types/tweet';
import { extractContinuousThread } from './thread';

interface CustomObserver {
  observe: (target: Node, options?: MutationObserverInit) => void;
  disconnect: () => void;
}

import { getTranslation, detectDefaultLocale } from '../i18n';

export const TRIGGER_BUTTON_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="3" width="13" height="15" rx="2"></rect>
  <path d="M8 21h10a2 2 0 0 0 2-2V7"></path>
  <path d="M7 8h5"></path>
  <path d="M7 12h3"></path>
</svg>
`.trim();

/**
 * Creates the sleek Post-to-Card trigger button formatted to blend
 * natively into the Twitter/X tweet action bar with zero emojis.
 */
export function createTriggerButton(onClick: () => void): HTMLElement {
  const t = getTranslation(detectDefaultLocale());
  const globalWithDom = globalThis as unknown as {
    DomElement?: new (tagName: string) => HTMLElement;
  };

  const btn: HTMLElement = (typeof document !== 'undefined' && typeof document.createElement === 'function')
    ? document.createElement('button')
    : (globalWithDom.DomElement ? new globalWithDom.DomElement('BUTTON') : ({} as HTMLElement));

  if (typeof btn.setAttribute === 'function') {
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', t.triggerButtonTitle);
    btn.setAttribute('title', t.triggerButtonTitle);
    btn.setAttribute('data-post-to-card-btn', 'true');
  }

  // Set crisp SVG vector icon without emoji
  if (typeof (btn as unknown as { innerHTML?: string }).innerHTML !== 'undefined') {
    (btn as unknown as { innerHTML: string }).innerHTML = TRIGGER_BUTTON_SVG;
  }

  if (btn.style) {
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.outline = 'none';
    btn.style.cursor = 'pointer';
    btn.style.padding = '0';
    btn.style.width = '34.75px';
    btn.style.height = '34.75px';
    btn.style.minWidth = '34.75px';
    btn.style.minHeight = '34.75px';
    btn.style.flexShrink = '0';
    btn.style.borderRadius = '9999px';
    btn.style.lineHeight = '1';
    btn.style.color = 'rgb(113, 118, 123)';
    btn.style.transition = 'background-color 0.15s ease, color 0.15s ease, transform 0.1s ease';
    btn.style.userSelect = 'none';
    btn.style.zIndex = '1';
  }

  if (typeof btn.addEventListener === 'function') {
    btn.addEventListener('click', (e: Event) => {
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      onClick();
    });

    btn.addEventListener('mouseenter', () => {
      if (btn.style) {
        btn.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
        btn.style.color = '#6366f1';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.style) {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'rgb(113, 118, 123)';
        btn.style.transform = 'scale(1)';
      }
    });

    btn.addEventListener('mousedown', () => {
      if (btn.style) {
        btn.style.transform = 'scale(0.92)';
      }
    });

    btn.addEventListener('mouseup', () => {
      if (btn.style) {
        btn.style.transform = 'scale(1)';
      }
    });
  }

  return btn;
}

/**
 * Injects the trigger button into a single tweet action bar with deduplication guard.
 */
export function injectIntoActionBar(
  actionBar: Element,
  onTrigger?: (article: Element) => void
): boolean {
  if (!actionBar) return false;

  // Deduplication guard
  if (
    actionBar.getAttribute('data-post-to-card-injected') === 'true' ||
    (typeof actionBar.querySelector === 'function' && actionBar.querySelector('[data-post-to-card-btn="true"]'))
  ) {
    return false;
  }

  actionBar.setAttribute('data-post-to-card-injected', 'true');

  const btn = createTriggerButton(() => {
    let article: Element | null = null;
    if (typeof btn.closest === 'function') {
      article = btn.closest('article[data-testid="tweet"]');
    }
    if (!article && typeof actionBar.closest === 'function') {
      article = actionBar.closest('article[data-testid="tweet"]');
    }

    if (article) {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const evt = typeof CustomEvent === 'function'
            ? new CustomEvent('post-to-card:trigger', { detail: { article } })
            : { type: 'post-to-card:trigger', detail: { article } };
          window.dispatchEvent(evt as Event);
        } catch {
          // Ignore environment differences
        }
      }

      if (onTrigger) {
        onTrigger(article);
      }
    }
  });

  actionBar.appendChild(btn);
  return true;
}

/**
 * Scans document for un-injected tweet action bars and injects trigger buttons.
 */
export function injectAll(onTrigger?: (article: Element) => void): number {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
    return 0;
  }

  // 1. Primary selector: group inside tweet article
  const selector = 'article[data-testid="tweet"] div[role="group"]:not([data-post-to-card-injected="true"])';
  const actionBars = Array.from(document.querySelectorAll(selector));

  let count = 0;
  for (const bar of actionBars) {
    if (injectIntoActionBar(bar, onTrigger)) {
      count++;
    }
  }

  // 2. Secondary fallback: if no group matched, locate via tweet action buttons
  if (count === 0) {
    const actionButtons = Array.from(
      document.querySelectorAll(
        'article[data-testid="tweet"] button[data-testid="reply"], article[data-testid="tweet"] button[data-testid="like"]'
      )
    );
    for (const btn of actionButtons) {
      let group: Element | null = null;
      if (typeof btn.closest === 'function') {
        group = btn.closest('div[role="group"]');
      }
      if (!group && btn.parentElement) {
        group = btn.parentElement.parentElement || btn.parentElement;
      }
      if (group && injectIntoActionBar(group, onTrigger)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Initializes continuous dynamic injection on Twitter/X Web App:
 * 1. Executes immediate initial injection scan.
 * 2. Establishes a 150ms debounced MutationObserver on document.body for virtual scrolling.
 * 3. Hooks popstate and history pushState/replaceState for SPA transitions.
 */
export function initTwitterInjection(
  onCardTrigger: (data: ThreadData) => void
): { disconnect: () => void; injectAll: () => void } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: CustomObserver | null = null;

  const handleArticleTrigger = (article: Element) => {
    const threadData = extractContinuousThread(article);
    onCardTrigger(threadData);
  };

  const scheduleScan = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      injectAll(handleArticleTrigger);
    }, 150);
  };

  // Immediate scan
  injectAll(handleArticleTrigger);

  // MutationObserver setup
  const globalWithObserver = globalThis as unknown as {
    DomMutationObserver?: new (cb: MutationCallback) => CustomObserver;
  };

  const MutationObserverCtor = (typeof MutationObserver !== 'undefined')
    ? MutationObserver
    : globalWithObserver.DomMutationObserver;

  if (MutationObserverCtor && typeof document !== 'undefined' && document.body) {
    observer = new MutationObserverCtor(() => {
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // SPA route transition handling
  const handleNavigation = () => {
    injectAll(handleArticleTrigger);
  };

  let unhookHistory: (() => void) | null = null;

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('locationchange', handleNavigation as EventListener);

    if (window.history) {
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
        const ret = originalPushState.call(this, data, unused, url);
        try {
          window.dispatchEvent(new Event('locationchange'));
        } catch {
          // Ignore
        }
        return ret;
      };

      window.history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
        const ret = originalReplaceState.call(this, data, unused, url);
        try {
          window.dispatchEvent(new Event('locationchange'));
        } catch {
          // Ignore
        }
        return ret;
      };

      unhookHistory = () => {
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;
      };
    }
  }

  return {
    disconnect: () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handleNavigation);
        window.removeEventListener('locationchange', handleNavigation as EventListener);
      }
      if (unhookHistory) {
        unhookHistory();
      }
    },
    injectAll: () => {
      injectAll(handleArticleTrigger);
    },
  };
}
