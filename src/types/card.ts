/**
 * Eight materials: the three papers (Parchment, Nocturne, Hairline), three
 * non-paper stocks (Kraft, Cyanotype, Terminal), a phase-2 broadsheet, and one
 * deliberately experimental theme kept off the default picker.
 */
export type ThemeId =
  | 'parchment'
  | 'nocturne'
  | 'hairline'
  | 'kraft'
  | 'cyanotype'
  | 'terminal'
  | 'broadsheet'
  | 'brutalist';

/**
 * Retired presets. Still accepted as stored values so an existing install
 * migrates instead of silently resetting; see `LEGACY_THEME_ALIASES` in
 * `content/ui/themes.ts`. The high-saturation full-bleed gradients stay retired
 * on purpose — they are what the paper themes replaced — and the three
 * gradient classics now map onto the material that absorbed them.
 */
export type LegacyThemeId =
  | 'sunset-glow'
  | 'aurora-purple'
  | 'cyber-mint'
  | 'linear-dark'
  | 'oled-black'
  | 'oled'
  | 'notion-white'
  | 'notion-clean-white';

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

