import type { JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { ThreadData } from '../../types/tweet.ts';
import type { CardConfig } from '../../types/card.ts';
import { DEFAULT_CARD_CONFIG, THEMES } from './themes.ts';
import { loadUserPreferences, saveUserPreferences, subscribePreferences } from '../prefs.ts';
import { setInjectedButtonVisibility } from '../adapter/injection.ts';
import { Card } from './Card.tsx';
import { Controls } from './Controls.tsx';
import { Modal } from './Modal.tsx';
import { handleRadioKeyDown } from './radioGroup.ts';
import { threadScope, toggleExcluded } from './threadScope.ts';
import type { ExportAction, ExportOutcome } from '../engine/index.ts';
import { DEFAULT_EXPORT_SCALE, ExportRenderError, exportSizeFor } from '../engine/index.ts';

import { getTranslation, sanitizeLocale, formatPreviewSummary } from '../i18n.ts';

/**
 * Zoom levels the preview offers.
 *
 * The numbers are fixed fractions of the card's own 640px width, so they mean the
 * same thing on every screen and a chosen level survives a window resize. `fit` is
 * the exception: it is resolved per render against the card's measured height, so
 * it shows the whole card at whatever scale the window turns out to allow. It
 * leads the list, and is the default, because it is the only level that stays
 * useful on a phone, where the fixed levels are all capped away -- and because
 * "show me the card I just asked for" is the question a preview opens on.
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
  const [isWarningStatus, setIsWarningStatus] = useState<boolean>(false);
  /**
   * The action to re-run, if the last export is worth another attempt.
   *
   * A ref rather than a boolean because the retry must repeat the *same* action
   * the user asked for: a copy that fell back to a download should be retried
   * as a copy, not silently turned into "download again".
   */
  const retryActionRef = useRef<ExportAction | null>(null);
  const [canRetry, setCanRetry] = useState<boolean>(false);
  /** The pending "clear the status line" timer, so a new export can cancel it. */
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** False from unmount on; an in-flight export must not write after it. */
  const mountedRef = useRef<boolean>(true);
  /** Focus target when the retry button is about to be removed. */
  const exportPrimaryRef = useRef<HTMLButtonElement | null>(null);
  // Preview-only scale. The export captures a copy of the card outside this
  // zoom (see mountUnzoomedCopy in engine/export.ts), so exported dimensions
  // stay at the fixed 640px card width.
  const [zoomIndex, setZoomIndex] = useState<number>(ZOOM_LEVELS.indexOf('fit'));
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
  // The same arithmetic the exporter runs, so the figure here is the figure in
  // the file: both call `fitScaleToCanvas` with the card's 640px width, and the
  // pure function is what keeps them from drifting apart again.
  const exportSize = exportSizeFor(CARD_WIDTH, cardHeight, DEFAULT_EXPORT_SCALE);

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
   * Keeps the selected zoom on a level the stage can actually show.
   *
   * A fixed level above `maxScale` is rendered anyway, clamped to `maxScale`, so
   * leaving it selected produced three surfaces disagreeing: the radio reported
   * `aria-checked`, the button carried no active styling, and the card drew at
   * something other than the percentage on screen. Because the capped button is
   * `disabled` rather than `aria-disabled` it also leaves the tab order, so the
   * group's checked member was unreachable and undiscoverable by keyboard or
   * screen reader. That was the default state at most viewport widths, 1024x768
   * included.
   *
   * Snapping down to the largest reachable fixed level costs some preview -- 0.902
   * to 0.75 on a 1024px window, 0.558 to 0.5 on a phone -- and buys a control that
   * says what it is showing. `fit` is never capped (it is defined by the stage), so
   * a selection made there is left alone by this effect; it is also the fallback
   * when every fixed level is capped away, which is the case where the toolbar
   * hides itself.
   *
   * Runs on `maxScale` rather than once at mount, so rotating a tablet into a
   * narrower stage corrects the selection too. It does not restore the previous
   * level when space comes back: the effective view is what the user was just
   * looking at, and tracking the intent separately would be state for its own sake.
   */
  useEffect(() => {
    setZoomIndex((current) => {
      const selected = ZOOM_LEVELS[current];
      if (!isFixedLevel(selected) || selected <= maxScale + 0.001) return current;
      for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
        const candidate = ZOOM_LEVELS[i];
        if (isFixedLevel(candidate) && candidate <= maxScale + 0.001) return i;
      }
      return ZOOM_LEVELS.indexOf('fit');
    });
  }, [maxScale]);

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

    // This mount now has two sources for the same value, and they can arrive in
    // either order. The read is asynchronous, so a change can come back over the
    // subscription first -- the popup's toggle while the card is opening is
    // enough. Applying the snapshot afterwards puts the old value back, which
    // the panel's next edit then writes down as the user's own. So a value that
    // arrived by change wins, and the snapshot applies only while nothing has.
    // The same guard, for the same reason, as the triggers' own reader in
    // `adapter/injection.ts`.
    let preferenceChangedSinceLoad = false;

    loadUserPreferences().then((saved) => {
      if (mounted && !preferenceChangedSinceLoad) {
        setConfig(saved);
        setInjectedButtonVisibility(saved.showActionBarButton !== false);
      }
    });

    // Follow changes this panel did not make: the popup's toggle, another tab's
    // panel. Without it this mount keeps its own copy and the next edit writes
    // that copy back whole, so the external change is undone by whichever
    // control the user reaches for next.
    const unsubscribe = subscribePreferences((next) => {
      if (!mounted) return;
      preferenceChangedSinceLoad = true;
      setConfig(next);
      setInjectedButtonVisibility(next.showActionBarButton !== false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
    // Mount-only by intent: `initialConfig` is a harness override that must not be
    // re-read, and reading it as a dependency would re-run the effect whenever the
    // caller passed a fresh object literal.
  }, []);

  // The status timer must not outlive the modal: it holds a closure over this
  // component's setter, and a pending timeout firing after unmount is a leak.
  // The flag matters as much as the clear: an export can still be awaiting
  // `onExport` when Escape closes the dialog, and its continuation would
  // otherwise schedule a fresh timer that this cleanup has already run past.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
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

  const clearStatusTimer = () => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  };

  /**
   * Replaces the pending status-clear timer.
   *
   * Cancelling here is not enough on its own: the paths that keep their message
   * on screen never call this, so a timer left by the previous, clean export
   * would still fire and wipe the new warning -- leaving a retry button with no
   * text beside it. `handleExport` therefore clears at its own start.
   */
  const scheduleStatusClear = (delayMs: number) => {
    clearStatusTimer();
    // Nothing here should outlive the modal; see the cleanup effect.
    if (!mountedRef.current) return;
    statusTimerRef.current = setTimeout(() => {
      statusTimerRef.current = null;
      setStatusMessage('');
    }, delayMs);
  };

  const setRetry = (action: ExportAction | null) => {
    retryActionRef.current = action;
    setCanRetry(action !== null);
  };

  /**
   * How a clipboard refusal is worded. The download already happened, so the
   * first clause says so; the reason follows, and only when the error message
   * actually named one (`other` stays vague on purpose).
   */
  const clipboardFallbackText = (reason: ExportOutcome['clipboardFailure']): string => {
    switch (reason) {
      case 'unsupported':
        return t.clipboardFallbackUnsupported;
      case 'permission':
        return t.clipboardFallbackPermission;
      case 'unfocused-or-gesture':
        return t.clipboardFallbackActivation;
      default:
        return t.clipboardFallbackNotice;
    }
  };

  /**
   * The outcome, in one line: where the file went, then what about it is worth
   * knowing. A degraded export is not a failure -- the file exists -- so the
   * warnings are clauses on the success sentence, not a replacement for it.
   */
  const describeOutcome = (outcome: ExportOutcome, action: ExportAction): string => {
    if (!outcome.success) {
      return outcome.error ? `${t.exportFailed}: ${outcome.error}` : t.exportFailed;
    }

    const base =
      outcome.method === 'clipboard'
        ? t.copiedSuccess
        : action === 'copy'
          ? clipboardFallbackText(outcome.clipboardFailure)
          : t.downloadSuccess;

    const notes: string[] = [];
    if (outcome.degradedImageCount) {
      notes.push(
        t.imagesUnavailableCount.replace('{count}', String(outcome.degradedImageCount))
      );
    }
    if (outcome.scaleReduced && outcome.appliedScale) {
      notes.push(t.exportScaleReduced.replace('{scale}', String(outcome.appliedScale)));
    }

    return notes.length ? `${base}${t.statusSeparator}${notes.join(t.statusSeparator)}` : base;
  };

  const handleExport = async (action: ExportAction) => {
    // Before anything else, and on every path out of this function: the clear
    // timer belongs to the *previous* export, and several paths below replace
    // the message without scheduling a new one.
    clearStatusTimer();

    const target = getExportTarget();
    if (!target) {
      setStatusMessage(t.targetNotFound);
      setIsErrorStatus(true);
      setIsWarningStatus(false);
      setRetry(action);
      return;
    }

    setIsExporting(true);
    setStatusMessage(action === 'copy' ? t.copying : t.generatingPng);
    setIsErrorStatus(false);
    setIsWarningStatus(false);
    setRetry(null);

    try {
      // The message follows the outcome, not the button that was pressed. A
      // clipboard that refuses is not a failure the user caused, but it is also
      // not a copy -- so it gets its own wording rather than "copied".
      let needsAttention = false;
      if (onExport) {
        const outcome = await onExport(target, action);
        // Escape can close the modal while this is in flight; nothing below has
        // a component to write to after that, and the timer in particular must
        // not be created past the unmount cleanup.
        if (!mountedRef.current) return;
        const degraded = Boolean(
          outcome.degradedImageCount || outcome.scaleReduced || outcome.clipboardFailure
        );
        setIsErrorStatus(!outcome.success);
        setIsWarningStatus(outcome.success && degraded);
        setStatusMessage(describeOutcome(outcome, action));
        // Anything short of a clean copy/download can be worth another try --
        // except a clipboard this browser simply does not have. Retrying that
        // can only fail the same way and save a second copy of the PNG.
        needsAttention =
          !outcome.success ||
          Boolean(outcome.degradedImageCount || outcome.scaleReduced) ||
          Boolean(outcome.clipboardFailure && outcome.clipboardFailure !== 'unsupported');
        setRetry(needsAttention ? action : null);
      }
      // A warning stays until the next export. Auto-clearing it while the
      // button that earned it is still on screen is how the warning was missed
      // the first time round: 2.5s is shorter than reading a three-clause line.
      // The clean path keeps the short timer; a retryable outcome does not.
      if (!needsAttention) scheduleStatusClear(2500);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      console.error('[Post-to-Card] Export error:', err);
      const msg = !(err instanceof ExportRenderError)
        ? err instanceof Error
          ? err.message
          : t.exportFailed
        : err.code === 'empty-blob'
          ? t.exportEmpty
          : err.code === 'too-tall'
            ? t.exportTooTall
            : err.message;
      setStatusMessage(msg);
      setIsErrorStatus(true);
      setIsWarningStatus(false);
      // An empty image is the one failure a second attempt can plausibly fix
      // (a transient allocation failure), so it gets a retry button. A
      // `rasterizer` error means the engine gave us nothing at all, which the
      // same click cannot change.
      const retryable = err instanceof ExportRenderError && err.code === 'empty-blob';
      setRetry(retryable ? action : null);
      // Same rule as the warning path: a line the user can still act on must
      // outlive the timer. An unrecognized error has no retry, so it fades.
      if (!retryable) scheduleStatusClear(4000);
    } finally {
      if (mountedRef.current) setIsExporting(false);
    }
  };

  const handleRetry = () => {
    const action = retryActionRef.current;
    if (!action) return;
    // The button is removed by the state update this starts (it disappears
    // while exporting). Moving focus to the primary action first keeps a
    // keyboard user inside the dialog instead of dropping them on <body>.
    exportPrimaryRef.current?.focus();
    void handleExport(action);
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

  // The summary counts one post as often as it counts several -- opening a
  // single post is the common case -- and English marks the difference, so a
  // one-count would otherwise read "1 tweets". The choice lives with the
  // templates, in `formatPreviewSummary`.
  const summary = formatPreviewSummary(t, activeTweetCount);

  return (
    <Modal
      onClose={onClose}
      locale={config.locale}
      summary={summary}
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
        isWarningStatus={isWarningStatus}
        onRetry={canRetry ? handleRetry : undefined}
        primaryButtonRef={exportPrimaryRef}
        threadData={threadData}
        exportSize={exportSize}
      />
    </Modal>
  );
}
