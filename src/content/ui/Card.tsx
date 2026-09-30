import type { JSX } from 'preact';
import type { TweetData, ThreadData, AuthorInfo, MediaItem, TweetStats } from '../../types/tweet';
import type { CardConfig, ImageFitOption, AspectRatioOption } from '../../types/card';
import { CardQrCode } from './qrcode';
import { getMediaRadius, getAspectMinHeight } from './themes';
import { formatLocaleTimestamp, getTranslation } from '../i18n';
import { Sparkles } from 'lucide-preact';

export interface CardProps {
  data: ThreadData | TweetData;
  config: CardConfig;
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

function renderTweetContent(tweet: TweetData) {
  if (tweet.richTokens && tweet.richTokens.length > 0) {
    return (
      <div class="tweet-text-content">
        {tweet.richTokens.map((token, index) => {
          if (token.type === 'mention') {
            return (
              <span key={index} class="token-mention">
                {token.value}
              </span>
            );
          }
          if (token.type === 'hashtag' || token.type === 'emoji') {
            return (
              <span key={index} class={token.type === 'hashtag' ? 'token-hashtag' : 'token-emoji'}>
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

  return <div class="tweet-text-content">{tweet.text}</div>;
}

function renderMediaGrid(
  media: MediaItem[] | undefined,
  mediaRadius: string,
  altPrefix: string = 'Tweet photo',
  imageFit: ImageFitOption = 'contain',
  aspectRatio: AspectRatioOption = 'auto'
) {
  if (!media || media.length === 0) return null;
  const items = media.slice(0, 4);
  const count = items.length;
  const ratioClass = `ratio-${aspectRatio.replace(':', '-')}`;
  const fitClass = `fit-${imageFit}`;

  return (
    <div
      class={`media-grid media-count-${count} ${ratioClass} ${fitClass}`}
      data-count={count}
      data-ratio={aspectRatio}
      data-fit={imageFit}
      style={{ borderRadius: mediaRadius }}
    >
      {items.map((m, idx) => (
        <img
          key={idx}
          src={m.url}
          alt={m.alt || `${altPrefix} ${idx + 1}`}
          class={`media-item ${fitClass} ${ratioClass}`}
          data-fit={imageFit}
          style={{ borderRadius: count === 1 ? mediaRadius : undefined }}
          loading="eager"
        />
      ))}
    </div>
  );
}

function renderAuthorHeader(author: AuthorInfo, isBlurred: boolean, verifiedTitle: string = 'Verified') {
  const defaultAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2371767b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';

  const blurClass = isBlurred ? 'is-blurred' : '';

  return (
    <div class={`author-header ${blurClass}`}>
      <div class={`author-avatar ${blurClass}`}>
        <img
          src={author.avatarUrl || defaultAvatar}
          alt={author.name}
          class={`author-avatar-img ${blurClass}`}
        />
      </div>
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

export function Card({ data, config }: CardProps): JSX.Element {
  const t = getTranslation(config.locale || 'en-US');
  const thread = normalizeThreadData(data);
  const mainTweet = thread.tweets[0];
  const subsequentTweets = thread.tweets.slice(1);
  const isThread = subsequentTweets.length > 0;

  const imageFit = config.imageFit || 'contain';
  const mediaRadius = getMediaRadius(config.borderRadius);
  const minHeightStyle = getAspectMinHeight(config.aspectRatio, 640);

  const cardClasses = [
    'post-to-card-target',
    `theme-${config.theme}`,
    `padding-${config.padding}`,
    `radius-${config.borderRadius}`,
    `ratio-${config.aspectRatio.replace(':', '-')}`,
    `fit-${imageFit}`,
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
      style={{
        padding: config.padding,
        borderRadius: config.borderRadius,
        minHeight: minHeightStyle === 'auto' ? 'unset' : minHeightStyle,
        height: 'auto',
        overflow: 'visible',
      }}
    >
      <div class="post-to-card-body-content">
        {/* Main Tweet */}
        <div class="thread-item-wrapper">
          {isThread && <div class="thread-connector-line" />}
          <div class="thread-tweet-block">
            {renderAuthorHeader(mainTweet.author, config.blurAuthor, t.verified)}
            {renderTweetContent(mainTweet)}
            {renderMediaGrid(mainTweet.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio)}

            {/* Quote Tweet if present */}
            {mainTweet.quotePost && (
              <div class="quote-card" style={{ borderRadius: mediaRadius }}>
                <div class="quote-author">
                  {mainTweet.quotePost.author.avatarUrl && (
                    <img
                      src={mainTweet.quotePost.author.avatarUrl}
                      alt={mainTweet.quotePost.author.name}
                      class="quote-avatar"
                    />
                  )}
                  <span class="quote-name">{mainTweet.quotePost.author.name}</span>
                  <span class="quote-handle">{mainTweet.quotePost.author.handle}</span>
                </div>
                <div class="quote-text">{mainTweet.quotePost.text}</div>
                {renderMediaGrid(mainTweet.quotePost.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio)}
              </div>
            )}
          </div>
        </div>

        {/* Subsequent Thread Tweets */}
        {subsequentTweets.map((subTweet, index) => {
          const isLastSub = index === subsequentTweets.length - 1;
          return (
            <div key={subTweet.id || index} class="thread-item-wrapper">
              {!isLastSub && <div class="thread-connector-line" />}
              <div class="thread-tweet-block">
                <div class="thread-divider" />
                {renderAuthorHeader(subTweet.author, config.blurAuthor, t.verified)}
                {renderTweetContent(subTweet)}
                {renderMediaGrid(subTweet.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio)}

                {subTweet.quotePost && (
                  <div class="quote-card" style={{ borderRadius: mediaRadius }}>
                    <div class="quote-author">
                      {subTweet.quotePost.author.avatarUrl && (
                        <img
                          src={subTweet.quotePost.author.avatarUrl}
                          alt={subTweet.quotePost.author.name}
                          class="quote-avatar"
                        />
                      )}
                      <span class="quote-name">{subTweet.quotePost.author.name}</span>
                      <span class="quote-handle">{subTweet.quotePost.author.handle}</span>
                    </div>
                    <div class="quote-text">{subTweet.quotePost.text}</div>
                    {renderMediaGrid(subTweet.quotePost.media, mediaRadius, t.photoAlt, imageFit, config.aspectRatio)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
