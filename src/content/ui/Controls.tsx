import type { JSX } from 'preact';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../../types/card';
import type { ThreadData } from '../../types/tweet';
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
  ListFilter,
} from 'lucide-preact';

export interface ControlsProps {
  config: CardConfig;
  onChange: (newConfig: CardConfig) => void;
  onExportCopy: () => void;
  onExportDownload: () => void;
  isExporting?: boolean;
  statusMessage?: string;
  isErrorStatus?: boolean;
  threadData?: ThreadData;
}

export function Controls({
  config,
  onChange,
  onExportCopy,
  onExportDownload,
  isExporting = false,
  statusMessage = '',
  isErrorStatus = false,
  threadData,
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

  const excludedSet = new Set(config.excludedTweetIds || []);
  const totalTweets = threadData?.tweets.length || 0;
  const activeCount = (totalTweets > 0 && threadData)
    ? threadData.tweets.filter((item, idx) => !excludedSet.has(item.id || String(idx))).length
    : 0;

  const handleToggleExclude = (tweetKey: string) => {
    const nextSet = new Set(excludedSet);
    if (nextSet.has(tweetKey)) {
      nextSet.delete(tweetKey);
    } else {
      if (activeCount > 1) {
        nextSet.add(tweetKey);
      }
    }
    updateConfig({ excludedTweetIds: Array.from(nextSet) });
  };

  const handleSelectAll = () => {
    updateConfig({ excludedTweetIds: [] });
  };

  const handleSelectCurrentOnly = () => {
    if (!threadData) return;
    const targetIdx = threadData.targetTweetIndex ?? 0;
    const targetKey = threadData.tweets[targetIdx]?.id || String(targetIdx);
    const toExclude = threadData.tweets
      .map((item, idx) => item.id || String(idx))
      .filter((k) => k !== targetKey);
    updateConfig({ excludedTweetIds: toExclude });
  };

  const targetKey = threadData
    ? (threadData.tweets[threadData.targetTweetIndex ?? 0]?.id || String(threadData.targetTweetIndex ?? 0))
    : '';

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

      {/* 0.5 Tweet Scope & Thread Item Manager */}
      {threadData && totalTweets > 1 && (
        <div class="control-section tweet-manager-section">
          <div class="control-section-header">
            <span class="control-label">
              <ListFilter size={14} strokeWidth={2} />
              <span>{t.manageTweets} ({activeCount}/{totalTweets})</span>
            </span>
            <div class="tweet-manager-actions">
              <button
                type="button"
                class="btn-text-action"
                onClick={handleSelectAll}
                disabled={activeCount === totalTweets}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                class="btn-text-action"
                onClick={handleSelectCurrentOnly}
                disabled={activeCount === 1 && !excludedSet.has(targetKey)}
              >
                {t.selectCurrentOnly}
              </button>
            </div>
          </div>
          <div class="tweet-manager-list">
            {threadData.tweets.map((tweet, idx) => {
              const key = tweet.id || String(idx);
              const isExcluded = excludedSet.has(key);
              const isTarget = idx === (threadData.targetTweetIndex ?? 0);
              const previewSnippet = tweet.text ? tweet.text.replace(/\s+/g, ' ').slice(0, 28) : `#${idx + 1}`;
              const hasMedia = tweet.media && tweet.media.length > 0;
              const isOnlyOneActive = activeCount === 1 && !isExcluded;

              return (
                <div
                  key={key}
                  class={`tweet-manager-item ${isExcluded ? 'is-excluded' : 'is-included'} ${isTarget ? 'is-target' : ''}`}
                  onClick={() => !isOnlyOneActive && handleToggleExclude(key)}
                  title={isOnlyOneActive ? '' : (isExcluded ? t.selectAll : t.excludeThisTweet)}
                >
                  <div class={`tweet-checkbox ${!isExcluded ? 'is-checked' : ''}`}>
                    {!isExcluded && (
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span class="tweet-index-badge">#{idx + 1}</span>
                  <span class="tweet-snippet">{previewSnippet}{tweet.text && tweet.text.length > 28 ? '...' : ''}</span>
                  {hasMedia && <span class="tweet-media-indicator">🖼️{tweet.media!.length}</span>}
                  {isExcluded && <span class="tweet-excluded-tag">{t.excludedBadge}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* 2.6 Multi-Image Layout (Grid vs Stack) */}
      <div class="control-section">
        <span class="control-label">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>{t.mediaLayout}</span>
        </span>
        <div class="btn-group">
          <button
            type="button"
            class={`btn-group-item ${(config.mediaLayout || 'grid') === 'grid' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ mediaLayout: 'grid' })}
            title={t.layoutGrid}
          >
            {t.layoutGrid}
          </button>
          <button
            type="button"
            class={`btn-group-item ${config.mediaLayout === 'stack' ? 'is-active' : ''}`}
            onClick={() => updateConfig({ mediaLayout: 'stack' })}
            title={t.layoutStack}
          >
            {t.layoutStack}
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

          {/* Tweet Action Bar Button */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showActionBarButton: config.showActionBarButton !== false ? false : true })}
          >
            <span class="toggle-title">{t.tweetActionButton}</span>
            <div class={`toggle-switch ${config.showActionBarButton !== false ? 'is-checked' : ''}`}>
              <div class="toggle-thumb" />
            </div>
          </div>

          {/* Video Play Button / Indicator on Card */}
          <div
            class="toggle-item"
            onClick={() => updateConfig({ showPlayButton: config.showPlayButton !== false ? false : true })}
          >
            <span class="toggle-title">{t.videoPlayButton}</span>
            <div class={`toggle-switch ${config.showPlayButton !== false ? 'is-checked' : ''}`}>
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
