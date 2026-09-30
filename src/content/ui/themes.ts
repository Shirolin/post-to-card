import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, ImageFitOption, MediaLayoutOption, CardConfig } from '../../types/card';
import { detectDefaultLocale, sanitizeLocale } from '../i18n';
export { sanitizeLocale };

export interface ThemeTokens {
  background: string;
  textColor: string;
  secondaryTextColor: string;
  accentColor: string;
  borderColor: string;
  quoteBackground: string;
  quoteBorder: string;
  dividerColor: string;
  qrFill: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  preview: string;
  tokens: ThemeTokens;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'linear-dark': {
    id: 'linear-dark',
    name: 'Linear Dark',
    preview: 'linear-gradient(135deg, #18191c 0%, #0d0e11 100%)',
    tokens: {
      background: 'linear-gradient(135deg, #18191c 0%, #0d0e11 100%)',
      textColor: '#f3f4f6',
      secondaryTextColor: '#9ca3af',
      accentColor: '#5e6ad2',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      quoteBackground: 'rgba(255, 255, 255, 0.03)',
      quoteBorder: 'rgba(255, 255, 255, 0.08)',
      dividerColor: 'rgba(255, 255, 255, 0.1)',
      qrFill: '#f3f4f6',
    },
  },
  'sunset-glow': {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    preview: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    tokens: {
      background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.75)',
      accentColor: '#ff8a65',
      borderColor: 'rgba(255, 175, 140, 0.25)',
      quoteBackground: 'rgba(0, 0, 0, 0.2)',
      quoteBorder: 'rgba(255, 255, 255, 0.15)',
      dividerColor: 'rgba(255, 255, 255, 0.18)',
      qrFill: '#ffffff',
    },
  },
  'aurora-purple': {
    id: 'aurora-purple',
    name: 'Aurora Purple',
    preview: 'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
    tokens: {
      background: 'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
      textColor: '#ffffff',
      secondaryTextColor: '#c084fc',
      accentColor: '#38bdf8',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      quoteBackground: 'rgba(168, 85, 247, 0.06)',
      quoteBorder: 'rgba(168, 85, 247, 0.2)',
      dividerColor: 'rgba(168, 85, 247, 0.25)',
      qrFill: '#f8fafc',
    },
  },
  'notion-clean-white': {
    id: 'notion-clean-white',
    name: 'Notion White',
    preview: '#ffffff',
    tokens: {
      background: '#ffffff',
      textColor: '#37352f',
      secondaryTextColor: '#6b7280',
      accentColor: '#2563eb',
      borderColor: '#e9e9e7',
      quoteBackground: '#f9fafb',
      quoteBorder: '#e5e7eb',
      dividerColor: '#e5e7eb',
      qrFill: '#111827',
    },
  },
  'cyber-mint': {
    id: 'cyber-mint',
    name: 'Cyber Mint',
    preview: 'linear-gradient(150deg, #070c0e 0%, #0d1619 50%, #080f12 100%)',
    tokens: {
      background: '#0d1117',
      textColor: '#f0fdf4',
      secondaryTextColor: '#94a3b8',
      accentColor: '#00ffcc',
      borderColor: 'rgba(168, 185, 129, 0.28)',
      quoteBackground: 'rgba(16, 185, 129, 0.04)',
      quoteBorder: 'rgba(16, 185, 129, 0.18)',
      dividerColor: 'rgba(16, 185, 129, 0.2)',
      qrFill: '#10b981',
    },
  },
  'oled-black': {
    id: 'oled-black',
    name: 'OLED Black',
    preview: '#000000',
    tokens: {
      background: '#000000',
      textColor: '#ffffff',
      secondaryTextColor: '#737373',
      accentColor: '#ffffff',
      borderColor: '#262626',
      quoteBackground: '#0d0d0d',
      quoteBorder: '#262626',
      dividerColor: '#262626',
      qrFill: '#ffffff',
    },
  },
};

export const PADDING_OPTIONS: PaddingOption[] = ['16px', '32px', '48px'];
export const RADIUS_OPTIONS: RadiusOption[] = ['0px', '12px', '20px'];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = ['auto', '3:4', '16:9'];
export const IMAGE_FIT_OPTIONS: ImageFitOption[] = ['contain', 'cover'];
export const MEDIA_LAYOUT_OPTIONS: MediaLayoutOption[] = ['grid', 'stack'];

export const DEFAULT_CARD_CONFIG: CardConfig = {
  theme: 'linear-dark',
  padding: '32px',
  borderRadius: '12px',
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
};

export function sanitizePadding(val: string): PaddingOption {
  if (val === '16px' || val === '32px' || val === '48px') {
    return val;
  }
  return '32px';
}

export function sanitizeRadius(val: string): RadiusOption {
  if (val === '0px' || val === '12px' || val === '20px') {
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

export function getMediaRadius(cardRadius: RadiusOption): string {
  if (cardRadius === '0px') return '0px';
  if (cardRadius === '12px') return '8px';
  return '14px';
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
