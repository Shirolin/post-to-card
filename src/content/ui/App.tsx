import type { JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ThreadData } from '../../types/tweet';
import type { CardConfig } from '../../types/card';
import { DEFAULT_CARD_CONFIG, THEMES, loadUserPreferences, saveUserPreferences } from './themes';
import { setInjectedButtonVisibility } from '../adapter/injection';
import { Card } from './Card';
import { Controls } from './Controls';
import { Modal } from './Modal';
import { handleRadioKeyDown } from './radioGroup';
import { threadScope } from './threadScope';

import type { Locale } from '../../types/card';
import { getTranslation, sanitizeLocale } from '../i18n';

const ZOOM_LEVELS = [0.5, 0.75, 1] as const;

export interface AppProps {
  threadData: ThreadData;
  onClose: () => void;
  onExport?: (target: HTMLElement, scale: number, action: 'copy' | 'download', locale?: Locale) => Promise<void>;
}

export function App({ threadData, onClose, onExport }: AppProps): JSX.Element {
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CARD_CONFIG);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isErrorStatus, setIsErrorStatus] = useState<boolean>(false);
  // Preview-only scale. Never applied to the export target, so exported
  // dimensions stay at the fixed 640px card width.
  const [zoomIndex, setZoomIndex] = useState<number>(ZOOM_LEVELS.length - 1);
  const zoom = ZOOM_LEVELS[zoomIndex];

  const t = getTranslation(sanitizeLocale(config.locale));

  // Load saved preferences on mount
  useEffect(() => {
    let mounted = true;
    loadUserPreferences().then((saved) => {
      if (mounted) {
        setConfig(saved);
        setInjectedButtonVisibility(saved.showActionBarButton !== false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleConfigChange = (newConfig: CardConfig) => {
    setConfig(newConfig);
    setInjectedButtonVisibility(newConfig.showActionBarButton !== false);
    saveUserPreferences(newConfig).catch(() => {});
  };

  const getExportTarget = (): HTMLElement | null => {
    // Look inside Shadow DOM or document
    const container = document.querySelector('post-to-card-container');
    if (container && container.shadowRoot) {
      const target = container.shadowRoot.querySelector('#post-to-card-export-target');
      if (target) return target as HTMLElement;
    }
    return document.querySelector('#post-to-card-export-target') as HTMLElement | null;
  };

  const handleExport = async (action: 'copy' | 'download') => {
    const target = getExportTarget();
    if (!target) {
      setStatusMessage(t.targetNotFound);
      setIsErrorStatus(true);
      return;
    }

    setIsExporting(true);
    setStatusMessage(action === 'copy' ? t.copying : t.generatingPng);
    setIsErrorStatus(false);

    try {
      if (onExport) {
        await onExport(target, 2, action, config.locale);
      }
      setStatusMessage(action === 'copy' ? t.copiedSuccess : t.downloadSuccess);
      setTimeout(() => setStatusMessage(''), 2500);
    } catch (err: unknown) {
      console.error('[Post-to-Card] Export error:', err);
      const msg = err instanceof Error ? err.message : t.exportFailed;
      setStatusMessage(msg);
      setIsErrorStatus(true);
      setTimeout(() => setStatusMessage(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // One scope answers both questions this surface asks: what the card shows,
  // and whether one more tweet may be dropped. Building the next set from the
  // returned one drops any key left over from a previous thread.
  const scope = threadScope(threadData, config.excludedTweetIds);

  const handleExcludeTweet = (tweetId: string) => {
    const next = new Set(scope.excluded);
    if (next.has(tweetId)) {
      next.delete(tweetId);
    } else if (scope.canExcludeMore) {
      next.add(tweetId);
    }
    handleConfigChange({ ...config, excludedTweetIds: Array.from(next) });
  };

  // The card never renders empty — Card substitutes a fallback tweet — so the
  // summary never says zero.
  const activeTweetCount = scope.activeCount || 1;

  return (
    <Modal
      onClose={onClose}
      locale={config.locale}
      summary={`${t.previewSummary.replace('{count}', String(activeTweetCount))}`}
    >
      <div class="preview-stage">
        <div class="preview-toolbar" role="group" aria-label={t.zoomLabel}>
          <span class="preview-toolbar-label">{t.zoomLabel}</span>
          <div class="btn-group btn-group-compact" role="radiogroup" aria-label={t.zoomLabel}>
            {ZOOM_LEVELS.map((level, idx) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={idx === zoomIndex}
                tabIndex={idx === zoomIndex ? 0 : -1}
                class={`btn-group-item ${idx === zoomIndex ? 'is-active' : ''}`}
                onClick={() => setZoomIndex(idx)}
                onKeyDown={(e) =>
                  handleRadioKeyDown(
                    e,
                    ZOOM_LEVELS,
                    ZOOM_LEVELS[zoomIndex],
                    (next) => setZoomIndex(ZOOM_LEVELS.indexOf(next))
                  )
                }
              >
                {Math.round(level * 100)}%
              </button>
            ))}
          </div>
        </div>
        <div
          class="preview-viewport"
          style={{ '--ptc-preview-canvas': THEMES[config.theme].tokens.canvas }}
        >
          <div
            class="preview-scale"
            style={{ zoom: `${zoom}` }}
            data-html2canvas-ignore="true"
          >
            <Card data={threadData} config={config} onExcludeTweet={handleExcludeTweet} />
          </div>
        </div>
      </div>
      <Controls
        config={config}
        onChange={handleConfigChange}
        onExportCopy={() => handleExport('copy')}
        onExportDownload={() => handleExport('download')}
        isExporting={isExporting}
        statusMessage={statusMessage}
        isErrorStatus={isErrorStatus}
        threadData={threadData}
      />
    </Modal>
  );
}
