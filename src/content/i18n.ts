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
  collapsePanel: string;
  expandPanel: string;
  language: string;
  layoutAndStyle: string;
  theme: string;
  themesShowAll: string;
  themesShowLess: string;
  aspectRatio: string;
  /** Disambiguates the card's own shape from the canvas shape below it. */
  aspectRatioTitle: string;
  aspectAuto: string;
  /**
   * The section heading for the exported picture: its shape, what it is painted
   * with, and the lift. The controls under it are named relative to it --
   * 画幅 / 背景, not 输出画幅 / 画布背景 -- because a heading directly above a
   * sub-label that repeats its words reads as one label stuttering rather than
   * as a section and a control.
   */
  canvas: string;
  canvasRatio: string;
  canvasRatioTitle: string;
  canvasRatioAuto: string;
  canvasBackground: string;
  canvasShadow: string;

  // The export's own settings, which change the file and not the card
  exportSettings: string;
  canvasBg_none: string;
  canvasBg_theme: string;
  canvasBg_paper: string;
  canvasBg_ink: string;
  canvasBg_moss: string;
  canvasBg_lagoon: string;
  canvasBg_steel: string;
  canvasBg_plum: string;
  canvasBg_ember: string;
  canvasBg_coral: string;
  canvasBg_sunset: string;
  canvasBg_citrus: string;
  canvasBg_neon: string;
  canvasBg_flamingo: string;
  canvasBg_aurora: string;
  /**
   * Shown when a canvas shape is chosen without a background: the ring is
   * transparent, so the ring exists but the picture has no field under it.
   */
  canvasTransparentHint: string;
  exportSize: string;
  exportSizeReduced: string;
  exportSizeImpossible: string;
  imageFit: string;
  fitContain: string;
  fitCover: string;
  mediaLayout: string;
  layoutGrid: string;
  layoutStack: string;
  padding: string;
  borderRadius: string;
  borderRadiusFollowTheme: string;
  cardFooter: string;
  privacy: string;
  actionButtonHint: string;
  experimentalTheme: string;
  watermarkHint: string;
  videoPlayButtonTitle: string;
  blurAuthorHint: string;
  presentation: string;

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
  theme_minimal: string;
  theme_midnight: string;
  theme_glass: string;
  theme_material: string;
  theme_gallery: string;
  theme_darkroom: string;
  theme_riso: string;
  theme_sumi: string;
  theme_clay: string;
  theme_terminal: string;
  theme_receipt: string;
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
  exportEmpty: string;
  exportTooTall: string;
  targetNotFound: string;
  clipboardFallbackNotice: string;
  clipboardFallbackUnsupported: string;
  clipboardFallbackPermission: string;
  clipboardFallbackActivation: string;
  imagesUnavailableCount: string;
  exportScaleReduced: string;
  /** Said instead of "Copied" when the card itself failed, so the fallback can be retried. */
  clipboardFallbackArtwork: string;
  preferHighResolution: string;
  preferHighResolutionHint: string;
  statusSeparator: string;
  retryExport: string;
  /**
   * Shown beside the size readout when the picture is so much taller than it is
   * wide that a feed will shrink it below reading size.
   */
  longCardWarning: string;

  // Preview
  zoomLabel: string;
  zoomFit: string;
  zoomFitHint: string;
  zoomFitCapped: string;
  previewSummary: string;
  previewSummarySingular: string;

  // Card Content
  retweetedBy: string;
  unavailablePost: string;
  truncatedContent: string;
  verified: string;
  articleKicker: string;
  articleAlt: string;
  qrHint: string;
  replies: string;
  reposts: string;
  likes: string;
  views: string;
  bookmarks: string;
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
    collapsePanel: '收起菜单',
    expandPanel: '展开菜单',
    language: '界面与卡片语言',
    layoutAndStyle: '版式与样式',
    theme: '视觉主题',
    themesShowAll: '展开其余 {count} 款',
    themesShowLess: '收起主题',
    aspectRatio: '卡片形状',
    aspectRatioTitle: '卡片内容的最小形状，卡片文字更长时会向下长高',
    aspectAuto: '自适应',
    canvas: '输出画布',
    canvasRatio: '画幅',
    canvasRatioTitle: '导出图片的形状（背景层），卡片始终完整地摆在里面',
    canvasRatioAuto: '自适应',
    canvasBackground: '背景',
    canvasShadow: '卡片投影',

    exportSettings: '导出设置',
    canvasBg_none: '无背景',
    canvasBg_theme: '跟随主题',
    canvasBg_paper: '纸白',
    canvasBg_ink: '墨黑',
    canvasBg_moss: '苔绿',
    canvasBg_lagoon: '潟湖',
    canvasBg_steel: '青灰',
    canvasBg_plum: '梅紫',
    canvasBg_ember: '余烬',
    canvasBg_coral: '珊瑚',
    canvasBg_sunset: '落日',
    canvasBg_citrus: '柑橘',
    canvasBg_neon: '霓虹',
    canvasBg_flamingo: '火烈鸟',
    canvasBg_aurora: '极光',
    canvasTransparentHint: '画幅留白是透明的；配一个背景，导出的才是一张有底的图',
    exportSize: '导出尺寸 {w} × {h} px',
    exportSizeReduced: '导出尺寸 {w} × {h} px（已按画布上限降至 {scale}×）',
    exportSizeImpossible: '卡片高于画布上限，当前设置无法导出',
    imageFit: '图片适配',
    fitContain: '完整展示',
    fitCover: '填充铺满',
    mediaLayout: '多图排版',
    layoutGrid: '拼图网格',
    layoutStack: '纵向平铺',
    padding: '内边距',
    borderRadius: '卡片圆角',
    borderRadiusFollowTheme: '跟随主题',
    cardFooter: '卡片页脚',
    privacy: '隐私',
    actionButtonHint: '隐藏后，将光标移到推文上按 Alt + C 仍可生成卡片',
    experimentalTheme: '实验性主题，效果可能不稳定',
    watermarkHint: '卡片右下角的一行署名与构建号',
    videoPlayButtonTitle: '视频缩略图右下角的角标。卡片是静态图，不含播放器',
    blurAuthorHint: '模糊正文作者的头像、昵称与账号。被引用的推文作者不受影响',
    presentation: '呈现细节',
    manageTweets: '包含推文',
    selectAll: '全选',
    selectCurrentOnly: '仅此推文',
    excludedBadge: '已剔除',
    excludeThisTweet: '剔除此推文',
    mediaOnlyTweet: '纯媒体推文',

    qrCode: '原文二维码',
    metricsAndStats: '互动数据',
    timestamp: '发布时间',
    watermark: '署名与版本',
    blurAuthor: '作者隐私脱敏',
    tweetActionButton: '推文卡片按钮',
    videoPlayButton: '视频播放按钮',

    theme_minimal: '极简',
    theme_midnight: '夜幕',
    theme_glass: '液态玻璃',
    theme_material: '质感 (MD3)',
    theme_gallery: '画廊',
    theme_darkroom: '暗房',
    theme_riso: '孔版',
    theme_sumi: '水墨',
    theme_clay: '软陶',
    theme_terminal: '终端',
    theme_receipt: '小票',
    theme_brutalist: '粗野派',

    copyImage: '复制图片',
    downloadPng: '保存 PNG',
    exporting: '正在导出...',
    copying: '正在复制到剪贴板...',
    generatingPng: '正在生成高清图...',
    copiedSuccess: '已复制到剪贴板',
    downloadSuccess: 'PNG 图片已保存',
    exportFailed: '导出失败',
    exportEmpty: '截图引擎返回了空图片，请重试',
    exportTooTall: '卡片高度超过画布上限，请减少推文或改用纵向平铺后重试',
    targetNotFound: '未找到卡片渲染节点。',
    clipboardFallbackNotice: '剪贴板写入失败，PNG 已保存到下载文件夹',
    clipboardFallbackUnsupported: '此浏览器不支持写入图片剪贴板，PNG 已保存到下载文件夹',
    clipboardFallbackPermission: '剪贴板权限被拒绝，PNG 已保存到下载文件夹',
    clipboardFallbackActivation: '窗口未聚焦或操作间隔过长，剪贴板写入被拒，PNG 已保存到下载文件夹',
    clipboardFallbackArtwork: '卡片没能渲染出来，PNG 已保存到下载文件夹',
    imagesUnavailableCount: '{count} 张配图未能加载',
    exportScaleReduced: '已按画布上限降至 {scale}×',
    preferHighResolution: '输出最高清晰度',
    preferHighResolutionHint: '单条推文按 3× 导出；很高的长串默认 2×（保留 3× 也只是被 X 缩回去）。文件更大，适合发到不压缩的渠道',
    statusSeparator: '；',
    retryExport: '重试',
    longCardWarning: '这张图很高，缩到信息流宽度后文字会很小；长串建议拆成几张',

    zoomLabel: '预览缩放',
    zoomFit: '适应',
    zoomFitHint: '缩放到刚好放下整张卡片',
    zoomFitCapped: '当前窗口放不下整张卡片，已自动适配',
    previewSummary: '共 {count} 条推文',
    previewSummarySingular: '共 {count} 条推文',

    retweetedBy: '转发自',
    unavailablePost: '此推文不可用',
    truncatedContent: '内容未完整显示',
    verified: '已认证账号',
    articleKicker: '长文',
    articleAlt: '文章封面',
    qrHint: '扫码打开原推文',
    replies: '条回复',
    reposts: '次转推',
    likes: '次喜欢',
    views: '次浏览',
    bookmarks: '次书签',
    photoAlt: '推文配图',
    videoLabel: '视频',
  },
  'en-US': {
    brandName: 'Post to Card',
    close: 'Close modal',
    triggerButtonTitle: 'Post to Card',

    moreSettings: 'More Settings',
    lessSettings: 'Hide Settings',
    collapsePanel: 'Collapse panel',
    expandPanel: 'Expand panel',
    language: 'Language (UI & Card)',
    layoutAndStyle: 'Layout & Style',
    theme: 'Theme',
    themesShowAll: 'Show {count} more',
    themesShowLess: 'Hide extra themes',
    aspectRatio: 'Card Shape',
    aspectRatioTitle: "The card's minimum shape; it grows taller when the text needs it",
    aspectAuto: 'Auto',
    canvas: 'Output Canvas',
    canvasRatio: 'Shape',
    canvasRatioTitle: 'The exported picture (the background layer); the card always sits whole inside it',
    canvasRatioAuto: 'Auto',
    canvasBackground: 'Background',
    canvasShadow: 'Card shadow',

    exportSettings: 'Export',
    canvasBg_none: 'None',
    canvasBg_theme: 'Theme',
    canvasBg_paper: 'Paper',
    canvasBg_ink: 'Ink',
    canvasBg_moss: 'Moss',
    canvasBg_lagoon: 'Lagoon',
    canvasBg_steel: 'Steel',
    canvasBg_plum: 'Plum',
    canvasBg_ember: 'Ember',
    canvasBg_coral: 'Coral',
    canvasBg_sunset: 'Sunset',
    canvasBg_citrus: 'Citrus',
    canvasBg_neon: 'Neon',
    canvasBg_flamingo: 'Flamingo',
    canvasBg_aurora: 'Aurora',
    canvasTransparentHint: 'The canvas around the card is transparent; pick a background to export a finished picture',
    exportSize: 'Exports at {w} × {h} px',
    exportSizeReduced: 'Exports at {w} × {h} px (reduced to {scale}× by the canvas limit)',
    exportSizeImpossible: 'The card is taller than the canvas limit and cannot be exported',
    imageFit: 'Image Fit',
    fitContain: 'Fit',
    fitCover: 'Fill',
    mediaLayout: 'Multi-Image Layout',
    layoutGrid: 'Grid',
    layoutStack: 'Stack',
    padding: 'Padding',
    borderRadius: 'Border Radius',
    // Short on purpose: the four-option group gives each entry ~69px, and this
    // label is the only one long enough to be ellipsised. `Auto` is the word the
    // aspect ratio already uses for "the app decides", so the two groups do not
    // invent separate terms for the same idea, and it has the most headroom of
    // any candidate. The tooltip carries the precise meaning.
    borderRadiusFollowTheme: 'Auto',
    cardFooter: 'Card Footer',
    privacy: 'Privacy',
    actionButtonHint: 'While hidden, hover a post and press Alt + C to still make a card',
    experimentalTheme: 'Experimental theme, may change',
    watermarkHint: 'A one-line credit and build number at the card\'s bottom right',
    videoPlayButtonTitle: 'The badge on a video thumbnail. The card is a still image, not a player',
    blurAuthorHint: 'Blurs the author of the post itself. A quoted post\'s author is untouched',
    presentation: 'Presentation',
    manageTweets: 'Included Tweets',
    selectAll: 'Select All',
    selectCurrentOnly: 'Current Only',
    excludedBadge: 'Excluded',
    excludeThisTweet: 'Exclude Tweet',
    mediaOnlyTweet: 'Media only',

    qrCode: 'QR Code',
    metricsAndStats: 'Metrics & Stats',
    timestamp: 'Timestamp',
    watermark: 'Credit & build',
    blurAuthor: 'Blur Author (Privacy)',
    tweetActionButton: 'Tweet Card Button',
    videoPlayButton: 'Video Play Button',

    theme_minimal: 'Minimal',
    theme_midnight: 'Midnight',
    theme_glass: 'Liquid Glass',
    theme_material: 'Material 3',
    theme_gallery: 'Gallery',
    theme_darkroom: 'Darkroom',
    theme_riso: 'Riso',
    theme_sumi: 'Sumi',
    theme_clay: 'Clay',
    theme_terminal: 'Terminal',
    theme_receipt: 'Receipt',
    theme_brutalist: 'Brutalist',

    copyImage: 'Copy Image',
    downloadPng: 'Download PNG',
    exporting: 'Exporting...',
    copying: 'Copying to clipboard...',
    generatingPng: 'Generating PNG...',
    copiedSuccess: 'Copied to clipboard',
    downloadSuccess: 'PNG downloaded',
    exportFailed: 'Export failed',
    exportEmpty: 'The screenshot engine returned an empty image; please retry',
    exportTooTall:
      'The card is taller than the largest canvas; remove some posts or switch the media layout and try again',
    targetNotFound: 'Export target not found.',
    clipboardFallbackNotice: 'Clipboard write failed; the PNG was saved to your downloads',
    clipboardFallbackUnsupported: 'This browser cannot put images on the clipboard; the PNG was saved to your downloads',
    clipboardFallbackPermission: 'Clipboard permission was denied; the PNG was saved to your downloads',
    clipboardFallbackActivation: 'The window lost focus or the action took too long, so the clipboard refused; the PNG was saved to your downloads',
    clipboardFallbackArtwork: 'The card could not be rendered; the PNG was saved to your downloads',
    imagesUnavailableCount: '{count} image(s) could not be loaded',
    exportScaleReduced: 'reduced to {scale}× by the canvas limit',
    preferHighResolution: 'Highest resolution',
    preferHighResolutionHint:
      'Exports a single post at 3×; a long thread stays at 2×, where more is scaled back down by X. A bigger file, for channels that do not recompress',
    statusSeparator: '; ',
    retryExport: 'Retry',
    longCardWarning: 'This picture is very tall; a feed will shrink its text. Consider splitting a long thread',

    zoomLabel: 'Preview Zoom',
    zoomFit: 'Fit',
    zoomFitHint: 'Scale so the whole card is visible',
    zoomFitCapped: 'The card does not fit this window, so it is auto-fitted',
    previewSummary: '{count} tweets',
    previewSummarySingular: '{count} tweet',

    retweetedBy: 'Retweeted by',
    unavailablePost: 'This post is unavailable',
    truncatedContent: 'Content truncated',
    verified: 'Verified',
    articleKicker: 'Article',
    articleAlt: 'Article cover',
    qrHint: 'Scan to open original tweet',
    replies: 'Replies',
    reposts: 'Reposts',
    likes: 'Likes',
    views: 'Views',
    bookmarks: 'Bookmarks',
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
 * The modal header's summary line for a given post count.
 *
 * Lives here rather than at the call site because the singular/plural choice is
 * a property of the templates: English marks the count, and a caller that
 * picked the plural for a one-post card printed "1 tweets". Keeping the
 * selection beside the two templates also keeps the `{count}` placeholder's
 * contract in one place, and makes the choice testable without rendering.
 *
 * Takes the resolved dictionary rather than a locale: every caller already has
 * one in hand (the card's UI resolves it once per render), and a second
 * `sanitizeLocale` here would be a second derivation of the same value.
 */
export function formatPreviewSummary(t: Translations, count: number): string {
  const template = count === 1 ? t.previewSummarySingular : t.previewSummary;
  return template.replace('{count}', String(count));
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
