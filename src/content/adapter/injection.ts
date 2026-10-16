/**
 * Twitter/X Action Bar Button Injection and DOM Lifecycle Manager.
 * Injects the trigger button into tweet action bars (`div[role="group"]`),
 * guards against duplicate injections, uses a 150ms debounced MutationObserver
 * to handle virtual scrolling, and hooks SPA route navigation.
 *
 * The button itself, its wrapper, its label and the visibility stylesheet live
 * in `triggerViews.ts`; this module owns only the scan lifecycle. The locale is
 * passed down to the view rather than held as module state, so a scan that
 * injects a late button cannot disagree with the ones already on the page.
 *
 * The DOM here is used directly. This file used to guard nearly every call with
 * `typeof x === 'function'`, reach for a `globalThis.DomElement` fallback, and
 * skip work it could not do. None of that was true of the product: a content
 * script has a document, and the classes it looked for on globalThis were only
 * ever defined by the test shim. What the guards bought was that the functions
 * could be called from a bare Node process, at the cost of every reader having to
 * work out which of the branches could actually run.
 *
 * Two kinds of check remain, because they are about the environment rather than
 * about the DOM: whether the extension APIs are present (`chrome`), and the
 * existence of the custom-element registry, which MV3 can hand us as null inside
 * an isolated world.
 */

import { TWEET_ARTICLE_SELECTOR, TWEET_ARTICLE_SELECTORS, withDescendant } from './thread.ts';
import { loadUserPreferences, subscribePreferences } from '../prefs.ts';
import { getTranslation, sanitizeLocale } from '../i18n.ts';
import type { Locale } from '../../types/card.ts';

export const HIDE_ACTION_BUTTON_CLASS = 'post-to-card-hide-action-btn';
export const VISIBILITY_STYLE_ID = 'post-to-card-visibility-style';
export const TRIGGER_SELECTOR = '[data-post-to-card-btn="true"]';
const TRIGGER_BUTTON_SELECTOR = TRIGGER_SELECTOR;

/**
 * The trigger button's own stylesheet, injected once alongside the visibility
 * rule it used to be the only content of.
 *
 * Everything here is scoped to this extension's own attributes, so it cannot
 * touch X's own controls. The `!important` flags survive from before this was one
 * stylesheet: the trigger sits inside X's action bar, which sets its own
 * `display`, `align-items` and `flex-shrink` on flex children, and a
 * same-specificity rule loses to the one the page ships later. The layout
 * declarations are therefore still mine to win; the *paint* ones are not
 * important, which is what lets a normal `:hover` rule below override the page's
 * colors.
 */
const TRIGGER_CSS = `
[data-post-to-card-btn="true"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 34.75px;
  min-width: 34.75px;
  min-height: 20px;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: rgb(113, 118, 123);
  font: inherit;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  vertical-align: middle;
  margin: auto 0;
  user-select: none;
  position: relative;
  z-index: 1;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
[data-post-to-card-btn="true"] svg { display: block; }

/* Neutral on hover. The button used to hard-code X's own brand blue,
   rgb(29, 155, 240), as its inline hover colour — the same blue the card themes
   are forbidden from carrying, and the same blue the tweet's own reply button
   turns on hover, so the trigger lit up exactly like a native control and had
   nothing of its own. This stays neutral grey and adds a focus ring instead, which
   is the affordance a keyboard user actually needs. */
[data-post-to-card-btn="true"]:hover {
  background-color: rgba(255, 255, 255, 0.12);
  color: rgb(231, 233, 234);
}
[data-post-to-card-btn="true"]:active {
  transform: scale(0.92);
}

/* The one thing the inline version could not do. outline:none was set inline, so
   nothing — not :focus, not :focus-visible, not the browser's own default — could
   draw a ring on a keyboard-focused trigger: the only control this extension puts
   on the page was invisible to a keyboard. The offset is negative because the
   action bar clips its children, so an outset ring is cut in half on the top and
   bottom. */
[data-post-to-card-btn="true"]:focus-visible {
  outline: 2px solid rgb(108, 176, 245);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  [data-post-to-card-btn="true"] { transition-duration: 0.01ms; }
}

[data-post-to-card-wrapper="true"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  height: 100% !important;
  max-height: 100%;
  margin: auto 0 !important;
  flex-shrink: 0 !important;
}
`;

/**
 * Toggles the visibility of injected action bar trigger buttons across all tweets.
 * When hidden, the buttons remain in DOM (preserving injection deduplication and scroll state)
 * but are visually removed with `display: none !important`.
 */
export function setInjectedButtonVisibility(visible: boolean): void {
  if (!document.getElementById(VISIBILITY_STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = VISIBILITY_STYLE_ID;
    const hideRule = `
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
    styleEl.textContent = TRIGGER_CSS + hideRule;
    const target = document.head || document.documentElement || document.body;
    target.appendChild(styleEl);
  }

  const root = document.documentElement || document.body;
  if (visible) {
    root.classList.remove(HIDE_ACTION_BUTTON_CLASS);
  } else {
    root.classList.add(HIDE_ACTION_BUTTON_CLASS);
  }
}

/**
 * Points the injected triggers at a locale, including the ones already on the
 * page. The label is written onto the element rather than drawn by CSS because
 * it is also the button's accessible name.
 */
export function applyTriggerLocale(locale?: Locale): void {
  const label = getTranslation(sanitizeLocale(locale)).triggerButtonTitle;
  for (const btn of Array.from(document.querySelectorAll(TRIGGER_SELECTOR))) {
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  }
}

/**
 * Lucide's `layout-panel-top`, copied from the installed package so the shape
 * matches exactly. The previous glyph was the Image icon, whose rounded square
 * plus circle reads as a camera at this size and was easily confused with X's
 * own media controls.
 *
 * It is also the product's mark: the popup header and the modal header now draw
 * the same three blocks, so the three places that name this extension agree.
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
 *
 * All of its styling lives in the stylesheet this module injects, and it used to
 * be thirty-odd `btn.style.` assignments plus JS listeners for hover and press.
 * That was two problems. The listeners re-implemented `:hover` and `:active` in
 * JS, so a `pointerleave` that stopped before the JS ran left the button lit; and
 * `btn.style.outline = 'none'` removed the focus ring that `:focus-visible` would
 * otherwise have drawn, leaving the only control this extension puts on the page
 * with no keyboard indicator at all. The states the reviewer saw were the
 * ones the stylesheet draws now.
 */
export function createTriggerButton(onClick: () => void, locale?: Locale): HTMLElement {
  const t = getTranslation(sanitizeLocale(locale));
  const btn = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', t.triggerButtonTitle);
  btn.setAttribute('title', t.triggerButtonTitle);
  btn.setAttribute('data-post-to-card-btn', 'true');

  btn.innerHTML = TRIGGER_BUTTON_SVG;

  btn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });

  return btn;
}

/**
 * Creates a flex container wrapper matching Twitter/X action bar item layout.
 * Ensures the trigger button is strictly centered vertically on both feed items
 * and status detail pages (`/status/xxx`).
 */
export function createActionBarButtonWrapper(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-post-to-card-wrapper', 'true');
  // Styled by TRIGGER_CSS. Inline styles lived here too; they moved with the
  // button's so one stylesheet owns everything this extension paints into X's
  // action bar.
  return wrapper;
}

interface CustomObserver {
  observe: (target: Node, options?: MutationObserverInit) => void;
  disconnect: () => void;
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
  onTrigger?: (article: Element) => void,
  locale?: Locale
): boolean {
  if (!actionBar) return false;

  const article = actionBar.closest(TWEET_ARTICLE_SELECTOR);

  // Deduplication guard, checked on the container and on its tweet.
  if (
    actionBar.getAttribute('data-post-to-card-injected') === 'true' ||
    actionBar.querySelector(TRIGGER_BUTTON_SELECTOR)
  ) {
    return false;
  }
  if (article) {
    if (
      article.getAttribute('data-post-to-card-injected') === 'true' ||
      article.querySelector(TRIGGER_BUTTON_SELECTOR)
    ) {
      return false;
    }
  }

  actionBar.setAttribute('data-post-to-card-injected', 'true');
  if (article) article.setAttribute('data-post-to-card-injected', 'true');

  const btn = createTriggerButton(() => {
    const target = article || btn.closest(TWEET_ARTICLE_SELECTOR);

    if (target) {
      window.dispatchEvent(
        new CustomEvent('post-to-card:trigger', { detail: { article: target } })
      );

      if (onTrigger) {
        onTrigger(target);
      }
    }
  }, locale);

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
  actionBar.appendChild(wrapper);
  return true;
}

/**
 * Scans document for un-injected tweet action bars and injects trigger buttons.
 */
export function injectAll(onTrigger?: (article: Element) => void, locale?: Locale): number {
  // 1. Primary selector: the action group of a top-level tweet.
  //
  //    `div[role="group"]` is a generic container that is not specific to the
  //    action bar: it also appears inside media players and quoted posts. A bare
  //    match therefore attaches the trigger to the photo or video block instead
  //    of the action row. Only a group that actually holds the engagement
  //    controls qualifies, and each tweet contributes exactly one candidate.
  //
  //    The descendant goes on every alternative, not on the joined string —
  //    `a, b div` parses as `a or (b div)`, which matched tweet *articles* and
  //    put the trigger on the post root, below the media, instead of in the
  //    action row. `withDescendant` is the one place that knows this.
  const selector = withDescendant(
    TWEET_ARTICLE_SELECTORS,
    'div[role="group"]:not([data-post-to-card-injected="true"])'
  );
  const actionBars = findActionBars(selector);

  let count = 0;
  for (const bar of actionBars) {
    if (injectIntoActionBar(bar, onTrigger, locale)) {
      count++;
    }
  }

  // 2. Secondary fallback: only runs when the primary selector matched nothing
  //    anywhere on the page, so it cannot double-inject alongside stage 1.
  //
  //    Same list rule as stage 1: each control selector is appended to every
  //    article alternative, not to the joined string. Interpolating the joined
  //    form here matched tweet *articles*, and `closest('div[role="group"]')`
  //    then answered null, so the anchor fell through to
  //    `parentElement.parentElement` — the post root, or `<body>` itself.
  if (count === 0) {
    const selector = TWEET_ARTICLE_SELECTORS.flatMap((part) => [
      `${part.trim()} button[data-testid="reply"]`,
      `${part.trim()} button[data-testid="like"]`,
    ]).join(', ');
    const actionButtons = Array.from(document.querySelectorAll(selector)).filter(btn =>
      isTopLevelActionBar(btn)
    );
    for (const btn of actionButtons) {
      const article = btn.closest(TWEET_ARTICLE_SELECTOR);
      let group: Element | null = btn.closest('div[role="group"]');
      if (!group && btn.parentElement) {
        // The fallback only applies to a control that is *not* wrapped in a
        // role=group, and it must still land inside the owning tweet on
        // something that holds the engagement controls. Without both guards the
        // walk reached `<body>` and appended the trigger to the page.
        const candidate = btn.parentElement.parentElement || btn.parentElement;
        const insideOwnArticle = !article || article.contains(candidate);
        if (insideOwnArticle && isActionBar(candidate)) group = candidate;
      }
      if (group && injectIntoActionBar(group, onTrigger, locale)) {
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
      const row = controls[0].closest('div[role="group"]') || controls[0].parentElement?.parentElement;
      const target = row || controls[0].parentElement;
      if (target && injectIntoActionBar(target, onTrigger, locale)) {
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
  if (!document.querySelectorAll) return [];

  const candidates = Array.from(document.querySelectorAll(selector)).filter(isTopLevelActionBar);
  const byArticle = new Map<Element, Element>();

  for (const candidate of candidates) {
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
  if (
    el.querySelector('button[data-testid="reply"], button[data-testid="retweet"], button[data-testid="unretweet"], button[data-testid="like"], button[data-testid="unlike"]')
  ) {
    return true;
  }
  // The engagement controls are always present on a live bar; the aria-label
  // aggregates their counts and is used when the testids are absent.
  const label = el.getAttribute('aria-label') || '';
  return /\d/.test(label) && /回复|Reply|转帖|Repost|Retweet|喜欢|Like/i.test(label);
}

/**
 * True when the element belongs to the tweet itself rather than to a quoted post
 * nested inside it.
 */
function isTopLevelActionBar(el: Element): boolean {
  if (el.closest('div[data-testid="quoteTweet"]')) return false;
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
 * 3. Hooks popstate for SPA transitions. A history pushState/replaceState wrapper
 *    is deliberately not installed -- see the note at the hook itself.
 */
export function initTwitterInjection(
  onCardTrigger: (article: Element) => void
): { disconnect: () => void; injectAll: () => void; triggerActiveTweet: () => boolean } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: CustomObserver | null = null;

  /**
   * The locale every trigger this manager injects speaks. Held in the manager
   * rather than passed through injectAll so a scan that fires later uses the
   * same language as the buttons already on the page.
   */
  let triggerLocale: Locale | undefined;

  const handleArticleTrigger = (article: Element) => {
    onCardTrigger(article);
  };

  const scan = () => {
    injectAll(handleArticleTrigger, triggerLocale);
  };

  // 1. Initial preference load. Visibility hides the triggers; the locale is what
  //    they say, and it has to come from the saved choice rather than the
  //    browser, or a user who picked a language sees the page in another one.
  //
  //    The read is asynchronous, so it can come back after something has already
  //    written a newer preference -- opening the card and changing a setting is
  //    enough. Applying this snapshot then would undo that change, which reads to
  //    the user as a setting that reverted itself. So a value that arrived by
  //    change wins, and this snapshot only applies while nothing has.
  let preferenceChangedSinceLoad = false;

  loadUserPreferences()
    .then((prefs) => {
      if (preferenceChangedSinceLoad) return;
      triggerLocale = prefs.locale;
      setInjectedButtonVisibility(prefs.showActionBarButton !== false);
      applyTriggerLocale(prefs.locale);
    })
    .catch(() => {});

  // 2. Storage change listener for multi-tab live sync
  const unsubscribePrefs = subscribePreferences((newConfig) => {
    preferenceChangedSinceLoad = true;
    triggerLocale = newConfig.locale;
    setInjectedButtonVisibility(newConfig.showActionBarButton !== false);
    applyTriggerLocale(newConfig.locale);
  });

  // 3. Track hovered article & trigger active tweet (for shortcut & popup)
  let lastHoveredArticle: Element | null = null;

  const handleMouseOver = (e: Event) => {
    const mouseEvt = e as MouseEvent;
    const target = mouseEvt.target as Element | null;
    if (target) {
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
    if (!targetArticle) {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        targetArticle = activeEl.closest(TWEET_ARTICLE_SELECTOR);
      }
    }
    if (!targetArticle) {
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
    // `code` carries the physical key, `key` the produced character. macOS
    // Option+C produces 'ç', so matching on `key` alone loses the shortcut on
    // every Mac; the modifier is still reported as altKey there.
    const isC = e.key === 'c' || e.key === 'C' || e.code === 'KeyC';
    if (e.altKey && isC && !e.ctrlKey && !e.metaKey) {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tag = activeEl.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || activeEl.isContentEditable) {
          return;
        }
      }

      if (triggerActiveTweet()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  document.addEventListener('mouseover', handleMouseOver);
  window.addEventListener('keydown', handleKeyDown as EventListener);

  const scheduleScan = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      scan();
    }, 150);
  };

  // Immediate scan
  scan();

  // MutationObserver setup
  if (document.body) {
    observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // SPA route transition handling.
  //
  // Only `popstate` is hooked. A `history.pushState` wrapper used to live here and
  // dispatched a `locationchange` event, but this script runs in the isolated
  // world: the wrapper it installs is the one X's own scripts never call, so the
  // event never fired and the wrapper's only effect was to shadow two native
  // methods. Route changes reach `scan` through the observer above instead -- a
  // route change replaces the main column, which is a childList mutation on body.
  const handleNavigation = () => {
    scan();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', handleNavigation);
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
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('keydown', handleKeyDown as EventListener);
      document.removeEventListener('mouseover', handleMouseOver);
      unsubscribePrefs();
    },
    injectAll: () => {
      scan();
    },
    triggerActiveTweet,
  };
}
