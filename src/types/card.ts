/**
 * The three primary papers, the three restored classics, the two phase-2
 * materials, and one deliberately experimental theme kept off the default
 * picker.
 */
export type ThemeId =
  | 'parchment'
  | 'nocturne'
  | 'hairline'
  | 'linear-dark'
  | 'oled-black'
  | 'notion-white'
  | 'terminal'
  | 'broadsheet'
  | 'brutalist';

/**
 * Retired gradient presets. Still accepted as stored values so an existing
 * install migrates instead of silently resetting; see `LEGACY_THEME_ALIASES` in
 * `content/ui/themes.ts`. The high-saturation full-bleed gradients stay retired
 * on purpose — they are what the paper themes replaced.
 */
export type LegacyThemeId =
  | 'sunset-glow'
  | 'aurora-purple'
  | 'cyber-mint'
  | 'notion-clean-white'
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

