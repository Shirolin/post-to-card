import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, ImageFitOption, MediaLayoutOption, CardConfig } from '../../types/card.ts';
import { detectDefaultLocale, sanitizeLocale } from '../i18n.ts';
export { sanitizeLocale };

/**
 * A theme is an object a post can live on, not a colour skin.
 *
 * `canvas` is the mat the card sits on (preview stage), `surface` is the sheet
 * itself. `text`/`muted`/`faint` are a three-step value ramp: body, secondary
 * copy, and time/footnote meta. `accent` is the only chromatic highlight; `link`
 * exists because the accent alone does not clear text contrast on every
 * surface. `fontDisplay`/`fontBody` are the theme's type pair.
 *
 * Each object also owns the small devices that make it that object: the mark at
 * the head of the body (`signature`), how pictures are mounted (`mediaFrame`),
 * the shape of avatars, the line style of its rules, and its vertical rhythm.
 * They are all tokens, so "switching theme" changes material, letterforms,
 * furniture and breathing together, and card.css never has to name a material.
 */
/**
 * The material's letterforms.
 *
 * The values live here and card.css only consumes them, so a material is a
 * table entry the compiler checks rather than a block of per-theme rules a
 * reader has to remember to write.
 *
 * The quoted post's byline is its own size on purpose. It is a nested author and
 * should not compete with the one the card is about; it shares the display
 * weight and tracking because those carry the material's voice.
 */
export interface TypeScale {
  /** Byline size, weight and tracking, for the author name and the kicker. */
  displaySize: string;
  displayWeight: string;
  displayTracking: string;
  /** The quoted post's byline size. Weight and tracking follow the display. */
  quoteSize: string;
  /** Post body size and line-height. */
  bodySize: string;
  bodyLeading: string;
  /** Timestamp and stats: size and tracking. */
  metaSize: string;
  metaTracking: string;
  /** Upper-cased meta, as a printed receipt sets its totals. */
  metaUppercase: boolean;
  /** Tabular figures, so counts line up as a data strip. */
  metaTabular: boolean;
  /** Rules between the stat columns, as a darkroom data strip is ruled. */
  metaDivider: boolean;
}

export interface ThemeTokens {
  /** The material's letterforms. See `TypeScale`. */
  type: TypeScale;
  /**
   * The mat the sheet is mounted on, used by the preview stage. Kept at least
   * 1.15:1 off `surface` so the card reads as an object lying on a board rather
   * than a slightly-off patch. The exported PNG is unaffected — this never
   * reaches the export target.
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
   * too faint to frame a picture. Its weight follows the card's `borderWidth`.
   */
  mediaBorder: string;
  /**
   * How the material binds a picture to itself. `rule` is a plain line at the
   * card's edge weight; `mat` sets the picture inside a thick passe-partout in
   * the `mat` colour, the way a print is mounted behind glass.
   */
  mediaFrame: MediaFrameStyle;
  /** The colour of the mount when `mediaFrame` is `mat`. */
  mat: string;
  /**
   * A print keyline: a hairline set just inside the card's edge, drawn in
   * `mediaBorder`. It tells the eye the sheet was composed on a press rather
   * than filled edge to edge. Off on the materials that are surfaces rather
   * than printed sheets.
   */
  keyline: boolean;
  /**
   * A material's own surface texture, layered behind the content as a second
   * background image over the flat `surface`. Only the terminal carries one — a
   * CRT refresh pattern — because a texture is what tells it apart from a plain
   * dark tint. A value is a CSS `background-image` (or `none`).
   */
  texture: string;
  /** The ink of every drawn line: the signature, the footer rule, the thread. */
  rule: string;
  /** `solid`, `dashed` or `dotted`; a receipt's rules are torn along a dash. */
  ruleStyle: RuleStyle;
  signature: SignatureSpec;
  /**
   * How the quote tweet reads against the sheet. Soft materials take a filled
   * recess; ruled materials take an outline, because a fill that clears 1.15:1
   * on warm paper is a smudge on a black rule grid.
   */
  quoteStyle: QuoteStyle;
  /** Stat counts drawn as small rounded chips rather than a bare row. */
  statChip: boolean;
  rhythm: Rhythm;
  fontDisplay: string;
  fontBody: string;
  /** Avatar corner: a circle, a seal-like rounded square, or a hard square. */
  avatarRadius: string;
  /** Full `box-shadow` for the byline avatar: a ring, a misregistered offset. */
  avatarShadow: string;
  /** Card corner, used when the user picks the "follow theme" radius option. */
  radius: string;
  /** Media and quote corners, one step tighter than the card's. */
  mediaRadius: string;
  /** Card edge weight: 0 for soft materials, heavier for the brutalist one. */
  borderWidth: string;
  /**
   * Card shadow. Kept inside the card's own box (inset offsets) because the
   * export captures the element's border box, so an outer shadow would be
   * cropped straight out of the PNG.
   */
  shadow: string;
}

/**
 * The mark drawn at the head of the body column, one per material, each the
 * kind of furniture its object actually has.
 *
 * `height` is the mark's own thickness (and drives the body's top padding so it
 * never sits on the first line). The ink is the theme's `rule`; a mark that
 * needs a second colour borrows `--accent` in card.css rather than carrying a
 * per-theme override.
 */
export type SignatureStyle =
  | 'rule'
  | 'tick-rule'
  | 'perforation'
  | 'titlebar'
  | 'seal'
  | 'registration'
  | 'pill'
  | 'block';

export interface SignatureSpec {
  style: SignatureStyle;
  height: string;
}

export type MediaFrameStyle = 'rule' | 'mat';

export type RuleStyle = 'solid' | 'dashed' | 'dotted';

export type QuoteStyle = 'filled' | 'outlined';

/**
 * Vertical breathing. `gap` is the space between content blocks (byline, body,
 * media, quote); `mediaGap` is the grid gutter. Kept separate from the user's
 * padding so a material can be tight or generous at any of the three padding
 * tiers.
 */
export interface Rhythm {
  gap: string;
  mediaGap: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** Swatch background for the picker. Two-tone so light sheets stay apart. */
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
 * Neo-grotesque for the gallery label: Helvetica where it exists (macOS), Arial
 * on Windows, which is the same shape of letter at a different weight.
 */
const GROTESK =
  '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", "Hiragino Sans", sans-serif';

/**
 * A condensed face for the darkroom's frame numbers. Bahnschrift ships with
 * Windows, DIN Alternate and Avenir Next Condensed with macOS.
 */
const CONDENSED =
  '"Bahnschrift", "DIN Alternate", "Avenir Next Condensed", "Arial Narrow", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * Heavy grotesque for the zine. Arial Black is on both Windows and macOS; a
 * CJK title falls through to the platform's heavy weight of the same family.
 */
const HEAVY =
  '"Arial Black", "Archivo Black", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * A brush-cut Kai face for sumi bylines. Latin goes to Georgia first so a
 * Latin handle does not inherit a Kai face's awkward letterforms.
 */
const KAI =
  'Georgia, "Kaiti SC", "STKaiti", "KaiTi", "BiauKai", "AR PL UKai CN", "Songti SC", SimSun, serif';

/** Rounded sans for the soft card; Yuanti is the rounded Chinese face on macOS. */
const ROUNDED =
  '"SF Pro Rounded", "Nunito", "Varela Round", "Yuanti SC", "Hiragino Maru Gothic ProN", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';

/** Typewriter for the receipt: Courier is what a thermal printer imitates. */
const TYPEWRITER =
  '"Courier New", Courier, "Cascadia Mono", Consolas, "Noto Sans Mono CJK SC", "Sarasa Mono SC", "Microsoft YaHei", monospace';

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
 * Surface texture for the terminal. A self-contained repeating gradient, so it
 * needs no `background-size` beside it and survives the export clone as a plain
 * computed `background-image`. Kept under 6% alpha: the texture must be felt at
 * arm's length, never read as a pattern competing with the body text.
 */
const CRT_TEXTURE =
  'repeating-linear-gradient(to bottom, rgba(94, 224, 138, 0.05) 0, rgba(94, 224, 138, 0.05) 1px, transparent 1px, transparent 3px)';

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // 1. Gallery — the wall label beside a framed work. A neutral off-white sheet,
  //    one Klein-blue tick over a black hairline, and pictures mounted behind a
  //    thick mat. The quiet default: the post is the exhibit, the card gets out
  //    of the way.
  gallery: {
    id: 'gallery',
    name: 'Gallery',
    preview: 'linear-gradient(135deg, #d6d7d3 0%, #f7f7f4 62%, #1b3bd6 62%, #1b3bd6 100%)',
    tokens: {
      type: {
        displaySize: '17px',
        displayWeight: '600',
        displayTracking: '-0.01em',
        quoteSize: '14px',
        bodySize: '17px',
        bodyLeading: '1.68',
        metaSize: '12.5px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
        metaDivider: false,
      },
      canvas: '#d6d7d3',
      surface: '#f7f7f4',
      text: '#101011',
      muted: '#55575b',
      faint: '#696b70',
      accent: '#1b3bd6',
      link: '#1b3bd6',
      border: '#d4d5d0',
      divider: '#dedfda',
      quoteBackground: '#ebebe7',
      quoteBorder: '#b4b5b0',
      qrFill: '#101011',
      mediaBorder: '#c4c5c0',
      mediaFrame: 'mat',
      mat: '#fdfdfb',
      keyline: false,
      texture: 'none',
      rule: '#101011',
      ruleStyle: 'solid',
      signature: { style: 'tick-rule', height: '2px' },
      quoteStyle: 'outlined',
      statChip: false,
      rhythm: { gap: '22px', mediaGap: '6px' },
      fontDisplay: GROTESK,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: 'none',
      radius: '4px',
      mediaRadius: '2px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 2. Darkroom — a contact print under the safelight. Near-black stock, frame
  //    numbers set in a condensed face, a black mat with a thin edge around each
  //    picture, and the one amber the room is lit with.
  darkroom: {
    id: 'darkroom',
    name: 'Darkroom',
    preview: 'linear-gradient(135deg, #050506 0%, #1b1b1e 60%, #ffb02e 60%, #ffb02e 100%)',
    tokens: {
      type: {
        displaySize: '19px',
        displayWeight: '600',
        displayTracking: '0.02em',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.7',
        metaSize: '12.5px',
        metaTracking: '0.08em',
        metaUppercase: false,
        metaTabular: true,
        metaDivider: true,
      },
      canvas: '#050506',
      surface: '#1b1b1e',
      text: '#ededf0',
      muted: '#a6a6ae',
      faint: '#8e8e97',
      accent: '#ffb02e',
      link: '#ffc45e',
      border: '#303035',
      divider: '#303035',
      quoteBackground: '#2c2c30',
      quoteBorder: '#404046',
      qrFill: '#ededf0',
      mediaBorder: '#44444b',
      mediaFrame: 'mat',
      mat: '#060607',
      keyline: false,
      texture: 'none',
      rule: '#404046',
      ruleStyle: 'solid',
      signature: { style: 'tick-rule', height: '2px' },
      quoteStyle: 'filled',
      statChip: false,
      rhythm: { gap: '20px', mediaGap: '5px' },
      fontDisplay: CONDENSED,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: '0 0 0 2px #1b1b1e, 0 0 0 3.5px #ffb02e',
      radius: '8px',
      mediaRadius: '3px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 3. Riso — a two-ink zine page. Text printed in blue ink, a fluorescent pink
  //    second ink for the quote wash and the avatar's misregistered offset, a
  //    heavy grotesque, a 2px ink edge.
  riso: {
    id: 'riso',
    name: 'Riso',
    preview: 'linear-gradient(135deg, #f2f3ee 0%, #f2f3ee 50%, #17238a 50%, #17238a 78%, #ff3d8b 78%, #ff3d8b 100%)',
    tokens: {
      type: {
        displaySize: '17px',
        displayWeight: '900',
        displayTracking: '-0.01em',
        quoteSize: '15px',
        bodySize: '16px',
        bodyLeading: '1.62',
        metaSize: '12px',
        metaTracking: '0.03em',
        metaUppercase: false,
        metaTabular: true,
        metaDivider: true,
      },
      canvas: '#d3d6cf',
      surface: '#f2f3ee',
      text: '#17238a',
      muted: '#3a49a6',
      faint: '#4f5db4',
      accent: '#ff3d8b',
      // The fluorescent pink is a print ink, not a text colour: on paper it is
      // 3:1. Links take the same hue pulled down to a readable value.
      link: '#c4155e',
      border: '#17238a',
      divider: '#17238a',
      quoteBackground: '#f8d2e1',
      quoteBorder: '#17238a',
      qrFill: '#17238a',
      mediaBorder: '#17238a',
      mediaFrame: 'rule',
      mat: '#f2f3ee',
      keyline: false,
      texture: 'none',
      rule: '#17238a',
      ruleStyle: 'solid',
      signature: { style: 'registration', height: '2px' },
      quoteStyle: 'filled',
      statChip: false,
      rhythm: { gap: '18px', mediaGap: '4px' },
      fontDisplay: HEAVY,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: '4px 4px 0 #ff3d8b',
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '2px',
      shadow: 'none',
    },
  },

  // 4. Sumi — a scroll. Cool celadon paper, ink, a Kai-style byline, generous
  //    leading for Chinese text, a square avatar like a seal, and one vermilion
  //    seal stamped at the head. The Chinese-first material.
  sumi: {
    id: 'sumi',
    name: 'Sumi',
    preview: 'linear-gradient(135deg, #bcc6bb 0%, #e4e9e3 58%, #b4281d 58%, #b4281d 100%)',
    tokens: {
      type: {
        displaySize: '19px',
        displayWeight: '400',
        displayTracking: '0.06em',
        quoteSize: '15px',
        bodySize: '17px',
        bodyLeading: '1.95',
        metaSize: '12.5px',
        metaTracking: '0.05em',
        metaUppercase: false,
        metaTabular: false,
        metaDivider: false,
      },
      canvas: '#bcc6bb',
      surface: '#e4e9e3',
      text: '#161f1a',
      muted: '#46524b',
      faint: '#59655e',
      accent: '#b4281d',
      link: '#a3241a',
      border: '#b7c2b5',
      divider: '#c8d1c6',
      quoteBackground: '#cbd5ca',
      quoteBorder: '#a9b6a7',
      qrFill: '#161f1a',
      mediaBorder: '#7f8d7e',
      mediaFrame: 'rule',
      mat: '#e4e9e3',
      keyline: true,
      texture: 'none',
      rule: '#7f8d7e',
      ruleStyle: 'solid',
      signature: { style: 'seal', height: '16px' },
      quoteStyle: 'filled',
      statChip: false,
      rhythm: { gap: '22px', mediaGap: '5px' },
      fontDisplay: KAI,
      fontBody: SERIF,
      avatarRadius: '5px',
      avatarShadow: '0 0 0 1px #7f8d7e',
      radius: '3px',
      mediaRadius: '2px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 5. Clay — a soft, pressed card. Powder-blue stock with no edge line, large
  //    corners, an embossed inset, stats as little pill chips, and a tangerine
  //    bar. Friendly rather than formal.
  clay: {
    id: 'clay',
    name: 'Clay',
    preview: 'linear-gradient(135deg, #9fb9d6 0%, #d8e6f4 60%, #ff6a2b 60%, #ff6a2b 100%)',
    tokens: {
      type: {
        displaySize: '18px',
        displayWeight: '700',
        displayTracking: '0',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.68',
        metaSize: '12.5px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
        metaDivider: false,
      },
      canvas: '#9fb9d6',
      surface: '#d8e6f4',
      text: '#0d2540',
      muted: '#365273',
      faint: '#4a6586',
      accent: '#ff6a2b',
      link: '#a63a0b',
      border: '#c3d6ea',
      divider: '#bfd4ea',
      quoteBackground: '#bfd4ea',
      quoteBorder: '#bfd4ea',
      qrFill: '#0d2540',
      mediaBorder: '#a9c0d9',
      mediaFrame: 'rule',
      mat: '#e6f0f9',
      keyline: false,
      texture: 'none',
      rule: '#a9c0d9',
      ruleStyle: 'solid',
      signature: { style: 'pill', height: '6px' },
      quoteStyle: 'filled',
      statChip: true,
      rhythm: { gap: '20px', mediaGap: '6px' },
      fontDisplay: ROUNDED,
      fontBody: ROUNDED,
      avatarRadius: '50%',
      avatarShadow: '0 0 0 3px #eef5fb',
      radius: '28px',
      mediaRadius: '18px',
      borderWidth: '0px',
      shadow: 'inset 0 -6px 0 0 rgba(13, 37, 64, 0.07), inset 0 2px 0 0 rgba(255, 255, 255, 0.65)',
    },
  },

  // 6. Terminal — a phosphor console in a window. Real monospace, three dots in
  //    a title bar, a faint CRT scan texture, a hard-cornered square avatar.
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    preview: 'linear-gradient(135deg, #0b0e0b 0%, #141a14 100%)',
    tokens: {
      type: {
        displaySize: '16px',
        displayWeight: '600',
        displayTracking: '0',
        quoteSize: '16px',
        bodySize: '15px',
        bodyLeading: '1.7',
        metaSize: '12px',
        metaTracking: '0.02em',
        metaUppercase: false,
        metaTabular: false,
        metaDivider: false,
      },
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
      mat: '#0f140f',
      keyline: false,
      texture: CRT_TEXTURE,
      // Drawn as the window furniture, so it must read as a line, not a border.
      rule: '#2f4032',
      ruleStyle: 'solid',
      signature: { style: 'titlebar', height: '10px' },
      quoteStyle: 'outlined',
      statChip: false,
      rhythm: { gap: '14px', mediaGap: '3px' },
      fontDisplay: MONO,
      fontBody: MONO,
      avatarRadius: '2px',
      avatarShadow: '0 0 0 1px #3b4d3e',
      radius: '10px',
      mediaRadius: '3px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 7. Receipt — a thermal till slip. Grey-white paper, typewriter type, rules
  //    torn along a dash, a row of perforation dots at the head, a square
  //    avatar, stats set as upper-case totals.
  receipt: {
    id: 'receipt',
    name: 'Receipt',
    preview: 'linear-gradient(135deg, #c9c9c3 0%, #f5f5f1 58%, #1c1c1b 58%, #1c1c1b 100%)',
    tokens: {
      type: {
        displaySize: '15.5px',
        displayWeight: '700',
        displayTracking: '0.02em',
        quoteSize: '14px',
        bodySize: '14.5px',
        bodyLeading: '1.75',
        metaSize: '11.5px',
        metaTracking: '0.08em',
        metaUppercase: true,
        metaTabular: true,
        metaDivider: false,
      },
      canvas: '#c9c9c3',
      surface: '#f5f5f1',
      text: '#1c1c1b',
      muted: '#464644',
      faint: '#5f5f5b',
      // Thermal print is one ink: the accent is the ink itself.
      accent: '#1c1c1b',
      link: '#1c1c1b',
      border: '#dadad4',
      divider: '#8a8a85',
      quoteBackground: '#ecece7',
      quoteBorder: '#6b6b66',
      qrFill: '#1c1c1b',
      mediaBorder: '#1c1c1b',
      mediaFrame: 'rule',
      mat: '#f5f5f1',
      keyline: false,
      texture: 'none',
      rule: '#7c7c77',
      ruleStyle: 'dashed',
      signature: { style: 'perforation', height: '4px' },
      quoteStyle: 'outlined',
      statChip: false,
      rhythm: { gap: '16px', mediaGap: '4px' },
      fontDisplay: TYPEWRITER,
      fontBody: TYPEWRITER,
      avatarRadius: '0px',
      avatarShadow: 'none',
      radius: '2px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 8. Brutalist — a sticker slapped on a wall. Signal yellow, 3px black edge, a
  //    hard offset band, a Times-weight headline against a plain sans body, and a
  //    violet link. Deliberately loud, so it is not part of the default rotation.
  brutalist: {
    id: 'brutalist',
    name: 'Brutalist',
    preview:
      'linear-gradient(135deg, #ffe64a 0%, #ffe64a 46%, #111110 46%, #111110 100%)',
    tokens: {
      type: {
        displaySize: '22px',
        displayWeight: '800',
        displayTracking: '-0.02em',
        quoteSize: '18px',
        bodySize: '17px',
        bodyLeading: '1.55',
        metaSize: '13px',
        metaTracking: '0',
        metaUppercase: false,
        metaTabular: false,
        metaDivider: false,
      },
      canvas: '#141413',
      surface: '#ffe64a',
      text: '#111110',
      muted: '#3b3813',
      faint: '#524e1a',
      accent: '#5a14d8',
      link: '#5a14d8',
      border: '#111110',
      divider: '#111110',
      quoteBackground: '#fff8c9',
      quoteBorder: '#111110',
      qrFill: '#111110',
      mediaBorder: '#111110',
      mediaFrame: 'rule',
      mat: '#fff8c9',
      keyline: false,
      texture: 'none',
      rule: '#111110',
      ruleStyle: 'solid',
      signature: { style: 'block', height: '4px' },
      quoteStyle: 'filled',
      statChip: false,
      // Loud material, loud gutter: the pictures are boxed hard and pushed
      // apart, the way the sheet's own 3px edge and offset band are.
      rhythm: { gap: '24px', mediaGap: '8px' },
      fontDisplay: SERIF,
      fontBody: SANS,
      avatarRadius: '0px',
      avatarShadow: '4px 4px 0 #111110',
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '3px',
      // Inset, not outset: the export captures the element's border box, so an
      // outer shadow is cropped straight out of the PNG. Negative offsets put
      // the hard band on the bottom-right.
      shadow: 'inset -12px -12px 0 0 #111110',
    },
  },
};

/**
 * Retired presets map onto the closest live material rather than resetting the
 * user's choice. This covers the old gradient skins and the previous material
 * set: each keeps its light/dark character and its place in the rotation.
 */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'sunset-glow': 'gallery',
  'aurora-purple': 'darkroom',
  'cyber-mint': 'terminal',
  // Retired classics.
  'linear-dark': 'darkroom',
  'oled-black': 'darkroom',
  'oled': 'darkroom',
  'notion-white': 'gallery',
  'notion-clean-white': 'gallery',
  // The previous material set.
  parchment: 'gallery',
  nocturne: 'darkroom',
  hairline: 'riso',
  kraft: 'sumi',
  cyanotype: 'clay',
  broadsheet: 'receipt',
};

export const PADDING_OPTIONS: PaddingOption[] = ['16px', '32px', '48px'];
export const RADIUS_OPTIONS: RadiusOption[] = ['theme', '0px', '12px', '20px'];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = ['auto', '3:4', '16:9'];
export const IMAGE_FIT_OPTIONS: ImageFitOption[] = ['contain', 'cover'];
export const MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = ['grid', 'stack'];

/**
 * Picker order and visibility.
 *
 * The first six are the everyday rotation, light and dark mixed so the picker's
 * first screen shows range. Receipt is a niche material and Brutalist is
 * deliberately last and marked experimental, so its 3px frame and hard band stay
 * behind the "more" disclosure.
 */
export const THEME_ORDER: ThemeId[] = [
  'gallery',
  'darkroom',
  'riso',
  'sumi',
  'clay',
  'terminal',
  'receipt',
  'brutalist',
];

export const EXPERIMENTAL_THEMES: ReadonlySet<ThemeId> = new Set<ThemeId>(['brutalist']);

export const DEFAULT_CARD_CONFIG: CardConfig = {
  theme: 'gallery',
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