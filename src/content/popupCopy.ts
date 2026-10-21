/**
 * The extension popup's own copy.
 *
 * The popup and the card modal are two different surfaces, so their words do
 * not overlap: the modal talks about a card's shape and its materials, and the
 * popup talks about the button it toggles and the card it opens. Sharing one
 * dictionary between them would mean one of them carrying words it never
 * shows.
 *
 * What they do share is the *locale*. The popup reads the same stored
 * preference the modal writes, and it has to resolve that preference the same
 * way — so the locale type, the browser's default and the storage key come
 * from the modules that own them, and this file holds only the words.
 *
 * The popup is a separate build entry, so this module reaches it through the
 * bundler rather than through a copy in `public/`. The popup's markup still
 * ships the Chinese strings inlined, because it paints before its script
 * runs; a test pins the two against each other.
 */

import type { Locale } from './i18n.ts';

/**
 * The popup's copy for one locale.
 */
export interface PopupCopy {
  /** The title of the toggle that shows the action-bar button. */
  toggleTitle: string;
  /** What that toggle does. */
  toggleDesc: string;
  /** The keyboard shortcut, shown under the toggle. */
  tip: string;
  /** The label of the button that opens a card for the current post. */
  trigger: string;
  /** Said after the action-bar button is switched on. */
  buttonEnabled: string;
  /** Said after the action-bar button is switched off. */
  buttonHidden: string;
  /** Said when the browser would not say which tab is active. */
  noTabAccess: string;
  /** Said when there is no active tab to open a card for. */
  noActiveTab: string;
  /** Said when the current tab is not one this extension works on. */
  notOnX: string;
  /** Said when the tab is right but no post is under the pointer. */
  hoverFirst: string;
  /** Said after a card was opened. */
  cardOpened: string;
}

/**
 * The popup's copy, per locale.
 *
 * The locale ids are the ones `i18n.ts` declares, because the popup follows
 * the stored preference and that preference names a locale from that list.
 */
export const POPUP_COPY: Record<Locale, PopupCopy> = {
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
