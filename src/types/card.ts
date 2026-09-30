export type ThemeId =
  | 'linear-dark'
  | 'sunset-glow'
  | 'aurora-purple'
  | 'notion-clean-white'
  | 'cyber-mint'
  | 'oled-black';

export type PaddingOption = '16px' | '32px' | '48px';
export type RadiusOption = '0px' | '12px' | '20px';
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
}

