import type { JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ThreadData } from '../../types/tweet.ts';
import type { CardConfig } from '../../types/card.ts';
import { DEFAULT_CARD_CONFIG, THEMES, loadUserPreferences, saveUserPreferences } from './themes.ts';
import { setInjectedButtonVisibility } from '../adapter/injection.ts';
import { Card } from './Card.tsx';
import { Controls } from './Controls.tsx';
import { Modal } from './Modal.tsx';
import { handleRadioKeyDown } from './radioGroup.ts';
import { threadScope } from './threadScope.ts';
import type { ExportAction, ExportOutcome } from '../engine/index.ts';

import { getTranslation, sanitizeLocale } from '../i18n.ts';

const ZOOM_LEVELS = [0.5, 0.75, 1] as const;

export interface AppProps {
  threadData: ThreadData;
  onClose: () => void;
  onExport?: (target: HTMLElement, action: ExportAction) => Promise<ExportOutcome>;
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

  const handleExport = async (action: ExportAction) => {
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
      // The message follows the outcome, not the button that was pressed. A
      // clipboard that refuses is not a failure the user caused, but it is also
      // not a copy -- so it gets its own wording rather than "copied".
      if (onExport) {
        const outcome = await onExport(target, action);
        setIsErrorStatus(!outcome.success);
        if (!outcome.success) {
          setStatusMessage(
            outcome.error ? `${t.exportFailed}: ${outcome.error}` : t.exportFailed
          );
        } else if (outcome.method === 'clipboard') {
          setStatusMessage(t.copiedSuccess);
        } else {
          setStatusMessage(
            action === 'copy' ? t.clipboardFallbackNotice : t.downloadSuccess
          );
        }
      }
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
