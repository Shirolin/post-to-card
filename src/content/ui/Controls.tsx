import type { JSX } from 'preact';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../../types/card';
import { THEMES, PADDING_OPTIONS, RADIUS_OPTIONS, ASPECT_RATIO_OPTIONS } from './themes';
import { getTranslation } from '../i18n';
import {
  Languages,
  Palette,
  Maximize2,
  Scaling,
  Space,
  Square,
  SlidersHorizontal,
  Copy,
  Download,
} from 'lucide-preact';

export interface ControlsProps {
  config: CardConfig;
  onChange: (newConfig: CardConfig) => void;
  onExportCopy: () => void;
  onExportDownload: () => void;
  isExporting?: boolean;
  statusMessage?: string;
  isErrorStatus?: boolean;
}

export function Controls({
  config,
  onChange,
  onExportCopy,
  onExportDownload,
  isExporting = false,
  statusMessage = '',
  isErrorStatus = false,
}: ControlsProps): JSX.Element {
  const t = getTranslation(config.locale || 'en-US');

  const updateConfig = (patch: Partial<CardConfig>) => {
    onChange({ ...config, ...patch });
  };

  const themeList = Object.values(THEMES);

  const getThemeDisplayName = (themeId: string, defaultName: string) => {
    const key = `theme_${themeId.replace(/-/g, '_')}` as keyof typeof t;
    return (t[key] as string) || defaultName;
  };

  return (
    <div class="controls-panel">
      {/* 0. Language Selector */}
      <div class="control-section">
        <span class="control-label">
          <Languages size={14} strokeWidth={2} />
          <span>{t.language}</span>
        </span>
        <div class="btn-group">
          <button
            type="button"
            class={`btn-group-item ${config.locale === 'zh-CN' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ locale: 'zh-CN' })}
          >
            中文
          </button>
          <button
            type="button"
            class={`btn-group-item ${config.locale === 'en-US' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ locale: 'en-US' })}
          >
            English
          </button>
        </div>
      </div>

      {/* 1. Theme Picker */}
      <div class="control-section">
        <span class="control-label">
          <Palette size={14} strokeWidth={2} />
          <span>{t.theme}</span>
        </span>
        <div class="theme-grid">
          {themeList.map((th) => {
            const isActive = config.theme === th.id;
            const displayName = getThemeDisplayName(th.id, th.name);
            return (
              <button
                key={th.id}
                type="button"
                class={`theme-button ${isActive ? 'is-active' : ''}`}
                onClick={() => updateConfig({ theme: th.id as ThemeId })}
                title={displayName}
              >
                <div
                  class="theme-swatch"
                  style={{ background: th.preview }}
                />
                <span>{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Aspect Ratio */}
      <div class="control-section">
        <span class="control-label">
          <Maximize2 size={14} strokeWidth={2} />
          <span>{t.aspectRatio}</span>
        </span>
        <div class="btn-group">
          {ASPECT_RATIO_OPTIONS.map((ratio) => {
            const isActive = config.aspectRatio === ratio;
            return (
              <button
                key={ratio}
                type="button"
                class={`btn-group-item ${isActive ? 'is-active' : ''}`}
                onClick={() => updateConfig({ aspectRatio: ratio as AspectRatioOption })}
              >
                {ratio === 'auto' ? 'Auto' : ratio}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2.5 Image Fit (Contain vs Cover) */}
      <div class="control-section">
        <span class="control-label">
          <Scaling size={14} strokeWidth={2} />
          <span>{t.imageFit}</span>
        </span>
        <div class="btn-group">
          <button
            type="button"
            class={`btn-group-item ${(config.imageFit || 'contain') === 'contain' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ imageFit: 'contain' })}
            title={t.fitContain}
          >
            {t.fitContain}
          </button>
          <button
            type="button"
            class={`btn-group-item ${config.imageFit === 'cover' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ imageFit: 'cover' })}
            title={t.fitCover}
          >
            {t.fitCover}
          </button>
        </div>
      </div>

      {/* 3. Padding */}
      <div class="control-section">
        <span class="control-label">
          <Space size={14} strokeWidth={2} />
          <span>{t.padding}</span>
        </span>
        <div class="btn-group">
          {PADDING_OPTIONS.map((p) => {
            const isActive = config.padding === p;
            const label = p === '16px' ? '16px' : p === '32px' ? '32px' : '48px';
            return (
              <button
                key={p}
                type="button"
                class={`btn-group-item ${isActive ? 'is-active' : ''}`}
                onClick={() => updateConfig({ padding: p as PaddingOption })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Border Radius */}
      <div class="control-section">
        <span class="control-label">
          <Square size={14} strokeWidth={2} />
          <span>{t.borderRadius}</span>
        </span>
        <div class="btn-group">
          {RADIUS_OPTIONS.map((r) => {
            const isActive = config.borderRadius === r;
            const label = r === '0px' ? '0px' : r === '12px' ? '12px' : '20px';
            return (
              <button
                key={r}
                type="button"
                class={`btn-group-item ${isActive ? 'is-active' : ''}`}
                onClick={() => updateConfig({ borderRadius: r as RadiusOption })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Feature Toggles */}
      <div class="control-section">
        <span class="control-label">
          <SlidersHorizontal size={14} strokeWidth={2} />
          <span>{t.elementsAndPrivacy}</span>
        </span>
        <div class="toggles-list">
          {/* QR Code */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showQrCode: !config.showQrCode })}
          >
            <span class="toggle-title">{t.qrCode}</span>
            <div class={`toggle-switch ${config.showQrCode ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>

          {/* Stats */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showStats: !config.showStats })}
          >
            <span class="toggle-title">{t.metricsAndStats}</span>
            <div class={`toggle-switch ${config.showStats ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>

          {/* Timestamp */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showTimestamp: !config.showTimestamp })}
          >
            <span class="toggle-title">{t.timestamp}</span>
            <div class={`toggle-switch ${config.showTimestamp ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>

          {/* Watermark */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showWatermark: !config.showWatermark })}
          >
            <span class="toggle-title">{t.watermark}</span>
            <div class={`toggle-switch ${config.showWatermark ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>

          {/* Author Privacy Blur */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ blurAuthor: !config.blurAuthor })}
          >
            <span class="toggle-title">{t.blurAuthor}</span>
            <div class={`toggle-switch ${config.blurAuthor ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. Export Actions */}
      <div class="export-actions">
        {statusMessage && (
          <div class={`status-message ${isErrorStatus ? 'is-error' : ''}`}>
            {statusMessage}
          </div>
        )}

        <button
          type="button"
          class="btn-primary"
          onClick={onExportCopy}
          disabled={isExporting}
        >
          <Copy size={16} strokeWidth={2} />
          <span>{isExporting ? t.exporting : t.copyImage}</span>
        </button>

        <button
          type="button"
          class="btn-secondary"
          onClick={onExportDownload}
          disabled={isExporting}
        >
          <Download size={16} strokeWidth={2} />
          <span>{t.downloadPng}</span>
        </button>
      </div>
    </div>
  );
}
