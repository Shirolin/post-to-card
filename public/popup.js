const STORAGE_KEY = 'post_to_card_user_prefs';

const toggleInput = document.getElementById('toggle-button');
const triggerBtn = document.getElementById('btn-trigger-now');
const statusText = document.getElementById('status-text');

/**
 * Popup copy, keyed by locale.
 *
 * The markup ships the Chinese strings so the popup paints correctly before this
 * script runs, but the stored preference resolves *after* that first paint and can
 * disagree with the browser's language -- so this table has to be able to write
 * either language, not only fall through to the markup's default. Relying on the
 * markup gets the en-then-zh direction wrong: the English text has already been
 * written by then, and there is no Chinese left in the document to fall back to.
 *
 * The keys stay in step with the `Locale` type in src/content/i18n.ts by hand:
 * public/ is copied into the bundle verbatim and is not a build entry, so it cannot
 * import from src/. A third locale means editing both files.
 */
const COPY = {
  'zh-CN': {
    toggleTitle: '推文卡片按钮',
    toggleDesc: '在推文操作栏显示生成卡片按钮',
    tip: '即使按钮隐藏，鼠标悬停在推文上按 <kbd>Alt</kbd> + <kbd>C</kbd> 仍可随时生成卡片。',
    trigger: '生成当前推文卡片',
    buttonEnabled: '已开启卡片按钮',
    buttonHidden: '已隐藏卡片按钮',
    noTabAccess: '无法访问当前标签页',
    noActiveTab: '未找到活动标签页',
    notOnX: '请在 Twitter/X 网页中使用此功能',
    hoverFirst: '请将光标移动到推文上或刷新页面',
    cardOpened: '卡片已生成！',
  },
  'en-US': {
    toggleTitle: 'Tweet Card Button',
    toggleDesc: 'Show trigger button on tweet action bars',
    tip: 'Even if hidden, press <kbd>Alt</kbd> + <kbd>C</kbd> while hovering on a tweet to generate card.',
    trigger: 'Generate Active Tweet Card',
    buttonEnabled: 'Button enabled',
    buttonHidden: 'Button hidden',
    noTabAccess: 'Cannot access tab',
    noActiveTab: 'No active tab found',
    notOnX: 'Please open Twitter/X first',
    hoverFirst: 'Hover over a tweet or refresh tab',
    cardOpened: 'Card opened!',
  },
};

const SUPPORTED_LOCALES = Object.keys(COPY);

/**
 * The locale a fresh install should use, from the browser.
 *
 * Matches `detectDefaultLocale` in src/content/i18n.ts: anything not starting
 * with `zh` reads as English.
 */
function browserLocale() {
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

// Starts from the browser so the popup is readable before storage answers, then
// follows the stored preference -- which is the point of the change, since the
// modal calls that setting 界面语言 and it should reach here too.
let locale = browserLocale();

/** Writes the active language into every static node. */
function renderLocale() {
  const copy = COPY[locale];
  document.documentElement.lang = locale;
  document.getElementById('toggle-title').textContent = copy.toggleTitle;
  document.getElementById('toggle-desc').textContent = copy.toggleDesc;
  document.getElementById('tip-text').innerHTML = copy.tip;
  document.getElementById('btn-text').textContent = copy.trigger;
}

renderLocale();

function showStatus(msg, isError = false) {
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
    if (SUPPORTED_LOCALES.includes(prefs.locale)) {
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
          const copy = COPY[locale];
          showStatus(enabled ? copy.buttonEnabled : copy.buttonHidden);
        });
      });
    }
  });
}

// 3. Handle quick trigger button
if (triggerBtn) {
  triggerBtn.addEventListener('click', () => {
    const copy = COPY[locale];
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