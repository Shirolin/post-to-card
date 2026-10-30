import { Fragment } from 'preact';
import type { JSX, Ref } from 'preact';
import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats, QuoteDepth } from '../../types/tweet.ts';
import type { CardConfig, ImageFitOption, AspectRatioOption, MediaLayoutOption, Locale, BlurOverrides } from '../../types/card.ts';
import { CardQrCode } from './qrcode.ts';
import {
  MAT_PADDING,
  MAT_SHADOW,
  resolveCanvasBackground,
  resolveRadius,
  THEMES,
} from './themes.ts';
import { aspectMinHeight, CARD_WIDTH, CARD_WIDTH_FALLBACK, GRID_TRACKS, MEDIA_MOUNT } from './geometry.ts';
import { planMediaGrid, applyMediaGridPlan, recordShape } from './mediaGrid.ts';
import {
  imageFallbackAttrs,
  avatarFallbackAttrs,
  advanceImageFallback,
  DEFAULT_AVATAR_SRC,
  EXPORT_SWAP_ATTR,
} from './imageFallback.ts';
import { threadSession } from '../threadSession.ts';
import { normalizeOverrides, resolveAuthorBlur } from '../authorPrivacy.ts';
import { formatLocaleTimestamp, getTranslation, resolveLocale } from '../i18n.ts';
import {
  MessageCircle,
  Repeat2,
  Heart,
  ChartNoAxesColumn,
  Bookmark,
  Languages,
  ImageOff,
} from 'lucide-preact';
import { brandMarkSvg } from './brandMark.ts';
import { CARD_BUILD } from '../build.ts';
import { getPhotoPreviewUrl } from '../adapter/urls.ts';

export interface CardProps {
  data: ThreadData | TweetData;
  config: CardConfig;
  onExcludeTweet?: (tweetId: string) => void;
  /**
   * Flips one post's author privacy, named by its thread key. Absent in a
   * context with nobody to click -- the string renderer, a screenshot -- and
   * the card then draws no avatar buttons at all.
   */
  onToggleAuthorBlur?: (key: string) => void;
  /**
   * The quoted authors' privacy for this opening, by `quote:<ownerKey>:<depth>`.
   * Kept out of `CardConfig` because it must not outlive the dialog: a quoted
   * post has no id, so a key that survived would point at another post's quote
   * the next time this thread was opened.
   */
  quoteBlurOverrides?: BlurOverrides;
  onToggleQuoteBlur?: (key: string) => void;
  /**
   * The exported element — the mat the card is mounted on, which is also what a
   * host measures. The preview needs its height to resolve its fit-to-window
   * zoom level, and it is the node the exporter is handed, so it is the mat
   * rather than the card: with a canvas background or a canvas ratio selected
   * the two differ by the ring of mat around the sheet. Optional because the
   * dev harness and the tests render the card with nothing to measure against.
   *
   * Named for the card because that is what a reader of `Card`'s props expects
   * to be handing over, and because the mat only exists to carry it. The
   * measurement in `App` is about the picture, which the prop's comment there
   * says.
   */
  cardRef?: Ref<HTMLDivElement>;
}

function normalizeThreadData(data: ThreadData | TweetData): ThreadData {
  if ('tweets' in data && Array.isArray(data.tweets)) {
    return data;
  }
  const singleTweet = data as TweetData;
  return {
    author: singleTweet.author,
    tweets: [singleTweet],
    isSingle: true,
  };
}

/**
 * Renders one interaction count for the card.
 *
 * X hands these over already localised — `4.6万`, `1.2K`, `84.1M` — so the only
 * job here is to pass those through verbatim and to abbreviate the raw numbers
 * the API paths still carry. The passthrough is decided by "ends in a unit
 * suffix", not by an allow-list of Latin letters: `万` and `亿` are units just
 * like `K`, and a value that falls through to `parseFloat` loses its scale
 * entirely, so `4.6万` used to print as `4.6` — a count silently four orders of
 * magnitude low, next to three siblings that were passed through untouched.
 *
 * A bare number is the one case worth reformatting, and only into the K/M
 * abbreviations the card has room for. Thousands separators are left to
 * `toLocaleString` rather than spelled out, so `12345` reads `12,345`.
 */
function formatStat(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    // A unit suffix — Latin (`K`/`M`/`B`) or CJK (`万`/`亿`) — means X has
    // already rounded for display. Reformatting it again would second-guess a
    // decision made against the same column width this card is fitting.
    if (/[A-Za-z\u4e00-\u9fff]$/.test(value.trim())) return value.trim();
    const num = Number.parseFloat(value.replace(/,/g, ''));
    if (!Number.isNaN(num)) return formatStat(num);
    return value;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toLocaleString();
}

/**
 * The ellipsis that marks a body X cut short, or nothing. Distinct from the
 * author's own text: it takes the material's faint ink so it reads as the
 * card's mark rather than a character the post ended on.
 */
function truncationMark(truncated: boolean | undefined) {
  if (!truncated) return null;
  return <span class="truncation-ellipsis">…</span>;
}

/**
 * Renders multiline text with controlled paragraph spacing.
 *
 * A raw double newline (`\n\n`) inside a `white-space: pre-wrap` element produces
 * a full-height empty line, which combined with body leading (1.68) inflates to
 * ~39px of dead air -- exceeding the inter-tweet gap.
 * Replacing double newlines with a dedicated paragraph-gap marker caps the separation
 * at a natural typographic paragraph gap (~18px), keeping multi-paragraph tweets cohesive.
 */
function renderTextWithParagraphBreaks(text: string, keyPrefix: string | number) {
  if (!text || !/\n\s*\n/.test(text)) {
    return text;
  }
  const clean = text.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
  if (!/\n\s*\n/.test(clean)) {
    return text;
  }
  const parts = clean.split(/\n\s*\n+/);
  return parts.map((part, pIdx) => (
    <Fragment key={`${keyPrefix}-p-${pIdx}`}>
      {pIdx > 0 && <span class="tweet-paragraph-gap" aria-hidden="true" />}
      {part}
    </Fragment>
  ));
}

function renderRichTokens(
  tokens: NonNullable<TweetData['richTokens']>,
  className: string,
  truncated: boolean = false
) {
  return (
    <div class={className}>
      {tokens.map((token, index) => {
        if (token.type === 'mention') {
          return (
            <span key={index} class="token-mention">
              {token.value}
            </span>
          );
        }
        if (token.type === 'hashtag' || token.type === 'cashtag' || token.type === 'emoji') {
          return (
            <span key={index} class={token.type === 'emoji' ? 'token-emoji' : `token-${token.type}`}>
              {token.value}
            </span>
          );
        }
        if (token.type === 'link') {
          return (
            <span key={index} class="token-link">
              {token.value}
            </span>
          );
        }
        return (
          <Fragment key={index}>
            {renderTextWithParagraphBreaks(token.value, index)}
          </Fragment>
        );
      })}
      {truncationMark(truncated)}
    </div>
  );
}

/**
 * Advances a failed picture to the next URL in its chain.
 *
 * The placeholder that covers a picture's cell while it loads sweeps a
 * highlight across it, so it has to know when waiting is over: a chain that ran
 * out is a picture that is not coming, and a cell that keeps sweeping would
 * claim otherwise. The chain
 * carries its own ending (it is the attribute that disappears), so "exhausted"
 * is read off the element after the walk, not reconstructed here.
 *
 * An error the exporter caused is skipped: it rewrites the card's sources while
 * it prepares a render, and a failure there says nothing about the picture the
 * preview is showing.
 */
function handleImageError(event: JSX.TargetedEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.hasAttribute(EXPORT_SWAP_ATTR)) return;
  advanceImageFallback(img);
  if (img.getAttribute('data-fallback') === null && img.naturalWidth === 0) {
    const cell = img.closest ? (img.closest('.media-box') as HTMLElement | null) : null;
    if (cell) cell.classList.add('is-picture-missing');
  }
}

/** Narrowest shape (width / height) a lone cover picture is shown at: 3:4. */
const MIN_LONE_RATIO = 0.75;

function renderMediaGrid(
  media: MediaItem[] | undefined,
  altPrefix: string = 'Tweet photo',
  imageFit: ImageFitOption = 'contain',
  aspectRatio: AspectRatioOption = 'auto',
  mediaLayout: MediaLayoutOption = 'grid',
  videoLabel: string = 'Video',
  showPlayButton: boolean = true
) {
  if (!media || media.length === 0) return null;
  // A mutable copy: a picture that reports its real shape replaces its own entry
  // here, so the next plan sees it. The caller's MediaItems are left untouched.
  let items = media.slice(0, 4);
  const count = items.length;

  // One plan, made from whatever shapes are known now. The images re-plan
  // through the same module when their real shapes arrive, so a grid can only
  // settle differently if the pictures told it something new.
  const gridOptions = { aspectRatio, mediaLayout, imageFit };
  const plan = planMediaGrid(items, gridOptions);

  // A lone picture under `cover` is the one shape the plan does not settle from
  // the picture: there is no line to share and no neighbour to agree with, so a
  // 9:16 video would run the card to nearly twice the column's height. Floor it
  // at 3:4 and crop to that, which bounds the card at 4/3 of the column. 完整展示
  // has no floor — it is the mode that promises the card grows to the picture —
  // and poster ratios and stack state their own ceilings.
  const floorsShape = count === 1 && imageFit === 'cover' && aspectRatio === 'auto' && mediaLayout !== 'stack';
  const shapeOf = (ratio: number) => (floorsShape ? Math.max(ratio, MIN_LONE_RATIO) : ratio);

  // Both an image and a video poster settle the grid the same way: record the
  // shape it reported, re-plan, and write the plan back. The plan takes the
  // picture's own shape; only the lone-cover floor above can overrule it.
  const settleGrid = (imgEl: HTMLImageElement, index: number) => {
    // A load the exporter caused is not the picture arriving: it swapped the
    // src for a data URL to keep the canvas origin-clean, and will put the real
    // one back. Recording its shape (the grey stand-in is 1:1) or calling the
    // cell loaded would outlive the export.
    if (imgEl.hasAttribute(EXPORT_SWAP_ATTR)) return;
    // The photograph has painted, so the cell's placeholder has done its job.
    // The mark goes on the cell rather than on the picture because the
    // placeholder is the cell's child; the picture itself never carries preview
    // state, since it is the node the exporter draws.
    const cell = imgEl.closest ? (imgEl.closest('.media-box') as HTMLElement | null) : null;
    if (cell) cell.classList.add('is-picture-loaded');
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;
    const ratio = Number((imgEl.naturalWidth / imgEl.naturalHeight).toFixed(3));
    const settled = recordShape(items, index, ratio);
    if (settled === items) return;
    items = settled;
    const next = planMediaGrid(items, gridOptions);
    const grid = imgEl.closest ? (imgEl.closest('.media-grid') as HTMLElement) : null;
    if (grid) applyMediaGridPlan(grid, next);
    // The picture's box is the picture's rectangle, so it takes the shape the
    // browser actually decoded — the plan's slot when it has one, because that
    // is the shape the cell beside it was weighted against.
    const box = imgEl.closest ? (imgEl.closest('.media-box') as HTMLElement | null) : null;
    if (box) {
      const boxRatio = shapeOf(next.slots?.[index]?.ratio ?? ratio);
      box.style.aspectRatio = String(boxRatio);
      // The first paint only knew X's declared shape; if the decoded one is
      // taller and the cover floor crops it, the picture has to cover the box
      // it was just given, not letterbox inside it.
      if (boxRatio !== ratio) imgEl.style.objectFit = 'cover';
    }
  };

  return (
    <div
      class="media-grid"
      data-count={count}
      data-layout={mediaLayout}
      data-grid-layout={plan.layout}
      style={{
        aspectRatio: plan.aspectRatio,
        gridTemplateColumns: plan.columns,
      }}
    >
      {items.map((m, idx) => {
        const isVideo = m.type === 'video' || m.type === 'gif';
        // In 完整展示 the plan gives each cell the width its own picture takes of
        // its line; a crop keeps the track the stylesheet gives it.
        const slot = plan.slots?.[idx];
        const boxRatio = slot ? slot.ratio : m.aspectRatio === undefined ? undefined : shapeOf(m.aspectRatio);
        // A floored box is a crop, so the picture has to cover it; 完整展示 and
        // the unfloored crop both leave the picture to its own fit rule.
        const cropsToFloor = boxRatio !== undefined && m.aspectRatio !== undefined && boxRatio !== m.aspectRatio;
        // The picture's small variant, for the blurred stand-in. Derived from
        // the mounted source, so a recovered picture keeps its preview; null for
        // anything X did not serve, which leaves the tone block alone.
        const previewUrl = getPhotoPreviewUrl(m.url);

        return (
          <div
            key={idx}
            class={isVideo ? 'media-item media-video-item' : 'media-item'}
            style={slot ? { width: slot.width } : undefined}
          >
            {/* The cell is the grid's track. This is the picture's own box: the
                one the fit mode sizes, and the corner the play badge sits on.
                Its ratio starts from X's own width/height, when the extractor
                read them, and is corrected below once the picture has loaded. */}
            <div class="media-box" style={{ aspectRatio: boxRatio ? `${boxRatio}` : undefined }}>
              <img
                src={m.url}
                alt={m.alt || `${altPrefix} ${idx + 1}`}
                class="media-picture"
                style={cropsToFloor ? { objectFit: 'cover' } : undefined}
                loading="eager"
                {...imageFallbackAttrs(m)}
                onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => settleGrid(e.currentTarget, idx)}
                onError={handleImageError}
              />
              {/* The cell's tone while the photograph is in flight. X serves
                  pictures from a host whose latency nobody here controls, and
                  until one decodes the cell is a transparent hole inside a
                  finished frame: the card reads as done and broken at once. A
                  recessed block in the material's own ink states "a picture goes
                  here", and covers the cell until the picture has painted --
                  then it fades out over it, so the photograph dissolves in
                  rather than replacing a hole. Above the picture so that the
                  dissolve is the placeholder going, not the picture arriving
                  late; below the play badge, which is the one thing that may sit
                  on a poster that is not there yet.

                  Inside it, in order: the picture's own small variant, blurred,
                  and a highlight that sweeps the block until that variant
                  arrives. The blur is what makes the wait read as a photograph
                  coming into focus rather than as an empty or missing slot; the
                  small file is derived from the mounted source
                  (`getPhotoPreviewUrl`) and is a fraction of its size, so it
                  usually lands first. No icon while waiting: a picture glyph over
                  a grey block reads as a broken image, which is the one thing a
                  wait must not look like.

                  A picture whose whole chain failed gets the crossed mark
                  instead, and the blur is hidden there too: the preview would
                  keep showing a picture that is not coming. The mark lives in
                  the tree and styles reveal it from the cell's classes, because
                  `is-picture-loaded` / `is-picture-missing` are written
                  imperatively and never re-render.

                  Deliberately kept out of the export: the engine waits for every
                  picture to decode, and a stand-in for a picture must never end
                  up in the file. The preview is inside this node, so it goes with
                  it. */}
              <span
                class="media-placeholder"
                aria-hidden="true"
                data-html2canvas-ignore="true"
              >
                {previewUrl && (
                  <img
                    class="media-placeholder-preview"
                    src={previewUrl}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) =>
                      e.currentTarget.parentElement?.classList.add('is-preview-ready')
                    }
                    // A small variant that fails is not a picture that failed:
                    // the full picture is still on its way, so the cell keeps
                    // waiting. Only the sweep stops, because nothing is left to
                    // announce -- it would otherwise keep promising an arrival
                    // that is no longer going to happen (`is-picture-missing`
                    // stays the cell's answer for the picture itself).
                    onError={(e: JSX.TargetedEvent<HTMLImageElement>) =>
                      e.currentTarget.parentElement?.classList.add('is-preview-failed')
                    }
                  />
                )}
                <ImageOff class="media-placeholder-icon" aria-hidden="true" />
              </span>
              {/* Play badge sits on the poster without a scrim: the pill is
                  opaque, so a gradient would only dim the image. */}
              {isVideo && showPlayButton && (
                <div class="video-indicator-badge">
                  {m.type === 'gif' ? (
                    <span class="video-badge-pill gif-badge">GIF</span>
                  ) : (
                    <div class="video-badge-pill">
                      <svg class="video-play-icon" viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                        <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
                      </svg>
                      <span class="video-duration-text">{m.duration || videoLabel}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderAuthorAvatar(author: AuthorInfo, isBlurred: boolean, toggle?: AuthorToggle) {
  if (!toggle) {
    const blurClass = isBlurred ? 'is-blurred' : '';
    return (
      <div class={`author-avatar ${blurClass}`}>
        <img
          src={author.avatarUrl || DEFAULT_AVATAR_SRC}
          alt={author.name}
          class={`author-avatar-img ${blurClass}`}
          {...avatarFallbackAttrs(author)}
          onError={handleImageError}
        />
      </div>
    );
  }
  return withPrivacyToggle(author, isBlurred, toggle);
}

/**
 * An avatar as its post's privacy switch: the avatar element itself becomes the
 * button, rather than being wrapped by one. A wrapper that carried
 * `data-html2canvas-ignore` would put the portrait inside a node the export
 * removes, so the card would export with no faces at all.
 *
 * Because it *is* the author block, it keeps the block's own classes: the
 * portrait's blur stays on the picture (and on the name and handle beside it),
 * and the block is marked `is-blurred` the way it always was -- that is the
 * class `.author-avatar.is-blurred img` and the privacy assertions name. What
 * must never happen is a *separate* wrapper carrying it.
 *
 * The blur is what the export draws too: the rasterizer copies computed styles,
 * so a hidden author is a blurred face in the picture rather than a hole in it.
 */
function withPrivacyToggle(author: AuthorInfo, isBlurred: boolean, toggle: AuthorToggle) {
  const blurClass = isBlurred ? 'is-blurred' : '';
  return (
    <button
      type="button"
      class={`author-avatar author-privacy-toggle ${blurClass}`}
      aria-label={isBlurred ? toggle.show : toggle.hide}
      aria-pressed={isBlurred}
      title={`${isBlurred ? toggle.titleHidden : toggle.titleVisible} — ${toggle.followGlobal}`}
      onClick={(e) => {
        e.stopPropagation();
        toggle.onToggle();
      }}
    >
      <img
        src={author.avatarUrl || DEFAULT_AVATAR_SRC}
        alt={author.name}
        class={`author-avatar-img ${blurClass}`}
        {...avatarFallbackAttrs(author)}
        onError={handleImageError}
      />
    </button>
  );
}

/**
 * What the on-avatar button says and does, resolved once per post by `Card`.
 *
 * The words describe the *visible* state: the label is what the click will do,
 * the title is what is on screen and how to get back to the default. A control
 * whose label promised the next state instead read as "Show this author" in
 * front of a sharp face.
 */
interface AuthorToggle {
  /** `aria-label` while the author is hidden: the click will show them. */
  show: string;
  /** `aria-label` while the author is shown: the click will hide them. */
  hide: string;
  /** `title` while hidden. */
  titleHidden: string;
  /** `title` while shown. */
  titleVisible: string;
  /** The way back to the default, named in the title. */
  followGlobal: string;
  onToggle: () => void;
}

function renderAuthorDetails(author: AuthorInfo, isBlurred: boolean, verifiedTitle: string = 'Verified') {
  const blurClass = isBlurred ? 'is-blurred' : '';
  return (
    <div class="author-details">
      <div class="author-name-row">
        <span class={`author-name ${blurClass}`}>{author.name}</span>
        {author.verified && (
          <span class="verified-badge" title={verifiedTitle}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.3 11.96l1.41-1.41 2.83 2.83 6.36-6.36 1.41 1.41-7.77 7.77z" />
            </svg>
          </span>
        )}
      </div>
      <span class={`author-handle ${blurClass}`}>{author.handle}</span>
    </div>
  );
}

function renderAuthorHeader(
  author: AuthorInfo,
  isBlurred: boolean,
  verifiedTitle: string = 'Verified',
  toggle?: AuthorToggle
) {
  const blurClass = isBlurred ? 'is-blurred' : '';
  return (
    <div class={`author-header ${blurClass}`}>
      {renderAuthorAvatar(author, isBlurred, toggle)}
      {renderAuthorDetails(author, isBlurred, verifiedTitle)}
    </div>
  );
}

/**
 * Attribution line for a retweet. The body belongs to the original author, so
 * the card states plainly whose words these are.
 */
function renderRetweetNotice(tweet: TweetData, label: string) {
  if (!tweet.retweetedBy) return null;
  return (
    <div class="retweet-notice">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14z" />
      </svg>
      <span>{label}</span>
      <span class="retweet-handle">{tweet.retweetedBy}</span>
    </div>
  );
}

/**
 * X's own "translated from <language>" notice, reproduced verbatim above the
 * body. It is attribution from the source page rather than card UI, so it is not
 * re-localized into the card's locale.
 */
function renderTranslationNotice(tweet: TweetData) {
  if (!tweet.translatedFrom) return null;
  return (
    <div class="translation-notice">
      <Languages class="translation-notice-icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span>{tweet.translatedFrom}</span>
    </div>
  );
}

/**
 * True when a stats object would render at least one metric. Kept separate so
 * the card footer can decide whether it has content without duplicating the
 * formatting rules.
 */
export function hasRenderableStats(stats: TweetStats | undefined): boolean {
  if (!stats) return false;
  return Boolean(
    formatStat(stats.replies) ||
      formatStat(stats.reposts) ||
      formatStat(stats.likes) ||
      formatStat(stats.views) ||
      formatStat(stats.bookmarks)
  );
}

function renderStats(stats: TweetStats | undefined, t: ReturnType<typeof getTranslation>) {
  if (!stats) return null;
  const replyStr = formatStat(stats.replies);
  const repostStr = formatStat(stats.reposts);
  const likeStr = formatStat(stats.likes);
  const viewsStr = formatStat(stats.views);
  const bookmarkStr = formatStat(stats.bookmarks);

  const hasAnyStat = replyStr || repostStr || likeStr || viewsStr || bookmarkStr;
  if (!hasAnyStat) return null;

  return (
    <div class="stats-row">
      {replyStr && (
        <span class="stat-item" title={`${replyStr} ${t.replies}`}>
          <MessageCircle class="stat-icon" size={15} strokeWidth={1.6} aria-hidden="true" />
          {replyStr}
        </span>
      )}
      {repostStr && (
        <span class="stat-item" title={`${repostStr} ${t.reposts}`}>
          <Repeat2 class="stat-icon" size={15} strokeWidth={1.6} aria-hidden="true" />
          {repostStr}
        </span>
      )}
      {likeStr && (
        <span class="stat-item" title={`${likeStr} ${t.likes}`}>
          <Heart class="stat-icon" size={15} strokeWidth={1.6} aria-hidden="true" />
          {likeStr}
        </span>
      )}
      {viewsStr && (
        <span class="stat-item" title={`${viewsStr} ${t.views}`}>
          <ChartNoAxesColumn class="stat-icon" size={15} strokeWidth={1.6} aria-hidden="true" />
          {viewsStr}
        </span>
      )}
      {!viewsStr && bookmarkStr && (
        <span class="stat-item" title={`${bookmarkStr} ${t.bookmarks}`}>
          <Bookmark class="stat-icon" size={15} strokeWidth={1.6} aria-hidden="true" />
          {bookmarkStr}
        </span>
      )}
    </div>
  );
}

/**
 * How deep in the quote chain a rendered quote panel sits. Bounded by the
 * shared `QUOTE_LEVELS`: the renderer never prints a level the channels never
 * extract. It reaches the DOM as a data attribute so card.css can step the
 * recess one level deeper per level — the component chooses the structure, the
 * material chooses how it reads.
 */

function renderQuoteCard(
  quotePost: NonNullable<TweetData['quotePost']>,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption,
  aspectRatio: AspectRatioOption,
  mediaLayout: MediaLayoutOption,
  showPlayButton: boolean,
  locale: Locale,
  blurred: boolean,
  nestedBlurred: boolean,
  onToggle?: () => void,
  depth: QuoteDepth = 1
) {
  const { author, text, richTokens, timestamp, url } = quotePost;
  const timestampText = timestamp ? formatLocaleTimestamp(timestamp, locale) : '';
  // Privacy blurs the quoted author too: a quote panel is still someone's name
  // and face, and leaving it sharp would undo the byline blur beside it. That
  // decision now arrives resolved, because a quoted author is the one author
  // the user can single out for themselves (the level-1 panel).
  const blurClass = blurred ? 'is-blurred' : '';

  if (quotePost.isUnavailable) {
    return (
      <div class="quote-card quote-card-unavailable">
        <span class="quote-unavailable-text">{t.unavailablePost}</span>
      </div>
    );
  }

  const toggle: AuthorToggle | undefined = onToggle
    ? {
        show: t.authorBlurToggleOff,
        hide: t.authorBlurToggleOn,
        titleHidden: t.authorBlurStateHidden,
        titleVisible: t.authorBlurStateVisible,
        followGlobal: t.authorFollowGlobal,
        onToggle,
      }
    : undefined;
  /** The trailing space keeps the `"is-blurred "` spelling this element has
   * always had, so the markup around the option is unchanged. */
  const avatar = (
    <img
      src={author.avatarUrl || DEFAULT_AVATAR_SRC}
      alt={author.name}
      class={`quote-avatar ${blurClass}`}
      loading="eager"
      {...avatarFallbackAttrs(author)}
      onError={handleImageError}
    />
  );

  return (
    <div class="quote-card" data-quote-depth={depth}>
      <div class="quote-author">
        {/* The level-1 quoted author is its own target: the quote panel is the
            only place a second person appears, and the same click has to work
            there. A deeper panel draws no button -- its author is not the author
            of the post being printed, and has nowhere of its own to be clicked.

            The button deliberately carries no `data-html2canvas-ignore`: the
            portrait is inside it, and the engine removes every ignored node
            before rasterizing, which would take the quoted author's face out of
            every export. Only the privacy mark is preview furniture. */}
        {toggle ? (
          <button
            type="button"
            class="author-privacy-toggle"
            aria-label={blurred ? toggle.show : toggle.hide}
            aria-pressed={blurred}
            title={`${blurred ? toggle.titleHidden : toggle.titleVisible} — ${toggle.followGlobal}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle.onToggle();
            }}
          >
            {avatar}
          </button>
        ) : (
          avatar
        )}
        <span class={`quote-name ${blurClass}`}>{author.name}</span>
        {author.verified && (
          <span class="verified-badge quote-verified-badge" title={t.verified}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.19 1.91-2.19 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.3 11.96l1.41-1.41 2.83 2.83 6.36-6.36 1.41 1.41-7.77 7.77z" />
            </svg>
          </span>
        )}
        <span class={`quote-handle ${blurClass}`}>{author.handle}</span>
        {timestampText && (
          url ? (
            <a
              class="quote-timestamp quote-timestamp-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
            >
              {timestampText}
            </a>
          ) : (
            <span class="quote-timestamp">{timestampText}</span>
          )
        )}
      </div>
      {richTokens && richTokens.length > 0 ? (
        renderRichTokens(richTokens, 'quote-text')
      ) : text ? (
        <div class="quote-text">{renderTextWithParagraphBreaks(text, 'quote')}</div>
      ) : null}
      {renderMediaGrid(quotePost.media, t.photoAlt, imageFit, aspectRatio, mediaLayout, t.videoLabel, showPlayButton)}
      {/* A quoted post can itself quote someone. That further post renders as
          its own quote panel inside this one, so the chain reads as the nesting
          it is rather than as one flat list of bodies. Two levels, no more: the
          card prints a quote's words and pictures, not a transcript of the chain
          behind it. Its author is not the author of the post being printed and
          has no place of its own to be clicked, so it follows the global switch
          alone. */}
      {quotePost.quotePost && renderQuoteCard(
        quotePost.quotePost,
        t,
        imageFit,
        aspectRatio,
        mediaLayout,
        showPlayButton,
        locale,
        nestedBlurred,
        nestedBlurred,
        undefined,
        2
      )}
    </div>
  );
}

/**
 * The lead the card prints under an article: what the post says about it.
 *
 * The post's own body comes first, because those are the author's words about
 * the article. When the post says nothing, the article's own opening line stands
 * in so the block never ends as an untitled cover with no context.
 */
function renderArticleLead(tweet: TweetData) {
  if (tweet.richTokens && tweet.richTokens.length > 0) {
    return renderRichTokens(tweet.richTokens, 'tweet-text-content', tweet.truncated);
  }
  if (tweet.text) {
    return (
      <div class="tweet-text-content">
        {renderTextWithParagraphBreaks(tweet.text, 'article-lead')}
        {truncationMark(tweet.truncated)}
      </div>
    );
  }
  if (tweet.article?.openingLine) {
    return <div class="tweet-text-content">{renderTextWithParagraphBreaks(tweet.article.openingLine, 'article-lead')}</div>;
  }
  return null;
}

/**
 * The block a long-form post's article renders as.
 *
 * Order is the one chosen for the card: cover, then what the article is called,
 * then what the post says about it. The cover takes the same MediaItem shape as
 * any other picture, so it is mounted with the theme's own media frame and
 * honours the user's image-fit choice rather than growing a second picture
 * treatment.
 *
 * The article's prose is not printed. It runs to thousands of words and a card
 * is a poster; the cover, the title and the post's own lead are what make the
 * article recognisable when the card is shared.
 */
function renderArticleBlock(
  article: NonNullable<TweetData['article']>,
  lead: JSX.Element | null,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption
) {
  return (
    <div class="article-block">
      {article.cover &&
        renderMediaGrid([article.cover], t.articleAlt, imageFit, 'auto', 'grid', undefined, false)}
      <div class="article-head">
        <span class="article-kicker">{t.articleKicker}</span>
        <div class="article-title">{article.title}</div>
      </div>
      {lead}
    </div>
  );
}

function renderTweetContent(tweet: TweetData, t: ReturnType<typeof getTranslation>, imageFit: ImageFitOption) {
  // A post carrying an article renders as the article, with the post's own words
  // as its lead.
  let body: JSX.Element | null;
  if (tweet.article) {
    body = renderArticleBlock(tweet.article, renderArticleLead(tweet), t, imageFit);
  } else if (tweet.richTokens && tweet.richTokens.length > 0) {
    body = renderRichTokens(tweet.richTokens, 'tweet-text-content', tweet.truncated);
  } else {
    body = (
      <div class="tweet-text-content">
        {renderTextWithParagraphBreaks(tweet.text, 'tweet-body')}
        {truncationMark(tweet.truncated)}
      </div>
    );
  }

  // X only gave the DOM a preview of a long post. The body ends in an ellipsis
  // above; this line says what that ellipsis means, so the preview is not read
  // as the author's complete post.
  if (!tweet.truncated) return body;
  return (
    <>
      {body}
      <div class="truncation-notice">{t.truncatedContent}</div>
    </>
  );
}

function renderSingleTweet(
  tweet: TweetData,
  config: CardConfig,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption,
  mediaLayout: MediaLayoutOption,
  locale: Locale,
  blurred: boolean,
  toggle: AuthorToggle | undefined,
  quoteBlurred: boolean,
  quoteToggle: (() => void) | undefined
) {
  return (
    <div class="single-tweet-block">
      {renderRetweetNotice(tweet, t.retweetedBy)}
      {renderAuthorHeader(tweet.author, blurred, t.verified, toggle)}
      {renderTranslationNotice(tweet)}
      {renderTweetContent(tweet, t, imageFit)}
      {renderMediaGrid(tweet.media, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
      {tweet.quotePost && renderQuoteCard(
        tweet.quotePost,
        t,
        imageFit,
        config.aspectRatio,
        mediaLayout,
        config.showPlayButton !== false,
        locale,
        quoteBlurred,
        config.blurAuthor,
        quoteToggle
      )}
    </div>
  );
}

function renderThreadTweet(
  tweet: TweetData,
  isLast: boolean,
  config: CardConfig,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption,
  mediaLayout: MediaLayoutOption,
  onExcludeTweet: ((tweetId: string) => void) | undefined,
  canExclude: boolean | undefined,
  locale: Locale,
  blurred: boolean,
  toggle: AuthorToggle | undefined,
  quoteBlurred: boolean,
  quoteToggle: (() => void) | undefined
) {
  // The button only exists for a post that has an id. A post without one is
  // keyed by position, which means something different in a different thread,
  // so it is not offered a button here at all.
  const tweetId = tweet.id;
  return (
    <div class="thread-item" data-tweet-id={tweetId}>
      {/* On-card quick exclude button */}
      {canExclude && onExcludeTweet && tweetId && (
        <button
          type="button"
          class="thread-exclude-btn"
          title={t.excludeThisTweet}
          aria-label={t.excludeThisTweet}
          onClick={(e) => {
            e.stopPropagation();
            onExcludeTweet(tweetId);
          }}
          data-html2canvas-ignore="true"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}

      {/* Left Column: Avatar + Continuous Timeline Line */}
      <div class="thread-gutter">
        {renderAuthorAvatar(tweet.author, blurred, toggle)}
        {!isLast && <div class="thread-connector-line" />}
      </div>

      {/* Right Column: Author Info + Content + Media + Quote */}
      <div class="thread-content-col">
        {renderRetweetNotice(tweet, t.retweetedBy)}
        {renderAuthorDetails(tweet.author, blurred, t.verified)}
        {renderTranslationNotice(tweet)}
        {renderTweetContent(tweet, t, imageFit)}
        {renderMediaGrid(tweet.media, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
        {tweet.quotePost && renderQuoteCard(
          tweet.quotePost,
          t,
          imageFit,
          config.aspectRatio,
          mediaLayout,
          config.showPlayButton !== false,
          locale,
          quoteBlurred,
          config.blurAuthor,
          quoteToggle
        )}
      </div>
    </div>
  );
}
export function Card({
  data,
  config,
  onExcludeTweet,
  onToggleAuthorBlur,
  quoteBlurOverrides,
  onToggleQuoteBlur,
  cardRef,
}: CardProps): JSX.Element {
  // One resolution per render: the dictionary, the quote cards' timestamps and
  // the footer date all read it, and resolving again at each call site would be
  // four chances for `'auto'` to be answered differently within one card.
  const locale = resolveLocale(config.locale);
  const t = getTranslation(locale);
  const thread = normalizeThreadData(data);
  // The one answer to which posts this card is showing, and to whether one
  // more may be dropped. The controls panel and the preview summary read the
  // same session, so the exclude buttons on the card only appear while a post
  // may actually be dropped.
  const session = threadSession(thread, config.excludedTweetIds);
  const effectiveTweets = session.showing;

  // One answer per post, made here and handed down. The key is the session's
  // own: deriving `tweet.id || String(index)` again would be a second copy of a
  // rule the panel already owns, and the two copies are what drift.
  const overrides = normalizeOverrides(config.authorBlurOverrides);
  const quoteModes = normalizeOverrides(quoteBlurOverrides);
  const quotedKey = (ownerKey: string, depth: QuoteDepth) => `quote:${ownerKey}:${depth}`;

  /**
   * What the on-avatar button says, for one author.
   *
   * Only a post with an id gets one. A post without one is keyed by position,
   * which names a different post in a different thread, so an override written
   * against it would land on a stranger -- the same reason the exclude chip has
   * never been offered there.
   */
  const authorToggle = (
    key: string | undefined,
    onToggle: ((key: string) => void) | undefined
  ): AuthorToggle | undefined => {
    if (!key || !onToggle) return undefined;
    return {
      show: t.authorBlurToggleOff,
      hide: t.authorBlurToggleOn,
      titleHidden: t.authorBlurStateHidden,
      titleVisible: t.authorBlurStateVisible,
      followGlobal: t.authorFollowGlobal,
      onToggle: () => onToggle(key),
    };
  };

  /** The toggle for the quote panel hanging off the post whose key is `ownerKey`. */
  const quoteToggle = (
    ownerKey: string,
    ownerHasId: boolean
  ): (() => void) | undefined => {
    if (!ownerHasId || !onToggleQuoteBlur) return undefined;
    const key = quotedKey(ownerKey, 1);
    return () => onToggleQuoteBlur(key);
  };

  /**
   * The thread key a post is named by, taken from the session's own rows.
   *
   * Both branches below look their post up this way. The single-post layout
   * prints `effectiveTweets[0]`, which is not necessarily the thread's first
   * post -- excluding the others, or letting the floor put the target back,
   * changes which post that is -- so reading `rows[0]` there named a different
   * post than the one on the card. The session already answers "which key does
   * this post have"; asking it once keeps the two layouts from drifting.
   */
  const keyOf = (tweet: TweetData): string =>
    session.rows.find((row) => row.tweet === tweet)?.key ?? '';

  /**
   * A post's own author, the quote hanging off it, and the quote of that quote.
   *
   * The quoted author follows the post's key. The level-2 author is neither this
   * post's author nor anyone with a clickable place of its own, so it answers to
   * the global switch alone -- agreed with the user on 2026-10-28.
   */
  const authorState = (tweet: TweetData) => {
    const key = keyOf(tweet);
    const ownerHasId = Boolean(tweet.id);
    const blurred = resolveAuthorBlur(overrides[key], config.blurAuthor);
    return {
      blurred,
      toggle: authorToggle(ownerHasId ? key : undefined, onToggleAuthorBlur),
      quoteBlurred: resolveAuthorBlur(quoteModes[quotedKey(key, 1)], config.blurAuthor),
      quoteToggle: quoteToggle(key, ownerHasId),
    };
  };

  const isThread = effectiveTweets.length > 1;
  const mainTweet = effectiveTweets[0];

  const imageFit = config.imageFit || 'contain';
  const mediaLayout = config.mediaLayout || 'grid';
  // The stored option resolves to the card's own corner and the corner inside
  // it; both are injected, so the stylesheet never has to re-derive either.
  const radius = resolveRadius(config.borderRadius, config.theme);
  const mediaRadius = radius.media;
  const tokens = THEMES[config.theme].tokens;
  const minHeightStyle = aspectMinHeight(config.aspectRatio, CARD_WIDTH);

  // Every option is carried by its data attribute alone, on the one element that
  // owns it: the card root for fit and layout, the media grid for the planned
  // arrangement and the picture count. Each used to be emitted two or three ways
  // -- a class here, an attribute there, the planner's own class on top -- and
  // card.css matched whichever it happened to name. Same element, same
  // specificity, same block, so the extra spellings decided nothing the survivor
  // did; they only meant an option could be renamed in one place and silently
  // keep its old styling in the other. Rules that need an option on a child
  // reach it through the root, which is what a descendant selector is for.
  //
  // The root therefore has no second class: `post-to-card-target` is the whole
  // list, and `cardRootStyle` in the tests reads the first class of the tag.

  // Only render the footer when it actually has content, otherwise its top
  // border and padding leave a stray divider at the bottom of the card.
  const footerTimestamp = config.showTimestamp
    ? formatLocaleTimestamp(mainTweet.timestamp, locale)
    : '';
  const hasFooterStats = Boolean(config.showStats && hasRenderableStats(mainTweet.stats));
  const hasFooterLeft = Boolean(footerTimestamp || hasFooterStats);
  const hasFooterRight = Boolean(
    config.showWatermark || (config.showQrCode && mainTweet.url)
  );
  const showFooter = hasFooterLeft || hasFooterRight;

  // The mat is the exported picture; the card is what is mounted on it. Both
  // options default to "off", and `matActive` is what keeps that literal: with
  // neither selected the mat contributes no padding and no background, so the
  // export is the card's own box, exactly as it was before the mat existed.
  const canvasRatio = config.canvasRatio ?? 'auto';
  const canvasBackground = config.canvasBackground ?? 'none';
  const matActive = canvasBackground !== 'none' || canvasRatio !== 'auto';
  const matBackground = resolveCanvasBackground(canvasBackground, config.theme);

  // The outer shadow is only added on a mat, and `none` has to be dropped
  // before joining: `box-shadow: none, 0 2px 6px ...` is an invalid value, and
  // the browser throws the whole declaration away -- including the theme's own
  // shadow, which several materials do set.
  const cardShadow =
    matActive && config.canvasShadow
      ? [tokens.shadow === 'none' ? '' : tokens.shadow, MAT_SHADOW].filter(Boolean).join(', ')
      : tokens.shadow;

  return (
    <div
      id="post-to-card-export-target"
      ref={cardRef}
      class="ptc-mat"
      lang={locale}
      data-canvas-ratio={canvasRatio}
      style={{
        // The card's own width, injected here so the mat's floor and the card's
        // box are built on the same number: the stylesheet reads it, it does
        // not keep its own. The card inherits it from this element.
        '--card-width': CARD_WIDTH_FALLBACK,
        '--mat-pad': matActive ? MAT_PADDING : '0px',
        // Omitted rather than set to 'none': an unset custom property and a
        // `none` background paint the same, and leaving it off keeps the
        // default export's inline style identical to the pre-mat one.
        '--mat-bg': matBackground || undefined,
      }}
    >
      <div
        class="post-to-card-target"
        data-theme={config.theme}
        data-padding={config.padding}
        data-radius={config.borderRadius}
        data-ratio={config.aspectRatio}
        data-fit={imageFit}
        data-signature={tokens.signature.style === 'none' ? undefined : tokens.signature.style}
        data-quote-style={tokens.quoteStyle}
        data-media-frame={tokens.mediaFrame}
        data-meta-divider={tokens.metaDivider ? 'on' : undefined}
        data-keyline={tokens.keyline ? 'on' : undefined}
        data-stat-chip={tokens.statChip ? 'on' : undefined}
        style={{
          padding: config.padding,
          borderRadius: radius.card,
          boxShadow: cardShadow,
          // Every theme colour, the type pair, the signature geometry and the
          // rhythm come from the token table and are injected here. card.css only
          // consumes them, so there is one place to edit a theme and no second
          // copy to drift out of sync. The mount a picture is hung on and the
          // grid's hero weights are geometry, and they are injected the same
          // way: the stylesheet reads them, it does not keep its own numbers.
          '--surface': tokens.surface,
          '--text': tokens.text,
          '--text-sec': tokens.muted,
          '--faint': tokens.faint,
          '--accent': tokens.accent,
          '--link': tokens.link,
          '--border-color': tokens.border,
          '--divider': tokens.divider,
          '--quote-bg': tokens.quoteBackground,
          '--quote-border': tokens.quoteBorder,
          '--qr-fill': tokens.qrFill,
          '--media-border': tokens.mediaBorder,
          '--mat': tokens.mat,
          '--rule-style': tokens.ruleStyle,
          '--avatar-radius': tokens.avatarRadius,
          '--avatar-shadow': tokens.avatarShadow,
          '--card-radius': radius.card,
          '--surface-texture': tokens.texture,
          '--rule': tokens.rule,
          '--border-width': tokens.borderWidth,
          '--signature-height': tokens.signature.height,
          '--rhythm-gap': tokens.rhythm.gap,
          '--media-gap': tokens.rhythm.mediaGap,
          // What a cell adds around its picture besides its ring: the passe-partout
          // where the material mounts pictures that way. The grid planner reads it
          // so a line of mounted pictures still comes out one height.
          '--media-mount': tokens.mediaFrame === 'mat' ? MEDIA_MOUNT : '0px',
          '--media-radius': mediaRadius,
          // The hero weights the grid planner's arithmetic is derived from.
          '--grid-left-hero': `${GRID_TRACKS.leftHero}fr`,
          '--grid-top-hero': `${GRID_TRACKS.topHero}fr`,
          '--font-display': tokens.fontDisplay,
          '--font-body': tokens.fontBody,
          // The material's letterforms. card.css applies each of these to the
          // one element it names, so a new material is a table entry the compiler
          // checks rather than three rule blocks a reader has to notice.
          '--type-display-size': tokens.type.displaySize,
          '--type-display-weight': tokens.type.displayWeight,
          '--type-display-tracking': tokens.type.displayTracking,
          '--type-quote-size': tokens.type.quoteSize,
          '--type-body-size': tokens.type.bodySize,
          '--type-body-leading': tokens.type.bodyLeading,
          '--type-meta-size': tokens.type.metaSize,
          '--type-meta-tracking': tokens.type.metaTracking,
          '--type-meta-transform': tokens.type.metaUppercase ? 'uppercase' : 'none',
          '--type-meta-numeric': tokens.type.metaTabular ? 'tabular-nums' : 'normal',
          minHeight: minHeightStyle === 'auto' ? 'unset' : minHeightStyle,
          height: 'auto',
          overflow: 'visible',
        }}
      >
      <div class="post-to-card-body-content">
        {!isThread ? (
          (() => {
            const state = authorState(mainTweet);
            return renderSingleTweet(
              mainTweet,
              config,
              t,
              imageFit,
              mediaLayout,
              locale,
              state.blurred,
              state.toggle,
              state.quoteBlurred,
              state.quoteToggle
            );
          })()
        ) : (
          <div class="thread-list">
            {effectiveTweets.map((tweet, index) => {
              const isLast = index === effectiveTweets.length - 1;
              const state = authorState(tweet);
              // Keyed by the post, not by its slot: unkeyed children let Preact
              // reuse one post's DOM for whichever post lands there next, and
              // the marks written on that DOM (a cell's picture arrived, a
              // failed chain) then belong to a picture it no longer holds.
              return (
                <Fragment key={tweet.id ?? `position-${index}`}>
                  {renderThreadTweet(
                    tweet,
                    isLast,
                    config,
                    t,
                    imageFit,
                    mediaLayout,
                    onExcludeTweet,
                    session.canExcludeMore,
                    locale,
                    state.blurred,
                    state.toggle,
                    state.quoteBlurred,
                    state.quoteToggle
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Footer */}
      {showFooter && (
        <div class="card-footer">
          {hasFooterLeft && (
            <div class="card-footer-left">
              {footerTimestamp && (
                <span class="card-timestamp">{footerTimestamp}</span>
              )}
              {config.showStats && renderStats(mainTweet.stats, t)}
            </div>
          )}

          {hasFooterRight && (
            <div class="card-footer-right">
              {config.showWatermark && (
                <div class="card-watermark" title="PostPress">
                  {/* The line variant, not the sticker: it strokes in
                      `currentColor`, so it takes the footer's own ink on all
                      twelve papers -- the card themes are not allowed to carry
                      a foreign colour, and mint on Riso's blue or Brutalist's
                      yellow would be exactly that. It also rasterizes into the
                      export without a picture to fetch.

                      30, not the 16 a single 11px line would take: the credit
                      is two lines, and the mark spans both. The press fills
                      19.75 of its 24-unit box across and 18.75 of it down (it
                      is wider than tall), so the old 28.5 -- correct for the
                      post glyph, which filled the box to 19.75 both ways --
                      left the ink 1.2px short of the block's own ink, name cap
                      to version baseline. 30 puts 23.4px on the card against
                      the text's 23.5, and its box then measures exactly what
                      the two-line block does. */}
                  <span
                    class="card-brand-icon"
                    dangerouslySetInnerHTML={{ __html: brandMarkSvg(30, 'line') }}
                    aria-hidden="true"
                  />
                  {/* The name links to the licence's source. GPL-3.0 asks for the
                      corresponding source to be offered to whoever receives a
                      covered work, and a PNG that leaves the machine is one: the
                      credit line is the one place on the card that can carry it
                      without inventing UI. The rasterizer does not draw URLs, so
                      the link is for the preview, and the build stamp names the
                      version the picture came from. */}
                  <a
                    class="card-credit"
                    href="https://github.com/Shirolin/post-to-card"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Source code — GPL-3.0"
                  >
                    <span>{t.brandName}</span>
                    <span class="card-build">{CARD_BUILD}</span>
                  </a>
                </div>
              )}
              {config.showQrCode && mainTweet.url && (
                <CardQrCode url={mainTweet.url} fillColor={tokens.qrFill} title={t.qrHint} />
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
