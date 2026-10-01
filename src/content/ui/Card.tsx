import type { JSX } from 'preact';
import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats } from '../../types/tweet';
import type { CardConfig, ImageFitOption, AspectRatioOption, MediaLayoutOption, Locale } from '../../types/card';
import { CardQrCode } from './qrcode';
import { getMediaRadius, getAspectMinHeight } from './themes';
import { formatLocaleTimestamp, getTranslation } from '../i18n';
import { Sparkles } from 'lucide-preact';

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

export function calculateDynamicGridRatio(
  count: number,
  gridLayout: string,
  items: MediaItem[]
): number | undefined {
  if (count === 3) {
    const r0 = items[0]?.aspectRatio;
    if (gridLayout === 'left-hero') {
      if (r0 === undefined) return 1.30;
      const r1 = items[1]?.aspectRatio;
      const r2 = items[2]?.aspectRatio;
      const rRight = (r1 !== undefined && r2 !== undefined) ? (r1 + r2) / 2 : (r1 ?? r2 ?? 1.0);
      // Left cell aspect ratio in 1.6fr:1fr columns is 0.615 * R_grid.
      // Target R_grid to let r0 fill left column: 1.625 * r0.
      // Balanced with right column target (0.77 * R_grid ~ rRight): 1.30 * rRight.
      const targetFromLeft = 1.625 * r0;
      const targetFromRight = 1.30 * rRight;
      const combined = (r1 !== undefined || r2 !== undefined)
        ? 0.65 * targetFromLeft + 0.35 * targetFromRight
        : targetFromLeft;
      return Number(Math.max(1.15, Math.min(1.65, combined)).toFixed(2));
    } else {
      // Top-hero: Row 1 is 1.4fr out of 2.4fr (0.583 H).
      // Row 1 cell aspect ratio is R_grid / 0.583 = 1.714 * R_grid.
      // Target R_grid to let r0 fill Row 1: 0.583 * r0.
      const r0Val = r0 ?? 1.6;
      const combined = 0.583 * r0Val;
      return Number(Math.max(1.00, Math.min(1.40, combined)).toFixed(2));
    }
  }

  if (count === 2) {
    const r0 = items[0]?.aspectRatio;
    const r1 = items[1]?.aspectRatio;
    if (r0 === undefined || r1 === undefined) return 1.60;
    if (gridLayout === 'stacked') {
      return Number(Math.max(0.75, Math.min(1.45, (r0 * r1) / (r0 + r1))).toFixed(2));
    } else if (gridLayout === 'portrait-columns') {
      return Number(Math.max(0.78, Math.min(1.65, r0 + r1)).toFixed(2));
    } else {
      // Dual columns side-by-side: natural aspect ratio is r0 + r1
      return Number(Math.max(1.20, Math.min(2.10, r0 + r1)).toFixed(2));
    }
  }

  if (count === 4) {
    const ratios = items.map(i => i.aspectRatio).filter((r): r is number => r !== undefined);
    if (ratios.length >= 2) {
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      return Number(Math.max(0.85, Math.min(1.85, avg)).toFixed(2));
    }
  }

  return undefined;
}

function renderMediaGrid(
  media: MediaItem[] | undefined,
  mediaRadius: string,
  altPrefix: string = 'Tweet photo',
  imageFit: ImageFitOption = 'contain',
  aspectRatio: AspectRatioOption = 'auto',
  mediaLayout: MediaLayoutOption = 'grid',
  videoLabel: string = 'Video',
  showPlayButton: boolean = true
) {
  if (!media || media.length === 0) return null;
  const items = media.slice(0, 4);
  const count = items.length;
  const ratioClass = `ratio-${aspectRatio.replace(':', '-')}`;
  const fitClass = `fit-${imageFit}`;
  const layoutClass = `media-layout-${mediaLayout}`;

  let gridLayout = 'default';
  let dynamicGridRatio: string | undefined;

  if (count === 3) {
    // 阈值 1.2：首图为竖图、正方形图（1.0，如漫画、插画）或接近正方形图（< 1.2）时采用 Twitter 标准「左一右二」Left-Hero；
    // 仅当首图为明确的横幅宽图（>= 1.2，如 16:9 全景、横向照片）时才采用「上一下二」Top-Hero
    const firstRatio = items[0]?.aspectRatio;
    const isPortrait = (firstRatio !== undefined) ? (firstRatio < 1.2) : true;
    gridLayout = isPortrait ? 'left-hero' : 'top-hero';
    if (aspectRatio === 'auto' && mediaLayout !== 'stack') {
      const combined = calculateDynamicGridRatio(count, gridLayout, items);
      if (combined) {
        dynamicGridRatio = `${combined}`;
      }
    }
  } else if (count === 2) {
    const r0 = items[0]?.aspectRatio;
    const r1 = items[1]?.aspectRatio;
    const bothWide = (r0 !== undefined && r1 !== undefined) ? (r0 >= 1.25 && r1 >= 1.25) : false;
    const bothPortrait = (r0 !== undefined && r1 !== undefined)
      ? (r0 <= 0.88 && r1 <= 0.88)
      : ((r0 !== undefined && r0 <= 0.85) || (r1 !== undefined && r1 <= 0.85));

    if (bothWide) {
      gridLayout = 'stacked';
    } else if (bothPortrait) {
      gridLayout = 'portrait-columns';
    } else {
      gridLayout = 'columns';
    }
    if (aspectRatio === 'auto' && mediaLayout !== 'stack') {
      const combined = calculateDynamicGridRatio(count, gridLayout, items);
      if (combined) {
        dynamicGridRatio = `${combined}`;
      }
    }
  } else if (count === 4) {
    gridLayout = 'quad';
    if (aspectRatio === 'auto' && mediaLayout !== 'stack') {
      const combined = calculateDynamicGridRatio(count, gridLayout, items);
      if (combined) {
        dynamicGridRatio = `${combined}`;
      }
    }
  }
  const gridLayoutClass = `grid-${gridLayout}`;

  return (
    <div
      class={`media-grid media-count-${count} ${ratioClass} ${fitClass} ${layoutClass} ${gridLayoutClass}`}
      data-count={count}
      data-ratio={aspectRatio}
      data-fit={imageFit}
      data-layout={mediaLayout}
      data-grid-layout={gridLayout}
      style={{
        borderRadius: mediaRadius,
        aspectRatio: dynamicGridRatio,
      }}
    >
      {items.map((m, idx) => {
        const isVideo = m.type === 'video' || m.type === 'gif';
        const itemRadius = (count === 1 || mediaLayout === 'stack') ? mediaRadius : undefined;

        if (isVideo) {
          return (
            <div
              key={idx}
              class={`media-item media-video-item ${fitClass} ${ratioClass} ${layoutClass}`}
              data-fit={imageFit}
              data-layout={mediaLayout}
              data-media-type={m.type}
              style={{
                borderRadius: itemRadius,
                aspectRatio: (count === 1 && m.aspectRatio) ? `${m.aspectRatio}` : undefined,
              }}
            >
              <img
                src={m.url}
                alt={m.alt || `${altPrefix} ${idx + 1}`}
                class={`media-video-poster ${fitClass} ${ratioClass}`}
                data-fit={imageFit}
                loading="eager"
                onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => {
                  const imgEl = e.currentTarget;
                  if (imgEl && imgEl.naturalWidth && imgEl.naturalHeight) {
                    const ratio = Number((imgEl.naturalWidth / imgEl.naturalHeight).toFixed(3));
                    if (!m.aspectRatio) {
                      m.aspectRatio = ratio;
                    }
                    if (count === 1) {
                      const wrapper = imgEl.closest ? (imgEl.closest('.media-video-item') as HTMLElement) : null;
                      if (wrapper && !wrapper.style.aspectRatio) {
                        wrapper.style.aspectRatio = `${ratio}`;
                      }
                    }
                  }
                }}
              />
              {/* Subtle Bottom Scrim for Contrast & Protection */}
              {showPlayButton && <div class="video-scrim-overlay" />}

              {/* Video Type / Duration Pill Badge */}
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
            class={`media-item ${fitClass} ${ratioClass} ${layoutClass}`}
            data-fit={imageFit}
            data-layout={mediaLayout}
            style={{ borderRadius: itemRadius }}
            loading="eager"
            onLoad={(e: JSX.TargetedEvent<HTMLImageElement>) => {
              const imgEl = e.currentTarget;
              if (imgEl && imgEl.naturalWidth && imgEl.naturalHeight && !m.aspectRatio) {
                m.aspectRatio = Number((imgEl.naturalWidth / imgEl.naturalHeight).toFixed(3));
                const grid = imgEl.closest ? (imgEl.closest('.media-grid') as HTMLElement) : null;
                if (grid) {
                  if (count === 2) {
                    const r0 = items[0]?.aspectRatio;
                    const r1 = items[1]?.aspectRatio;
                    if (r0 !== undefined && r1 !== undefined) {
                      const bothWide = r0 >= 1.25 && r1 >= 1.25;
                      const bothPortrait = (r0 <= 0.88 && r1 <= 0.88) || ((r0 + r1) / 2 <= 0.88);
                      let newLayout = 'columns';
                      if (bothWide) newLayout = 'stacked';
                      else if (bothPortrait) newLayout = 'portrait-columns';

                      grid.setAttribute('data-grid-layout', newLayout);
                      grid.classList.remove('grid-columns', 'grid-stacked', 'grid-portrait-columns');
                      grid.classList.add(`grid-${newLayout}`);

                      if (aspectRatio === 'auto' && mediaLayout !== 'stack') {
                        const combined = calculateDynamicGridRatio(count, newLayout, items);
                        if (combined) {
                          grid.style.aspectRatio = `${combined}`;
                        }
                      }
                    }
                  } else if (count === 3) {
                    const r0 = items[0]?.aspectRatio;
                    if (r0 !== undefined) {
                      const isPortrait = r0 < 1.2;
                      const newLayout = isPortrait ? 'left-hero' : 'top-hero';
                      grid.setAttribute('data-grid-layout', newLayout);
                      grid.classList.remove('grid-top-hero', 'grid-left-hero');
                      grid.classList.add(`grid-${newLayout}`);

                      if (aspectRatio === 'auto' && mediaLayout !== 'stack') {
                        const combined = calculateDynamicGridRatio(count, newLayout, items);
                        if (combined) {
                          grid.style.aspectRatio = `${combined}`;
                        }
                      }
                    }
                  } else if (count === 4 && aspectRatio === 'auto' && mediaLayout !== 'stack') {
                    const combined = calculateDynamicGridRatio(count, 'quad', items);
                    if (combined) {
                      grid.style.aspectRatio = `${combined}`;
                    }
                  }
                }
              }
            }}
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
          <svg class="stat-icon" viewBox="0 0 24 24">
            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.24c-4.426 0-8.01-3.58-8.01-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.32 2.688 6.01 6.005 6.01h2.245v2.22l4.908-2.72c2.032-1.12 3.342-3.26 3.342-5.51 0-3.39-2.75-6-6.134-6H9.756z" />
          </svg>
          {replyStr}
        </span>
      )}
      {repostStr && (
        <span class="stat-item" title={`${repostStr} ${t.reposts}`}>
          <svg class="stat-icon" viewBox="0 0 24 24">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14z" />
          </svg>
          {repostStr}
        </span>
      )}
      {likeStr && (
        <span class="stat-item" title={`${likeStr} ${t.likes}`}>
          <svg class="stat-icon" viewBox="0 0 24 24">
            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-2.428.13-4.246 2.05-4.297 4.56-.057 2.81 1.636 5.86 4.965 8.79 2.222 1.96 4.675 3.34 4.877 3.45l.154.09.153-.09c.203-.11 2.656-1.49 4.877-3.45 3.33-2.93 5.023-5.98 4.966-8.79-.052-2.51-1.87-4.43-4.298-4.56zm-4.694 14.55C10.74 19.33 3.99 14.99 4.007 10.08c.03-1.46 1.056-2.57 2.404-2.65.89-.05 1.97.35 2.923 1.65l1.67 2.27 1.67-2.27c.952-1.3 2.032-1.7 2.922-1.65 1.348.08 2.374 1.19 2.404 2.65.018 4.91-6.733 9.25-7.996 9.97z" />
          </svg>
          {likeStr}
        </span>
      )}
      {viewsStr && (
        <span class="stat-item" title={`${viewsStr} ${t.views}`}>
          <svg class="stat-icon" viewBox="0 0 24 24">
            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
          </svg>
          {viewsStr}
        </span>
      )}
    </div>
  );
}

function renderQuoteCard(
  quotePost: NonNullable<TweetData['quotePost']>,
  mediaRadius: string,
  t: ReturnType<typeof getTranslation>,
  imageFit: ImageFitOption,
  aspectRatio: AspectRatioOption,
  mediaLayout: MediaLayoutOption,
  showPlayButton: boolean,
  locale: Locale = 'en-US'
) {
  const { author, text, richTokens, timestamp, url } = quotePost;
  const timestampText = timestamp ? formatLocaleTimestamp(timestamp, locale) : '';

  return (
    <div class="quote-card" style={{ borderRadius: mediaRadius }}>
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
      {renderMediaGrid(quotePost.media, mediaRadius, t.photoAlt, imageFit, aspectRatio, mediaLayout, t.videoLabel, showPlayButton)}
    </div>
  );
}

function renderSingleTweet(
  tweet: TweetData,
  config: CardConfig,
  t: ReturnType<typeof getTranslation>,
  mediaRadius: string,
  imageFit: ImageFitOption,
  mediaLayout: MediaLayoutOption
) {
  return (
    <div class="single-tweet-block">
      {renderAuthorHeader(tweet.author, config.blurAuthor, t.verified)}
      {renderTweetContent(tweet)}
      {renderMediaGrid(tweet.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
      {tweet.quotePost && renderQuoteCard(tweet.quotePost, mediaRadius, t, imageFit, config.aspectRatio, mediaLayout, config.showPlayButton !== false, config.locale || 'en-US')}
    </div>
  );
}

function renderThreadTweet(
  tweet: TweetData,
  isLast: boolean,
  config: CardConfig,
  t: ReturnType<typeof getTranslation>,
  mediaRadius: string,
  imageFit: ImageFitOption,
  mediaLayout: MediaLayoutOption,
  onExcludeTweet?: (tweetId: string) => void,
  canExclude?: boolean
) {
  const tweetKey = tweet.id;
  return (
    <div class="thread-item">
      {/* On-card quick exclude button */}
      {canExclude && onExcludeTweet && tweetKey && (
        <button
          type="button"
          class="thread-exclude-btn"
          title={t.excludeThisTweet}
          aria-label={t.excludeThisTweet}
          onClick={(e) => {
            e.stopPropagation();
            onExcludeTweet(tweetKey);
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
        {renderAuthorDetails(tweet.author, config.blurAuthor, t.verified)}
        {renderTweetContent(tweet)}
        {renderMediaGrid(tweet.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio, mediaLayout, t.videoLabel, config.showPlayButton !== false)}
        {tweet.quotePost && renderQuoteCard(tweet.quotePost, mediaRadius, t, imageFit, config.aspectRatio, mediaLayout, config.showPlayButton !== false, config.locale || 'en-US')}
      </div>
    </div>
  );
}

export function Card({ data, config, onExcludeTweet }: CardProps): JSX.Element {
  const t = getTranslation(config.locale || 'en-US');
  const thread = normalizeThreadData(data);
  const excludedSet = new Set(config.excludedTweetIds || []);

  // Filter out manually excluded tweets
  const activeTweets = thread.tweets.filter((tweet, idx) => {
    const key = tweet.id || String(idx);
    return !excludedSet.has(key);
  });

  // Guarantee at least one tweet is rendered (prefer target tweet or first available)
  const targetIndex = thread.targetTweetIndex ?? 0;
  const fallbackTweet = thread.tweets[targetIndex] || thread.tweets[0];
  const effectiveTweets = activeTweets.length > 0 ? activeTweets : [fallbackTweet];

  const isThread = effectiveTweets.length > 1;
  const mainTweet = effectiveTweets[0];

  const imageFit = config.imageFit || 'contain';
  const mediaLayout = config.mediaLayout || 'grid';
  const mediaRadius = getMediaRadius(config.borderRadius);
  const minHeightStyle = getAspectMinHeight(config.aspectRatio, 640);

  const cardClasses = [
    'post-to-card-target',
    `theme-${config.theme}`,
    `padding-${config.padding}`,
    `radius-${config.borderRadius}`,
    `ratio-${config.aspectRatio.replace(':', '-')}`,
    `fit-${imageFit}`,
    `media-layout-${mediaLayout}`,
  ].join(' ');

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
      style={{
        padding: config.padding,
        borderRadius: config.borderRadius,
        minHeight: minHeightStyle === 'auto' ? 'unset' : minHeightStyle,
        height: 'auto',
        overflow: 'visible',
      }}
    >
      <div class="post-to-card-body-content">
        {!isThread ? (
          renderSingleTweet(mainTweet, config, t, mediaRadius, imageFit, mediaLayout)
        ) : (
          <div class="thread-list">
            {effectiveTweets.map((tweet, index) => {
              const isLast = index === effectiveTweets.length - 1;
              return renderThreadTweet(
                tweet,
                isLast,
                config,
                t,
                mediaRadius,
                imageFit,
                mediaLayout,
                onExcludeTweet,
                effectiveTweets.length > 1
              );
            })}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div class="card-footer">
        <div class="card-footer-left">
          {config.showTimestamp && (
            <span class="card-timestamp">{formatLocaleTimestamp(mainTweet.timestamp, config.locale || 'en-US')}</span>
          )}
          {config.showStats && renderStats(mainTweet.stats, t)}
        </div>

        <div class="card-footer-right">
          {config.showWatermark && (
            <div class="card-watermark" title="Post-to-Card">
              <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
              <span>Post to Card</span>
            </div>
          )}
          {config.showQrCode && mainTweet.url && (
            <CardQrCode url={mainTweet.url} />
          )}
        </div>
      </div>
    </div>
  );
}
