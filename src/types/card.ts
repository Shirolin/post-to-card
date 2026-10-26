/**
 * Eight objects a post can live on: a gallery wall label, a darkroom contact
 * print, a risograph zine, a sumi scroll, a clay-toned soft card, a terminal
 * window, a thermal receipt, and one deliberately loud experimental theme kept
 * off the default picker.
 */
export type ThemeId =
  | 'minimal'
  | 'midnight'
  | 'glass'
  | 'material'
  | 'gallery'
  | 'darkroom'
  | 'riso'
  | 'sumi'
  | 'clay'
  | 'terminal'
  | 'receipt'
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
  | 'notion-clean-white'
  // The previous material set, retired by the card redesign.
  | 'parchment'
  | 'nocturne'
  | 'hairline'
  | 'kraft'
  | 'cyanotype'
  | 'broadsheet';

export type PaddingOption = '16px' | '32px' | '48px';
/** `'theme'` defers the corner to the active theme's own `radius` token. */
export type RadiusOption = 'theme' | '0px' | '12px' | '20px';
export type AspectRatioOption = 'auto' | '3:4' | '16:9';

/**
 * The shape of the exported canvas, which is not the shape of the card.
 *
 * `aspectRatio` above sets a floor on the card's own height; this one sets a
 * floor on the mat the card is mounted on. They compose rather than replace:
 * a 3:4 card on a 1:1 canvas is a 3:4 sheet centred in a square. Like
 * `aspectRatio`, these are floors -- a card taller than the canvas shape simply
 * makes a taller picture, so no setting here can ever crop a post.
 */
export type CanvasRatioOption = 'auto' | '1:1' | '4:5' | '3:4' | '16:9';

/**
 * What the mat is painted with. The ids name the value; see
 * `CANVAS_BACKGROUNDS` in `content/ui/themes.ts` for the table and for what
 * `'theme'` resolves to.
 */
export type CanvasBackgroundId =
  | 'none'
  | 'theme'
  | 'paper'
  | 'ink'
  | 'lagoon'
  | 'moss'
  | 'steel'
  | 'plum'
  | 'ember'
  | 'coral'
  | 'sunset'
  | 'citrus'
  | 'neon'
  | 'flamingo'
  | 'aurora';

/**
 * A language the interface, the card and the popup are drawn in.
 *
 * The full list and everything derived from it live in `content/i18n.ts`; this
 * is the type layer's copy, and the two are held together by
 * `SUPPORTED_LOCALES` being typed `readonly Locale[]` and `TRANSLATIONS` being
 * a `Record<Locale, …>`. A region appears here only where it changes the words
 * (`zh-CN`/`zh-TW`, `pt-BR`), matching Chrome's own locale table.
 */
export type Locale = 'en-US' | 'zh-CN';

/**
 * What the language setting stores: a language, or `'auto'`.
 *
 * `'auto'` is the default and means "follow the browser", which is not the same
 * as "English": a German install shows German until the user pins something.
 * Stored separately from `Locale` so a preference that only said `'auto'` is
 * not silently rewritten into the language the machine happened to report.
 */
export type LocalePreference = Locale | 'auto';

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
  locale?: LocalePreference;
  excludedTweetIds?: string[];
  /** The exported canvas shape. `'auto'` shrinks the mat to the card. */
  canvasRatio?: CanvasRatioOption;
  /** What the mat is painted with. `'none'` exports the card alone. */
  canvasBackground?: CanvasBackgroundId;
  /**
   * Lifts the card off the mat with a drop shadow. Only has anywhere to fall
   * when a canvas is on -- with neither option selected the mat is the card's
   * own box, so the shadow would be clipped by the export's border box.
   */
  canvasShadow?: boolean;
  /**
   * "Prefer the sharpest picture": export at `SHARP_EXPORT_SCALE` even when the
   * picture would pass X's own display cap, for a channel that does not.
   */
  preferHighResolution?: boolean;
}
