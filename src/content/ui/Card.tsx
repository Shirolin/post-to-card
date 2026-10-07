import type { JSX } from 'preact';
import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats } from '../../types/tweet.ts';
import type { CardConfig, ImageFitOption, AspectRatioOption, MediaLayoutOption, Locale } from '../../types/card.ts';
import { CardQrCode } from './qrcode.ts';
import { resolveRadius, getAspectMinHeight, THEMES } from './themes.ts';
import { planMediaGrid, applyMediaGridPlan, recordShape } from './mediaGrid.ts';
import { threadScope, tweetKey } from './threadScope.ts';
import { formatLocaleTimestamp, getTranslation, sanitizeLocale } from '../i18n.ts';
import { Sparkles, MessageCircle, Repeat2, Heart, ChartNoAxesColumn, Languages } from 'lucide-preact';

export interface CardProps {
  data: ThreadData | TweetData;
  config: CardConfig;
  onExcludeTweet?: (tweetId: string) => void;
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

function renderRichTokens(tokens: NonNullable<TweetData['richTokens']>, className: string) {
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
        return <span key={index}>{token.value}</span>;
      })}
    </div>
  );
}

function renderTweetContent(tweet: TweetData) {
  if (tweet.richTokens && tweet.richTokens.length > 0) {
    return renderRichTokens(tweet.richTokens, 'tweet-text-content');
  }

  return <div class="tweet-text-content">{tweet.text}</div>;
}

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

  // Both an image and a video poster settle the grid the same way: record the
  // shape it reported, re-plan, and write the plan back.
  const settleGrid = (imgEl: HTMLImageElement, index: number) => {
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;
    const ratio = Number((imgEl.naturalWidth / imgEl.naturalHeight).toFixed(3));
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

        if (isVideo) {
          return (
            <div
              key={idx}
              class={`media-item media-video-item ${fitClass} ${layoutClass}`}
              data-fit={imageFit}
              data-layout={mediaLayout}
              data-media-type={m.type}
              style={{
                aspectRatio: (count === 1 && m.aspectRatio) ? `${m.aspectRatio}` : undefined,
              }}
            >
              <img
                src={m.url}
                alt={m.alt || `${altPrefix} ${idx + 1}`}
                class={`media-video-poster ${fitClass}`}
                data-fit={imageFit}
                loading="eager"
                onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => settleGrid(e.currentTarget, idx)}
              />
              {/* Play badge sits on the poster without a scrim: the pill is
                  opaque, so a gradient would only dim the image. */}
              {showPlayButton && (
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
          );
        }

        return (
          <img
            key={idx}
            src={m.url}
            alt={m.alt || `${altPrefix} ${idx + 1}`}
            class={`media-item ${fitClass} ${layoutClass}`}
            data-fit={imageFit}
            data-layout={mediaLayout}
            loading="eager"
            onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => settleGrid(e.currentTarget, idx)}
          />
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
      <span class="retweet-handle">@{tweet.retweetedBy.replace(/^@/, '')}</span>
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
        <div class="quote-text">{text}</div>
      ) : null}
      {renderMediaGrid(quotePost.media, t.photoAlt, imageFit, aspectRatio, mediaLayout, t.videoLabel, showPlayButton)}
    </div>
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
      {renderTweetContent(tweet)}
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
        {renderTweetContent(tweet)}
        {renderMediaGrid(tweet.media, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
        {tweet.quotePost && renderQuoteCard(tweet.quotePost, t, imageFit, config.aspectRatio, mediaLayout, config.showPlayButton !== false, sanitizeLocale(config.locale))}
      </div>
    </div>
  );
}

export function Card({ data, config, onExcludeTweet }: CardProps): JSX.Element {
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
                </div>
              )}
              {config.showQrCode && mainTweet.url && (
                <CardQrCode url={mainTweet.url} fillColor={tokens.qrFill} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
