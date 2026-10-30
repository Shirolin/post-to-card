/**
 * The shape every dictionary has to fill in.
 *
 * Deliberately its own module with no imports: `locales/<id>.ts` annotate
 * themselves with this, and `i18n.ts` imports both the interface and the
 * dictionaries. Keeping the interface here is what stops the two from forming a
 * cycle, and it is why a dictionary file can be added without touching the
 * module that assembles them.
 *
 * The interface is the gate, not a comment. `tsc` rejects a dictionary that
 * mistypes a key, and `Record<Locale, Translations>` in `i18n.ts` rejects a
 * locale that was added to the list but never given a dictionary. Neither rule
 * can be satisfied by a key that is merely present and misspelled -- a mistyped
 * dictionary key is an excess property, and a missing one is an absent one.
 *
 * Placeholders are `{name}` and are substituted with `String.prototype.replace`
 * by the call site. Every dictionary must declare exactly the same placeholders
 * as `en-US` for a given key; `i18n.10` is what enforces that, because a
 * translation that drops `{count}` renders the literal braces and no test that
 * only compared key sets would see it.
 */
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
  /** The language picker's first option: follow the browser rather than pin one. */
  languageAuto: string;
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
  /**
   * Per-post author privacy. The four avatar-button strings describe the
   * *visible* state: the label says what the click will do, the title says what
   * is on screen and how to get back to the default.
   */
  authorBlurToggleOn: string;
  authorBlurToggleOff: string;
  authorBlurStateHidden: string;
  authorBlurStateVisible: string;
  /** The one-time notice in the preview. */
  authorBlurHint: string;
  authorBlurHintDismiss: string;
  /** "Follow global": the way back from an override, in the panel and the list. */
  authorFollowGlobal: string;
  /** The two explicit states, as the panel's chips name them. */
  authorBlurHidden: string;
  authorBlurShown: string;
  /** Marks a quoted author's override as living only as long as this dialog. */
  authorBlurQuoteNote: string;
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
