import type { JSX } from 'preact';
import type { ThreadData, TweetData } from '../../types/tweet.ts';
import type { CardConfig, ThemeId, PaddingOption, RadiusOption, CanvasRatioOption, CanvasBackgroundId } from '../../types/card.ts';
import { THEMES, THEME_ORDER, EXPERIMENTAL_THEMES, PADDING_OPTIONS, RADIUS_OPTIONS, ASPECT_RATIO_OPTIONS, IMAGE_FIT_OPTIONS, MEDIA_LAYOUT_OPTIONS, CANVAS_RATIO_OPTIONS, CANVAS_BACKGROUNDS, CANVAS_BACKGROUND_ORDER, resolveCanvasBackground, themePreview } from './themes.ts';
import { getTranslation, sanitizeLocale, type Translations } from '../i18n.ts';
import { useId, useState } from 'preact/hooks';
import { handleRadioKeyDown } from './radioGroup.ts';
import { threadScope, tweetKey, toggleExcluded, selectCurrentOnly } from './threadScope.ts';
import { hasRenderableStats } from './Card.tsx';
import { isLongCard } from '../engine/scale.ts';
import {
  Languages,
  Palette,
  Maximize2,
  Scaling,
  Square,
  Copy,
  Download,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Check,
  LayoutGrid,
} from 'lucide-preact';

/**
 * How many themes the grid shows before "all themes" is expanded.
 *
 * One row of four, not two rows of three. The grid is the single largest block in
 * the panel, and two rows of swatches pushed every control below it -- the toggles
 * included -- past the first screen. Dropping to a row buys back roughly 90px,
 * which is what lets the footer toggles and the privacy toggle land in view too.
 * Four still spans both ends of the rotation: a light paper, a dark one, a glassy
 * one and a textured one.
 */
const THEME_GRID_VISIBLE = 4;

export interface ControlsProps {
  config: CardConfig;
  onChange: (newConfig: CardConfig) => void;
  onExportCopy: () => void;
  onExportDownload: () => void;
  isExporting?: boolean;
  statusMessage?: string;
  isErrorStatus?: boolean;
  /**
   * The export finished but not cleanly -- some pictures are placeholders, or
   * the canvas limit forced a smaller scale. Rendered as a warning rather than
   * an error because the file did leave the page.
   */
  isWarningStatus?: boolean;
  /** Present when the last failure is worth another attempt. */
  onRetry?: () => void;
  /**
   * The retry button's replacement focus target. Retrying removes that button
   * from the DOM, and a keyboard user whose focus is on it would otherwise be
   * dropped on `<body>`, outside the modal's focus trap until the next Tab.
   */
  primaryButtonRef?: { current: HTMLButtonElement | null };
  threadData?: ThreadData;
  /**
   * The exported PNG's pixel size, or null until the preview has measured the
   * card. Shown under the aspect ratio because that is the control that moves the
   * height most, and it is not persisted -- it is a readout, not a preference.
   *
   * `scale`/`reduced` come from the same arithmetic the exporter uses, so a card
   * the canvas limit shrinks is quoted at the size it will actually be.
   * `impossible` means no scale can export it; the hint says so and the export
   * buttons are disabled rather than promising a file that cannot exist.
   */
  exportSize?: {
    width: number;
    height: number;
    scale?: number;
    reduced?: boolean;
    impossible?: boolean;
  } | null;
}

interface ToggleSpec {
  key: keyof CardConfig;
  label: string;
  /** Why the toggle is there, shown on hover. The label alone does not say it. */
  title?: string;
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

/**
 * Single-choice control whose options are colours, not words.
 *
 * A `Segmented` cannot carry this one: the seven backgrounds have no labels a
 * user could choose between at a glance, and the two gradients have no single
 * colour to print on a button. So each option is a chip of the value itself.
 * It is still a radio group, and it shares `handleRadioKeyDown` with
 * `Segmented` rather than re-deriving roving tabindex and arrow keys -- the two
 * controls sit in the same panel and a keyboard user should not be able to tell
 * which is which from the behaviour.
 *
 * The chip is painted with the same resolver the card uses, so `'theme'` shows
 * the active material's own mat rather than a hardcoded approximation of it.
 * `'none'` gets the crossed-out treatment instead of a colour, because it is
 * not a colour.
 */
function SwatchRow({
  name,
  options,
  value,
  onSelect,
  labels,
  theme,
}: {
  name: string;
  options: readonly CanvasBackgroundId[];
  value: CanvasBackgroundId;
  onSelect: (next: CanvasBackgroundId) => void;
  labels: Record<string, string>;
  /** The active material, so `'theme'` previews the mat it will actually use. */
  theme: ThemeId;
}): JSX.Element {
  return (
    <div class="swatch-row" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const isActive = value === opt;
        const paint = resolveCanvasBackground(opt, theme);
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            class={`swatch ${isActive ? 'is-active' : ''} ${opt === 'none' ? 'is-none' : ''}`}
            onClick={() => onSelect(opt)}
            onKeyDown={(e) => handleRadioKeyDown(e, options, value, onSelect)}
            title={labels[opt] || CANVAS_BACKGROUNDS[opt].name}
            aria-label={labels[opt] || CANVAS_BACKGROUNDS[opt].name}
            style={paint ? { background: paint } : undefined}
          />
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onToggle,
  title,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      class="toggle-item"
      onClick={onToggle}
      title={title}
    >
      <span class="toggle-title">{label}</span>
      <span class={`toggle-switch ${checked ? 'is-checked' : ''}`} aria-hidden="true">
        <span class="toggle-thumb" />
      </span>
    </button>
  );
}

/**
 * The dictionary's labels for the canvas backgrounds, keyed by id.
 *
 * Built here rather than read off `CANVAS_BACKGROUNDS[id].name` so the names
 * follow the interface language. The table's own `name` stays as the fallback
 * for a label a dictionary is missing.
 */
function canvasBackgroundLabels(t: Translations): Record<string, string> {
  return {
    none: t.canvasBg_none,
    theme: t.canvasBg_theme,
    paper: t.canvasBg_paper,
    stone: t.canvasBg_stone,
    ink: t.canvasBg_ink,
    linen: t.canvasBg_linen,
    dusk: t.canvasBg_dusk,
  };
}

/**
 * Whether a post puts any picture on the card at all.
 *
 * The card draws media from a post's own attachment, an article's cover, and the
 * same two on a quoted post -- through however many quotes are nested, because a
 * quote of a quote renders as its own panel rather than as a flat body. An
 * unavailable quote renders as one line of text with no media of its own, so it
 * contributes nothing and the walk stops there.
 */
function postHasMedia(tweet: TweetData | undefined): boolean {
  if (!tweet) return false;
  if (tweet.media && tweet.media.length > 0) return true;
  if (tweet.article && tweet.article.cover) return true;
  return quoteHasMedia(tweet.quotePost);
}

function quoteHasMedia(quote: TweetData['quotePost']): boolean {
  if (!quote || quote.isUnavailable) return false;
  if (quote.media && quote.media.length > 0) return true;
  return quoteHasMedia(quote.quotePost);
}

export function Controls({
  config,
  onChange,
  onExportCopy,
  onExportDownload,
  isExporting = false,
  statusMessage = '',
  isErrorStatus = false,
  isWarningStatus = false,
  onRetry,
  primaryButtonRef,
  threadData,
  exportSize,
}: ControlsProps): JSX.Element {
  const t = getTranslation(sanitizeLocale(config.locale));
  const [showMore, setShowMore] = useState<boolean>(false);
  const [showAllThemes, setShowAllThemes] = useState<boolean>(false);
  /**
   * Starts collapsed on the string renderer (no window to measure) and on the
   * string renderer only. A real viewport starts expanded.
   *
   * The bottom sheet used to start collapsed on every screen at most 900px wide,
   * which meant the first thing a phone showed was a "展开菜单" handle and nothing
   * else: the whole panel, controls included, was behind one more tap. The sheet
   * still collapses, and still takes a share of the height rather than all of it,
   * so the collapse is available rather than imposed. Wide screens were already
   * expanded and stay that way.
   */
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') return true;
    return window.innerWidth > 900;
  });
  const moreId = useId();
  const themeGridId = useId();

  const updateConfig = (patch: Partial<CardConfig>) => {
    onChange({ ...config, ...patch });
  };

  // The picker's pool is the whole rotation, in order, and nothing else in the
  // panel widens or narrows it.
  //
  // Brutalist is deliberately experimental, so it is last and off the primary
  // row: the grid opens on the everyday rotation, and this grid's own expansion
  // is what reveals the rest -- Brutalist included, marked as experimental on
  // its own button. Gating it on the "More settings" disclosure as well moved
  // the count below from 7 to 8 whenever that unrelated section was opened,
  // while the grid itself still showed the same four themes.
  const themeList = THEME_ORDER.map((id) => THEMES[id]);

  // The grid is four rows tall in the narrow panel, which pushed every control
  // below it off the first screen. It opens on the everyday rotation instead,
  // and the active theme is always kept so a saved choice is never hidden.
  const primaryThemes = themeList.slice(0, THEME_GRID_VISIBLE);
  const activeTheme = themeList.find((th) => th.id === config.theme);
  const collapsedThemes = [
    ...primaryThemes,
    ...(activeTheme && !primaryThemes.includes(activeTheme) ? [activeTheme] : []),
  ];
  const visibleThemes = showAllThemes ? themeList : collapsedThemes;
  // Counted from what is actually shown, so pinning the active theme does not
  // leave the label promising more themes than the expansion reveals.
  const hiddenThemeCount = themeList.length - collapsedThemes.length;

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

  /**
   * The post the card actually prints its footer from.
   *
   * The panel is handed the thread, not the scope, so it derives the same one the
   * card does rather than reading the first tweet it is given. The two name
   * different posts whenever a target or an exclusion moves it, and the panel
   * would then offer a toggle for a footer the card is not drawing.
   */
  const activeTweets = (threadData?.tweets || []).filter(
    (tweet, idx) => !excluded.has(tweetKey(tweet, idx))
  );
  const fallbackIndex = threadData?.targetTweetIndex ?? 0;
  const fallbackTweet = threadData?.tweets[fallbackIndex] || threadData?.tweets[0];
  // The same effective set the card draws from, so every question asked below
  // about "this post" is asked about the posts that will actually be printed.
  const effectiveTweets =
    activeTweets.length > 0 ? activeTweets : fallbackTweet ? [fallbackTweet] : [];
  const mainTweet = effectiveTweets[0];

  /**
   * Whether the post this card shows actually carries what each footer toggle
   * claims to add.
   *
   * A switch that cannot change anything is worse than no switch: it invites the
   * user to conclude the panel is broken. The card already refuses to draw a
   * footer with nothing in it, so the panel refuses to offer the matching control
   * rather than inventing a disabled state of its own.
   *
   * Without a thread -- the string renderer, or a mount that has not resolved one
   * yet -- there is nothing to judge, so every control is offered.
   */
  const canDecide = Boolean(mainTweet);
  const hasQrTarget = !canDecide || Boolean(mainTweet?.url);
  const hasStatsData = !canDecide || hasRenderableStats(mainTweet?.stats);
  const hasTimestamp = !canDecide || Boolean(mainTweet?.timestamp);

  /**
   * Whether the card will draw a picture, and so whether the two media controls
   * have anything to act on. Same reasoning as the footer switches above: a pair
   * of switches that cannot change the output invites the user to conclude the
   * panel is broken. Counted over every post the card prints, not just the first
   * -- a thread whose second post carries the picture still needs them.
   */
  const hasMedia = !canDecide || effectiveTweets.some(postHasMedia);

  /**
   * The footer toggles, in order of how often they get touched.
   *
   * All three print into the same footer, so they belong in one group with one
   * promise: every switch here puts information on the card. That is what keeps
   * them apart from the privacy toggle below, which is the only one that takes
   * information away.
   */
  const footerToggles: ToggleSpec[] = [
    { key: 'showStats', label: t.metricsAndStats },
    { key: 'showTimestamp', label: t.timestamp },
    { key: 'showQrCode', label: t.qrCode },
  ];

  /**
   * Which of those the current post can actually use, in the same order.
   *
   * One map from key to verdict, rather than a condition per switch at the call
   * site: adding a fourth footer control should mean adding one entry here, not
   * remembering to thread another boolean through the JSX.
   */
  const footerToggleAvailable: Record<string, boolean> = {
    showStats: hasStatsData,
    showTimestamp: hasTimestamp,
    showQrCode: hasQrTarget,
  };
  const visibleFooterToggles = footerToggles.filter((item) =>
    footerToggleAvailable[String(item.key)]
  );

  /**
   * Kept behind the disclosure. Neither changes what a post says; they change how
   * it is presented, and both are set once and forgotten.
   *
   * The `titles` carry the meanings the labels do not: the credit is a one-line
   * byline with a build number rather than a layer over the image, the play badge
   * is a corner marker on a still image rather than a control, and the action
   * button lives on X rather than on the card. The label strings stay as they are
   * -- the tests and the popup both read them -- so the explanation goes here.
   */
  const presentationToggles: ToggleSpec[] = [
    { key: 'showPlayButton', label: t.videoPlayButton, title: t.videoPlayButtonTitle },
    { key: 'showWatermark', label: t.watermark, title: t.watermarkHint },
    { key: 'showActionBarButton', label: t.tweetActionButton, title: t.actionButtonHint },
  ];

  const handleToggleExclude = (key: string) => {
    updateConfig({ excludedTweetIds: toggleExcluded(threadData, config.excludedTweetIds, key) });
  };

  const handleSelectAll = () => {
    updateConfig({ excludedTweetIds: [] });
  };

  const targetKey = threadData
    ? tweetKey(threadData.tweets[threadData.targetTweetIndex ?? 0], threadData.targetTweetIndex ?? 0)
    : '';

  const handleSelectCurrentOnly = () => {
    if (!threadData) return;
    updateConfig({ excludedTweetIds: selectCurrentOnly(threadData) });
  };

  return (
    <div class={`controls-panel ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Narrow-screen bottom sheet collapse/expand toggle */}
      <button
        type="button"
        class="panel-collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? t.expandPanel : t.collapsePanel}
      >
        <span class="collapse-grab-bar" aria-hidden="true" />
        <span class="collapse-toggle-text">
          {isCollapsed ? t.expandPanel : t.collapsePanel}
        </span>
        {isCollapsed ? (
          <ChevronUp size={14} strokeWidth={2} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      <div class="controls-scroll" hidden={isCollapsed}>
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
                // `text` is the canonical field and the primary source. The rich tokens are
                // read as a fallback because `Card` renders from them, so a tweet that
                // arrives carrying only tokens would otherwise be labelled "media
                // only" here while the card shows its paragraph. Both extraction
                // paths currently write `text` alongside them, so this is a guard
                // against the two surfaces drifting rather than a live case.
                const source =
                  tweet.text || (tweet.richTokens ?? []).map((token) => token.value).join('');
                const trimmedText = source.replace(/\s+/g, ' ').trim();
                const snippet = trimmedText ? trimmedText.slice(0, 30) : t.mediaOnlyTweet;
                const tweetHasMedia = tweet.media && tweet.media.length > 0;
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
                    {tweetHasMedia && (
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

        {/* The two media controls lead the panel, behind only the thread scope.
            They are the only pair here whose right answer is a property of the
            post rather than of the user: which fit and which layout look right
            depend on whether this picture is tall, wide, or one of four, and that
            answer expires the moment the next post loads. Everything below them
            answers a question about the user or the destination instead, and
            survives the next post, which is what lets it sit lower. */}
        {hasMedia && (
          <>
            <section class="control-section">
              <span class="control-label">
                <Scaling size={14} strokeWidth={2} />
                <span>{t.imageFit}</span>
              </span>
              <Segmented
                name={t.imageFit}
                options={IMAGE_FIT_OPTIONS}
                value={config.imageFit || 'contain'}
                onSelect={(next) => updateConfig({ imageFit: next })}
                labels={{ contain: t.fitContain, cover: t.fitCover }}
                titles={{ contain: t.fitContain, cover: t.fitCover }}
              />
            </section>

            <section class="control-section">
              <span class="control-label">
                <LayoutGrid size={14} strokeWidth={2} />
                <span>{t.mediaLayout}</span>
              </span>
              <Segmented
                name={t.mediaLayout}
                options={MEDIA_LAYOUT_OPTIONS}
                value={config.mediaLayout || 'grid'}
                onSelect={(next) => updateConfig({ mediaLayout: next })}
                labels={{ grid: t.layoutGrid, stack: t.layoutStack }}
                titles={{ grid: t.layoutGrid, stack: t.layoutStack }}
              />
            </section>
          </>
        )}

        {/* Aspect ratio ahead of the theme: three options in the width of one
            segmented control, and it decides the card's height -- the thing that
            decides whether the card is usable on the platform it is going to. */}
        <section class="control-section">
          <span class="control-label">
            <Maximize2 size={14} strokeWidth={2} />
            <span>{t.aspectRatio}</span>
          </span>
          <Segmented
            name={t.aspectRatio}
            options={ASPECT_RATIO_OPTIONS}
            value={config.aspectRatio}
            onSelect={(next) => updateConfig({ aspectRatio: next })}
            labels={{ auto: t.aspectAuto }}
          />
        </section>

        {/* Theme — the single most impactful visual choice */}
        <section class="control-section">
          <span class="control-label">
            <Palette size={14} strokeWidth={2} />
            <span>{t.theme}</span>
          </span>
          <div class="theme-grid" id={themeGridId} role="radiogroup" aria-label={t.theme}>
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
                  title={
                    EXPERIMENTAL_THEMES.has(th.id)
                      ? `${displayName} — ${t.experimentalTheme}`
                      : displayName
                  }
                >
                  <span class="theme-swatch" style={{ background: themePreview(th.id) }} aria-hidden="true">
                    {isActive && (
                      <span class="theme-swatch-check">
                        <Check size={10} strokeWidth={2.8} />
                      </span>
                    )}
                  </span>
                  <span class="theme-button-label">{displayName}</span>
                </button>
              );
            })}
          </div>
          {hiddenThemeCount > 0 && (
            <button
              type="button"
              class="more-toggle"
              aria-expanded={showAllThemes}
              aria-controls={themeGridId}
              onClick={() => setShowAllThemes((v) => !v)}
            >
              <ChevronDown
                size={15}
                strokeWidth={2}
                class={`more-chevron ${showAllThemes ? 'is-open' : ''}`}
                aria-hidden="true"
              />
              <span>
                {showAllThemes
                  ? t.themesShowLess
                  : t.themesShowAll.replace('{count}', String(hiddenThemeCount))}
              </span>
            </button>
          )}
        </section>

        {/* Footer content: every switch here adds information to the card. The
            whole section goes rather than showing a heading over an empty list --
            a post with no link, metrics or timestamp has no footer to fill, and a
            labelled group with nothing in it reads as a broken panel. */}
        {visibleFooterToggles.length > 0 && (
          <section class="control-section">
            <span class="control-label">
              <span>{t.cardFooter}</span>
            </span>
            <div class="toggles-list">
              {visibleFooterToggles.map((item) => (
                <Toggle
                  key={String(item.key)}
                  label={item.label}
                  checked={Boolean(config[item.key])}
                  onToggle={() =>
                    updateConfig({ [item.key]: !config[item.key] } as Partial<CardConfig>)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Privacy gets its own group rather than a slot in the list above. It is
            the only control that removes something from the card, and the only one
            that ships off -- so "everything in this group hides" is a promise the
            heading can actually keep. Promoting it inside the footer list would
            leave it sitting among four switches that add. */}
        <section class="control-section">
          <span class="control-label">
            <span>{t.privacy}</span>
          </span>
          <div class="toggles-list">
            <Toggle
              label={t.blurAuthor}
              checked={Boolean(config.blurAuthor)}
              onToggle={() => updateConfig({ blurAuthor: !config.blurAuthor })}
              title={t.blurAuthorHint}
            />
          </div>
        </section>

        {/* Collapsible low-frequency settings */}
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
            {/* Language opens the disclosure. It is the slowest-moving control in
                the panel -- set once, then read rather than changed -- and it is
                the one about to grow past two options, which is a shape a fixed
                row cannot hold. Inside here it costs one tap when it is actually
                wanted and nothing when it is not. */}
            <div class="control-section control-row-inline">
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

            {/* Padding and radius are the knobs that go with the theme chosen
                above, so the settings proper open with them -- one tap from the
                theme rather than a screen and a half. */}
            <div class="control-section">
              <span class="control-label">
                <span>{t.layoutAndStyle}</span>
              </span>
              <span class="control-sub-label">{t.padding}</span>
              <Segmented
                name={t.padding}
                options={PADDING_OPTIONS}
                value={config.padding}
                onSelect={(next) => updateConfig({ padding: next as PaddingOption })}
              />
              <span class="control-sub-label">{t.borderRadius}</span>
              <Segmented
                name={t.borderRadius}
                options={RADIUS_OPTIONS}
                value={config.borderRadius}
                onSelect={(next) => updateConfig({ borderRadius: next as RadiusOption })}
                labels={{ theme: t.borderRadiusFollowTheme }}
                titles={{ theme: t.borderRadiusFollowTheme }}
              />
            </div>

            {/* The canvas: the picture the card is mounted on. It sits with
                padding and radius rather than with the card's own shape because
                it is a property of the sheet the card is presented on, not of
                the card -- and because all three are the knobs a user reaches
                for once the theme is settled. */}
            <div class="control-section">
              <span class="control-label">
                <span>{t.canvas}</span>
              </span>
              <span class="control-sub-label">{t.canvasRatio}</span>
              <Segmented
                name={t.canvasRatio}
                options={CANVAS_RATIO_OPTIONS}
                value={config.canvasRatio ?? 'auto'}
                onSelect={(next) => updateConfig({ canvasRatio: next as CanvasRatioOption })}
                labels={{ auto: t.canvasRatioAuto }}
              />
              <span class="control-sub-label">{t.canvasBackground}</span>
              <SwatchRow
                name={t.canvasBackground}
                options={CANVAS_BACKGROUND_ORDER}
                value={config.canvasBackground ?? 'none'}
                onSelect={(next) => updateConfig({ canvasBackground: next })}
                labels={canvasBackgroundLabels(t)}
                theme={config.theme}
              />
            </div>

            <div class="control-section">
              <span class="control-label">
                <Square size={14} strokeWidth={2} />
                <span>{t.presentation}</span>
              </span>
              <div class="toggles-list">
                {presentationToggles.map((item) => (
                  <Toggle
                    key={String(item.key)}
                    label={item.label}
                    checked={config[item.key] !== false}
                    title={item.title}
                    onToggle={() =>
                      updateConfig({ [item.key]: config[item.key] === false } as Partial<CardConfig>)
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky primary action bar — always reachable regardless of scroll position */}
      <div class="export-actions">
        <div class="status-region" role="status" aria-live="polite">
          {statusMessage && (
            <div
              class={`status-message ${isErrorStatus ? 'is-error' : isWarningStatus ? 'is-warning' : ''}`}
            >
              {statusMessage}
            </div>
          )}
        </div>
        {/* Two reasons this is a sibling of the live region rather than a child:
            the failure text is asserted verbatim (F24.7), so a button next to it
            must not join `textContent`; and a control inside `role="status"` is
            announced as part of every message, then removed on retry while it
            still holds focus -- which drops a keyboard user out of the dialog. */}
        {onRetry && !isExporting && (
          <div class="status-retry-row">
            <button type="button" class="status-retry" onClick={onRetry}>
              {t.retryExport}
            </button>
          </div>
        )}
        {/* The exported pixel size belongs here rather than under the aspect ratio,
            which it used to sit beneath. It is not that control's output: the card's
            height moves with padding, radius and the media grid as well, so under the
            ratio it read as though only the ratio changed it. Stated next to the
            button that produces it, it reads as what it is -- what you are about to
            export. Hidden until the card has been measured, so a frame does not show a
            zero-height figure. */}
        {exportSize && (
          <span class="control-hint export-size-hint">
            {(exportSize.impossible
              ? t.exportSizeImpossible
              : exportSize.reduced
                ? t.exportSizeReduced
                : t.exportSize
            )
              .replace('{w}', String(exportSize.width))
              .replace('{h}', String(exportSize.height))
              .replace('{scale}', String(exportSize.scale ?? ''))}
          </span>
        )}
        {/* Beside the size, not inside it: the size is a fact and this is advice
            about the file that fact describes. A square mat pulls a tall card
            back under the line, so it is the readout's own numbers that decide --
            see `isLongCard`. */}
        {exportSize && isLongCard(exportSize) && (
          <span class="control-hint long-card-hint">{t.longCardWarning}</span>
        )}
        <div class="export-buttons">
          <button
            type="button"
            class="btn-primary"
            ref={primaryButtonRef}
            onClick={onExportCopy}
            disabled={isExporting || exportSize?.impossible === true}
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
            disabled={isExporting || exportSize?.impossible === true}
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
