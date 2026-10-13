import { Fragment } from 'preact';
import type { JSX, Ref } from 'preact';
import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats } from '../../types/tweet.ts';
import type { CardConfig, ImageFitOption, AspectRatioOption, MediaLayoutOption, Locale } from '../../types/card.ts';
import { CardQrCode } from './qrcode.ts';
import { resolveRadius, getAspectMinHeight, THEMES } from './themes.ts';
import { planMediaGrid, applyMediaGridPlan, recordShape } from './mediaGrid.ts';
import { imageFallbackAttrs, advanceImageFallback } from './imageFallback.ts';
import { threadScope, tweetKey } from './threadScope.ts';
import { formatLocaleTimestamp, getTranslation, sanitizeLocale } from '../i18n.ts';
import { Sparkles, MessageCircle, Repeat2, Heart, ChartNoAxesColumn, Languages } from 'lucide-preact';
import { CARD_BUILD } from '../build.ts';

export interface CardProps {
  data: ThreadData | TweetData;
  config: CardConfig;
  onExcludeTweet?: (tweetId: string) => void;
  /**
   * The card's root node, so a host can measure the card it renders. The preview
   * needs the height to resolve its fit-to-window zoom level. Optional because the
   * dev harness and the tests render the card with nothing to measure against.
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

function formatStat(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    if (/[KkMmBb]/.test(value)) return value;
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
 * Advances a failed picture to the next URL in its fallback chain, or leaves it
 * broken once the chain is exhausted so a genuinely gone picture is still
 * visible as missing rather than silently swapped for a placeholder.
 */
function handleImageError(event: JSX.TargetedEvent<HTMLImageElement>) {
  advanceImageFallback(event.currentTarget);
}

/** Narrowest shape (width / height) a lone auto-ratio picture is shown at: 3:4. */
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
  const fitClass = `fit-${imageFit}`;
  const layoutClass = `media-layout-${mediaLayout}`;

  // One plan, made from whatever shapes are known now. The images re-plan
  // through the same module when their real shapes arrive, so a grid can only
  // settle differently if the pictures told it something new.
  const gridOptions = { aspectRatio, mediaLayout };
  const plan = planMediaGrid(items, gridOptions);

  // A lone picture in the auto ratio fills the column, so its height follows
  // from its shape. Floor that shape at 3:4: anything taller (a 9:16 video, a
  // long screenshot) is cropped to it, which bounds the card at 4/3 of the
  // column instead of an absolute ceiling that left the recess showing beside
  // a picture it had shrunk. Poster ratios and stack have their own rules.
  const floorsShape = count === 1 && aspectRatio === 'auto' && mediaLayout !== 'stack';
  const shapeOf = (ratio: number) => (floorsShape ? Math.max(ratio, MIN_LONE_RATIO) : ratio);

  // Both an image and a video poster settle the grid the same way: record the
  // shape it reported, re-plan, and write the plan back.
  const settleGrid = (imgEl: HTMLImageElement, index: number) => {
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;
    const ratio = Number((imgEl.naturalWidth / imgEl.naturalHeight).toFixed(3));
    // The picture's box is the picture's rectangle, so it takes the shape the
    // browser actually decoded: X's own width/height were only a first guess.
    const box = imgEl.closest ? (imgEl.closest('.media-box') as HTMLElement | null) : null;
    if (box) box.style.aspectRatio = String(shapeOf(ratio));
    if (shapeOf(ratio) !== ratio) imgEl.style.objectFit = 'cover';
    const settled = recordShape(items, index, ratio);
    if (settled === items) return;
    items = settled;
    const grid = imgEl.closest ? (imgEl.closest('.media-grid') as HTMLElement) : null;
    if (grid) {
      applyMediaGridPlan(grid, planMediaGrid(items, gridOptions));
    }
  };

  return (
    <div
      class={`media-grid media-count-${count} ${fitClass} ${layoutClass} ${plan.layoutClass}`}
      data-count={count}
      data-ratio={aspectRatio}
      data-fit={imageFit}
      data-layout={mediaLayout}
      data-grid-layout={plan.layout}
      style={{
        aspectRatio: plan.aspectRatio,
      }}
    >
      {items.map((m, idx) => {
        const isVideo = m.type === 'video' || m.type === 'gif';

        return (
          <div
            key={idx}
            class={`media-item ${isVideo ? 'media-video-item ' : ''}${fitClass} ${layoutClass}`}
            data-fit={imageFit}
            data-layout={mediaLayout}
          >
            {/* The cell is the grid's track. This is the picture's own box: the
                one the fit mode sizes, and the corner the play badge sits on.
                Its ratio starts from X's own width/height, when the extractor
                read them, and is corrected below once the picture has loaded. */}
            <div class="media-box" style={{ aspectRatio: m.aspectRatio ? `${shapeOf(m.aspectRatio)}` : undefined }}>
              <img
                src={m.url}
                alt={m.alt || `${altPrefix} ${idx + 1}`}
                class={`media-picture ${fitClass}`}
                data-fit={imageFit}
                style={m.aspectRatio && shapeOf(m.aspectRatio) !== m.aspectRatio ? { objectFit: 'cover' } : undefined}
                loading="eager"
                {...imageFallbackAttrs(m)}
                onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => settleGrid(e.currentTarget, idx)}
                onError={handleImageError}
              />
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

const defaultAvatar =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2371767b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';

function renderAuthorAvatar(author: AuthorInfo, isBlurred: boolean) {
  const blurClass = isBlurred ? 'is-blurred' : '';
  return (
    <div class={`author-avatar ${blurClass}`}>
      <img
        src={author.avatarUrl || defaultAvatar}
        alt={author.name}
        class={`author-avatar-img ${blurClass}`}
      />
    </div>
  );
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

function renderAuthorHeader(author: AuthorInfo, isBlurred: boolean, verifiedTitle: string = 'Verified') {
  const blurClass = isBlurred ? 'is-blurred' : '';
  return (
    <div class={`author-header ${blurClass}`}>
      {renderAuthorAvatar(author, isBlurred)}
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
      formatStat(stats.views || stats.bookmarks)
  );
}

function renderStats(stats: TweetStats | undefined, t: ReturnType<typeof getTranslation>) {
  if (!stats) return null;
  const replyStr = formatStat(stats.replies);
  const repostStr = formatStat(stats.reposts);
  const likeStr = formatStat(stats.likes);
  const viewsStr = formatStat(stats.views || stats.bookmarks);

  const hasAnyStat = replyStr || repostStr || likeStr || viewsStr;
  if (!hasAnyStat) return null;

  return (
    <div class="stats-row">
      {replyStr && (
        <span class="stat-item" title={`${replyStr} ${t.replies}`}>
          <MessageCircle class="stat-icon" size={15} strokeWidth={2} aria-hidden="true" />
          {replyStr}
        </span>
      )}
      {repostStr && (
        <span class="stat-item" title={`${repostStr} ${t.reposts}`}>
          <Repeat2 class="stat-icon" size={15} strokeWidth={2} aria-hidden="true" />
          {repostStr}
        </span>
      )}
      {likeStr && (
        <span class="stat-item" title={`${likeStr} ${t.likes}`}>
          <Heart class="stat-icon" size={15} strokeWidth={2} aria-hidden="true" />
          {likeStr}
        </span>
      )}
      {viewsStr && (
        <span class="stat-item" title={`${viewsStr} ${t.views}`}>
          <ChartNoAxesColumn class="stat-icon" size={15} strokeWidth={2} aria-hidden="true" />
          {viewsStr}
        </span>
      )}
    </div>
  );
}

function renderQuoteCard(
  quotePost: NonNullable<TweetData['quotePost']>,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption,
  aspectRatio: AspectRatioOption,
  mediaLayout: MediaLayoutOption,
  showPlayButton: boolean,
  locale: Locale
) {
  const { author, text, richTokens, timestamp, url } = quotePost;
  const timestampText = timestamp ? formatLocaleTimestamp(timestamp, locale) : '';

  if (quotePost.isUnavailable) {
    return (
      <div class="quote-card quote-card-unavailable">
        <span class="quote-unavailable-text">{t.unavailablePost}</span>
      </div>
    );
  }

  return (
    <div class="quote-card">
      <div class="quote-author">
        <img
          src={author.avatarUrl || defaultAvatar}
          alt={author.name}
          class="quote-avatar"
          loading="eager"
        />
        <span class="quote-name">{author.name}</span>
        {author.verified && (
          <span class="verified-badge quote-verified-badge" title={t.verified}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.19 1.91-2.19 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.3 11.96l1.41-1.41 2.83 2.83 6.36-6.36 1.41 1.41-7.77 7.77z" />
            </svg>
          </span>
        )}
        <span class="quote-handle">{author.handle}</span>
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
  mediaLayout: MediaLayoutOption
) {
  return (
    <div class="single-tweet-block">
      {renderRetweetNotice(tweet, t.retweetedBy)}
      {renderAuthorHeader(tweet.author, config.blurAuthor, t.verified)}
      {renderTranslationNotice(tweet)}
      {renderTweetContent(tweet, t, imageFit)}
      {renderMediaGrid(tweet.media, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
      {tweet.quotePost && renderQuoteCard(tweet.quotePost, t, imageFit, config.aspectRatio, mediaLayout, config.showPlayButton !== false, sanitizeLocale(config.locale))}
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
  onExcludeTweet?: (tweetId: string) => void,
  canExclude?: boolean
) {
  // The button only exists for a post that has an id. A post without one is
  // keyed by position, which means something different in a different thread,
  // so it is not offered a button here at all.
  const tweetId = tweet.id;
  return (
    <div class="thread-item">
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
        {renderAuthorAvatar(tweet.author, config.blurAuthor)}
        {!isLast && <div class="thread-connector-line" />}
      </div>

      {/* Right Column: Author Info + Content + Media + Quote */}
      <div class="thread-content-col">
        {renderRetweetNotice(tweet, t.retweetedBy)}
        {renderAuthorDetails(tweet.author, config.blurAuthor, t.verified)}
        {renderTranslationNotice(tweet)}
        {renderTweetContent(tweet, t, imageFit)}
        {renderMediaGrid(tweet.media, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
        {tweet.quotePost && renderQuoteCard(tweet.quotePost, t, imageFit, config.aspectRatio, mediaLayout, config.showPlayButton !== false, sanitizeLocale(config.locale))}
      </div>
    </div>
  );
}

export function Card({ data, config, onExcludeTweet, cardRef }: CardProps): JSX.Element {
  const t = getTranslation(sanitizeLocale(config.locale));
  const thread = normalizeThreadData(data);
  // The same scope the controls panel reads, so the exclude buttons on the card
  // only appear while a tweet may actually be dropped.
  const scope = threadScope(thread, config.excludedTweetIds);

  // Filter out manually excluded tweets
  const activeTweets = thread.tweets.filter(
    (tweet, idx) => !scope.excluded.has(tweetKey(tweet, idx))
  );

  // Guarantee at least one tweet is rendered (prefer target tweet or first available)
  const targetIndex = thread.targetTweetIndex ?? 0;
  const fallbackTweet = thread.tweets[targetIndex] || thread.tweets[0];
  const effectiveTweets = activeTweets.length > 0 ? activeTweets : [fallbackTweet];

  const isThread = effectiveTweets.length > 1;
  const mainTweet = effectiveTweets[0];

  const imageFit = config.imageFit || 'contain';
  const mediaLayout = config.mediaLayout || 'grid';
  // The stored option resolves to the card's own corner and the corner inside
  // it; both are injected, so the stylesheet never has to re-derive either.
  const radius = resolveRadius(config.borderRadius, config.theme);
  const mediaRadius = radius.media;
  const tokens = THEMES[config.theme].tokens;
  const minHeightStyle = getAspectMinHeight(config.aspectRatio, 640);

  // Every option is carried by its data attribute alone. Each one used to be
  // emitted twice, as a class here and as an attribute below, and card.css
  // matched both spellings in every rule. Same element, same specificity, same
  // block, so the class decided nothing the attribute did not -- it only meant
  // an option could be renamed in one place and silently keep its old styling
  // in the other. `fit-` and `media-layout-` still travel as classes because
  // card.css keys their child rules on them; those are on the media grid, not
  // on the card root.
  const cardClasses = [
    'post-to-card-target',
    `fit-${imageFit}`,
    `media-layout-${mediaLayout}`,
  ].join(' ');

  // Only render the footer when it actually has content, otherwise its top
  // border and padding leave a stray divider at the bottom of the card.
  const footerTimestamp = config.showTimestamp
    ? formatLocaleTimestamp(mainTweet.timestamp, sanitizeLocale(config.locale))
    : '';
  const hasFooterStats = Boolean(config.showStats && hasRenderableStats(mainTweet.stats));
  const hasFooterLeft = Boolean(footerTimestamp || hasFooterStats);
  const hasFooterRight = Boolean(
    config.showWatermark || (config.showQrCode && mainTweet.url)
  );
  const showFooter = hasFooterLeft || hasFooterRight;

  return (
    <div
      id="post-to-card-export-target"
      ref={cardRef}
      class={cardClasses}
      data-theme={config.theme}
      data-padding={config.padding}
      data-radius={config.borderRadius}
      data-ratio={config.aspectRatio}
      data-fit={imageFit}
      data-media-layout={mediaLayout}
      data-signature={tokens.signature.style === 'none' ? undefined : tokens.signature.style}
      data-quote-style={tokens.quoteStyle}
      data-media-frame={tokens.mediaFrame}
      data-meta-divider={tokens.metaDivider ? 'on' : undefined}
      data-keyline={tokens.keyline ? 'on' : undefined}
      data-stat-chip={tokens.statChip ? 'on' : undefined}
      style={{
        padding: config.padding,
        borderRadius: radius.card,
        boxShadow: tokens.shadow,
        // Every theme colour, the type pair, the signature geometry and the
        // rhythm come from the token table and are injected here. card.css only
        // consumes them, so there is one place to edit a theme and no second
        // copy to drift out of sync.
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
        '--media-radius': mediaRadius,
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
          renderSingleTweet(mainTweet, config, t, imageFit, mediaLayout)
        ) : (
          <div class="thread-list">
            {effectiveTweets.map((tweet, index) => {
              const isLast = index === effectiveTweets.length - 1;
              return renderThreadTweet(
                tweet,
                isLast,
                config,
                t,
                imageFit,
                mediaLayout,
                onExcludeTweet,
                scope.canExcludeMore
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
                <div class="card-watermark" title="Post-to-Card">
                  <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
                  <span>Post to Card</span>
                  <span class="card-build">{CARD_BUILD}</span>
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
  );
}
