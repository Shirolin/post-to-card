/**
 * Twitter/X Action Bar Button Injection and DOM Lifecycle Manager.
 * Injects the trigger button into tweet action bars (`div[role="group"]`),
 * guards against duplicate injections, uses a 150ms debounced MutationObserver
 * to handle virtual scrolling, and hooks SPA route navigation.
 *
 * One module for both halves of that job: the trigger's own markup, its
 * stylesheet, the theme probe that colours it, and the visibility class it
 * wears, beside the scan lifecycle that puts them on the page. They were once
 * split into a `triggerViews.ts`, which meant a change to the button's look
 * started in a file whose name said nothing about action bars; reading the
 * button now means reading the file that decides when it exists.
 *
 * The locale is still passed down to the view rather than held as module state,
 * so a scan that injects a late button cannot disagree with the ones already on
 * the page.
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
import { getTranslation, resolveLocale } from '../i18n.ts';
import type { LocalePreference } from '../../types/card.ts';
import { brandMarkSvg } from '../ui/brandMark.ts';

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
  /* The box is the hover circle, not the icon: the layout placeholder is the
     wrapper below, so the click target stays a 34.75/38.5 disc while the row
     only spends icon width on us. The circle is the icon plus the 16px X pads
     its own action buttons with, and both numbers come from the per-bar
     variable the injection writes. */
  --post-to-card-hover-size: calc(var(--post-to-card-icon-size) + 16px);
  width: var(--post-to-card-hover-size);
  min-width: var(--post-to-card-hover-size);
  min-height: 20px;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: transparent;
  /* X's own action-bar grey, per theme: #536471 on the light page, #71767B on
     the dim and lights-out ones. One hard-coded #71767B served all three, which
     is the dark theme's grey, so on the white page this button sat a shade
     lighter than the icons beside it. Which theme is on is read off the page
     (see applyActionBarTheme), never guessed from prefers-color-scheme:
     X's theme is a stored choice and only its "use system" setting follows the
     OS. The default here is the light value, because "Default" is X's own
     default theme; the dark pair is at the end of this block. */
  color: rgb(83, 100, 113);
  font: inherit;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  vertical-align: middle;
  margin: auto 0;
  user-select: none;
  position: relative;
  z-index: 1;
  transition: color 0.15s ease, transform 0.1s ease;
}
[data-post-to-card-btn="true"] svg {
  display: block;
  /* Overrides brandMarkSvg's width/height attributes. The mark is drawn at the
     timeline's size for every surface that shares it; only this surface follows
     the action bar it landed in (18.75 in a timeline, 22.5 on the focused tweet
     of a status page). */
  width: var(--post-to-card-icon-size);
  height: var(--post-to-card-icon-size);
}

/* X paints its own action-button hover as a circle centred on the icon, 16px
   wider than the glyph. Ours is only as tall as the action row (~20px), so the
   same background on the button itself drew a wide oval that matched nothing in
   the row. The circle is a pseudo-element instead: it can be a circle without
   making the action bar 34.75px tall, and it takes the button's own size, which
   the stylesheet derives from the per-bar icon size. */
[data-post-to-card-btn="true"]::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--post-to-card-hover-size);
  height: var(--post-to-card-hover-size);
  margin: calc(var(--post-to-card-hover-size) / -2) 0 0 calc(var(--post-to-card-hover-size) / -2);
  border-radius: 9999px;
  background-color: transparent;
  transition: background-color 0.15s ease;
  z-index: -1;
  pointer-events: none;
}
[data-post-to-card-btn="true"]:hover::before {
  /* Light page: X paints its own hover as a 10% wash of the light theme's ink
     (#0F1419). Ours was a 12% wash of *white*, which on a white page is the
     page itself — the circle measured 1.00:1, i.e. it did not appear at all. */
  background-color: rgba(15, 20, 25, 0.1);
}

/* The mark turns the product's mint on hover.
 *
 * It has been two other things. First a hard-coded indigo, then X's own brand
 * blue rgb(29, 155, 240) -- the same blue the card themes are forbidden from
 * carrying, and the same blue the tweet's own reply button turns on hover, so
 * the trigger lit up exactly like a native control and had nothing of its own.
 * Then a fully neutral state that differed from rest only in brightness, which
 * on a 12% circle is easy to lose among X's own hovers. Mint is the colour this
 * extension already uses everywhere else (the focus ring before this change, the
 * popup's accent, the card's mark), so the hover says "PostPress" without
 * pretending to be a fifth X control.
 *
 * Two values, because the ground decides: #6CC59C is 10.10:1 on #000000 and
 * 7.93:1 on #15202B, but only 2.08:1 on the white page. The light theme
 * therefore uses the same hue and saturation (HSL 152.4 / 43%) at 36%
 * lightness -- #34845F, 4.55:1 on white and 3.71:1 on the 10% ink circle it
 * sits in. Both clear the 3:1 non-text floor; the dark rule is at the end of
 * this block.
 *
 * The circle stays the neutral wash above rather than a mint tint: the glyph is
 * the state, and a tinted circle would put colour in the row while the pointer
 * is merely passing over it. */
[data-post-to-card-btn="true"]:hover {
  color: rgb(52, 132, 95);
}
[data-post-to-card-btn="true"]:active {
  transform: scale(0.92);
}

/* The one thing the inline version could not do. outline:none was set inline, so
   nothing — not :focus, not :focus-visible, not the browser's own default — could
   draw a ring on a keyboard-focused trigger: the only control this extension puts
   on the page was invisible to a keyboard. The offset is negative because the
   action bar clips its children, so an outset ring is cut in half on the top and
   bottom.

   The colour is the page's own ink, not the mint: hover is mint now, and a mint
   ring would make keyboard focus look like the pointer resting on the button.
   The ink is also the strongest colour either ground has -- 18.51:1 on the white
   page, 17.24:1 on #000000 and 9.37:1 on the dark theme's hover circle -- far
   above the 3:1 non-text floor (1.4.11) that a ring only needs, because it is
   the one state a keyboard user has to find. The dark rule is at the end of the
   block. */
[data-post-to-card-btn="true"]:focus-visible {
  outline: 2px solid rgb(15, 20, 25);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  [data-post-to-card-btn="true"],
  [data-post-to-card-btn="true"]::before { transition-duration: 0.01ms; }
}

[data-post-to-card-wrapper="true"] {
  /* Written per bar by the injection, after the append: X uses 18.75px icons in
     the timeline and in the replies on a status page but 22.5px on the focused
     tweet above them, so two sizes can share one screen and neither a
     breakpoint nor a page-wide rule can answer for both. The default is the
     timeline size, which is also what stands when the bar has nothing to read. */
  --post-to-card-icon-size: 18.75px;
  --post-to-card-trailing-gap: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  /* The placeholder is the icon, not the hover circle: X's own trailing boxes are
     the glyph (18.75px on a timeline, 22.5px on the focused tweet), while our old
     34.75 spent 8px either side on padding no glyph used. That slack is what set
     the distance to the neighbouring share icon. The button is wider than this
     box and overflows it symmetrically, so the row still ends on the icon. */
  width: var(--post-to-card-icon-size);
  min-width: var(--post-to-card-icon-size);
  /* The hover circle is taller and wider than this box. Nothing here may clip it. */
  overflow: visible;
  height: 100% !important;
  max-height: 100%;
  margin: auto 0 !important;
  /* X puts 12px between its trailing glyphs: the row's own 4px gap plus the 8px
     margin the bookmark carries on a timeline. This box is exactly the icon and
     supplies none of that 8px itself, so the injection measures the item before
     us and writes what is still owed -- 8 beside a native icon, 0 beside a box
     that already padded its icon. Declared after the shorthand, and repeated in
     the hide rule the module appends to this same sheet, because both
     declarations are !important and the later one wins. */
  margin-left: var(--post-to-card-trailing-gap) !important;
  flex-shrink: 0 !important;
}

/* Dim (#15202B) and lights-out (#000000): the rest ink and the wash this button
   shipped with, unchanged. Only the hover and the ring differ from the light
   page, and the attribute that selects them is set from the page's own
   background by applyActionBarTheme. It is absent before the first scan -- which
   is when the first button is created, so no button is ever painted in the other
   theme's grey. */
html[data-post-to-card-theme="dark"] [data-post-to-card-btn="true"] {
  color: rgb(113, 118, 123);
}
html[data-post-to-card-theme="dark"] [data-post-to-card-btn="true"]:hover {
  color: rgb(108, 197, 156);
}
html[data-post-to-card-theme="dark"] [data-post-to-card-btn="true"]:hover::before {
  background-color: rgba(255, 255, 255, 0.12);
}
/* The ring, on the two dark grounds: the page's ink, #E7E9EA -- 17.24:1 on
   #000000, 13.54:1 on #15202B, and still 13.53:1 / 9.37:1 on the hover circle
   those rules above fill. Not the mint: that is the hover now, and a ring in the
   same colour would make keyboard focus read as a resting pointer. Only the
   colour changes -- the width and the negative offset are the light rule's, so
   the ring sits in the same place in every theme. */
html[data-post-to-card-theme="dark"] [data-post-to-card-btn="true"]:focus-visible {
  outline-color: rgb(108, 197, 156);
}
`;

/**
 * The attribute the stylesheet keys the dark half off. It sits on `<html>`, next
 * to the hide class, so one value covers every button on the page.
 */
const THEME_ATTRIBUTE = 'data-post-to-card-theme';

/** A CSS colour's channels, or null when it is not an opaque rgb() value. */
function parseOpaqueRgb(value: string): [number, number, number] | null {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(value);
  if (!match) return null;
  // A transparent ground says nothing about the theme; treat it as missing so
  // the caller can look at the next candidate.
  const alpha = match[4] === undefined
    ? 1
    : match[4].endsWith('%')
      ? parseFloat(match[4]) / 100
      : parseFloat(match[4]);
  if (alpha < 0.5) return null;
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

/** WCAG relative luminance, which is what "is this ground light" means. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Reads X's theme off the page and records it for the stylesheet.
 *
 * The ground is the evidence: X paints its theme's background on `<body>`
 * (white, #15202B or #000000) and the rest of the page's inks follow it. A light
 * ground below half the luminance range means the light theme. That is the same
 * judgement `prefers-color-scheme` would make on a page that followed the OS, and
 * X's theme does not have to: it is a stored choice, which is why the media query
 * is only ever a *reason to look again* (see the listener in
 * `initTwitterInjection`) and never the answer.
 *
 * The read is computed style, not `body.style`, because the theme arrives as a
 * stylesheet rule rather than an inline declaration. It is a few property
 * lookups per scan, and scans are already debounced.
 */
function applyActionBarTheme(): void {
  const root = document.documentElement;
  if (!root) return;
  // The test DOM is hand-written and has no style resolution at all. Absent
  // reader means absent evidence, and the stylesheet's light default stands.
  const backgroundOf = (el: Element | null): [number, number, number] | null => {
    if (!el || typeof getComputedStyle !== 'function') return null;
    return parseOpaqueRgb(getComputedStyle(el).backgroundColor || '');
  };
  const ground = backgroundOf(document.body) || backgroundOf(root);
  const dark = ground !== null && relativeLuminance(ground) < 0.5;
  root.setAttribute(THEME_ATTRIBUTE, dark ? 'dark' : 'light');
}

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
        /* This block is appended after TRIGGER_CSS, and two !important
           declarations of the same property are settled by order, so the
           shorthand above would otherwise zero the gap TRIGGER_CSS sets. */
        margin-left: var(--post-to-card-trailing-gap, 8px) !important;
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
export function applyTriggerLocale(locale?: LocalePreference): void {
  const label = getTranslation(resolveLocale(locale)).triggerButtonTitle;
  for (const btn of Array.from(document.querySelectorAll(TRIGGER_SELECTOR))) {
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  }
}

/**
 * The product's mark, at the action bar's icon size.
 *
 * The `line` variant, because this is the one surface inside someone else's
 * controls: at rest a coloured press would be the only colour in X's row of grey
 * outline icons, which is what makes a plugin look like an ad. `brandMark.ts`
 * draws the same press the extension icon carries, stroked at `currentColor`,
 * 1.75/24 with round joins, so it sits in the row instead of against it. The ink
 * is the button's own, and that follows X's theme; the colour arrives only while
 * the pointer is on it -- see the hover rule in `TRIGGER_CSS`.
 *
 * The size here is the timeline's, which is also what the stylesheet falls back
 * to; the injection overrides it per bar for the 22.5px rows.
 */
export const TRIGGER_BUTTON_SVG = brandMarkSvg(18.75, 'line');

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
export function createTriggerButton(onClick: () => void, locale?: LocalePreference): HTMLElement {
  const t = getTranslation(resolveLocale(locale));
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

/**
 * Sizes the trigger to the icon its own action bar draws.
 *
 * X uses 18.75px action icons on the timeline and in the replies under a post,
 * but 22.5px on the focused tweet of a status page, so one screen can hold both
 * sizes: the number belongs to the bar the button landed in, never to the page
 * or the viewport. The reply control is the reference because every real action
 * bar carries it, in both the testid form and the labelled one the logged-out
 * fallback anchors to.
 *
 * Computed width rather than `getBoundingClientRect`: an offscreen or not yet
 * laid out bar reports a zero rect, while the computed width still answers. When
 * nothing can be read the stylesheet's 18.75 -- the timeline size, and the size
 * this button has always had -- stands.
 */
function applyActionBarIconSize(wrapper: HTMLElement, actionBar: Element): void {
  if (typeof getComputedStyle !== 'function') return;
  const icon = actionBar.querySelector('button[data-testid="reply"] svg') || actionBar.querySelector('svg');
  if (!icon) return;
  const size = parseFloat(getComputedStyle(icon).width);
  if (size > 0) wrapper.style.setProperty('--post-to-card-icon-size', `${size}px`);
}

/**
 * Restores the 12px glyph spacing X gives its trailing icons.
 *
 * That 12px is the row's own 4px gap plus the 8px margin the bookmark carries on
 * a timeline. This box is exactly the icon now, so it contributes none of the
 * second half and has to add what is missing.
 *
 * Measuring the previous item instead of assuming it is the share button keeps
 * the spacing right beside either kind of neighbour: a native icon box has no
 * slack to its glyph and wants all 8px, while one that already carries slack --
 * another extension's padded box, or the bookmark's own 8px margin -- owes none.
 * Two extensions then read 12px between glyphs in both injection orders.
 */
function applyTrailingGap(wrapper: HTMLElement): void {
  let gap = 8;
  const previous = wrapper.previousElementSibling;
  const previousIcon = previous ? previous.querySelector('svg') : null;
  if (previous && previousIcon && typeof getComputedStyle === 'function') {
    const box = previous.getBoundingClientRect();
    const icon = previousIcon.getBoundingClientRect();
    // A zero-size box means there was no layout to read (offscreen or hidden);
    // the native share button's 8px is the ordinary case, so it was the seed.
    if (box.width > 0 && icon.width > 0) {
      const marginRight = parseFloat(getComputedStyle(previous).marginRight) || 0;
      gap = Math.max(0, 8 - (box.right - icon.right + marginRight));
    }
  }
  wrapper.style.setProperty('--post-to-card-trailing-gap', `${gap}px`);
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
  locale?: LocalePreference
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

  // Read per bar and after the append: the size belongs to this row, and the
  // spacing is measured against the sibling the button actually sits after.
  applyActionBarIconSize(wrapper, actionBar);
  applyTrailingGap(wrapper);
  return true;
}

/**
 * Scans document for un-injected tweet action bars and injects trigger buttons.
 */
export function injectAll(onTrigger?: (article: Element) => void, locale?: LocalePreference): number {
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
 * True when a batch of mutation records could have produced a new injection
 * point.
 *
 * The observer watches all of `document.body` with `subtree: true`, so on a live
 * timeline it fires continuously for reasons that have nothing to do with this
 * extension: a virtual-scroll cell recycled, a hover card opened, a poll's timer
 * ticking, an ad slot rotating. Each of those used to schedule a full-document
 * query for the action-bar selector -- a descendant-combinator query over every
 * article on the page. Reading the records lets the ones that cannot matter fall
 * through instead.
 *
 * Two shapes both matter, and they are why this checks more than "is the added
 * node a tweet":
 *
 *   - a whole post inserted into the page (or into a virtual-scroll cell), where
 *     the added node is, or contains, an article; and
 *   - a post whose own subtree was filled in afterwards. X inserts the article's
 *     skeleton first and hydrates the action bar into it, so the change that
 *     matters has the article as its *target* and carries no added node that
 *     matches.
 *
 * Removals are not read: taking a node away cannot create an injection point.
 */
function mutationsMayAffectTweets(records: MutationRecord[]): boolean {
  for (const record of records) {
    const target = record.target;
    if (target.nodeType === 1 && (target as Element).closest(TWEET_ARTICLE_SELECTOR)) {
      return true;
    }
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = node as Element;
      if (el.matches(TWEET_ARTICLE_SELECTOR) || el.querySelector(TWEET_ARTICLE_SELECTOR)) {
        return true;
      }
    }
  }
  return false;
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
  let triggerLocale: LocalePreference | undefined;

  const handleArticleTrigger = (article: Element) => {
    onCardTrigger(article);
  };

  const scan = () => {
    // Re-read before every pass. A scan follows any DOM churn, and a theme
    // switch rebuilds the page's ground, so the cheapest correct moment to look
    // is the moment the buttons are about to be (re)injected.
    applyActionBarTheme();
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
    observer = new MutationObserver((records) => {
      if (mutationsMayAffectTweets(records)) {
        scheduleScan();
      }
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

  // The one way X's theme can change without the page mutating first: its "use
  // system" setting follows the OS, and the OS reports that through a media
  // query. The query is a reason to look again, not the answer -- the answer is
  // still the page's own background.
  const systemTheme = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const handleSystemTheme = () => {
    applyActionBarTheme();
  };
  systemTheme?.addEventListener('change', handleSystemTheme);

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
      systemTheme?.removeEventListener('change', handleSystemTheme);
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
