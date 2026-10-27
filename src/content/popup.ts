/**
 * The extension popup.
 *
 * A build entry of its own: the popup is a page, not part of the content
 * script, and it ships in the bundle as one file the page loads with a
 * `<script>` tag. Being an entry is what lets it import the modules that own
 * the things it must agree with — the storage key, the locale, and the copy —
 * instead of carrying a second spelling of each.
 *
 * The markup still ships the Chinese strings inlined, because the popup paints
 * before this script runs. A test pins the two against each other.
 */

import { STORAGE_KEY } from './prefs.ts';
import { detectDefaultLocale, SUPPORTED_LOCALES, type Locale } from './i18n.ts';
import { POPUP_COPY } from './popupCopy.ts';
import { brandIconSrc } from './ui/brandIcon.ts';

const toggleInput = document.getElementById('toggle-button') as HTMLInputElement | null;
const triggerBtn = document.getElementById('btn-trigger-now') as HTMLButtonElement | null;
const statusText = document.getElementById('status-text');

// The extension icon, inlined by `brandMark.ts` so the page does not name a
// `chrome-extension://` path. The script sits at the end of the body, so this
// runs before the popup is shown -- there is no empty slot to see.
const brandSlot = document.querySelector<HTMLImageElement>('[data-brand-mark]');
if (brandSlot) brandSlot.src = brandIconSrc;

// Starts from the browser so the popup is readable before storage answers, then
// follows the stored preference — which is the point of the change, since the
// modal calls that setting 界面语言 and it should reach here too.
let locale: Locale = detectDefaultLocale();

/** Writes the active language into every static node. */
function renderLocale(): void {
  const copy = POPUP_COPY[locale];
  document.documentElement.lang = locale;
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('toggle-title', copy.toggleTitle);
  set('toggle-desc', copy.toggleDesc);
  const tip = document.getElementById('tip-text');
  if (tip) tip.innerHTML = copy.tip;
  set('btn-text', copy.trigger);
}

renderLocale();

function showStatus(msg: string, isError = false): void {
  if (!statusText) return;
  statusText.textContent = msg;
  statusText.style.color = isError ? '#f87171' : '#34d399';
  setTimeout(() => {
    statusText.textContent = '';
  }, 2500);
}

// 1. Load initial preference
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(STORAGE_KEY, (items) => {
    const prefs = items && items[STORAGE_KEY] ? items[STORAGE_KEY] : {};
    if (toggleInput) {
      toggleInput.checked = prefs.showActionBarButton !== false;
    }
    // A stored locale wins over the browser's. An absent or unrecognised value
    // leaves the browser's answer in place, which is also what a fresh install
    // gets and what a corrupted preference should degrade to.
    //
    // `'auto'` is deliberately not in this list: it means "follow the browser",
    // which is what `detectDefaultLocale()` already answered above, so falling
    // through leaves exactly the right language on screen.
    if (SUPPORTED_LOCALES.includes(prefs.locale as Locale)) {
      locale = prefs.locale;
      renderLocale();
    }
  });
}

// 2. Handle toggle change
if (toggleInput) {
  toggleInput.addEventListener('change', () => {
    const enabled = toggleInput.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(STORAGE_KEY, (items) => {
        // A read that failed hands the callback no items at all, and the set
        // below would then write the one-field object built from that over every
        // other preference. Nothing to toggle is the safe outcome; the stored
        // value is whatever the page's own card still reads.
        if (chrome.runtime.lastError) return;
        const prefs = items && items[STORAGE_KEY] ? items[STORAGE_KEY] : {};
        prefs.showActionBarButton = enabled;
        chrome.storage.local.set({ [STORAGE_KEY]: prefs }, () => {
          const copy = POPUP_COPY[locale];
          showStatus(enabled ? copy.buttonEnabled : copy.buttonHidden);
        });
      });
    }
  });
}

// 3. Handle quick trigger button
if (triggerBtn) {
  triggerBtn.addEventListener('click', () => {
    const copy = POPUP_COPY[locale];
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      showStatus(copy.noTabAccess, true);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        showStatus(copy.noActiveTab, true);
        return;
      }

      // Whether this tab is X is answered by the send, not by its URL. The
      // manifest grants neither "tabs" nor "activeTab" and no x.com host
      // permission, so `activeTab.url` is always undefined here -- a check on it
      // rejects every tab, including the X ones. A missing receiver surfaces as
      // `lastError`; a receiver with no tweet to open answers `success: false`.
      chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_ACTIVE_CARD' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          showStatus(copy.notOnX, true);
          return;
        }
        if (!res.success) {
          showStatus(copy.hoverFirst, true);
          return;
        }
        showStatus(copy.cardOpened);
        setTimeout(() => {
          window.close();
        }, 400);
      });
    });
  });
}
