/**
 * Trigger presentation for the injected "post to card" action-bar button:
 * the button itself, its wrapper, its label, and the visibility stylesheet.
 *
 * The scan lifecycle lives in `injection.ts`; this module only draws and names.
 * The locale is a parameter rather than module state, so a button's language is
 * whatever the caller passes and a scan that injects later cannot disagree with
 * the buttons already on the page.
 */

import { getTranslation, sanitizeLocale } from '../i18n.ts';
import type { Locale } from '../../types/card.ts';

export const HIDE_ACTION_BUTTON_CLASS = 'post-to-card-hide-action-btn';
export const VISIBILITY_STYLE_ID = 'post-to-card-visibility-style';
export const TRIGGER_SELECTOR = '[data-post-to-card-btn="true"]';

/**
 * Toggles the visibility of injected action bar trigger buttons across all tweets.
 * When hidden, the buttons remain in DOM (preserving injection deduplication and scroll state)
 * but are visually removed with `display: none !important`.
 */
export function setInjectedButtonVisibility(visible: boolean): void {
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
export function createTriggerButton(onClick: () => void, locale?: Locale): HTMLElement {
  const t = getTranslation(sanitizeLocale(locale));
  const btn = document.createElement('button');
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', t.triggerButtonTitle);
  btn.setAttribute('title', t.triggerButtonTitle);
  btn.setAttribute('data-post-to-card-btn', 'true');

  // Set crisp SVG vector icon from Lucide icon library without emoji
  btn.innerHTML = TRIGGER_BUTTON_SVG;

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

  btn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
    btn.style.color = 'rgb(29, 155, 240)';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = 'rgb(113, 118, 123)';
    btn.style.transform = 'scale(1)';
  });

  btn.addEventListener('mousedown', () => {
    btn.style.transform = 'scale(0.92)';
  });

  btn.addEventListener('mouseup', () => {
    btn.style.transform = 'scale(1)';
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

  return wrapper;
}
