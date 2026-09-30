/**
 * Twitter/X Action Bar Button Injection and DOM Lifecycle Manager.
 * Injects a sleek "✨" trigger button into tweet action bars (`div[role="group"]`),
 * guards against duplicate injections, uses a 150ms debounced MutationObserver
 * to handle virtual scrolling, and hooks SPA route navigation.
 */

import type { ThreadData } from '../../types/tweet';
import { extractContinuousThread } from './thread';
import { loadUserPreferences, STORAGE_KEY } from '../ui/themes';

interface CustomObserver {
  observe: (target: Node, options?: MutationObserverInit) => void;
  disconnect: () => void;
}

import { getTranslation, detectDefaultLocale } from '../i18n';

export const HIDE_ACTION_BUTTON_CLASS = 'post-to-card-hide-action-btn';
export const VISIBILITY_STYLE_ID = 'post-to-card-visibility-style';

/**
 * Toggles the visibility of injected action bar trigger buttons across all tweets.
 * When hidden, the buttons remain in DOM (preserving injection deduplication and scroll state)
 * but are visually removed with `display: none !important`.
 */
export function setInjectedButtonVisibility(visible: boolean): void {
  if (typeof document === 'undefined') return;

  if (!document.getElementById(VISIBILITY_STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = VISIBILITY_STYLE_ID;
    styleEl.textContent = `
      html.${HIDE_ACTION_BUTTON_CLASS} [data-post-to-card-btn="true"],
      html.${HIDE_ACTION_BUTTON_CLASS} [data-post-to-card-wrapper="true"],
      .${HIDE_ACTION_BUTTON_CLASS} [data-post-to-card-btn="true"],
      .${HIDE_ACTION_BUTTON_CLASS} [data-post-to-card-wrapper="true"] {
        display: none !important;
      }
      [data-post-to-card-wrapper="true"] {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        align-self: center !important;
        height: 100% !important;
        margin: auto 0 !important;
      }
      [data-post-to-card-btn="true"] {
        align-self: center !important;
        margin: auto 0 !important;
        vertical-align: middle !important;
      }
    `;
    const target = document.head || document.documentElement || document.body;
    if (target && typeof target.appendChild === 'function') {
      target.appendChild(styleEl);
    }
  }

  const root = document.documentElement || document.body;
  if (root && root.classList) {
    if (visible) {
      root.classList.remove(HIDE_ACTION_BUTTON_CLASS);
    } else {
      root.classList.add(HIDE_ACTION_BUTTON_CLASS);
    }
  }
}

export const TRIGGER_BUTTON_SVG = `
<svg viewBox="0 0 24 24" width="18.75" height="18.75" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
  <circle cx="9" cy="9" r="2"></circle>
  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
</svg>
`.trim();

/**
 * Creates the sleek Post-to-Card trigger button formatted to blend
 * natively into the Twitter/X tweet action bar using Lucide Image icon.
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

  // Set crisp SVG vector icon from Lucide icon library without emoji
  if (typeof (btn as unknown as { innerHTML?: string }).innerHTML !== 'undefined') {
    (btn as unknown as { innerHTML: string }).innerHTML = TRIGGER_BUTTON_SVG;
  }

  if (btn.style) {
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.alignSelf = 'center';
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
    btn.style.margin = 'auto 0';
    btn.style.verticalAlign = 'middle';
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
        btn.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
        btn.style.color = 'rgb(29, 155, 240)';
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
 * Creates a flex container wrapper matching Twitter/X action bar item layout.
 * Ensures the trigger button is strictly centered vertically on both feed items
 * and status detail pages (`/status/xxx`).
 */
export function createActionBarButtonWrapper(): HTMLElement {
  const globalWithDom = globalThis as unknown as {
    DomElement?: new (tagName: string) => HTMLElement;
  };

  const wrapper: HTMLElement = (typeof document !== 'undefined' && typeof document.createElement === 'function')
    ? document.createElement('div')
    : (globalWithDom.DomElement ? new globalWithDom.DomElement('DIV') : ({} as HTMLElement));

  if (typeof wrapper.setAttribute === 'function') {
    wrapper.setAttribute('data-post-to-card-wrapper', 'true');
  }

  if (wrapper.style) {
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignSelf = 'center';
    wrapper.style.height = '100%';
    wrapper.style.minHeight = '34.75px';
    wrapper.style.maxHeight = '100%';
    wrapper.style.margin = 'auto 0';
    wrapper.style.flexShrink = '0';
  }

  return wrapper;
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

  const wrapper = createActionBarButtonWrapper();

  // If Twitter native button wrappers exist as siblings, copy their class list for seamless integration
  if (typeof actionBar.querySelector === 'function') {
    const siblingBtn = actionBar.querySelector('button[data-testid="reply"], button[data-testid="like"], button[data-testid="retweet"], button');
    if (siblingBtn && siblingBtn.parentElement && siblingBtn.parentElement !== actionBar) {
      const parentClass = siblingBtn.parentElement.getAttribute('class');
      if (parentClass && typeof wrapper.setAttribute === 'function') {
        wrapper.setAttribute('class', parentClass);
      }
    }
  }

  wrapper.appendChild(btn);
  actionBar.appendChild(wrapper);
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
): { disconnect: () => void; injectAll: () => void; triggerActiveTweet: () => boolean } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: CustomObserver | null = null;

  const handleArticleTrigger = (article: Element) => {
    const threadData = extractContinuousThread(article);
    onCardTrigger(threadData);
  };

  // 1. Initial preference load for button visibility
  loadUserPreferences()
    .then((prefs) => {
      setInjectedButtonVisibility(prefs.showActionBarButton !== false);
    })
    .catch(() => {});

  // 2. Storage change listener for multi-tab live sync
  const handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
      const newConfig = changes[STORAGE_KEY].newValue as { showActionBarButton?: boolean };
      setInjectedButtonVisibility(newConfig.showActionBarButton !== false);
    }
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange as unknown as (changes: object, area: string) => void);
  }

  // 3. Track hovered article & trigger active tweet (for shortcut & popup)
  let lastHoveredArticle: Element | null = null;

  const handleMouseOver = (e: Event) => {
    const mouseEvt = e as MouseEvent;
    const target = mouseEvt.target as Element | null;
    if (target && typeof target.closest === 'function') {
      const article = target.closest('article[data-testid="tweet"]');
      if (article) {
        lastHoveredArticle = article;
      }
    }
  };

  const triggerActiveTweet = (): boolean => {
    let targetArticle: Element | null = null;
    if (lastHoveredArticle && (lastHoveredArticle as { isConnected?: boolean }).isConnected !== false) {
      targetArticle = lastHoveredArticle;
    }
    if (!targetArticle && typeof document !== 'undefined') {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && typeof activeEl.closest === 'function') {
        targetArticle = activeEl.closest('article[data-testid="tweet"]');
      }
    }
    if (!targetArticle && typeof document !== 'undefined') {
      const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      targetArticle = tweets[0] || null;
    }

    if (targetArticle) {
      handleArticleTrigger(targetArticle);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
      const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
      if (activeEl) {
        const tag = activeEl.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || activeEl.isContentEditable) {
          return;
        }
      }

      if (triggerActiveTweet()) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
    }
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('mouseover', handleMouseOver);
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', handleKeyDown as EventListener);
  }

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
        window.removeEventListener('keydown', handleKeyDown as EventListener);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('mouseover', handleMouseOver);
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange as unknown as (changes: object, area: string) => void);
      }
      if (unhookHistory) {
        unhookHistory();
      }
    },
    injectAll: () => {
      injectAll(handleArticleTrigger);
    },
    triggerActiveTweet,
  };
}
