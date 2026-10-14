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

/**
 * How many quote levels the card prints: the tweet's own quote and the one
 * further post that quote itself quotes.
 *
 * A card-print bound, not a claim about X: chains deeper than two exist on X
 * in principle, but no sample deeper than two has been collected (see
 * `docs/observed-dom-2026-10-14-nested-quote.md` §尚未核验), and the card
 * prints a quote's words and pictures rather than a transcript of the chain
 * behind it. One shared constant so the DOM channel, the GraphQL channel and
 * the renderer cannot disagree about where the chain stops.
 */
export const QUOTE_LEVELS = 2;

/** How deep in the quote chain a rendered quote panel sits. */
export type QuoteDepth = 1 | 2;

/**
 * A quoted post, as the card renders it: one author, one body, one media set —
 * and, when the quoted post itself quotes someone, one further quote.
 *
 * The nesting is self-referential rather than a `QuoteChain` list: X renders the
 * quoted post as a full tweet article, and that article may itself quote. A
 * quoted post that quotes is still exactly one quote box, containing one further
 * quote box, which is what this type says. The DOM finder proves the nesting by
 * walking out of the current box, so the two shapes agree by construction rather
 * than by both being maintained.
 */
export interface QuoteTweetData {
  author: AuthorInfo;
  text: string;
  richTokens?: TweetData['richTokens'];
  media?: MediaItem[];
  timestamp?: string;
  url?: string;
  /** Post was deleted, private, or otherwise not renderable. */
  isUnavailable?: boolean;
  /**
   * The post this quote itself quotes, when it does.
   *
   * Absent for a plain quote. Its presence is the whole point of the field: the
   * extraction reads one level of quote and nothing deeper, because a card is
   * read for the quote's own words and its media, not for a transcript of the
   * chain behind it.
   */
  quotePost?: QuoteTweetData;
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
  /**
   * The article's own opening line, used only when the tweet body is empty.
   * X's own `preview_text` can span paragraphs; both channels carry only the
   * first one, so the card's lead is the same whichever channel answered.
   */
  openingLine?: string;
  cover?: MediaItem;
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
  /** The tweet's own quote, if it quotes another post. Its own nested quote, if any, lives on `QuoteTweetData.quotePost`. */
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
   * Which extraction strategy produced this record. Purely diagnostic: a body or
   * media count of `none` is the early warning that X changed its DOM, ahead of
   * user reports. The `fallback` values this once offered are gone because no
   * path could produce them -- `text` comes from `tweetText` and nowhere else --
   * so the warning it advertised could never fire.
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
  text?: 'testid' | 'none';
  media?: 'testid' | 'none';
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
