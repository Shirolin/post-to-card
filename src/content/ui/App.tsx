import type { JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { ThreadData } from '../../types/tweet.ts';
import type { CardConfig } from '../../types/card.ts';
import { DEFAULT_CARD_CONFIG, THEMES } from './themes.ts';
import { loadUserPreferences, saveUserPreferences } from '../prefs.ts';
import { setInjectedButtonVisibility } from '../adapter/injection.ts';
import { Card } from './Card.tsx';
import { Controls } from './Controls.tsx';
import { Modal } from './Modal.tsx';
import { handleRadioKeyDown } from './radioGroup.ts';
import { threadScope, toggleExcluded } from './threadScope.ts';
import type { ExportAction, ExportOutcome } from '../engine/index.ts';

import { getTranslation, sanitizeLocale } from '../i18n.ts';

const ZOOM_LEVELS = [0.5, 0.75, 1] as const;

/** The card's own width, mirrored from card.css. */
const CARD_WIDTH = 640;

/**
 * Horizontal breathing room the viewport reserves on each side. Mirrors the
 * `.preview-viewport` padding, and drops to zero on the narrow layout where the
 * stage runs edge to edge.
 */
function viewportHorizontalPadding(width: number): number {
  return width <= 900 ? 12 : 24;
}

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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState<number>(1);

  const t = getTranslation(sanitizeLocale(config.locale));

  /**
   * Fits the card to the viewport when the user's zoom would otherwise push it
   * past the edge.
   *
   * The card is a fixed 640px so exports stay pixel-exact, which is wider than
   * a phone. Letting it overflow relied on the user discovering a horizontal
   * scroll they cannot see (the mobile scrollbar is hidden), so the preview
   * scales down instead. The clamp is a ceiling rather than a floor: a zoom the
   * user picked is never exceeded, so shrinking is reachable but the card can
   * still be panned at 100% on a viewport wide enough to want it.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const padding = viewportHorizontalPadding(window.innerWidth);
      const available = viewport.clientWidth - padding * 2;
      if (available <= 0) return;
      setFitScale(available / CARD_WIDTH);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [zoom]);

  /**
   * Returns the preview to the card's origin whenever its geometry changes.
   *
   * A preserved scroll offset is only meaningful while the card keeps the same
   * shape: after a zoom or a theme change the card can be smaller than the
   * offset, leaving its left edge off-screen behind a scroll the user never
   * asked for.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollLeft = 0;
  }, [zoom, config.theme]);

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
    handleConfigChange({ ...config, excludedTweetIds: toggleExcluded(threadData, config.excludedTweetIds, tweetId) });
  };

  // The card never renders empty — Card substitutes a fallback tweet — so the
  // summary never says zero.
  const activeTweetCount = scope.activeCount || 1;

  /**
   * Which zoom level carries the group's single tab stop.
   *
   * The roving-tabindex contract wants exactly one, and it must not be a
   * disabled button or the picker drops out of the tab order. The active level
   * is preferred; when the fitted scale has disabled it, the first level still
   * within reach takes over.
   */
  const zoomTabStopIndex = (() => {
    const isReachable = (idx: number) => ZOOM_LEVELS[idx] <= fitScale + 0.001;
    if (isReachable(zoomIndex)) return zoomIndex;
    const found = ZOOM_LEVELS.findIndex((_, idx) => isReachable(idx));
    return found >= 0 ? found : zoomIndex;
  })();

  return (
    <Modal
      onClose={onClose}
      locale={config.locale}
      summary={`${t.previewSummary.replace('{count}', String(activeTweetCount))}`}
    >
      <div class="preview-stage">
        {/* Hidden when the window cannot show even the smallest level: at that
            point every choice resolves to the same fitted scale, so the
            control would be a row of dead buttons. */}
        <div
          class="preview-toolbar"
          role="group"
          aria-label={t.zoomLabel}
          hidden={fitScale < ZOOM_LEVELS[0]}
        >
          <span class="preview-toolbar-label">{t.zoomLabel}</span>
          <div class="btn-group btn-group-compact" role="radiogroup" aria-label={t.zoomLabel}>
            {ZOOM_LEVELS.map((level, idx) => {
              // A level above the fitted scale cannot be shown: the card would
              // run past the stage edge behind a scrollbar the mobile shell
              // hides. Such a level is disabled rather than silently ignored.
              const isCapped = level > fitScale + 0.001;
              const isActive = idx === zoomIndex;
              const isTabStop = idx === zoomTabStopIndex;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  disabled={isCapped}
                  tabIndex={isTabStop ? 0 : -1}
                  class={`btn-group-item ${isActive && !isCapped ? 'is-active' : ''}`}
                  title={isCapped ? t.zoomFitCapped : undefined}
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
              );
            })}
          </div>
        </div>
        <div
          class="preview-viewport"
          ref={viewportRef}
          style={{ '--ptc-preview-canvas': THEMES[config.theme].tokens.canvas }}
        >
          <div
            class="preview-scale"
            style={{ zoom: `${Math.min(zoom, fitScale)}` }}
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
