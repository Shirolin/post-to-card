export interface AuthorInfo {
  name: string;
  handle: string;
  avatarUrl: string;
  verified?: boolean;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string; // upgraded to large or 400x400
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
}

export interface ThreadData {
  author: AuthorInfo;
  tweets: TweetData[];
  isSingle: boolean;
  targetTweetIndex?: number;
}
