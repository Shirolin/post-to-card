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

/**
 * A long-form post: X's article attached to a tweet.
 *
 * The tweet that carries an article is still a tweet — it has its own body,
 * author and stats — but the article is the reason it exists. `cover` is the
 * same shape as any other MediaItem so the card can mount it with the theme's
 * own media frame rather than growing a second picture treatment.
 *
 * The article's own body is deliberately not modelled. It runs to thousands of
 * words and a card is a poster, not a reader; what the card needs is the cover,
 * the title and what the post says about it.
 */
export interface ArticleData {
  title: string;
  /** The article's own opening text, used only when the tweet body is empty. */
  previewText?: string;
  cover?: MediaItem;
  restId?: string;
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
  article?: ArticleData;
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
   * X rendered only a preview of this post in the DOM, with its "Show more"
   * affordance beside it. The complete body is not in the markup at all — it
   * lives in the GraphQL `note_tweet` field — so the DOM channel cannot print
   * it. The card marks the cut instead of passing the preview off as the whole
   * post. Only the DOM channel can set this; GraphQL reads the full body.
   */
  truncated?: boolean;
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
