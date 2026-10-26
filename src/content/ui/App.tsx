import type { JSX } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { ThreadData } from '../../types/tweet.ts';
import type { CardConfig } from '../../types/card.ts';
import { DEFAULT_CARD_CONFIG, THEMES } from './themes.ts';
import { loadUserPreferences, saveUserPreferences, subscribePreferences } from '../prefs.ts';
import { setInjectedButtonVisibility } from '../adapter/injection.ts';
import { Card } from './Card.tsx';
import { Controls } from './Controls.tsx';
import { Modal } from './Modal.tsx';
import { handleRadioKeyDown } from './radioGroup.ts';
import { threadSession, toggleExcluded } from '../threadSession.ts';
import { CARD_WIDTH, viewportPadding } from './geometry.ts';
import type { ExportAction, ExportOutcome } from '../engine/index.ts';
import { ExportRenderError, exportSizeReadout } from '../engine/index.ts';

import { getTranslation, resolveLocale, formatPreviewSummary } from '../i18n.ts';

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

function isFixedLevel(level: ZoomLevel): level is FixedZoomLevel {
  return typeof level === 'number';
}

/**
 * How long a post takes to travel to its new place when the tweet set changes.
 *
 * The same order as the dialog's own entrance: long enough to read as a move
 * rather than a cut, short enough that the pointer is still where the user left
 * it.
 */
const THREAD_FLIP_MS = 220;

/**
 * The exclusions as a comparable value: the same set is the same string, in any
 * order. Used to tell "the card now holds different posts" from "some other
 * option changed", which is the only question the flip animation asks.
 */
function exclusionSignature(ids: string[] | undefined): string {
  return [...(ids ?? [])].sort().join('|');
}

interface FlipMove {
  element: HTMLElement;
  start: Partial<CSSStyleDeclaration>;
  end: Partial<CSSStyleDeclaration>;
  transition: string;
}

/**
 * Plays a batch of moves: writes every start value, lets the browser keep them,
 * then transitions every element to its end value.
 *
 * The style read in the middle is the whole trick: without it the two writes
 * collapse before the next style pass, there is no "from" to interpolate, and
 * the property simply lands where it was going. Every FLIP here needs the same
 * three beats, so they live in one place, and the beats are per batch rather
 * than per element: one read forces the layout for all of them, where a read per
 * post forced one synchronous layout per post on the animation's first frame.
 */
function playFrom(moves: FlipMove[]): void {
  if (moves.length === 0) return;
  for (const move of moves) {
    move.element.style.transition = 'none';
    Object.assign(move.element.style, move.start);
  }
  // Forces a style recalculation, which is what makes each `start` above the
  // value its transition begins from.
  void moves[0].element.offsetWidth;
  for (const move of moves) {
    move.element.style.transition = move.transition;
    Object.assign(move.element.style, move.end);
  }
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
  /**
   * Which action is in flight, or null when nothing is.
   *
   * One state, not a boolean beside it: "exporting" is exactly "some action is
   * pending", and two states that must be set and cleared together are one
   * state with a nullable value. It also says *which* button carries the
   * spinner, so exactly one of the two spins -- two spinners would claim two
   * things are happening.
   */
  const [pendingAction, setPendingAction] = useState<ExportAction | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  /**
   * A clean export's confirmation, held on the button that produced it.
   *
   * A successful copy needs no sentence: the button is where the press happened,
   * and a check on it answers "did that work" without moving the eye. The status
   * line is therefore reserved for outcomes that carry news -- a warning, a
   * failure -- which is what lets it claim no height at all the rest of the time.
   */
  const [flash, setFlash] = useState<ExportAction | null>(null);
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
  // Preview-only scale. The export captures a copy of the mat outside this zoom
  // (see mountUnzoomedCopy in engine/export.ts), so the exported dimensions are
  // the mat's own: the card's 640px when no canvas is selected, and whatever the
  // selected shape and ring make of it otherwise.
  const [zoomIndex, setZoomIndex] = useState<number>(ZOOM_LEVELS.indexOf('fit'));
  const level = ZOOM_LEVELS[zoomIndex];
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The exported element's size at scale 1: the mat, which is the card's own box
  // when no canvas is selected and is wider and/or taller than it when one is.
  // Zero until the first measurement, which leaves the height axis out of `fit`
  // for a frame rather than guessing at it.
  const [cardHeight, setCardHeight] = useState<number>(0);
  const [cardWidth, setCardWidth] = useState<number>(0);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [availableHeight, setAvailableHeight] = useState<number>(0);
  /**
   * Whether the card has been measured at least once.
   *
   * Before that there is no `fit` to draw: the width is unknown and the height is
   * zero, so both fallbacks resolve to 1:1 and the first paint shows the card at
   * its full 640px -- on a phone, hanging off both edges of the stage -- only to
   * jump to the fitted scale a frame later. The stage holds the card back until
   * the measurement answers, then fades it in while the dialog is still opening,
   * so the card arrives at the size it will keep. See `.preview-scale` in
   * modal.css.
   *
   * A one-way flag: a later theme, ratio or thread change moves the card's
   * geometry too, but that is an edit the user made and the card must stay
   * visible through it. Only the first arrival is hidden.
   */
  const [isCardMeasured, setIsCardMeasured] = useState<boolean>(false);

  /**
   * The width the exported picture actually has. `CARD_WIDTH` is only the
   * first-frame stand-in: a selected canvas pads the mat out beyond the card,
   * and the size readout is about the picture the user gets, not about the sheet
   * inside it.
   */
  const exportWidth = cardWidth || CARD_WIDTH;

  /**
   * The ceiling on the *fixed* levels, measured against the card.
   *
   * A level is a plain scale applied to the exported picture, so 100% is 1:1 by
   * definition -- the ring included, with the card at the same 640px it has in
   * the file. What this number decides is only whether that level is reachable
   * at the current stage width.
   *
   * Measured against the picture, adding a background could push 100% out of
   * reach, and the effect below would then snap the selection down a level:
   * choosing a margin silently rescaled what the user was reading. Measured
   * against the card, the ladder is the one the app had before canvases existed,
   * and a reachable level renders at exactly the percentage it names.
   *
   * The price is that at a fixed level the ring can sit up to 96px x the level
   * past the stage, to be panned to. `fit` remains the mode that frames the
   * whole picture.
   */
  const maxScale = availableWidth > 0 ? availableWidth / CARD_WIDTH : 1;

  /**
   * The scale `fit` resolves to: the whole picture -- ring included -- has to
   * clear the stage in both axes, so this is the smaller of the two.
   */
  const stageScale = availableWidth > 0 ? availableWidth / exportWidth : 1;
  const fitScale = cardHeight > 0 ? Math.min(stageScale, availableHeight / cardHeight) : stageScale;

  const zoom = isFixedLevel(level) ? Math.min(level, maxScale) : fitScale;

  /**
   * The exported PNG's pixel size, or null until the mat has been measured.
   *
   * The export captures an unzoomed copy of the mat and rasterizes it at the
   * scale the engine picks for it -- 3x for a lone post, 2x for a picture past
   * X's own display cap -- so this is the figure that lands on the clipboard. It
   * has nothing to do with the preview's zoom: a long thread on a phone can look
   * tiny here and still export at full width.
   *
   * Read through the exporter's own rule (`exportSizeReadout`), not recomputed
   * here: while the scale was a constant this was `exportWidth * 2`, and a second
   * copy of the rule is exactly how a readout ends up naming a size the file never
   * has.
   */
  const exportSize = exportSizeReadout(
    { width: exportWidth, height: cardHeight },
    { preferHighResolution: config.preferHighResolution === true }
  );

  // Resolved once, and the same value is what `Modal` and the card are handed:
  // a second resolution further down would be a second answer to the same
  // question, and `'auto'` is the one preference that could make them differ.
  const locale = resolveLocale(config.locale);
  const t = getTranslation(locale);

  /**
   * Measures what the stage can show: the stage's own box, and the exported
   * element's size at scale 1.
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
   *
   * Both axes are measured with the preview's zoom taken off, because the height
   * feeds the zoom and the zoom feeds the height -- and zoom is not a clean
   * post-scale, it changes where text breaks. See the note at the measurement.
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
      // Measured with the preview's zoom taken off first. This number feeds
      // `fit`, which is written straight back into that zoom, so measuring
      // inside it makes the fit a function of itself. It is not only sub-pixel
      // noise: `zoom` changes how text is rounded, so the same paragraph broke
      // into three more lines at one zoom than at another -- 8127px against
      // 8203px on a tall card, far past any pixel-sized tolerance, and the two
      // zoom levels alternated forever. At 1 the card lays out exactly as the
      // exporter's unzoomed clone does, which is also what the size readout is
      // supposed to be quoting. The zoom is restored before the browser can
      // paint, so nothing flickers.
      //
      // The zoom lives on `.preview-scale`, which is *not* the card's parent:
      // the mat sits between them. Reading `parentElement` here silently wrote
      // the zoom onto the mat, where it changed nothing, and the loop ran on --
      // which is exactly how this looked fixed while a tall card still shook.
      const scale = card.closest('.preview-scale') as HTMLElement | null;
      // Nothing to remove if the scale has no inline zoom yet (the first
      // measure can run before Preact's first paint writes it); the layout is
      // already at 1 in that case.
      const previousZoom = scale ? scale.style.zoom : '';
      if (previousZoom) scale!.style.zoom = '1';
      const naturalHeight = card.offsetHeight;
      const naturalWidth = card.offsetWidth;
      if (previousZoom) scale!.style.zoom = previousZoom;

      // The tolerance is a guard against a real fractional difference between
      // passes; with the zoom out of the measurement it is no longer what keeps
      // the loop from running.
      if (naturalHeight > 0) {
        setCardHeight((prev) => (Math.abs(prev - naturalHeight) > 1 ? naturalHeight : prev));
      }
      // Read alongside the height because the two move together: selecting a
      // canvas ratio changes both axes at once, and a width that lagged a frame
      // behind would misreport the export size in exactly the state the user
      // just switched into.
      if (naturalWidth > 0) {
        setCardWidth((prev) => (Math.abs(prev - naturalWidth) > 1 ? naturalWidth : prev));
      }

      // Both axes are measured, so `fit` has a real answer for the first time.
      // The card is allowed on screen from here; the zoom written by this render
      // is the one it keeps, which is the whole point of holding it back.
      if (naturalHeight > 0 && naturalWidth > 0) setIsCardMeasured(true);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
    // Re-run when the card is a different one. A toggle changes the height of the
    // box the observer is watching, and it fires for that; opening another tweet
    // replaces the element, and an observer left on the old node would never see
    // the new one's height -- the readout would then quote the previous card.
    // This is the effect's only dependency, and it is a value, not a mount flag.
  }, [threadData]);

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
   * A preserved scroll offset is only meaningful while the picture keeps the
   * same geometry: after a zoom, a theme change or a canvas change the picture
   * can be smaller than the offset, leaving its left edge off-screen behind a
   * scroll the user never asked for.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollLeft = 0;
  }, [zoom, config.theme, config.canvasRatio, config.canvasBackground]);

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

  /**
   * What the card looked like before the tweet set changed.
   *
   * `positions` is where each post sat, in the card's own pixels: the card is a
   * column, so removing one makes every post below it jump up by the removed
   * height in a single frame -- the one edit in this panel whose result is a
   * *different layout* rather than a different value. Measuring before the render
   * and replaying afterwards turns that jump into a move.
   *
   * `showing` is which posts were on the card, and it is a separate answer on
   * purpose: "was this post here before" cannot be read off the measurement,
   * because a one-post card renders no measured items at all. Restoring a post
   * would then treat the post that was already on screen as new and fade it in.
   *
   * `offsetTop`, not `getBoundingClientRect`: the stage zooms the card, and a
   * rect arrives multiplied by that zoom (and carrying any transform on an
   * ancestor). Layout pixels are what a `translateY` written back onto the item
   * has to be expressed in, and transforms do not change them, so the same
   * number is correct on both sides of the measurement.
   */
  const threadChangeRef = useRef<{ positions: Map<string, number>; showing: Set<string> } | null>(null);
  // The pending release of the list's clip. Held rather than left as a bare
  // timeout so a second exclusion inside the flight cannot have its clip opened
  // by the previous turn's timer.
  const threadClipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotThreadItems = (): Map<string, number> => {
    const snapshot = new Map<string, number>();
    const card = cardRef.current;
    if (!card) return snapshot;
    card.querySelectorAll<HTMLElement>('[data-tweet-id]').forEach((item) => {
      const id = item.dataset.tweetId;
      if (id) snapshot.set(id, item.offsetTop);
    });
    return snapshot;
  };

  const handleConfigChange = (newConfig: CardConfig) => {
    // A shape the user picked is a command, not a consequence: the ratio control
    // says "this card is 16:9 now", so the picture must be that shape on the next
    // frame rather than animate into it. The same applies to the canvas shape,
    // which changes the mat the card is measured against. Everything else that
    // moves the height -- a post leaving, a picture reporting its shape -- is a
    // consequence and is replayed (see `lastFitRef`).
    if (newConfig.aspectRatio !== config.aspectRatio || newConfig.canvasRatio !== config.canvasRatio) {
      skipFitReplayRef.current = true;
    }
    // Only a change to *which* posts are in the card moves the ones that stay.
    // Compared by set rather than by array, because the same exclusions in a
    // different order are the same card and must not animate.
    if (exclusionSignature(newConfig.excludedTweetIds) !== exclusionSignature(config.excludedTweetIds)) {
      threadChangeRef.current = {
        positions: snapshotThreadItems(),
        showing: new Set(
          threadSession(threadData, config.excludedTweetIds)
            .showing.map((tweet) => tweet.id)
            .filter((id): id is string => Boolean(id))
        ),
      };
    }
    setConfig(newConfig);
    setInjectedButtonVisibility(newConfig.showActionBarButton !== false);
    saveUserPreferences(newConfig).catch(() => {});
  };

  /**
   * Plays back the snapshot above, once, for the render that moved the posts.
   *
   * A layout effect so the first frame the browser paints is already the
   * displaced one: a passive effect would let it paint the new positions once
   * and then jump back, which is the jump this exists to remove. Mount passes
   * through with nothing to play.
   *
   * A post that was already on the card is offset by the distance it was
   * displaced and eased back to zero; a post that just joined has no old place to
   * come from, so it fades in where the layout already put it. A post that was
   * already there but has no measured position is left alone -- that is the
   * single-post layout, which draws no posts to measure and changes shape rather
   * than moving anything.
   */
  const exclusionSignatureValue = exclusionSignature(config.excludedTweetIds);
  useLayoutEffect(() => {
    const before = threadChangeRef.current;
    threadChangeRef.current = null;
    const card = cardRef.current;
    if (!before || !card) return;

    // Decided before anything is written: whether the list has to be clipped
    // for the duration. A post that moves starts lower than its new slot, and
    // the card has already shrunk around it -- unclipped, the displaced post is
    // painted over the stage below the sheet. Clipping at the list's own edge
    // is what turns that into the post sliding in from the card's bottom.
    const moves: Array<{ item: HTMLElement; shift: number | null }> = [];
    card.querySelectorAll<HTMLElement>('[data-tweet-id]').forEach((item) => {
      const id = item.dataset.tweetId;
      if (!id) return;
      if (!before.showing.has(id)) {
        moves.push({ item, shift: null });
        return;
      }
      const from = before.positions.get(id);
      if (from === undefined) return;
      const shift = from - item.offsetTop;
      if (Math.abs(shift) >= 1) moves.push({ item, shift });
    });
    if (moves.length === 0) return;

    const list = card.querySelector('.thread-list') as HTMLElement | null;
    if (list) list.style.overflow = 'hidden';

    playFrom(
      moves.map(({ item, shift }) =>
        shift === null
          ? {
              element: item,
              start: { opacity: '0' },
              end: { opacity: '' },
              transition: `opacity ${THREAD_FLIP_MS}ms ease-out`,
            }
          : {
              element: item,
              start: { transform: `translateY(${shift}px)` },
              end: { transform: '' },
              transition: `transform ${THREAD_FLIP_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }
      )
    );

    if (!list) return;

    // One frame past the longest move, so the clip is released after every post
    // has arrived rather than mid-flight. The cleanup runs before the next
    // exclusion and on unmount: it drops this turn's timer and reopens the clip,
    // which the next run re-applies if it also moves posts.
    threadClipTimerRef.current = setTimeout(() => {
      list.style.overflow = '';
      threadClipTimerRef.current = null;
    }, THREAD_FLIP_MS + 60);

    return () => {
      if (threadClipTimerRef.current) {
        clearTimeout(threadClipTimerRef.current);
        threadClipTimerRef.current = null;
      }
      list.style.overflow = '';
    };
  }, [exclusionSignatureValue]);

  /**
   * The card's own last fitted geometry: the height it had, and the zoom `fit`
   * answered with for it.
   *
   * `fit` is a function of the card's height, so any change to that height --
   * a post leaving, a picture reporting its real shape, a material with a
   * different rhythm -- also changes the whole picture's scale. That second
   * jump lands on top of whatever moved inside the card, which is what made a
   * reordered thread read as "everything jumps".
   *
   * Replaying it with a `transform` rather than by animating `zoom` keeps the
   * cost on the compositor: `zoom` is a layout property, and interpolating it
   * would re-wrap the card's text on every frame.
   */
  const lastFitRef = useRef<{ height: number; zoom: number } | null>(null);
  const scaleRef = useRef<HTMLDivElement | null>(null);
  const skipFitReplayRef = useRef<boolean>(false);
  useLayoutEffect(() => {
    const element = scaleRef.current;
    const last = lastFitRef.current;
    lastFitRef.current = { height: cardHeight, zoom };
    // Consumed whether or not there is anything to replay: the flag belongs to
    // one render, and a stale one would suppress an unrelated later refit.
    const userPickedShape = skipFitReplayRef.current;
    skipFitReplayRef.current = false;
    // Nothing to replay on the first measurement (the card is still hidden), and
    // nothing to replay when the card's height did not move -- which is what
    // tells a zoom the *user* picked from a zoom `fit` re-derived.
    if (userPickedShape || !element || !last || last.height <= 0 || Math.abs(last.height - cardHeight) < 1) return;
    const ratio = last.zoom / zoom;
    if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.005) return;
    // Top centre: the stage centres the card horizontally and starts it at the
    // top, so that is the point the picture appears to scale around.
    element.style.transformOrigin = '50% 0';
    playFrom([
      {
        element,
        start: { transform: `scale(${ratio})` },
        end: { transform: '' },
        transition: `transform ${THREAD_FLIP_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      },
    ]);
  }, [cardHeight, zoom]);

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
      setFlash(null);
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
      case 'artwork':
        return t.clipboardFallbackArtwork;
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

    setPendingAction(action);
    // A new export owns the line from here: the previous outcome is no longer
    // what is happening, and leaving it up while the spinner runs reads as a
    // result for a run that has not finished. `needsAttention` paths below put
    // their own line back.
    setStatusMessage('');
    setFlash(null);
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
        // Anything short of a clean copy/download can be worth another try --
        // except a clipboard this browser simply does not have. Retrying that
        // can only fail the same way and save a second copy of the PNG.
        needsAttention =
          !outcome.success ||
          Boolean(outcome.degradedImageCount || outcome.scaleReduced) ||
          Boolean(outcome.clipboardFailure && outcome.clipboardFailure !== 'unsupported');
        setRetry(needsAttention ? action : null);
        // A clean result is a tick on the button, not a sentence under it: the
        // press happened there and "did it work" is answered there. Everything
        // else -- anything with something to say -- goes to the status line.
        if (needsAttention) {
          setStatusMessage(describeOutcome(outcome, action));
        } else {
          setFlash(action);
        }
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
      if (mountedRef.current) setPendingAction(null);
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

  // One session answers both questions this surface asks: what the card shows,
  // and whether one more tweet may be dropped. Building the next set from the
  // returned one drops any key left over from a previous thread.
  const session = threadSession(threadData, config.excludedTweetIds);

  const handleExcludeTweet = (tweetId: string) => {
    handleConfigChange({ ...config, excludedTweetIds: toggleExcluded(threadData, config.excludedTweetIds, tweetId) });
  };

  // The card never renders empty — the session keeps the target post standing
  // in — so the summary never says zero.
  const activeTweetCount = session.rawCount || 1;

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
      locale={locale}
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
            class={`preview-scale${isCardMeasured ? ' is-measured' : ''}`}
            ref={scaleRef}
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
        pendingAction={pendingAction}
        flash={flash}
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
