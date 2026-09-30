const STORAGE_KEY = 'post_to_card_user_prefs';

const toggleInput = document.getElementById('toggle-button');
const triggerBtn = document.getElementById('btn-trigger-now');
const statusText = document.getElementById('status-text');

// Simple i18n
const isZh = (navigator.language || 'zh').toLowerCase().startsWith('zh');
if (!isZh) {
  document.getElementById('toggle-title').textContent = 'Tweet Card Button';
  document.getElementById('toggle-desc').textContent = 'Show trigger button on tweet action bars';
  document.getElementById('tip-text').innerHTML = 'Even if hidden, press <kbd>Alt</kbd> + <kbd>C</kbd> while hovering on a tweet to generate card.';
  document.getElementById('btn-text').textContent = 'Generate Active Tweet Card';
}

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
  });
}

// 2. Handle toggle change
if (toggleInput) {
  toggleInput.addEventListener('change', () => {
    const enabled = toggleInput.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(STORAGE_KEY, (items) => {
        const prefs = items && items[STORAGE_KEY] ? items[STORAGE_KEY] : {};
        prefs.showActionBarButton = enabled;
        chrome.storage.local.set({ [STORAGE_KEY]: prefs }, () => {
          showStatus(enabled ? (isZh ? '已开启卡片按钮' : 'Button enabled') : (isZh ? '已隐藏卡片按钮' : 'Button hidden'));
        });
      });
    }
  });
}

// 3. Handle quick trigger button
if (triggerBtn) {
  triggerBtn.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      showStatus(isZh ? '无法访问当前标签页' : 'Cannot access tab', true);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        showStatus(isZh ? '未找到活动标签页' : 'No active tab found', true);
        return;
      }

      const url = activeTab.url || '';
      if (!url.includes('x.com') && !url.includes('twitter.com')) {
        showStatus(isZh ? '请在 Twitter/X 网页中使用此功能' : 'Please open Twitter/X first', true);
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_ACTIVE_CARD' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          showStatus(isZh ? '请将光标移动到推文上或刷新页面' : 'Hover over a tweet or refresh tab', true);
        } else {
          showStatus(isZh ? '卡片已生成！' : 'Card opened!');
          setTimeout(() => {
            window.close();
          }, 400);
        }
      });
    });
  });
}
