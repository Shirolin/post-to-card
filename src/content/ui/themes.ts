import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, ImageFitOption, MediaLayoutOption, CardConfig } from '../../types/card.ts';
import { detectDefaultLocale, sanitizeLocale } from '../i18n.ts';
export { sanitizeLocale };

/**
 * A theme is a sheet of paper, not a background gradient.
 *
 * `canvas` is the mat the card sits on (preview stage), `surface` is the sheet
 * itself. `text`/`muted`/`faint` are a three-step value ramp: body, secondary
 * copy, and time/footnote meta. `accent` is the only chromatic colour; `link`
 * exists because the accent alone does not clear text contrast on every
 * surface. `fontDisplay`/`fontBody` are the theme's type pair.
 *
 * A theme is also its *signature* and its *breathing*: the material owns the
 * one decorative rule at the head of the body and the vertical rhythm of the
 * column. Those used to be hand-written per theme in card.css, which is how
 * six materials ended up with a fingerprint and three ended up as flat colour.
 * They are tokens now, so "switching theme" changes material, letterforms and
 * breathing together.
 */
export interface ThemeTokens {
  /**
   * The mat the sheet is mounted on, used by the preview stage. The brief's
   * original values were within 5% luminance of `surface`, which made a light
   * card read as a slightly-off patch rather than a sheet lying on a board, so
   * the two light mats are pulled down until the paper actually has an edge.
   * The exported PNG is unaffected — this never reaches the export target.
   */
  canvas: string;
  surface: string;
  text: string;
  muted: string;
  /**
   * Time and meta. Kept at or above 4.5:1 against `surface` in every theme —
   * a footnote can be quiet without being unreadable.
   */
  faint: string;
  accent: string;
  link: string;
  border: string;
  divider: string;
  quoteBackground: string;
  quoteBorder: string;
  qrFill: string;
  /**
   * The ink a photo is mounted with. Every other edge on the card is the
   * card's own `border`, which is tuned to sit quietly against the sheet and is
   * therefore too faint to frame a picture (Parchment's border is only ~1.3:1
   * on its own surface). This is one step darker than `border`, so the media
   * reads as mounted on the material rather than pasted onto it. Its weight
   * follows the card's `borderWidth`, so a heavy material frames heavily too.
   */
  mediaBorder: string;
  /**
   * How the material binds a picture to itself, the way it declares a
   * signature. Every stock takes a plain rule at the card's own edge weight;
   * Kraft alone stitches its pictures, dashed like its envelope seam.
   */
  mediaFrame: MediaFrameStyle;
  /**
   * A print keyline: a hairline set just inside the card's edge, drawn in
   * `mediaBorder`. It is the certificate/nameplate detail that tells the eye
   * the sheet was composed on a press rather than filled edge to edge. Off on
   * the materials that are surfaces rather than printed sheets (the darks and
   * the brutalist block).
   */
  keyline: boolean;
  /**
   * A material's own surface texture, layered behind the content as a second
   * background image over the flat `surface`. Only the process materials carry
   * one — a CRT refresh pattern on Terminal, a blueprint grid on Cyanotype —
   * because a texture is what tells those two apart from a plain dark tint.
   * The papers stay clean: paper grain at card scale is noise, not material.
   * Value is a CSS `background-image` (or `none`), so a new texture is a table
   * entry rather than a hand-written rule.
   */
  texture: string;
  /**
   * The theme's signature rule. This is the one place a theme is allowed a
   * material of its own rather than a tint of `border`. Drawn by card.css from
   * the style name, so a new material is one table entry rather than a new
   * block of hand-written pseudo-element CSS.
   */
  rule: string;
  signature: SignatureSpec;
  /**
   * How the quote tweet reads against the sheet. Paper and dark panels take a
   * filled recess; ruled materials (Hairline, Broadsheet, Terminal, Brutalist)
   * take an outline, because a fill that clears 1.15:1 on warm paper is a
   * smudge on a black rule grid. One tint cannot serve both materials.
   */
  quoteStyle: QuoteStyle;
  rhythm: Rhythm;
  fontDisplay: string;
  fontBody: string;
  /** Card corner, used when the user picks the "follow theme" radius option. */
  radius: string;
  /** Media and quote corners, one step tighter than the card's. */
  mediaRadius: string;
  /** Card edge weight: 1px for the papers, heavier for the brutalist material. */
  borderWidth: string;
  /**
   * Card shadow. Kept inside the card's own box (inset offsets) because the
   * export captures the element's border box, so an outer shadow would be
   * cropped straight out of the PNG.
   */
  shadow: string;
}

/**
 * The material's fingerprint, drawn at the head of the body column.
 *
 * `height` is the rule's own thickness (and drives the body's top padding so
 * the rule never sits on the first line). The ink is always the theme's `rule`;
 * the one signature that needs a second colour (Nocturne's accent tick) gets it
 * from `--accent` in card.css rather than from a per-theme override.
 */
export type SignatureStyle =
  | 'rule'
  | 'hairline'
  | 'tick-rule'
  | 'scanline'
  | 'double'
  | 'block'
  | 'stitch'
  | 'registration';

export interface SignatureSpec {
  style: SignatureStyle;
  height: string;
}

/**
 * The material's mounting style for photos, posters and avatars.
 *
 * `rule` is the plain mounting line every stock gets by default, drawn at the
 * card's own edge weight. `stitch` is Kraft's binding: the same line, dashed,
 * the way its envelope seam is. Only these two are distinct in geometry — the
 * frame weight is already carried by `borderWidth`, so there is deliberately no
 * separate "hairline" or "heavy" value for a material that would resolve to the
 * same pixels.
 */
export type MediaFrameStyle = 'rule' | 'stitch';

export type QuoteStyle = 'filled' | 'outlined';

/**
 * Vertical breathing. `gap` is the space between content blocks (byline, body,
 * media, quote); `mediaGap` is the grid gutter. Kept separate from the user's
 * padding so a material can be tight (Terminal, Hairline) or generous
 * (Brutalist, Parchment) at any of the three padding tiers.
 */
export interface Rhythm {
  gap: string;
  mediaGap: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** Swatch background for the picker. Two-tone so light papers stay apart. */
  preview: string;
  tokens: ThemeTokens;
}

/**
 * System UI stack.
 *
 * The CJK faces are listed explicitly because `sans-serif` resolves to a Latin
 * face on most systems and leaves kana/kanji to a browser-chosen fallback, which
 * is how Japanese and Chinese bodies end up set in mismatched metrics. Simplified
 * Chinese faces come first because zh-CN is the product's default locale — a
 * Japanese face ahead of them would ship Chinese glyph variants with the wrong
 * shapes for a few characters.
 */
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, "Helvetica Neue", Arial, sans-serif';

/**
 * Display stack: Georgia for Latin, then the platform Song/Mincho face so a
 * non-Latin title sets in a serif instead of silently falling back to a sans.
 */
const SERIF =
  'Georgia, "Times New Roman", "Songti SC", "Source Han Serif SC", "Noto Serif SC", SimSun, "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif';

/**
 * Monospace stack. Cascadia and SF Mono are the faces Windows Terminal and
 * macOS Terminal actually install, so the theme reads as a console rather than
 * as a generic font at the wrong weight. CJK falls back to a monospaced CJK
 * face before the generic, because a proportional CJK face breaks the column
 * grid this theme is built on.
 */
const MONO =
  '"Cascadia Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Noto Sans Mono CJK SC", "Sarasa Mono SC", monospace';

/**
 * Surface textures for the two process materials. Self-contained repeating
 * gradients, so they need no `background-size` beside them and survive the
 * export clone as plain computed `background-image`. Both are kept under 6%
 * alpha: the texture must be felt at arm's length, never read as a pattern
 * competing with the body text.
 */
const CRT_TEXTURE =
  'repeating-linear-gradient(to bottom, rgba(94, 224, 138, 0.05) 0, rgba(94, 224, 138, 0.05) 1px, transparent 1px, transparent 3px)';

const BLUEPRINT_TEXTURE =
  'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.05) 0, rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 26px), repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0, rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 26px)';

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // 1. Parchment — warm ivory paper, editorial serif, for quotes and long posts.
  //    Signature: a full-width cream standfirst rule. It started as a short
  //    terracotta tick, which read as a stray red mark; a full-width rule reads
  //    as a decision the layout made, and leaves the accent to mean one thing:
  //    emphasis in text.
  parchment: {
    id: 'parchment',
    name: 'Parchment',
    preview: 'linear-gradient(135deg, #e4e0d2 0%, #faf9f5 100%)',
    tokens: {
      canvas: '#e4e0d2',
      surface: '#faf9f5',
      text: '#141413',
      muted: '#5e5d59',
      faint: '#74726b',
      accent: '#c96442',
      link: '#ad5330',
      border: '#ded9c8',
      divider: '#e8e6dc',
      // A filled recess pulled to 1.16:1 off the sheet, with a border that
      // actually draws the panel edge (the old tint was 1.09:1 — invisible).
      quoteBackground: '#ebe9df',
      quoteBorder: '#d5cfba',
      qrFill: '#141413',
      mediaBorder: '#c7bfa8',
      mediaFrame: 'rule',
      keyline: true,
      texture: 'none',
      rule: '#ded8c6',
      signature: { style: 'rule', height: '2px' },
      quoteStyle: 'filled',
      rhythm: { gap: '20px', mediaGap: '5px' },
      fontDisplay: SERIF,
      fontBody: SANS,
      radius: '12px',
      mediaRadius: '8px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 2. Nocturne — warm charcoal, magazine cover, for video and image-led posts.
  //    Signature: a masthead — one terracotta tick over a hairline.
  nocturne: {
    id: 'nocturne',
    name: 'Nocturne',
    preview: 'linear-gradient(135deg, #1a1918 0%, #30302e 100%)',
    tokens: {
      canvas: '#1a1918',
      surface: '#30302e',
      text: '#f5f4ed',
      muted: '#b0aea5',
      faint: '#9a988f',
      accent: '#c96442',
      link: '#dd8462',
      border: '#4a4844',
      divider: '#45443f',
      quoteBackground: '#252523',
      quoteBorder: '#4a4844',
      qrFill: '#f5f4ed',
      mediaBorder: '#57554f',
      mediaFrame: 'rule',
      keyline: false,
      texture: 'none',
      rule: '#4a4844',
      signature: { style: 'tick-rule', height: '2px' },
      quoteStyle: 'filled',
      rhythm: { gap: '20px', mediaGap: '4px' },
      fontDisplay: SERIF,
      fontBody: SANS,
      radius: '10px',
      mediaRadius: '6px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 3. Hairline — Swiss grid: hairline rules, light sans, no shadow.
  //    Signature: one full-width ink hairline. Outlined quote: a fill would be
  //    a grey patch on a black rule grid.
  hairline: {
    id: 'hairline',
    name: 'Hairline',
    preview:
      'linear-gradient(180deg, #faf9f5 0%, #faf9f5 58%, #141413 58%, #141413 100%)',
    tokens: {
      canvas: '#dedcd4',
      surface: '#faf9f5',
      text: '#141413',
      muted: '#5e5d59',
      faint: '#74726b',
      accent: '#c96442',
      // Same deeper terracotta as Parchment: the bare accent only reaches
      // 3.7:1 on this surface, which is too low for body-size link text.
      link: '#ad5330',
      border: '#141413',
      divider: '#141413',
      quoteBackground: '#f3f1ea',
      quoteBorder: '#141413',
      qrFill: '#141413',
      mediaBorder: '#141413',
      mediaFrame: 'rule',
      keyline: true,
      texture: 'none',
      rule: '#141413',
      signature: { style: 'hairline', height: '1px' },
      quoteStyle: 'outlined',
      // Swiss precision: the gutter is as tight as the rules are thin.
      rhythm: { gap: '16px', mediaGap: '3px' },
      fontDisplay: SANS,
      fontBody: SANS,
      radius: '2px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 4. Kraft — a manila envelope. Warm tan stock, brown ink, a stitched
  //    binding at the head. Its own material, not a tint of Parchment.
  kraft: {
    id: 'kraft',
    name: 'Kraft',
    preview: 'linear-gradient(135deg, #b9a681 0%, #d3c3a2 100%)',
    tokens: {
      canvas: '#b9a681',
      surface: '#d3c3a2',
      text: '#2b2117',
      muted: '#584832',
      faint: '#5a4c33',
      accent: '#8a4b1f',
      link: '#6f3913',
      border: '#a8946f',
      divider: '#b09d78',
      // A lighter panel — the recess on kraft stock reads as a raised label,
      // and it keeps body text at 10.97:1 and meta at 5.81:1.
      quoteBackground: '#e2d6c0',
      quoteBorder: '#a8946f',
      qrFill: '#2b2117',
      mediaBorder: '#8f7a53',
      mediaFrame: 'stitch',
      keyline: true,
      texture: 'none',
      rule: '#a8946f',
      signature: { style: 'stitch', height: '2px' },
      quoteStyle: 'filled',
      // Roomier than the papers: a stitched binding needs air so the dashes of
      // adjacent frames do not read as one broken line.
      rhythm: { gap: '20px', mediaGap: '6px' },
      fontDisplay: SANS,
      fontBody: SANS,
      radius: '6px',
      mediaRadius: '4px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 5. Cyanotype — a blueprint. Deep prussian blue, white line-work, a
  //    registration mark at the head. The one true cold material in the set,
  //    and it earns it by being a process rather than a "tech blue" skin.
  cyanotype: {
    id: 'cyanotype',
    name: 'Cyanotype',
    preview: 'linear-gradient(135deg, #0d1c2c 0%, #14304d 100%)',
    tokens: {
      canvas: '#0d1c2c',
      surface: '#14304d',
      text: '#e8f1f8',
      muted: '#9fb8cc',
      faint: '#8aa6bd',
      accent: '#ffffff',
      link: '#9fd8ff',
      border: '#2c5175',
      divider: '#2c5175',
      quoteBackground: '#0e2438',
      quoteBorder: '#2c5175',
      qrFill: '#e8f1f8',
      mediaBorder: '#3f6d99',
      mediaFrame: 'rule',
      keyline: false,
      texture: BLUEPRINT_TEXTURE,
      rule: '#3d6a94',
      signature: { style: 'registration', height: '1px' },
      quoteStyle: 'filled',
      rhythm: { gap: '20px', mediaGap: '4px' },
      fontDisplay: SANS,
      fontBody: SANS,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 6. Terminal — a phosphor console. Real monospace, one scanline, no paper.
  //    Signature: a CRT refresh band, faint enough to sit over a text column.
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    preview: 'linear-gradient(135deg, #0b0e0b 0%, #141a14 100%)',
    tokens: {
      canvas: '#080a08',
      surface: '#161d16',
      text: '#d8f5d0',
      muted: '#7fa878',
      // 5.3:1 on this surface; the ramp dims by hue, not by fading.
      faint: '#6f9a68',
      accent: '#5ee08a',
      link: '#7ff0a4',
      border: '#2b382d',
      divider: '#232e25',
      quoteBackground: '#1a231b',
      quoteBorder: '#344635',
      qrFill: '#d8f5d0',
      mediaBorder: '#3b4d3e',
      mediaFrame: 'rule',
      keyline: false,
      texture: CRT_TEXTURE,
      // The scanline is drawn with this, so it must read as a screen line, not
      // as a border. Lifted to 1.56:1 — the old 1.25:1 was invisible.
      rule: '#2f4032',
      signature: { style: 'scanline', height: '4px' },
      quoteStyle: 'outlined',
      rhythm: { gap: '14px', mediaGap: '3px' },
      fontDisplay: MONO,
      fontBody: MONO,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 7. Broadsheet — multi-column newspaper: masthead, all-caps kickers, ruled
  //    columns. Signature: the double rule a paper sets under its flag.
  broadsheet: {
    id: 'broadsheet',
    name: 'Broadsheet',
    preview:
      'linear-gradient(180deg, #fbfaf6 0%, #fbfaf6 62%, #1a1a17 62%, #1a1a17 100%)',
    tokens: {
      canvas: '#e6e3d8',
      surface: '#fbfaf6',
      text: '#1a1a17',
      muted: '#57564f',
      faint: '#6d6c64',
      accent: '#a8382a',
      link: '#8f2f23',
      border: '#1a1a17',
      divider: '#1a1a17',
      quoteBackground: '#f2f0e8',
      quoteBorder: '#1a1a17',
      qrFill: '#1a1a17',
      mediaBorder: '#1a1a17',
      mediaFrame: 'rule',
      keyline: true,
      texture: 'none',
      rule: '#1a1a17',
      signature: { style: 'double', height: '5px' },
      quoteStyle: 'outlined',
      rhythm: { gap: '18px', mediaGap: '4px' },
      fontDisplay: SERIF,
      fontBody: SERIF,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 8. Brutalist — thick rules and a hard offset shadow. Deliberately loud, so
  //    it is not part of the default rotation (see DEFAULT_CARD_CONFIG).
  brutalist: {
    id: 'brutalist',
    name: 'Brutalist',
    preview:
      'linear-gradient(135deg, #f4f1e4 0%, #f4f1e4 46%, #14140f 46%, #14140f 100%)',
    tokens: {
      canvas: '#d8d4c4',
      surface: '#f4f1e4',
      text: '#14140f',
      muted: '#4f4d43',
      faint: '#63615a',
      accent: '#e0523a',
      link: '#b83a24',
      border: '#14140f',
      divider: '#14140f',
      quoteBackground: '#eae6d4',
      quoteBorder: '#14140f',
      qrFill: '#14140f',
      mediaBorder: '#14140f',
      mediaFrame: 'rule',
      keyline: false,
      texture: 'none',
      rule: '#14140f',
      signature: { style: 'block', height: '3px' },
      quoteStyle: 'outlined',
      // Loud material, loud gutter: the pictures are boxed hard and pushed
      // apart, the way the sheet's own 3px edge and offset shadow are.
      rhythm: { gap: '24px', mediaGap: '8px' },
      fontDisplay: SANS,
      fontBody: SANS,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '3px',
      // Inset, not outset: the export captures the element's border box, so an
      // outer shadow is cropped straight out of the PNG. Negative offsets put
      // the hard band on the bottom-right, so the sheet reads as a block cast
      // down-right rather than a recessed panel.
      shadow: 'inset -20px -20px 0 0 #14140f',
    },
  },
};

/**
 * Retired presets map onto the closest live material rather than resetting the
 * user's choice. The three gradient classics are retired here: their restrained
 * surfaces were absorbed by Nocturne (dark UI), Cyanotype (pure dark) and
 * Parchment (warm white), and keeping them alongside the materials is what made
 * the picker read as "skins" again. The high-saturation full-bleed gradients
 * stay retired on purpose — they are what the papers replaced.
 */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'sunset-glow': 'parchment',
  'aurora-purple': 'nocturne',
  'cyber-mint': 'terminal',
  // Retired classics.
  'linear-dark': 'nocturne',
  'oled-black': 'cyanotype',
  'oled': 'cyanotype',
  'notion-white': 'parchment',
  'notion-clean-white': 'parchment',
};

export const PADDING_OPTIONS: PaddingOption[] = ['16px', '32px', '48px'];
export const RADIUS_OPTIONS: RadiusOption[] = ['theme', '0px', '12px', '20px'];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = ['auto', '3:4', '16:9'];
export const IMAGE_FIT_OPTIONS: ImageFitOption[] = ['contain', 'cover'];
export const MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = ['grid', 'stack'];

/**
 * Picker order and visibility.
 *
 * The first six are the everyday rotation: the three papers plus the three
 * materials that are not a variant of paper (Kraft, Cyanotype, Terminal).
 * Broadsheet is a phase-2 material and Brutalist is deliberately last and
 * marked experimental, so the picker keeps its 3px frame and hard shadow behind
 * the "more" disclosure.
 */
export const THEME_ORDER: ThemeId[] = [
  'parchment',
  'nocturne',
  'hairline',
  'kraft',
  'cyanotype',
  'terminal',
  'broadsheet',
  'brutalist',
];

export const EXPERIMENTAL_THEMES: ReadonlySet<ThemeId> = new Set<ThemeId>(['brutalist']);

export const DEFAULT_CARD_CONFIG: CardConfig = {
  theme: 'parchment',
  padding: '32px',
  borderRadius: 'theme',
  aspectRatio: 'auto',
  imageFit: 'contain',
  mediaLayout: 'grid',
  showQrCode: true,
  showStats: true,
  showTimestamp: true,
  showWatermark: true,
  blurAuthor: false,
  showActionBarButton: true,
  showPlayButton: true,
  locale: detectDefaultLocale(),
  excludedTweetIds: [],
};

export function sanitizePadding(val: string): PaddingOption {
  if (val === '16px' || val === '32px' || val === '48px') {
    return val;
  }
  return '32px';
}

/**
 * Resolves any stored theme value to a live theme. Accepts the current ids and
 * the retired presets, so upgrading keeps the user's paper instead of dropping
 * them on the default.
 */
export function sanitizeTheme(val?: string | null): ThemeId {
  if (val && val in THEMES) {
    return val as ThemeId;
  }
  if (val && val in LEGACY_THEME_ALIASES) {
    return LEGACY_THEME_ALIASES[val];
  }
  return DEFAULT_CARD_CONFIG.theme;
}

export function sanitizeRadius(val: string): RadiusOption {
  if (val === 'theme' || val === '0px' || val === '12px' || val === '20px') {
    return val;
  }
  return '12px';
}

export function sanitizeImageFit(val?: string): ImageFitOption {
  if (val === 'contain' || val === 'cover') {
    return val;
  }
  return 'contain';
}

export function sanitizeMediaLayout(val?: string): MediaLayoutOption {
  if (val === 'grid' || val === 'stack') {
    return val;
  }
  return 'grid';
}

/**
 * Resolves the stored radius option into the two corners the card actually
 * paints. `'theme'` hands the decision to the active paper; the explicit
 * options keep their long-standing rule that inner corners sit a step tighter
 * than the card's, so a rounded sheet never shows a boxier photo inside it.
 */
export function resolveRadius(
  radius: RadiusOption,
  theme: ThemeId
): { card: string; media: string } {
  if (radius === 'theme') {
    const tokens = THEMES[theme].tokens;
    return { card: tokens.radius, media: tokens.mediaRadius };
  }
  if (radius === '0px') return { card: '0px', media: '0px' };
  if (radius === '12px') return { card: '12px', media: '8px' };
  return { card: '20px', media: '14px' };
}

export function getAspectMinHeight(ratio: AspectRatioOption, width: number = 640): string {
  if (ratio === 'auto') return 'auto';
  if (ratio === '3:4') return `${Math.round(width * (4 / 3))}px`;
  if (ratio === '16:9') return `${Math.round(width * (9 / 16))}px`;
  return 'auto';
}

export function getAspectMinHeightNumber(ratio: AspectRatioOption, width: number = 640): number {
  if (ratio === '3:4') return Math.round(width * (4 / 3)); // 853
  if (ratio === '16:9') return Math.round(width * (9 / 16)); // 360
  return 0;
}

export const STORAGE_KEY = 'post_to_card_user_prefs';

export async function loadUserPreferences(): Promise<CardConfig> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        if (chrome.runtime?.lastError) {
          resolve(DEFAULT_CARD_CONFIG);
          return;
        }
        const saved = res?.[STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          resolve({
            ...DEFAULT_CARD_CONFIG,
            ...saved,
            theme: sanitizeTheme(saved.theme),
            padding: sanitizePadding(saved.padding),
            borderRadius: sanitizeRadius(saved.borderRadius),
            imageFit: sanitizeImageFit(saved.imageFit),
            mediaLayout: sanitizeMediaLayout(saved.mediaLayout),
            showActionBarButton: saved.showActionBarButton !== false,
            showPlayButton: saved.showPlayButton !== false,
            locale: sanitizeLocale(saved.locale),
          });
        } else {
          resolve(DEFAULT_CARD_CONFIG);
        }
      });
    } else {
      resolve(DEFAULT_CARD_CONFIG);
    }
  });
}

export async function saveUserPreferences(config: CardConfig): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: config });
  }
}
