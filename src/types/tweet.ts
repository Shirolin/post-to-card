export interface AuthorInfo {
  name: string;
  handle: string;
  avatarUrl: string;
  verified?: boolean;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string; // upgraded to orig resolution where available
  originalUrl?: string;
  posterUrl?: string;
  alt?: string;
  aspectRatio?: number;
  duration?: string;
}

export interface TweetStats {
  replies?: string;
  reposts?: string;
  likes?: string;
  views?: string;
  bookmarks?: string;
}

export interface QuoteTweetData {
  author: AuthorInfo;
  text: string;
  richTokens?: TweetData['richTokens'];
  media?: MediaItem[];
  timestamp?: string;
  url?: string;
  /** Post was deleted, private, or otherwise not renderable. */
  isUnavailable?: boolean;
}

export interface TweetData {
  id: string;
  url: string;
  author: AuthorInfo;
  text: string; // unicode emojis restored
  richTokens?: Array<{ type: 'text' | 'mention' | 'hashtag' | 'cashtag' | 'link' | 'emoji'; value: string; href?: string }>;
  timestamp: string; // ISO or formatted
  stats?: TweetStats;
  media?: MediaItem[];
  quotePost?: QuoteTweetData;
  isThreadPart?: boolean;
  threadIndex?: number;
  threadTotal?: number;
  /**
   * Handle of the account that retweeted this post, when the timeline entry is
   * a retweet rather than an original. The body belongs to that other account.
   */
  retweetedBy?: string;
  /**
   * X's own "translated from <language>" notice, verbatim, when the visible body
   * is a machine translation. Kept as X rendered it because the source-language
   * name is localized by X and no language code is exposed in the DOM.
   */
  translatedFrom?: string;
  /**
   * Which extraction strategy produced this record. Purely diagnostic: a rising
   * count of `fallback` here is the early warning that X changed its DOM,
   * ahead of user reports.
   */
  diagnostics?: ExtractionDiagnostics;
}

export interface ExtractionDiagnostics {
  /** Which channel produced this record. */
  source?: 'graphql' | 'dom';
  /** Operation that answered, e.g. TweetDetail. Never used to identify a request. */
  operationName?: string;
  /**
   * The rotated queryId observed at capture time. Recorded purely so a
   * rotation is visible in logs; a change here is expected and harmless.
   */
  queryId?: string;
  tweet?: 'testid' | 'role' | 'structural' | 'none';
  text?: 'testid' | 'fallback' | 'none';
  media?: 'testid' | 'fallback' | 'none';
  isUnavailable?: boolean;
  /** Which social-context signal classified this entry, if any. */
  social?: 'retweet' | 'reply' | 'pinned' | 'none';
}

export interface ThreadData {
  author: AuthorInfo;
  tweets: TweetData[];
  isSingle: boolean;
  targetTweetIndex?: number;
}
