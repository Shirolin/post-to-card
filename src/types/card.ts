/**
 * The three primary papers, plus the two phase-2 materials and one deliberately
 * experimental theme that stays off the default picker.
 */
export type ThemeId =
  | 'parchment'
  | 'nocturne'
  | 'hairline'
  | 'terminal'
  | 'broadsheet'
  | 'brutalist';

/**
 * Retired gradient presets. They are still accepted as stored values so an
 * existing install migrates instead of silently resetting to the default; see
 * `LEGACY_THEME_ALIASES` in `content/ui/themes.ts` for the mapping.
 */
export type LegacyThemeId =
  | 'linear-dark'
  | 'sunset-glow'
  | 'aurora-purple'
  | 'notion-clean-white'
  | 'notion-white'
  | 'cyber-mint'
  | 'oled-black'
  | 'oled';

export type PaddingOption = '16px' | '32px' | '48px';
/** `'theme'` defers the corner to the active theme's own `radius` token. */
export type RadiusOption = 'theme' | '0px' | '12px' | '20px';
export type AspectRatioOption = 'auto' | '3:4' | '16:9';

export type Locale = 'zh-CN' | 'en-US';

export type ImageFitOption = 'contain' | 'cover';
export type MediaLayoutOption = 'grid' | 'stack';

export interface CardConfig {
  theme: ThemeId;
  padding: PaddingOption;
  borderRadius: RadiusOption;
  aspectRatio: AspectRatioOption;
  imageFit?: ImageFitOption;
  mediaLayout?: MediaLayoutOption;
  showQrCode: boolean;
  showStats: boolean;
  showTimestamp: boolean;
  showWatermark: boolean;
  blurAuthor: boolean;
  showActionBarButton?: boolean;
  showPlayButton?: boolean;
  locale?: Locale;
  excludedTweetIds?: string[];
}

