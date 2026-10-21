import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, ImageFitOption, MediaLayoutOption, CardConfig, LegacyThemeId, CanvasRatioOption, CanvasBackgroundId } from '../../types/card.ts';
import { detectDefaultLocale } from '../i18n.ts';
import {
  ASPECT_RATIO,
  CANVAS_BACKGROUND,
  CANVAS_RATIO,
  IMAGE_FIT,
  MEDIA_LAYOUT,
  PADDING,
  RADIUS,
  optionValue,
} from './options.ts';

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
}

export interface ThemeTokens {
  /** The material's letterforms. See `TypeScale`. */
  type: TypeScale;
  /**
   * The mat the sheet is mounted on. Kept at least 1.15:1 off `surface` so the
   * card reads as an object lying on a board rather than a slightly-off patch.
   *
   * It paints the preview stage, and it is also what the `'theme'` canvas
   * background resolves to — so a material still carries its own mat into the
   * PNG when the user asks for one. Choosing no background leaves this out of
   * the export entirely, which is the default.
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
  /**
   * The ink of every drawn line: the signature, the footer rule, the thread.
   *
   * It must be a real ink, never `transparent`. The four modern materials used to
   * set it to `transparent` to mean "this paper draws no furniture", which was
   * true of the signature (`signature.style: 'none'`) and false of everything
   * else that consumes this token: the thread connector and the footer rule draw
   * with `var(--rule)`, and a CSS fallback only fires when the variable is
   * *undefined*. A defined `transparent` therefore erased both lines silently —
   * the thread lost its spine and the footer floated without its rule. "No
   * furniture" is expressed by the signature style, not by a blank ink.
   *
   * It also has to *separate* from the sheet. The floor the repo holds a drawn
   * edge to is 1.4:1 (`F17.11`), and this token is what draws the footer rule,
   * so it is held to it too — `F17.14c` enforces it. That is why it is not
   * simply `mediaBorder`: the mount ink is tuned to sit quietly around a photo
   * (1.32–1.38:1 on the four modern sheets) and is too faint to read as a line.
   */
  rule: string;
  /** `solid` or `dashed`; a receipt's rules are torn along a dash. */
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
  /**
   * Rules between the stat columns, as a darkroom data strip is ruled. A
   * footnote treatment rather than a letterform, so it lives beside `statChip`
   * rather than inside `TypeScale`.
   */
  metaDivider: boolean;
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
  | 'none'
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

export type RuleStyle = 'solid' | 'dashed';

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
  // 1. Minimal — quiet, distraction-free modern layout. Warm paper tone, no edge line,
  //    no top furniture, zero distraction, letting pure typography speak.
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    tokens: {
      type: {
        displaySize: '18px',
        displayWeight: '600',
        displayTracking: '-0.01em',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.68',
        metaSize: '12.5px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
      },
      metaDivider: false,
      canvas: '#deddd6',
      surface: '#faf9f5',
      text: '#121211',
      muted: '#4a4a47',
      faint: '#5e5e5b',
      accent: '#2563eb',
      link: '#2563eb',
      border: '#e5e4de',
      divider: '#e5e4de',
      quoteBackground: '#e5e4dc',
      quoteBorder: '#d5d4cd',
      qrFill: '#121211',
      mediaBorder: '#dcdbd4',
      mediaFrame: 'rule',
      mat: '#faf9f5',
      keyline: false,
      texture: 'none',
      // Its own step off `mediaBorder`: the mount ink is tuned to sit quietly
      // against the sheet (1.32:1), and a drawn line has to clear the floor the
      // repo sets for one. 1.51:1.
      rule: '#cecdc6',
      ruleStyle: 'solid',
      signature: { style: 'none', height: '0px' },
      quoteStyle: 'filled',
      statChip: false,
      rhythm: { gap: '18px', mediaGap: '8px' },
      fontDisplay: SANS,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: 'none',
      radius: '16px',
      mediaRadius: '10px',
      borderWidth: '0px',
      shadow: 'none',
    },
  },

  // 2. Midnight — deep nocturnal navy-grey. High contrast, easy on the eyes,
  //    delivering an elegant dark mode without harsh pitch-black contrast.
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    tokens: {
      type: {
        displaySize: '18px',
        displayWeight: '600',
        displayTracking: '-0.01em',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.68',
        metaSize: '12.5px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
      },
      metaDivider: false,
      canvas: '#060709',
      surface: '#181b22',
      text: '#f0f2f5',
      muted: '#a8b0ba',
      faint: '#88909a',
      accent: '#7aa2ff',
      link: '#7aa2ff',
      border: '#282e3a',
      divider: '#242934',
      quoteBackground: '#232936',
      quoteBorder: '#323b4e',
      qrFill: '#f0f2f5',
      mediaBorder: '#2c3442',
      mediaFrame: 'rule',
      mat: '#181b22',
      keyline: false,
      texture: 'none',
      // One step lighter than `mediaBorder` so the drawn line clears the
      // repo's floor on this dark sheet: 1.51:1.
      rule: '#323a48',
      ruleStyle: 'solid',
      signature: { style: 'none', height: '0px' },
      quoteStyle: 'filled',
      statChip: false,
      rhythm: { gap: '18px', mediaGap: '6px' },
      fontDisplay: SANS,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: 'none',
      radius: '16px',
      mediaRadius: '10px',
      borderWidth: '0px',
      shadow: 'none',
    },
  },

  // 3. Liquid Glass — inspired by translucent Apple liquid glass aesthetics.
  //    A soft aurora diffuse background layered with a high-translucency white plate,
  //    delicate specular inner highlights, and a generous 24px radius.
  glass: {
    id: 'glass',
    name: 'Liquid Glass',
    tokens: {
      type: {
        displaySize: '18px',
        displayWeight: '600',
        displayTracking: '-0.01em',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.68',
        metaSize: '12px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
      },
      metaDivider: false,
      canvas: '#bdc9d8',
      surface: '#ebf1f8',
      text: '#0f172a',
      muted: '#475569',
      faint: '#546479',
      accent: '#0369a1',
      link: '#0369a1',
      border: 'rgba(255, 255, 255, 0.6)',
      divider: '#c8daf0',
      quoteBackground: '#ebf1f8',
      quoteBorder: '#8fa8c8',
      qrFill: '#0f172a',
      mediaBorder: '#c0d4ed',
      mediaFrame: 'rule',
      mat: '#ebf1f8',
      keyline: false,
      texture:
        'radial-gradient(at 0% 0%, rgba(255, 255, 255, 0.8) 0px, transparent 60%), radial-gradient(at 100% 100%, rgba(3, 105, 161, 0.12) 0px, transparent 50%)',
      // Its own step off `mediaBorder` (1.33:1), to 1.50:1.
      rule: '#b4c8e1',
      ruleStyle: 'solid',
      signature: { style: 'none', height: '0px' },
      quoteStyle: 'outlined',
      statChip: true,
      rhythm: { gap: '18px', mediaGap: '10px' },
      fontDisplay: SANS,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: 'none',
      radius: '24px',
      mediaRadius: '14px',
      borderWidth: '1px',
      shadow: 'inset 0 1.5px 0 0 rgba(255, 255, 255, 0.9), 0 8px 32px 0 rgba(31, 38, 135, 0.08)',
    },
  },

  // 4. Material 3 — Google Material You in natural sage green.
  //    Tonal surface elevations, friendly 28px pill contours, and tonal container chips.
  material: {
    id: 'material',
    name: 'Material 3',
    tokens: {
      type: {
        displaySize: '18px',
        displayWeight: '600',
        displayTracking: '-0.01em',
        quoteSize: '14.5px',
        bodySize: '16.5px',
        bodyLeading: '1.68',
        metaSize: '12px',
        metaTracking: '0.01em',
        metaUppercase: false,
        metaTabular: true,
      },
      metaDivider: false,
      canvas: '#dfe4d8',
      surface: '#f4f6f0',
      text: '#191d17',
      muted: '#444f42',
      faint: '#546152',
      accent: '#3e6837',
      link: '#3e6837',
      border: '#d8e0d3',
      divider: '#dde5d8',
      quoteBackground: '#d7e2d1',
      quoteBorder: '#cad6c3',
      qrFill: '#191d17',
      mediaBorder: '#cbd6c4',
      mediaFrame: 'rule',
      mat: '#f4f6f0',
      keyline: false,
      texture: 'none',
      // Its own step off `mediaBorder` (1.38:1), to 1.51:1.
      rule: '#c2cdbb',
      ruleStyle: 'solid',
      signature: { style: 'none', height: '0px' },
      quoteStyle: 'filled',
      statChip: true,
      rhythm: { gap: '18px', mediaGap: '8px' },
      fontDisplay: SANS,
      fontBody: SANS,
      avatarRadius: '50%',
      avatarShadow: 'none',
      radius: '28px',
      mediaRadius: '16px',
      borderWidth: '0px',
      shadow: 'none',
    },
  },

  // 5. Gallery — the wall label beside a framed work. A neutral off-white sheet,
  //    one Klein-blue tick over a black hairline, and pictures mounted behind a
  //    thick mat. The quiet default: the post is the exhibit, the card gets out
  //    of the way.
  gallery: {
    id: 'gallery',
    name: 'Gallery',
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
      },
      metaDivider: false,
      canvas: '#d6d7d3',
      surface: '#f7f7f4',
      text: '#101011',
      muted: '#55575b',
      faint: '#696b70',
      accent: '#1b3bd6',
      link: '#1b3bd6',
      border: '#d4d5d0',
      divider: '#dedfda',
      quoteBackground: '#f0f0eb',
      quoteBorder: '#c8c9c4',
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
      },
      metaDivider: false,
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
      avatarShadow: '0 0 0 1.5px #ffb02e',
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
      },
      metaDivider: true,
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
      },
      metaDivider: false,
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
      },
      metaDivider: false,
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
      },
      metaDivider: false,
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
      },
      metaDivider: false,
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
      },
      metaDivider: false,
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
export const LEGACY_THEME_ALIASES: Record<LegacyThemeId, ThemeId> = {
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

export const PADDING_OPTIONS: PaddingOption[] = [...PADDING.values];
export const RADIUS_OPTIONS: RadiusOption[] = [...RADIUS.values];

/**
 * Aspect ratios, in the order the segmented control offers them. The values are
 * the user-facing labels already, so only `auto` needs a translation -- `3:4` and
 * `16:9` are ratios, not words. That is why the control's labels map has exactly one
 * key.
 *
 * These strings are persisted config and compared as literals downstream, not just
 * display text: the geometry module switches on them to work out the poster
 * floor, mediaGrid checks `=== 'auto'` to decide whether to fit cells to their
 * pictures, and Card emits them as the export target's `data-ratio`.
 * Translating this list would break all three, so localize through the labels
 * map and leave the values alone.
 */
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [...ASPECT_RATIO.values];
export const IMAGE_FIT_OPTIONS: ImageFitOption[] = [...IMAGE_FIT.values];
export const MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = [...MEDIA_LAYOUT.values];

/**
 * The exported canvas shape, in picker order. Square first because it is the
 * one the platforms this exists for actually render natively.
 *
 * Same rule as `ASPECT_RATIO_OPTIONS`: these strings are persisted config and
 * are read back as literals by `data-canvas-ratio` in card.css, so only `auto`
 * needs a translation and it goes through the control's labels map.
 */
export const CANVAS_RATIO_OPTIONS: CanvasRatioOption[] = [...CANVAS_RATIO.values];

/**
 * The ring of mat left showing around the card when a canvas is switched on.
 *
 * Fixed rather than user-adjustable: the geometry below derives the canvas
 * shape from this number, so a slider here would be a second control whose
 * only visible effect is to make the first one's output bigger. It is 0 when
 * nothing is selected, which is what keeps the default export byte-identical
 * to the card alone.
 */
export const MAT_PADDING = '48px';

/**
 * The drop shadow the card takes when "Card shadow" is on.
 *
 * Outer rather than inset, which the material tokens deliberately never are:
 * those are kept inside the card's box because the export used to capture the
 * card itself. On a mat that changed -- the mat is the exported element now, and
 * it holds 48px of padding, so there is room for a shadow to fall into. Two
 * layers: a tight one for the contact edge, a wide soft one for the lift. Black
 * at these opacities works over both the pale gradients and the dark ones; a
 * coloured shadow would have to be tuned per background.
 */
export const MAT_SHADOW =
  '0 2px 6px rgba(0, 0, 0, 0.12), 0 16px 40px -8px rgba(0, 0, 0, 0.34)';

/**
 * What the mat can be painted with.
 *
 * A table rather than a colour picker: every entry is a CSS literal, so the
 * whole feature stays offline and nothing is fetched at export time. `'theme'`
 * is the one entry that is not a literal — it resolves to the active material's
 * own `canvas` token, which is why it is the default choice: the twelve
 * materials already ship twelve mats that were tuned against their sheets, and
 * picking `'theme'` reuses that work instead of asking the user to match a
 * background to a card by eye.
 */
export interface CanvasBackgroundDefinition {
  /**
   * How the mat gets its value. `'none'` and `'theme'` are not literals and are
   * resolved at render time; `'paint'` entries are read straight off `css`.
   *
   * Solid and gradient are one kind on purpose: nothing downstream treats them
   * differently, and a `solid`/`gradient` split would invite a branch that only
   * ever tests the same `css` twice. It is the mat's `background` either way.
   */
  kind: 'none' | 'theme' | 'paint';
  /** A CSS `background` value. Empty for `'none'` and `'theme'`. */
  css: string;
  /** Fallback label. The panel prefers `canvasBg_<id>` from the dictionary. */
  name: string;
}

export const CANVAS_BACKGROUNDS: Record<CanvasBackgroundId, CanvasBackgroundDefinition> = {
  none: { kind: 'none', css: '', name: 'None' },
  theme: { kind: 'theme', css: '', name: 'Follow theme' },
  // The two ends of the range the materials are built from, so a solid choice
  // reads as a material decision rather than a colour one. They are the only
  // extremes on purpose: a mid-grey solid would sit within 1.4:1 of half the
  // twelve sheets, and "Follow theme" already ships a tuned one for each.
  paper: { kind: 'paint', css: '#faf9f5', name: 'Paper' },
  ink: { kind: 'paint', css: '#141413', name: 'Ink' },
  // The rest are mid-tone gradients, one per hue family, because that is what a
  // wallpaper does that a solid cannot: it reads as a surface behind the card
  // instead of a second sheet under it. Mid-tone is the constraint that makes
  // them usable with all twelve materials -- each was picked so its *worst*
  // contrast against any of the twelve sheets is still >= 1.6:1, which is what
  // keeps a dark card from dissolving into a dark mat and a light one from
  // glowing out of a light one. Light-to-dark along the diagonal matches the
  // direction the preview's own mat shading runs, so a card dropped on one
  // reads as lit from the top-left the way it does on a material.
  lagoon: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #2c6f7e 0%, #24506f 100%)',
    name: 'Lagoon',
  },
  moss: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #5a7050 0%, #3d4f38 100%)',
    name: 'Moss',
  },
  steel: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #79808d 0%, #3e4552 100%)',
    name: 'Steel',
  },
  plum: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #6d4a80 0%, #4a3560 100%)',
    name: 'Plum',
  },
  ember: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #a05a48 0%, #7a3a46 100%)',
    name: 'Ember',
  },
  coral: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #d9836f 0%, #a44f5a 100%)',
    name: 'Coral',
  },
  // The five above are quiet on purpose; these are the loud ones. They break
  // the mid-tone rule the quiet set follows -- higher chroma, and ends that run
  // from near-white to near-black -- because the point of a wallpaper is to be
  // seen. The cost is edge contrast: measured against the twelve sheets, the
  // worst stop here is 1.04:1 (Sunset's peach against Clay's pale blue), where
  // the quiet set never falls below 1.6:1. That is a silhouette-only number:
  // the mat is never a field for text, so no text fails on it, but a light card
  // on Sunset has a softer edge than on Lagoon. They are here because that soft
  // edge is the look -- the reference for this set is a desktop wallpaper with
  // the sheet floating on it, not a paper stock.
  sunset: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #ffd7c2 0%, #f7bfdc 50%, #c9b6f4 100%)',
    name: 'Sunset',
  },
  citrus: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #ffd166 0%, #ff8a5b 50%, #ef476f 100%)',
    name: 'Citrus',
  },
  neon: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #ff2e88 0%, #ff7a3d 100%)',
    name: 'Neon',
  },
  flamingo: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #ff5f8f 0%, #c43de0 55%, #6a2fd1 100%)',
    name: 'Flamingo',
  },
  aurora: {
    kind: 'paint',
    css: 'linear-gradient(135deg, #1fd3b0 0%, #2f7cf6 55%, #7b3ff2 100%)',
    name: 'Aurora',
  },
};

/**
 * Picker order: no background, then the theme's own, then the two solids, then
 * the quiet gradients in hue order, then the bold ones. The extremes come
 * first so the left of the grid still reads as "no paint, then a sheet, then
 * ink"; the bold set is last because it is the deliberate exception.
 *
 * The order is the option's own list of values, so the two cannot disagree
 * about which paints exist or which comes first.
 */
export const CANVAS_BACKGROUND_ORDER: CanvasBackgroundId[] = [...CANVAS_BACKGROUND.values];

/**
 * The CSS `background` the mat is painted with.
 *
 * Shaped like `resolveRadius` below: `'theme'` is the only entry that needs the
 * active material, so the material is a parameter rather than something this
 * reads for itself.
 */
export function resolveCanvasBackground(id: CanvasBackgroundId, theme: ThemeId): string {
  const definition = CANVAS_BACKGROUNDS[id];
  if (!definition || definition.kind === 'none') return '';
  if (definition.kind === 'theme') return THEMES[theme].tokens.canvas;
  return definition.css;
}

/**
 * Picker order and visibility.
 *
 * The first six are the everyday rotation, light and dark mixed so the picker's
 * first screen shows range. Receipt is a niche material and Brutalist is
 * deliberately last and marked experimental, so its 3px frame and hard band stay
 * behind the "more" disclosure.
 */
export const THEME_ORDER: ThemeId[] = [
  'minimal',
  'midnight',
  'glass',
  'material',
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
  theme: 'minimal',
  // The option defaults, read from the options themselves rather than written
  // out again: a default that lived in two places is a default that could
  // disagree with itself, and this one already did — the corner's sanitizer
  // answered `'12px'` for a value that was never set while the card shipped
  // with `'theme'`.
  padding: PADDING.default,
  borderRadius: RADIUS.default,
  aspectRatio: ASPECT_RATIO.default,
  imageFit: IMAGE_FIT.default,
  mediaLayout: MEDIA_LAYOUT.default,
  showQrCode: true,
  showStats: true,
  showTimestamp: true,
  showWatermark: true,
  blurAuthor: false,
  showActionBarButton: true,
  showPlayButton: true,
  locale: detectDefaultLocale(),
  excludedTweetIds: [],
  // Both default to "leave the export alone". A default of anything else would
  // repaint every existing user's PNG the moment they upgrade.
  canvasRatio: CANVAS_RATIO.default,
  canvasBackground: CANVAS_BACKGROUND.default,
  canvasShadow: false,
};

/**
 * The card's minimum shape, or the shipped one when the stored value is not a
 * shape the card offers.
 *
 * This one is load-bearing beyond the usual: the card's own floor is computed
 * from the ratio, and an unrecognised one would reach that arithmetic as
 * `undefined`.
 */
export function sanitizeAspectRatio(val?: string): AspectRatioOption {
  return optionValue(ASPECT_RATIO, val);
}

/**
 * The card's own breathing room, or the shipped one when the stored value is
 * not a tier the card offers.
 */
export function sanitizePadding(val: string): PaddingOption {
  return optionValue(PADDING, val);
}

/**
 * Resolves any stored theme value to a live theme. Accepts the current ids and
 * the retired presets, so upgrading keeps the user's paper instead of dropping
 * them on the default.
 */
export function sanitizeTheme(val?: string | null): ThemeId {
  // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `constructor`
  // or `__proto__` would be taken for a live theme id and handed to
  // `THEMES[id].tokens`, which is the crash this sanitizer exists to prevent.
  if (val && Object.hasOwn(THEMES, val)) {
    return val as ThemeId;
  }
  if (val && Object.hasOwn(LEGACY_THEME_ALIASES, val)) {
    // `hasOwn` proves the key exists; TS cannot narrow a `string` to the key union.
    return LEGACY_THEME_ALIASES[val as LegacyThemeId];
  }
  return DEFAULT_CARD_CONFIG.theme;
}

/**
 * The card's corner, or the shipped one when the stored value is not a corner
 * the card offers.
 */
export function sanitizeRadius(val: string): RadiusOption {
  return optionValue(RADIUS, val);
}

/**
 * How a picture is fitted into its cell, or the shipped way when the stored
 * value is not one the card offers.
 */
export function sanitizeImageFit(val?: string): ImageFitOption {
  return optionValue(IMAGE_FIT, val);
}

/**
 * How several pictures are arranged, or the shipped way when the stored value
 * is not one the card offers.
 */
export function sanitizeMediaLayout(val?: string): MediaLayoutOption {
  return optionValue(MEDIA_LAYOUT, val);
}

/**
 * The exported canvas's shape, or the shipped one when the stored value is not
 * a shape the card offers.
 */
export function sanitizeCanvasRatio(val?: string): CanvasRatioOption {
  return optionValue(CANVAS_RATIO, val);
}

/**
 * What the mat is painted with, or the shipped way when the stored value is
 * not a paint the card offers.
 */
export function sanitizeCanvasBackground(val?: string): CanvasBackgroundId {
  return optionValue(CANVAS_BACKGROUND, val);
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

/**
 * The picker's swatch for one material: the sheet's tone, the material's accent,
 * and — where it has one — its own signature mark.
 *
 * This used to be a hand-written `preview` gradient per theme: twelve strings
 * nobody could derive from anything, which is why all twelve ended in the same
 * move — a light square falling to the accent in the corner. They drifted into
 * one family, so the swatch carried the accent and nothing else, and
 * \u6db2\u6001\u73bb\u7483 / \u591c\u5e55 were near-indistinguishable in the picker even
 * though the two materials have nothing else in common.
 *
 * It is composed from the tokens now, which makes it honest by construction
 * instead of by upkeep. Three signals, in the order they matter:
 *
 *   1. The sheet and its ink — the one pairing a reader recognises a card by.
 *      Eight of the twelve surfaces are within 1.20:1 of each other (measured;
 *      three are within 1.05:1), so surface tone alone cannot separate them;
 *      one of the flat five is light-on-dark, and that is visible at a glance.
 *   2. The signature mark, drawn with the geometry `card.css` uses for real,
 *      scaled to the swatch. Seven of twelve materials have one; the five that
 *      do not are deliberately flat, and two ink rules are the honest answer.
 *   3. The accent, as the card's own link ink rather than as a field.
 *
 * These are `background-image` layers rather than a pseudo-element because the
 * swatch sets its `background` inline, and `background-image` paints front to
 * back — the mark must be listed before the wash or it is buried under it,
 * which is exactly how the first attempt rendered six blank swatches.
 */
export function themePreview(theme: ThemeId): string {
  const t = THEMES[theme].tokens;
  const layers: string[] = [];

  // 1. The signature mark, first in the list: see the note above about paint
  //    order. Seven of the twelve materials have one, and it is the only thing
  //    that makes them recognisable — the signature rule, the seal, the
  //    perforation. The five without one get a gradient instead.
  const mark = signatureMark(t);
  layers.push(...mark);

  // 2. What stands in for a mark when there is none: the card's own two inks on
  //    its own sheet -- a headline, then a link.
  //
  //    This used to be a diagonal wash from the sheet to the accent, and it was
  //    the one place the picker lied: Minimal's chip read blue-on-blue, but the
  //    card it stands for is warm paper with black text, and Midnight's read the
  //    same blue gradient over a near-black sheet that prints white. Both flat
  //    materials looked like each other and like neither.
  //
  //    The ink carries the identity the accent alone could not: the five flat
  //    surfaces sit within 1.20:1 of each other (three within 1.05:1), but their
  //    *text* inks are light-on-dark for one of them and dark-on-light for the
  //    rest, which is the difference a thumbnail has to show. The accent stays,
  //    as the card's own link ink rather than as a field.
  if (mark.length === 0) {
    layers.push(
      `linear-gradient(${t.text}, ${t.text}) 8% 9px / 46% 3px no-repeat`,
      `linear-gradient(${t.accent}, ${t.accent}) 8% 17px / 30% 2px no-repeat`,
      `linear-gradient(${t.surface}, ${t.surface}) center / 100% 100% no-repeat`
    );
  } else {
    // 3. A sheet under the mark, as a wash so the mark shows through it.
    layers.push(
      `linear-gradient(${t.surface}e6, ${t.surface}e6) center / 100% 100% no-repeat`,
      // And the accent as a hairline along the bottom edge — the same place a
      // card's own accent ink sits. Sized as a rule, not a band: a 34% band of
      // accent read as a solid brick, which is the one thing a signed material
      // is defined by not having.
      `linear-gradient(${t.accent}, ${t.accent}) 0 100% / 100% 3px no-repeat`
    );
  }

  return layers.join(', ');
}

/**
 * The signature layers, front to back, or empty for a material with no mark.
 *
 * Heights come from the theme's own `signature.height` so a thick rule stays
 * thick; the fixed offsets are the swatch's scale, not a second table. Each
 * case is the shape `card.css` draws for the same `signature.style`, which is
 * the point: the picker advertises the material, not a near-miss of it.
 *
 * The two draw the same *shape* at different *scales*, and the sizes are
 * therefore not meant to match: the card's rule is 40px of a 640px sheet, the
 * swatch's is 46% of 34px, because three dots drawn at the card's size would
 * not fit in a thumbnail at all. A swatch is a reduction, and each mark's
 * proportions are what survive the reduction. What must not happen is the two
 * disagreeing about the *shape* — a seal is a square at both sizes, a
 * perforation is a row of dots at both.
 *
 * Returns an array because a mark is often two layers — a rule plus a tick, a
 * line plus a seal — and joining them here would hide that from the caller,
 * which needs the order to compose them correctly.
 *
 * `none` returns nothing. Filling that band with the accent instead would
 * invent a mark the card does not have, and the picker is where someone decides
 * which material they want; it should not lie about any of them.
 */
function signatureMark(t: ThemeTokens): string[] {
  const { style, height } = t.signature;
  const rule = t.rule;
  const accent = t.accent;
  const top = '6px';

  switch (style) {
    // A plain ink bar: the gallery label's rule and the sticker's thick rule
    // are one decision at two weights.
    case 'rule':
    case 'block':
      return [`linear-gradient(${rule}, ${rule}) 0 ${top} / 100% ${height} no-repeat`];

    // One accent tick riding a full hairline, the tick over it, same as the card.
    //
    // The rule is drawn thinner than the tick's own 2px, and the tick wider,
    // because a swatch is a reduction and the two invert at this scale: Gallery's
    // rule is the body ink (#101011, 17.7:1 on its sheet), which across the full
    // width of 34px reads as a black bar with a blue segment interrupted into it
    // -- the opposite of what the theme is, per its own note, "one Klein-blue
    // tick over a black hairline". Darkroom's rule is 1.67:1 on its sheet, so
    // there the hairline is genuinely a hairline and no adjustment is needed;
    // the difference is in the ink, not the geometry.
    case 'tick-rule':
      return [
        `linear-gradient(${accent}, ${accent}) 0 ${top} / 46% 2px no-repeat`,
        `linear-gradient(${rule}, ${rule}) 0 9px / 100% 1px no-repeat`,
      ];

    // Two overlapping discs, one per ink, a few pixels off: the two-colour
    // print's registration miss.
    case 'registration': {
      const dot = (color: string, x: string) =>
        `radial-gradient(circle 3px at ${x} ${top}, ${color} 100%, transparent 0) no-repeat`;
      return [
        dot(rule, '16%'),
        dot(accent, '26%'),
        `linear-gradient(${rule}, ${rule}) 0 11px / 100% ${height} no-repeat`,
      ];
    }

    // A short rounded bar, pressed in.
    case 'pill':
      return [`linear-gradient(${accent}, ${accent}) 0 ${top} / 44% ${height} no-repeat`];

    // The seal a scroll is signed with: a square stamp at the end of the line.
    case 'seal':
      return [
        `linear-gradient(${rule}, ${rule}) 0 15px / 100% 1px no-repeat`,
        `linear-gradient(${accent}, ${accent}) 100% 9px / 13% 7px no-repeat`,
      ];

    // Three traffic dots, in the sheet's own inks rather than stock
    // red/amber/green.
    case 'titlebar': {
      const dot = (color: string, x: string) =>
        `radial-gradient(circle 2.5px at ${x} ${top}, ${color} 100%, transparent 0) no-repeat`;
      return [dot(accent, '18%'), dot(t.muted, '36%'), dot(rule, '54%')];
    }

    // A row of dots, not a line, the tear a till slip is pulled along.
    case 'perforation':
      return [
        `radial-gradient(circle 1.3px at 50% 50%, ${rule} 100%, transparent 0) 0 ${top} / 6px ${height} repeat-x`,
      ];

    case 'none':
      return [];
  }
}

