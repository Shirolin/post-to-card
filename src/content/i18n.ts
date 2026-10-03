/**
 * Lightweight, zero-dependency i18n module for Post-to-Card.
 * Supports 'zh-CN' (Simplified Chinese) and 'en-US' (English).
 */

export type Locale = 'zh-CN' | 'en-US';

export interface Translations {
  // Brand & Shell
  brandName: string;
  close: string;
  triggerButtonTitle: string;

  // Controls Sections
  moreSettings: string;
  lessSettings: string;
  language: string;
  layoutAndStyle: string;
  theme: string;
  aspectRatio: string;
  imageFit: string;
  fitContain: string;
  fitCover: string;
  mediaLayout: string;
  layoutGrid: string;
  layoutStack: string;
  padding: string;
  borderRadius: string;
  borderRadiusFollowTheme: string;
  elementsAndPrivacy: string;

  // Tweet Scope & Management
  manageTweets: string;
  selectAll: string;
  selectCurrentOnly: string;
  excludedBadge: string;
  excludeThisTweet: string;
  mediaOnlyTweet: string;

  // Toggles
  qrCode: string;
  metricsAndStats: string;
  timestamp: string;
  watermark: string;
  blurAuthor: string;
  tweetActionButton: string;
  videoPlayButton: string;

  // Themes
  theme_parchment: string;
  theme_nocturne: string;
  theme_hairline: string;
  theme_kraft: string;
  theme_cyanotype: string;
  theme_terminal: string;
  theme_broadsheet: string;
  theme_brutalist: string;

  // Export Actions & Status
  copyImage: string;
  downloadPng: string;
  exporting: string;
  copying: string;
  generatingPng: string;
  copiedSuccess: string;
  downloadSuccess: string;
  exportFailed: string;
  targetNotFound: string;
  clipboardFallbackNotice: string;

  // Preview
  zoomLabel: string;
  previewSummary: string;
  tweetUnit: string;

  // Card Content
  retweetedBy: string;
  unavailablePost: string;
  verified: string;
  replies: string;
  reposts: string;
  likes: string;
  views: string;
  photoAlt: string;
  videoLabel: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  'zh-CN': {
    brandName: 'Post to Card',
    close: '关闭窗口',
    triggerButtonTitle: '生成推文卡片',

    moreSettings: '更多设置',
    lessSettings: '收起设置',
    language: '界面语言',
    layoutAndStyle: '版式与样式',
    theme: '视觉主题',
    aspectRatio: '画幅比例',
    imageFit: '图片适配',
    fitContain: '完整展示',
    fitCover: '填充铺满',
    mediaLayout: '多图排版',
    layoutGrid: '拼图网格',
    layoutStack: '纵向平铺',
    padding: '内边距',
    borderRadius: '卡片圆角',
    borderRadiusFollowTheme: '跟随主题',
    elementsAndPrivacy: '展示模块与隐私',
    manageTweets: '包含推文',
    selectAll: '全选',
    selectCurrentOnly: '仅此推文',
    excludedBadge: '已剔除',
    excludeThisTweet: '剔除此推文',
    mediaOnlyTweet: '纯媒体推文',

    qrCode: '原文二维码',
    metricsAndStats: '互动数据',
    timestamp: '发布时间',
    watermark: '微水印尾标',
    blurAuthor: '作者隐私脱敏',
    tweetActionButton: '推文卡片按钮',
    videoPlayButton: '视频播放按钮',

    theme_parchment: '羊皮纸',
    theme_nocturne: '暗刊',
    theme_hairline: '细线',
    theme_kraft: '牛皮纸',
    theme_cyanotype: '蓝晒图',
    theme_terminal: '终端',
    theme_broadsheet: '报纸栏',
    theme_brutalist: '粗野派',

    copyImage: '复制图片',
    downloadPng: '保存 PNG',
    exporting: '正在导出...',
    copying: '正在复制到剪贴板...',
    generatingPng: '正在生成高清图...',
    copiedSuccess: '已复制到剪贴板',
    downloadSuccess: 'PNG 图片已保存',
    exportFailed: '导出失败',
    targetNotFound: '未找到卡片渲染节点。',
    clipboardFallbackNotice: '剪贴板写入受限，已自动为您下载高清图片！',

    zoomLabel: '预览缩放',
    previewSummary: '共 {count} 条推文',
    tweetUnit: '条',

    retweetedBy: '转发自',
    unavailablePost: '此推文不可用',
    verified: '已认证账号',
    replies: '条回复',
    reposts: '次转推',
    likes: '次喜欢',
    views: '次浏览',
    photoAlt: '推文配图',
    videoLabel: '视频',
  },
  'en-US': {
    brandName: 'Post to Card',
    close: 'Close modal',
    triggerButtonTitle: 'Post to Card',

    moreSettings: 'More Settings',
    lessSettings: 'Hide Settings',
    language: 'Language',
    layoutAndStyle: 'Layout & Style',
    theme: 'Theme',
    aspectRatio: 'Aspect Ratio',
    imageFit: 'Image Fit',
    fitContain: 'Fit',
    fitCover: 'Fill',
    mediaLayout: 'Multi-Image Layout',
    layoutGrid: 'Grid',
    layoutStack: 'Stack',
    padding: 'Padding',
    borderRadius: 'Border Radius',
    borderRadiusFollowTheme: 'Follow Theme',
    elementsAndPrivacy: 'Elements & Privacy',
    manageTweets: 'Included Tweets',
    selectAll: 'Select All',
    selectCurrentOnly: 'Current Only',
    excludedBadge: 'Excluded',
    excludeThisTweet: 'Exclude Tweet',
    mediaOnlyTweet: 'Media only',

    qrCode: 'QR Code',
    metricsAndStats: 'Metrics & Stats',
    timestamp: 'Timestamp',
    watermark: 'Watermark',
    blurAuthor: 'Blur Author (Privacy)',
    tweetActionButton: 'Tweet Card Button',
    videoPlayButton: 'Video Play Button',

    theme_parchment: 'Parchment',
    theme_nocturne: 'Nocturne',
    theme_hairline: 'Hairline',
    theme_kraft: 'Kraft',
    theme_cyanotype: 'Cyanotype',
    theme_terminal: 'Terminal',
    theme_broadsheet: 'Broadsheet',
    theme_brutalist: 'Brutalist',

    copyImage: 'Copy Image',
    downloadPng: 'Download PNG',
    exporting: 'Exporting...',
    copying: 'Copying to clipboard...',
    generatingPng: 'Generating PNG...',
    copiedSuccess: 'Copied to clipboard',
    downloadSuccess: 'PNG downloaded',
    exportFailed: 'Export failed',
    targetNotFound: 'Export target not found.',
    clipboardFallbackNotice: 'Clipboard restricted; auto-downloaded PNG!',

    zoomLabel: 'Preview Zoom',
    previewSummary: '{count} tweets',
    tweetUnit: 'tweets',

    retweetedBy: 'Retweeted by',
    unavailablePost: 'This post is unavailable',
    verified: 'Verified',
    replies: 'Replies',
    reposts: 'Reposts',
    likes: 'Likes',
    views: 'Views',
    photoAlt: 'Tweet photo',
    videoLabel: 'Video',
  },
};

/**
 * Detects the user's preferred locale based on browser settings.
 */
export function detectDefaultLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return 'zh-CN';
    }
  }
  return 'en-US';
}

/**
 * Safely sanitizes and normalizes an input string into a supported Locale.
 */
export function sanitizeLocale(val?: string): Locale {
  if (val === 'zh-CN' || val === 'en-US') {
    return val;
  }
  return detectDefaultLocale();
}

/**
 * Safely retrieves translation dictionary for given locale with fallback to en-US.
 */
export function getTranslation(locale: Locale = 'en-US'): Translations {
  return TRANSLATIONS[locale] || TRANSLATIONS['en-US'];
}

/**
 * Formats a tweet timestamp according to the selected locale.
 */
export function formatLocaleTimestamp(timestampStr: string, locale: Locale): string {
  if (!timestampStr) return '';
  try {
    const d = new Date(timestampStr);
    if (Number.isNaN(d.getTime())) return timestampStr;

    if (locale === 'zh-CN') {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    }

    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${timePart} · ${datePart}`;
  } catch {
    return timestampStr;
  }
}
