import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, ImageFitOption, MediaLayoutOption, CardConfig } from '../../types/card';
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
   * The theme's signature rule. This is the one place a theme is allowed a
   * material of its own rather than a tint of `border` — Parchment's cream
   * standfirst rule is the reason it does not read as a quieter Hairline.
   */
  rule: string;
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

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // 1. Parchment — warm ivory paper, editorial serif, for quotes and long posts.
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
      border: '#e8e6dc',
      divider: '#e8e6dc',
      quoteBackground: '#f1efe7',
      quoteBorder: '#e8e6dc',
      qrFill: '#141413',
      rule: '#ded8c6',
      fontDisplay: SERIF,
      fontBody: SANS,
      radius: '12px',
      mediaRadius: '8px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 2. Nocturne — warm charcoal, magazine cover, for video and image-led posts.
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
      border: '#3f3e3a',
      divider: '#45443f',
      quoteBackground: '#282826',
      quoteBorder: '#3f3e3a',
      qrFill: '#f5f4ed',
      rule: '#4a4844',
      fontDisplay: SERIF,
      fontBody: SANS,
      radius: '10px',
      mediaRadius: '6px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 3. Hairline — Swiss grid: hairline rules, light sans, no shadow.
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
      quoteBorder: '#d7d4c9',
      qrFill: '#141413',
      rule: '#141413',
      fontDisplay: SANS,
      fontBody: SANS,
      radius: '2px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 4. Terminal — a phosphor console. Real monospace, one scanline, no paper.
  //    Replaces the retired Hacker Mint without inheriting its gradient.
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
      quoteBorder: '#2b382d',
      qrFill: '#d8f5d0',
      // The scanline is drawn with this, so it must read as a screen line, not
      // as a border: one step off the surface rather than near-black.
      rule: '#243026',
      fontDisplay: MONO,
      fontBody: MONO,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 5. Broadsheet — multi-column newspaper: masthead, all-caps kickers, ruled
  //    columns. For contested posts, where the layout should look like a paper
  //    of record rather than a social card.
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
      quoteBorder: '#c9c6b8',
      qrFill: '#1a1a17',
      rule: '#1a1a17',
      fontDisplay: SERIF,
      fontBody: SERIF,
      radius: '0px',
      mediaRadius: '0px',
      borderWidth: '1px',
      shadow: 'none',
    },
  },

  // 6. Brutalist — thick rules and a hard offset shadow. Deliberately loud, so
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
      rule: '#14140f',
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
 * Retired presets map onto the closest paper rather than resetting the user's
 * choice: dark blue-black and OLED both become Nocturne, warm white and sunset
 * become Parchment, the purple and mint experiments follow their base colour.
 */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'linear-dark': 'nocturne',
  'oled-black': 'nocturne',
  'oled': 'nocturne',
  'cyber-mint': 'nocturne',
  'aurora-purple': 'nocturne',
  'notion-clean-white': 'parchment',
  'notion-white': 'parchment',
  'sunset-glow': 'parchment',
};


export const PADDING_OPTIONS: PaddingOption[] = ['16px', '32px', '48px'];
export const RADIUS_OPTIONS: RadiusOption[] = ['theme', '0px', '12px', '20px'];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = ['auto', '3:4', '16:9'];
export const IMAGE_FIT_OPTIONS: ImageFitOption[] = ['contain', 'cover'];
export const MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = ['grid', 'stack'];

/**
 * Picker order and visibility.
 *
 * The first three are the everyday papers. Terminal and Broadsheet are phase-2
 * materials a user opts into. Brutalist is deliberately last and marked
 * experimental, so the picker can keep a 3px frame with a hard shadow behind the
 * "more" disclosure instead of putting it in front of everyone.
 */
export const THEME_ORDER: ThemeId[] = [
  'parchment',
  'nocturne',
  'hairline',
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
 * the retired gradient presets, so upgrading keeps the user's paper instead of
 * dropping them on the default.
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
