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
import { DEFAULT_EXPORT_SCALE } from '../engine/index.ts';

import { getTranslation, sanitizeLocale } from '../i18n.ts';

/**
 * Zoom levels the preview offers.
 *
 * The numbers are fixed fractions of the card's own 640px width, so they mean the
 * same thing on every screen and a chosen level survives a window resize. `fit` is
 * the exception: it is resolved per render against the card's measured height, so
 * it shows the whole card at whatever scale the window turns out to allow. It
 * leads the list because it is the only level that stays useful on a phone, where
 * the fixed levels are all capped away.
 */
const ZOOM_LEVELS = ['fit', 0.5, 0.75, 1] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/** The percentage levels, smallest first. Read where `fit` must be excluded. */
const FIXED_ZOOM_LEVELS = [0.5, 0.75, 1] as const;
type FixedZoomLevel = (typeof FIXED_ZOOM_LEVELS)[number];

/** The card's own width, mirrored from card.css. */
const CARD_WIDTH = 640;

function isFixedLevel(level: ZoomLevel): level is FixedZoomLevel {
  return typeof level === 'number';
}

/**
 * Breathing room the viewport reserves on each side. Mirrors the
 * `.preview-viewport` padding, which is uniform on both axes and trims on the
 * narrow layout where the stage has to give the card every pixel it can get.
 */
function viewportPadding(width: number): number {
  return width <= 900 ? 12 : 24;
}

export interface AppProps {
  threadData: ThreadData;
  onClose: () => void;
  onExport?: (target: HTMLElement, action: ExportAction) => Promise<ExportOutcome>;
  /**
   * Replaces the stored preferences for one mount, and skips reading them.
   *
   * Exists for the dev harness, so a review state can be reached from a URL
   * (`?modal=1&theme=terminal&ratio=3:4`) instead of by clicking through the
   * panel. Skipping the read rather than racing it is the point: storage resolves
   * asynchronously, so an override that only set the initial state would be
   * overwritten a tick later and the URL would silently mean nothing.
   *
   * Undefined in the extension, where the stored preferences are the only source.
   */
  initialConfig?: CardConfig;
}

export function App({ threadData, onClose, onExport, initialConfig }: AppProps): JSX.Element {
  const [config, setConfig] = useState<CardConfig>(initialConfig ?? DEFAULT_CARD_CONFIG);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isErrorStatus, setIsErrorStatus] = useState<boolean>(false);
  // Preview-only scale. The export captures a copy of the card outside this
  // zoom (see mountUnzoomedCopy in engine/export.ts), so exported dimensions
  // stay at the fixed 640px card width.
  const [zoomIndex, setZoomIndex] = useState<number>(ZOOM_LEVELS.length - 1);
  const level = ZOOM_LEVELS[zoomIndex];
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The card's height at scale 1. Zero until the first measurement, which leaves
  // the height axis out of `fit` for a frame rather than guessing at it.
  const [cardHeight, setCardHeight] = useState<number>(0);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [availableHeight, setAvailableHeight] = useState<number>(0);

  /**
   * The ceiling on the *fixed* levels: the card must never run past the mat
   * sideways, and a user who picks 100% on a tall card accepts scrolling.
   */
  const maxScale = availableWidth > 0 ? availableWidth / CARD_WIDTH : 1;

  /**
   * The scale `fit` resolves to: the whole card has to clear the mat in both
   * axes, so this is the smaller of the two.
   */
  const fitScale = cardHeight > 0 ? Math.min(maxScale, availableHeight / cardHeight) : maxScale;

  const zoom = isFixedLevel(level) ? Math.min(level, maxScale) : fitScale;

  /**
   * The exported PNG's pixel size, or null until the card has been measured.
   *
   * The export captures an unzoomed copy at the card's own 640px width and
   * rasterizes it at the engine's default scale, so this is the figure that lands
   * on the clipboard. It has nothing to do with the preview's zoom: a long thread
   * on a phone can look tiny here and still export at full width.
   */
  const exportSize =
    cardHeight > 0
      ? {
          width: Math.round(CARD_WIDTH * DEFAULT_EXPORT_SCALE),
          height: Math.round(cardHeight * DEFAULT_EXPORT_SCALE),
        }
      : null;

  const t = getTranslation(sanitizeLocale(config.locale));

  /**
   * Measures what the stage can show: the mat's own box, and the card's height at
   * scale 1.
   *
   * The width half is a hard ceiling -- the card is a fixed 640px so exports stay
   * pixel-exact, which is wider than a phone, and letting it overflow relied on
   * the user discovering a horizontal scroll they cannot see (the mobile
   * scrollbar is hidden). The clamp is a ceiling rather than a floor: a zoom the
   * user picked is never exceeded, so shrinking is reachable but the card can
   * still be panned at 100% on a viewport wide enough to want it.
   *
   * The height half only feeds `fit`. Capping the fixed levels by it would be a
   * regression: picking 100% on a tall card is a deliberate choice to read it at
   * full size and scroll, not a scale the window is allowed to refuse.
   *
   * The card is read with `offsetHeight`, not `getBoundingClientRect`. The rect
   * is the right box for a pixel comparison and the wrong one here for two
   * reasons: it arrives multiplied by the preview's `zoom`, and it also carries
   * any transform on an ancestor. The dialog animates in with
   * `transform: scale(0.975)`, so a measurement taken during that animation came
   * back 2.5% short and stayed wrong -- a transform does not change layout, so the
   * observer never fired again to correct it, and the error was non-deterministic
   * because it depended on whether the animation had finished. `offsetHeight` is
   * the border box in layout pixels, free of both.
   *
   * The card's own observer covers every content change -- a theme, a different
   * tweet set, an image settling into the grid -- so this effect does not need the
   * config in its dependencies.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const padding = viewportPadding(window.innerWidth);
      const width = viewport.clientWidth - padding * 2;
      const height = viewport.clientHeight - padding * 2;
      // Guarded against the no-op update: the observer fires on the card's own
      // resize, which the zoom change also causes, and re-rendering for an
      // unchanged number would loop.
      if (width > 0) setAvailableWidth((prev) => (Math.abs(prev - width) > 0.5 ? width : prev));
      if (height > 0) setAvailableHeight((prev) => (Math.abs(prev - height) > 0.5 ? height : prev));

      const card = cardRef.current;
      if (!card) return;
      const natural = card.offsetHeight;
      if (natural > 0) setCardHeight((prev) => (Math.abs(prev - natural) > 0.5 ? natural : prev));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

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

  // Load saved preferences on mount, unless the caller supplied a state to review.
  useEffect(() => {
    if (initialConfig) return;
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
    // Mount-only by intent: `initialConfig` is a harness override that must not be
    // re-read, and reading it as a dependency would re-run the effect whenever the
    // caller passed a fresh object literal.
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
   * within reach takes over. `fit` is never disabled, so it is always a valid
   * fallback -- and it leads the list, which makes it the one the Home key lands
   * on and the one ArrowLeft reaches from 50%.
   */
  const zoomTabStopIndex = (() => {
    const isReachable = (idx: number) => {
      const candidate = ZOOM_LEVELS[idx];
      return !isFixedLevel(candidate) || candidate <= maxScale + 0.001;
    };
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
        {/* Hidden when the window cannot show even the smallest fixed level: at
            that point every percentage resolves to the same fitted scale, so the
            control would be a row of dead buttons. `fit` is exempt from the
            reasoning -- it is the only live choice left there, so the toolbar
            earns its place by showing it. */}
        <div
          class="preview-toolbar"
          role="group"
          aria-label={t.zoomLabel}
          hidden={maxScale < FIXED_ZOOM_LEVELS[0]}
        >
          <span class="preview-toolbar-label">{t.zoomLabel}</span>
          <div class="btn-group btn-group-compact" role="radiogroup" aria-label={t.zoomLabel}>
            {ZOOM_LEVELS.map((candidate, idx) => {
              // A percentage above the fitted scale cannot be shown: the card
              // would run past the stage edge behind a scrollbar the mobile
              // shell hides. Such a level is disabled rather than silently
              // ignored. `fit` is never capped -- it is defined by the stage.
              const isCapped = isFixedLevel(candidate) && candidate > maxScale + 0.001;
              const isActive = idx === zoomIndex;
              const isTabStop = idx === zoomTabStopIndex;
              return (
                <button
                  key={candidate}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  disabled={isCapped}
                  tabIndex={isTabStop ? 0 : -1}
                  class={`btn-group-item ${isActive && !isCapped ? 'is-active' : ''}`}
                  title={isCapped ? t.zoomFitCapped : isFixedLevel(candidate) ? undefined : t.zoomFitHint}
                  onClick={() => setZoomIndex(idx)}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ZOOM_LEVELS,
                      level,
                      (next) => setZoomIndex(ZOOM_LEVELS.indexOf(next))
                    )
                  }
                >
                  {isFixedLevel(candidate) ? `${Math.round(candidate * 100)}%` : t.zoomFit}
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
            style={{ zoom: `${zoom}` }}
            data-html2canvas-ignore="true"
          >
            <Card
              data={threadData}
              config={config}
              onExcludeTweet={handleExcludeTweet}
              cardRef={cardRef}
            />
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
        exportSize={exportSize}
      />
    </Modal>
  );
}
