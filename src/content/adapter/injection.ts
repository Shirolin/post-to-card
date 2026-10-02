/**
 * Twitter/X Action Bar Button Injection and DOM Lifecycle Manager.
 * Injects a sleek "✨" trigger button into tweet action bars (`div[role="group"]`),
 * guards against duplicate injections, uses a 150ms debounced MutationObserver
 * to handle virtual scrolling, and hooks SPA route navigation.
 */

import type { ThreadData } from '../../types/tweet';
import { extractContinuousThread, TWEET_ARTICLE_SELECTOR } from './thread.ts';
import { loadUserPreferences, STORAGE_KEY } from '../ui/themes.ts';

interface CustomObserver {
  observe: (target: Node, options?: MutationObserverInit) => void;
  disconnect: () => void;
}

import { getTranslation, detectDefaultLocale } from '../i18n.ts';

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
        flex-shrink: 0 !important;
      }
      [data-post-to-card-btn="true"] {
        align-self: center !important;
        margin: auto 0 !important;
        flex-shrink: 0 !important;
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

/**
 * Lucide's `layout-panel-top`, copied from the installed package so the shape
 * matches exactly. The previous glyph was the Image icon, whose rounded square
 * plus circle reads as a camera at this size and was easily confused with X's
 * own media controls.
 */
export const TRIGGER_BUTTON_SVG = `
<svg viewBox="0 0 24 24" width="18.75" height="18.75" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect width="18" height="7" x="3" y="3" rx="1" ry="1"></rect>
  <rect width="7" height="7" x="3" y="14" rx="1" ry="1"></rect>
  <rect width="7" height="7" x="14" y="14" rx="1" ry="1"></rect>
</svg>
`.trim();

/**
 * Creates the Post-to-Card trigger button, formatted to blend into the X tweet
 * action bar while remaining visually distinct from its native controls.
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
    // Matches the hit area X gives its own action buttons in a measured bar:
    // a 20px tall row with ~34px of pitch, so the target is wide enough to click
    // while the box itself does not overflow the row vertically.
    btn.style.width = '34.75px';
    btn.style.height = '100%';
    btn.style.minWidth = '34.75px';
    btn.style.minHeight = '20px';
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
    // Sized from a measured action bar rather than copied from a native class.
    // The live bar is 20px tall with roughly 34px of horizontal pitch between
    // items, so the wrapper matches that and stays vertically centred without
    // inheriting a min-height that would overflow the row.
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignSelf = 'center';
    wrapper.style.height = '100%';
    wrapper.style.maxHeight = '100%';
    wrapper.style.margin = 'auto 0';
    wrapper.style.flexShrink = '0';
  }

  return wrapper;
}

/**
 * Injects the trigger button into a single tweet action bar.
 *
 * Deduplication is anchored to the owning tweet, not to the container. The
 * three lookup strategies below resolve to different elements for the same
 * post — the role=group wrapper, the reply button's parent, and the action row
 * itself — so a container-level marker let one tweet receive several buttons.
 * Marking the article makes the guard hold no matter which element a given
 * strategy lands on.
 */
export function injectIntoActionBar(
  actionBar: Element,
  onTrigger?: (article: Element) => void
): boolean {
  if (!actionBar) return false;

  const article = typeof actionBar.closest === 'function'
    ? actionBar.closest(TWEET_ARTICLE_SELECTOR)
    : null;

  // Deduplication guard, checked on the container and on its tweet.
  if (
    actionBar.getAttribute('data-post-to-card-injected') === 'true' ||
    (typeof actionBar.querySelector === 'function' && actionBar.querySelector('[data-post-to-card-btn="true"]'))
  ) {
    return false;
  }
  if (article) {
    if (
      article.getAttribute('data-post-to-card-injected') === 'true' ||
      (typeof article.querySelector === 'function' && article.querySelector('[data-post-to-card-btn="true"]'))
    ) {
      return false;
    }
  }

  actionBar.setAttribute('data-post-to-card-injected', 'true');
  if (article) article.setAttribute('data-post-to-card-injected', 'true');

  const btn = createTriggerButton(() => {
    const target = article || (typeof btn.closest === 'function' ? btn.closest(TWEET_ARTICLE_SELECTOR) : null);

    if (target) {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const evt = typeof CustomEvent === 'function'
            ? new CustomEvent('post-to-card:trigger', { detail: { article: target } })
            : { type: 'post-to-card:trigger', detail: { article: target } };
          window.dispatchEvent(evt as Event);
        } catch {
          // Ignore environment differences
        }
      }

      if (onTrigger) {
        onTrigger(target);
      }
    }
  });

  const wrapper = createActionBarButtonWrapper();

  // The wrapper no longer copies a native sibling's class list. Doing so pulled
  // in X's own layout rules — including a min-height and margins that had to be
  // fought with !important overrides — and made the button shift whenever X
  // restyled its action bar. It now carries only its own class.
  wrapper.appendChild(btn);

  // Appended, so the trigger lands at the very end of the action row, after
  // share. This is the position it has always occupied and is the intended
  // one: keeping it out of the engagement group stops it reading as a fifth
  // metric, and the bar is a single space-between flex row with no separators
  // to align against.
  if (typeof actionBar.appendChild === 'function') {
    actionBar.appendChild(wrapper);
  }
  return true;
}

/**
 * Scans document for un-injected tweet action bars and injects trigger buttons.
 */
export function injectAll(onTrigger?: (article: Element) => void): number {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
    return 0;
  }

  // 1. Primary selector: the action group of a top-level tweet.
  //
  //    `div[role="group"]` is a generic container that is not specific to the
  //    action bar: it also appears inside media players and quoted posts. A bare
  //    match therefore attaches the trigger to the photo or video block instead
  //    of the action row. Only a group that actually holds the engagement
  //    controls qualifies, and each tweet contributes exactly one candidate.
  const selector = `${TWEET_ARTICLE_SELECTOR} div[role="group"]:not([data-post-to-card-injected="true"])`;
  const actionBars = findActionBars(selector);

  let count = 0;
  for (const bar of actionBars) {
    if (injectIntoActionBar(bar, onTrigger)) {
      count++;
    }
  }

  // 2. Secondary fallback: only runs when the primary selector matched nothing
  //    anywhere on the page, so it cannot double-inject alongside stage 1.
  if (count === 0) {
    const actionButtons = Array.from(
      document.querySelectorAll(
        `${TWEET_ARTICLE_SELECTOR} button[data-testid="reply"], ${TWEET_ARTICLE_SELECTOR} button[data-testid="like"]`
      )
    ).filter(btn => isTopLevelActionBar(btn));
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

  // 3. Logged-out fallback. A real public tweet page was observed to render
  //    without any data-testid, so neither div[role="group"] nor the reply/like
  //    testids match. The engagement controls are still present, so the trigger
  //    is anchored to the row that holds them rather than to an arbitrary
  //    role=button, which on a media-rich tweet can sit inside the photo block.
  if (count === 0) {
    const articles = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR));

    for (const article of articles) {
      if (article.getAttribute('data-post-to-card-injected') === 'true') continue;

      // Locate the engagement row by the controls it contains, in either the
      // testid form or the labelled form seen when logged out.
      const controls = Array.from(article.querySelectorAll('[role="button"], a[role="link"]'))
        .filter(el => isTopLevelActionBar(el))
        .filter(el => {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
          return /^(?:回复|Reply|Comment|转帖|Repost|Retweet|喜欢|Like)\b/i.test(label) || /^\d/.test(label);
        });

      if (controls.length === 0) continue;

      // Group the controls and attach to the common container they live in.
      const row = typeof controls[0].closest === 'function'
        ? controls[0].closest('div[role="group"]') || controls[0].parentElement?.parentElement
        : null;
      const target = row || controls[0].parentElement;
      if (target && injectIntoActionBar(target, onTrigger)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Resolves the action bar for every tweet, at most one per tweet.
 *
 * `div[role="group"]` is not unique to the action row: media players and quoted
 * posts contain their own. Matching them put the trigger on the photo block.
 * A real action bar is identified by the engagement controls it holds, so
 * candidates are grouped by owning tweet and only the qualifying one is kept.
 */
function findActionBars(selector: string): Element[] {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return [];

  const candidates = Array.from(document.querySelectorAll(selector)).filter(isTopLevelActionBar);
  const byArticle = new Map<Element, Element>();

  for (const candidate of candidates) {
    if (typeof candidate.closest !== 'function') continue;
    const article = candidate.closest(TWEET_ARTICLE_SELECTOR);
    if (!article) continue;

    const existing = byArticle.get(article);
    // Prefer a group that actually contains the engagement controls.
    if (!existing || isActionBar(candidate)) {
      if (!existing || !isActionBar(existing) || isActionBar(candidate)) {
        byArticle.set(article, candidate);
      }
    }
  }

  return Array.from(byArticle.values());
}

/**
 * True when a group holds the reply, retweet or like controls, which is what
 * distinguishes the action bar from a media player or quote container.
 */
export function isActionBar(el: Element): boolean {
  if (typeof el.querySelector !== 'function') return false;
  if (
    el.querySelector('button[data-testid="reply"], button[data-testid="retweet"], button[data-testid="unretweet"], button[data-testid="like"], button[data-testid="unlike"]')
  ) {
    return true;
  }
  // The engagement controls are always present on a live bar; the aria-label
  // aggregates their counts and is used when the testids are absent.
  const label = typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') || '' : '';
  return /\d/.test(label) && /回复|Reply|转帖|Repost|Retweet|喜欢|Like/i.test(label);
}

/**
 * True when the element belongs to the tweet itself rather than to a quoted post
 * nested inside it.
 */
function isTopLevelActionBar(el: Element): boolean {
  if (typeof el.closest === 'function') {
    if (el.closest('div[data-testid="quoteTweet"]')) return false;
  }
  // A group inside a nested <article> is a quoted post's own action bar.
  let node: Element | null = el.parentElement;
  let depth = 0;
  while (node) {
    if ((node.tagName || '').toUpperCase() === 'ARTICLE') {
      depth++;
      if (depth > 1) return false;
    }
    node = node.parentElement;
  }
  return true;
}

/**
 * Initializes continuous dynamic injection on Twitter/X Web App:
 * 1. Executes immediate initial injection scan.
 * 2. Establishes a 150ms debounced MutationObserver on document.body for virtual scrolling.
 * 3. Hooks popstate and history pushState/replaceState for SPA transitions.
 */
export function initTwitterInjection(
  onCardTrigger: (data: ThreadData, article: Element) => void
): { disconnect: () => void; injectAll: () => void; triggerActiveTweet: () => boolean } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: CustomObserver | null = null;

  const handleArticleTrigger = (article: Element) => {
    const threadData = extractContinuousThread(article);
    // The originating element is passed through so the caller can correlate the
    // DOM result with any structured response captured for the same tweet.
    onCardTrigger(threadData, article);
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
      const article = target.closest(TWEET_ARTICLE_SELECTOR);
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
        targetArticle = activeEl.closest(TWEET_ARTICLE_SELECTOR);
      }
    }
    if (!targetArticle && typeof document !== 'undefined') {
      const tweets = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR));
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
