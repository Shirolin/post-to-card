import type { JSX } from 'preact';
import type { ThreadData } from '../../types/tweet';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, AspectRatioOption } from '../../types/card';
import { THEMES, THEME_ORDER, EXPERIMENTAL_THEMES, PADDING_OPTIONS, RADIUS_OPTIONS } from './themes';
import { getTranslation, sanitizeLocale } from '../i18n';
import { useId, useState } from 'preact/hooks';
import { handleRadioKeyDown } from './radioGroup';
import { threadScope, tweetKey } from './threadScope';
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
  ChevronDown,
  Check,
  LayoutGrid,
} from 'lucide-preact';

interface AspectOption {
  value: AspectRatioOption;
  label: string;
}

const ASPECT_OPTIONS: AspectOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
];

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

interface ToggleSpec {
  key: keyof CardConfig;
  label: string;
}

/**
 * Segmented single-choice control. Rendered as a radio group so keyboard users
 * get arrow-key navigation and screen readers announce the selection state.
 */
function Segmented<T extends string>({
  name,
  options,
  value,
  onSelect,
  labels,
  titles,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onSelect: (next: T) => void;
  /** Display text when the raw option value is not user-facing (e.g. locale codes). */
  labels?: Record<string, string>;
  titles?: Record<string, string>;
}): JSX.Element {
  return (
    <div class="btn-group" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            class={`btn-group-item ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelect(opt)}
            onKeyDown={(e) => handleRadioKeyDown(e, options, value, onSelect)}
            title={titles?.[opt]}
          >
            {labels?.[opt] || opt}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      class="toggle-item"
      onClick={onToggle}
    >
      <span class="toggle-title">{label}</span>
      <span class={`toggle-switch ${checked ? 'is-checked' : ''}`} aria-hidden="true">
        <span class="toggle-thumb" />
      </span>
    </button>
  );
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
  const t = getTranslation(sanitizeLocale(config.locale));
  const [showMore, setShowMore] = useState<boolean>(false);
  const moreId = useId();

  const updateConfig = (patch: Partial<CardConfig>) => {
    onChange({ ...config, ...patch });
  };

  // Brutalist is deliberately experimental, so it is not in the main rotation.
  // It only joins the picker once the user opens "More", or when it is already
  // the active theme (otherwise a saved Brutalist config would show no
  // selection at all).
  const themeList = THEME_ORDER.map((id) => THEMES[id]);
  const visibleThemes = themeList.filter(
    (th) => !EXPERIMENTAL_THEMES.has(th.id) || showMore || config.theme === th.id
  );

  const getThemeDisplayName = (themeId: string, defaultName: string) => {
    const key = `theme_${themeId.replace(/-/g, '_')}` as keyof typeof t;
    return (t[key] as string) || defaultName;
  };

  // The same scope the card renders from, so the counts here and the buttons on
  // the card cannot disagree about what may still be dropped.
  const { excluded, activeCount, totalCount, canExcludeMore } = threadScope(
    threadData,
    config.excludedTweetIds
  );
  const totalTweets = totalCount;

  const handleToggleExclude = (key: string) => {
    const nextSet = new Set(excluded);
    if (nextSet.has(key)) {
      nextSet.delete(key);
    } else if (canExcludeMore) {
      nextSet.add(key);
    }
    updateConfig({ excludedTweetIds: Array.from(nextSet) });
  };

  const handleSelectAll = () => {
    updateConfig({ excludedTweetIds: [] });
  };

  const targetKey = threadData
    ? tweetKey(threadData.tweets[threadData.targetTweetIndex ?? 0], threadData.targetTweetIndex ?? 0)
    : '';

  const handleSelectCurrentOnly = () => {
    if (!threadData) return;
    const targetIdx = threadData.targetTweetIndex ?? 0;
    const key = tweetKey(threadData.tweets[targetIdx], targetIdx);
    const toExclude = threadData.tweets
      .map((item, idx) => tweetKey(item, idx))
      .filter((k) => k !== key);
    updateConfig({ excludedTweetIds: toExclude });
  };

  const toggles: ToggleSpec[] = [
    { key: 'showQrCode', label: t.qrCode },
    { key: 'showStats', label: t.metricsAndStats },
    { key: 'showTimestamp', label: t.timestamp },
    { key: 'showWatermark', label: t.watermark },
    { key: 'blurAuthor', label: t.blurAuthor },
  ];

  return (
    <div class="controls-panel">
      <div class="controls-scroll">
        {/* 1. Thread scope — highest-value control when a thread is open */}
        {threadData && totalTweets > 1 && (
          <section class="control-section tweet-manager-section">
            <div class="control-section-header">
              <span class="control-label">
                <ListFilter size={14} strokeWidth={2} />
                <span>{t.manageTweets}</span>
                <span class="control-count">{activeCount}/{totalTweets}</span>
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
                  disabled={!canExcludeMore && !excluded.has(targetKey)}
                >
                  {t.selectCurrentOnly}
                </button>
              </div>
            </div>
            <div class="tweet-manager-list" role="group" aria-label={t.manageTweets}>
              {threadData.tweets.map((tweet, idx) => {
                const key = tweetKey(tweet, idx);
                const isExcluded = excluded.has(key);
                const isTarget = idx === (threadData.targetTweetIndex ?? 0);
                const trimmedText = tweet.text ? tweet.text.replace(/\s+/g, ' ').trim() : '';
                const snippet = trimmedText ? trimmedText.slice(0, 30) : t.mediaOnlyTweet;
                const hasMedia = tweet.media && tweet.media.length > 0;
                const isOnlyOneActive = !canExcludeMore && !isExcluded;

                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={!isExcluded}
                    disabled={isOnlyOneActive}
                    class={`tweet-manager-item ${isExcluded ? 'is-excluded' : 'is-included'} ${isTarget ? 'is-target' : ''}`}
                    onClick={() => !isOnlyOneActive && handleToggleExclude(key)}
                    title={isOnlyOneActive ? t.selectCurrentOnly : (isExcluded ? t.selectAll : t.excludeThisTweet)}
                  >
                    <span class={`tweet-checkbox ${!isExcluded ? 'is-checked' : ''}`} aria-hidden="true">
                      {!isExcluded && (
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span class="tweet-index-badge">#{idx + 1}</span>
                    <span class="tweet-snippet">{snippet}{trimmedText.length > 30 ? '…' : ''}</span>
                    {hasMedia && (
                      <span class="tweet-media-indicator" aria-hidden="true">
                        <LayoutGrid size={10} strokeWidth={2} />
                        {tweet.media!.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. Theme — the single most impactful visual choice */}
        <section class="control-section">
          <span class="control-label">
            <Palette size={14} strokeWidth={2} />
            <span>{t.theme}</span>
          </span>
          <div class="theme-grid" role="radiogroup" aria-label={t.theme}>
            {visibleThemes.map((th) => {
              const isActive = config.theme === th.id;
              const displayName = getThemeDisplayName(th.id, th.name);
              return (
                <button
                  key={th.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  class={`theme-button ${isActive ? 'is-active' : ''}`}
                  onClick={() => updateConfig({ theme: th.id as ThemeId })}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      visibleThemes.map((item) => item.id as ThemeId),
                      config.theme,
                      (next) => updateConfig({ theme: next })
                    )
                  }
                  title={displayName}
                >
                  <span class="theme-swatch" style={{ background: th.preview }} aria-hidden="true">
                    {isActive && (
                      <span class="theme-swatch-check">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span class="theme-button-label">{displayName}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Aspect ratio */}
        <section class="control-section">
          <span class="control-label">
            <Maximize2 size={14} strokeWidth={2} />
            <span>{t.aspectRatio}</span>
          </span>
          <div class="btn-group" role="radiogroup" aria-label={t.aspectRatio}>
            {ASPECT_OPTIONS.map((opt) => {
              const isActive = config.aspectRatio === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  class={`btn-group-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => updateConfig({ aspectRatio: opt.value })}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ASPECT_OPTIONS.map((item) => item.value),
                      config.aspectRatio,
                      (next) => updateConfig({ aspectRatio: next })
                    )
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Element toggles */}
        <section class="control-section">
          <span class="control-label">
            <SlidersHorizontal size={14} strokeWidth={2} />
            <span>{t.elementsAndPrivacy}</span>
          </span>
          <div class="toggles-list">
            {toggles.map((item) => (
              <Toggle
                key={String(item.key)}
                label={item.label}
                checked={Boolean(config[item.key])}
                onToggle={() => updateConfig({ [item.key]: !config[item.key] } as Partial<CardConfig>)}
              />
            ))}
            <Toggle
              label={t.tweetActionButton}
              checked={config.showActionBarButton !== false}
              onToggle={() => updateConfig({ showActionBarButton: config.showActionBarButton === false })}
            />
            <Toggle
              label={t.videoPlayButton}
              checked={config.showPlayButton !== false}
              onToggle={() => updateConfig({ showPlayButton: config.showPlayButton === false })}
            />
          </div>
        </section>

        {/* 5. Collapsible low-frequency settings */}
        <section class="control-section more-section">
          <button
            type="button"
            class="more-toggle"
            aria-expanded={showMore}
            aria-controls={moreId}
            onClick={() => setShowMore((v) => !v)}
          >
            <ChevronDown size={15} strokeWidth={2} class={`more-chevron ${showMore ? 'is-open' : ''}`} aria-hidden="true" />
            <span>{showMore ? t.lessSettings : t.moreSettings}</span>
          </button>

          <div id={moreId} class="more-body" hidden={!showMore}>
            <div class="control-section">
              <span class="control-label">
                <Languages size={14} strokeWidth={2} />
                <span>{t.language}</span>
              </span>
              <Segmented
                name={t.language}
                options={['zh-CN', 'en-US'] as const}
                value={sanitizeLocale(config.locale)}
                onSelect={(next) => updateConfig({ locale: next })}
                labels={{ 'zh-CN': '中文', 'en-US': 'English' }}
              />
            </div>

            <div class="control-section">
              <span class="control-label">
                <Scaling size={14} strokeWidth={2} />
                <span>{t.imageFit}</span>
              </span>
              <Segmented
                name={t.imageFit}
                options={['contain', 'cover'] as const}
                value={(config.imageFit || 'contain') as 'contain' | 'cover'}
                onSelect={(next) => updateConfig({ imageFit: next })}
                labels={{ contain: t.fitContain, cover: t.fitCover }}
                titles={{ contain: t.fitContain, cover: t.fitCover }}
              />
            </div>

            <div class="control-section">
              <span class="control-label">
                <LayoutGrid size={14} strokeWidth={2} />
                <span>{t.mediaLayout}</span>
              </span>
              <Segmented
                name={t.mediaLayout}
                options={['grid', 'stack'] as const}
                value={(config.mediaLayout || 'grid') as 'grid' | 'stack'}
                onSelect={(next) => updateConfig({ mediaLayout: next })}
                labels={{ grid: t.layoutGrid, stack: t.layoutStack }}
                titles={{ grid: t.layoutGrid, stack: t.layoutStack }}
              />
            </div>

            <div class="control-section">
              <span class="control-label">
                <Space size={14} strokeWidth={2} />
                <span>{t.padding}</span>
              </span>
              <Segmented
                name={t.padding}
                options={PADDING_OPTIONS}
                value={config.padding}
                onSelect={(next) => updateConfig({ padding: next as PaddingOption })}
              />
            </div>

            <div class="control-section">
              <span class="control-label">
                <Square size={14} strokeWidth={2} />
                <span>{t.borderRadius}</span>
              </span>
              <Segmented
                name={t.borderRadius}
                options={RADIUS_OPTIONS}
                value={config.borderRadius}
                onSelect={(next) => updateConfig({ borderRadius: next as RadiusOption })}
                labels={{ theme: t.borderRadiusFollowTheme }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Sticky primary action bar — always reachable regardless of scroll position */}
      <div class="export-actions">
        <div class="status-region" role="status" aria-live="polite">
          {statusMessage && (
            <div class={`status-message ${isErrorStatus ? 'is-error' : ''}`}>
              {statusMessage}
            </div>
          )}
        </div>
        <div class="export-buttons">
          <button
            type="button"
            class="btn-primary"
            onClick={onExportCopy}
            disabled={isExporting}
          >
            {isExporting
              ? <span class="spinner" aria-hidden="true" />
              : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
            <span>{isExporting ? t.exporting : t.copyImage}</span>
          </button>
          <button
            type="button"
            class="btn-secondary"
            onClick={onExportDownload}
            disabled={isExporting}
            aria-label={t.downloadPng}
            title={t.downloadPng}
          >
            <Download size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
