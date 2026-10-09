/**
 * Maps X GraphQL responses onto this project's TweetData / ThreadData model.
 *
 * Field paths follow the current response shape. The `legacy` object is still
 * required for tweets even though it is being removed for user objects, so
 * author fields accept both the legacy and the newer shape.
 *
 * Asset URLs are the same assets the DOM channel reads, so they go through the
 * same rules: `urls.ts` owns what an X media URL looks like, and this channel is
 * the second caller of it rather than a second implementation of it.
 */

import type { ThreadData, TweetData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData, ArticleData } from '../../types/tweet.ts';
import { upgradeAvatarUrl, upgradePhotoUrl } from '../adapter/urls.ts';
import { isArticlePermalink, stripTrailingArticleToken } from '../adapter/emojis.ts';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type RichToken = NonNullable<TweetData['richTokens']>[number];

/**
 * Builds the styled-token view of a body from X's entity ranges.
 *
 * X keeps entity offsets against the same string it returns as the body, so the
 * visible text is reconstructed by walking the ranges in order. URLs are the one
 * exception: the body carries the t.co redirect while X — and therefore the card
 * — shows the human-readable `display_url`.
 *
 * Returns undefined when the body has no styled segments, so plain posts keep the
 * simple string path.
 */
function parseRichTokens(text: string, entityContainer: unknown): RichToken[] | undefined {
  if (!text || !isObject(entityContainer)) return undefined;

  const ranges: Array<{ start: number; end: number; token: RichToken }> = [];

  const add = (list: unknown, make: (entity: Json, visible: string) => RichToken) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!isObject(raw)) continue;
      const indices = Array.isArray(raw.indices) ? raw.indices : null;
      if (!indices || indices.length < 2) continue;
      const start = Number(indices[0]);
      const end = Number(indices[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      if (start < 0 || end > text.length || end <= start) continue;
      ranges.push({ start, end, token: make(raw, text.slice(start, end)) });
    }
  };

  add(entityContainer.hashtags, (_e, visible) => ({ type: 'hashtag', value: visible }));
  add(entityContainer.symbols, (_e, visible) => ({ type: 'cashtag', value: visible }));
  add(entityContainer.user_mentions, (_e, visible) => ({ type: 'mention', value: visible }));
  add(entityContainer.urls, (entity, visible) => ({
    type: 'link',
    value: str(entity.display_url) || visible,
    href: str(entity.expanded_url) || str(entity.url) || undefined,
  }));

  if (ranges.length === 0) return undefined;

  // Entity order is not guaranteed; overlaps only occur in malformed payloads,
  // where the first range wins and the rest are dropped.
  ranges.sort((a, b) => a.start - b.start);
  const tokens: RichToken[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) tokens.push({ type: 'text', value: text.slice(cursor, range.start) });
    tokens.push(range.token);
    cursor = range.end;
  }
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });

  return tokens;
}

/**
 * Picks the entity container that matches the body text in use: long posts keep
 * their entities beside the note body, shorter posts under `legacy`.
 */
function entitySourceFor(noteResult: unknown, legacy: Json): unknown {
  const noteEntitySet = isObject(noteResult) ? noteResult.entity_set : undefined;
  if (isObject(noteEntitySet)) return noteEntitySet;
  return isObject(legacy.entities) ? legacy.entities : undefined;
}

/**
 * Unwraps a `TweetUnion`: results can be a plain Tweet, a visibility wrapper
 * around one, a tombstone, unavailable, or missing entirely.
 */
function unwrapTweetUnion(value: unknown): { tweet?: Json; unavailable: boolean } {
  if (!isObject(value)) return { unavailable: true };
  const type = str(value.__typename);
  if (type === 'TweetTombstone' || type === 'TweetUnavailable') {
    return { unavailable: true };
  }
  if (isObject(value.tweet)) {
    // TweetWithVisibilityResults keeps the real payload under `tweet`.
    const inner = unwrapTweetUnion(value.tweet);
    return inner.tweet ? inner : { unavailable: true };
  }
  if (type === 'Tweet' && str(value.rest_id)) {
    return { tweet: value, unavailable: false };
  }
  return { unavailable: true };
}

function parseAuthor(tweet: Json): AuthorInfo {
  const userResults = isObject(tweet.core) ? tweet.core.user_results : undefined;
  const result = isObject(userResults) ? unwrapUser(userResults.result) : null;
  const legacy = result && isObject(result.legacy) ? result.legacy : {};
  const core = result && isObject(result.core) ? result.core : {};

  // `legacy` is being removed for user objects; newer responses expose the
  // profile shape directly, so both are accepted.
  const handle =
    str(core.screen_name) ||
    str(legacy.screen_name) ||
    str((core.user_results as Json | undefined)?.screen_name) ||
    '';
  const name =
    str(core.name) ||
    str(legacy.name) ||
    str(result?.name) ||
    handle;

  // The avatar moved out of `legacy` too: newer responses carry it under
  // `avatar.image_url`, while `legacy.profile_image_url_https` is the older
  // path. Reading only the legacy field left the card on its placeholder even
  // though name and handle (which come from `core`) still resolved.
  const avatar = isObject(result?.avatar) ? result.avatar : {};
  const rawAvatarUrl =
    str(avatar.image_url) ||
    str(result?.profile_image_url_https) ||
    str(result?.avatar_url) ||
    str(legacy.profile_image_url_https) ||
    str(legacy.profile_image_url) ||
    '';

  return {
    name,
    handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
    // X serves profile images at _normal or _bigger, and this channel used to
    // take whatever the payload carried. The DOM channel upscales them, and
    // content/index.ts prefers GraphQL whenever it has tweets, so a card built
    // from a payload showed a 48px avatar stretched over its recess -- on the
    // sheet and in the exported PNG. One rule, both channels.
    avatarUrl: upgradeAvatarUrl(rawAvatarUrl),
    verified: isObject(result?.verification) || Boolean(result?.is_blue_verified),
  };
}

function unwrapUser(value: unknown): Json | null {
  if (!isObject(value)) return null;
  if (isObject(value.user)) return unwrapUser(value.user);
  if (isObject(value.result)) return unwrapUser(value.result);
  return value;
}

/** Parses X's `Mon Dec 22 19:38:26 +0000 2025` timestamp into ISO form. */
function parseXDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

function parseStats(tweet: Json): TweetStats | undefined {
  const legacy = isObject(tweet.legacy) ? tweet.legacy : {};
  // `views.count` is a preformatted string (e.g. "377K") while the legacy
  // counters are numbers, so the two shapes are handled separately.
  const views = isObject(tweet.views) ? tweet.views.count : undefined;
  const entries: Array<[keyof TweetStats, unknown]> = [
    ['replies', legacy.reply_count],
    ['reposts', legacy.retweet_count],
    ['likes', legacy.favorite_count],
    ['bookmarks', legacy.bookmark_count],
  ];
  const out: TweetStats = {};
  let hasAny = false;
  for (const [key, value] of entries) {
    if (typeof value === 'number' && value >= 0) {
      out[key] = String(value);
      hasAny = true;
    }
  }
  const viewCount = str(views) || (typeof views === 'number' ? String(views) : undefined);
  if (viewCount) {
    out.views = viewCount;
    hasAny = true;
  }
  return hasAny ? out : undefined;
}

/**
 * The first paragraph of X's article preview text, or undefined.
 *
 * X's `preview_text` can carry several paragraphs. The card's lead is the
 * article's opening line, and the DOM channel can only read the first
 * paragraph, so both channels take the same slice rather than the card
 * printing different amounts for the same article depending on which answered.
 */
function firstParagraph(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [first] = value.split(/\n\s*\n/);
  const trimmed = first.trim();
  return trimmed || undefined;
}

/**
 * Parses the article attached to a long-form post, or undefined.
 *
 * The article rides on the tweet as `article.article_results.result`, an
 * `ArticleEntity`. Only what the card shows is read: the title, the cover and
 * the opening preview. The article's own body lives under `content_state` in
 * the `ArticleByTweetId` response and runs to thousands of words — a card is a
 * poster, not a reader.
 *
 * X pads the title with trailing whitespace in the payload (`"Anime Harry
 * Potter "`), which would ride into the card's layout as a phantom gap, so it is
 * trimmed here rather than at every use.
 */
function parseArticle(tweet: Json): ArticleData | undefined {
  const article = isObject(tweet.article) ? tweet.article.article_results : undefined;
  const result = isObject(article) ? article.result : undefined;
  if (!isObject(result)) return undefined;
  if (str(result.__typename) !== 'ArticleEntity') return undefined;

  const title = str(result.title)?.trim();
  // A title is what makes an article an article on the card; without one the
  // record would only add an untitled cover.
  if (!title) return undefined;

  const coverResult = isObject(result.cover_media_results) ? result.cover_media_results.result : undefined;
  const mediaInfo = isObject(coverResult) && isObject(coverResult.media_info) ? coverResult.media_info : undefined;
  const coverUrl = isObject(mediaInfo) ? str(mediaInfo.original_img_url) : undefined;

  let cover: MediaItem | undefined;
  if (coverUrl) {
    const width = isObject(mediaInfo) && typeof mediaInfo.original_img_width === 'number' ? mediaInfo.original_img_width : 0;
    const height = isObject(mediaInfo) && typeof mediaInfo.original_img_height === 'number' ? mediaInfo.original_img_height : 0;
    // Same rule as every other picture: `urls.ts` states the format and the
    // resolution fallback, so the cover is not a second implementation of it.
    cover = {
      type: 'image',
      url: upgradePhotoUrl(coverUrl),
      originalUrl: coverUrl,
      aspectRatio: width > 0 && height > 0 ? Number((width / height).toFixed(3)) : undefined,
    };
  }

  return {
    title,
    openingLine: firstParagraph(str(result.preview_text)),
    cover,
  };
}

function parseMedia(tweet: Json): MediaItem[] | undefined {
  const legacy = isObject(tweet.legacy) ? tweet.legacy : {};
  const extended = isObject(legacy.extended_entities) ? legacy.extended_entities.media : undefined;
  const basic = isObject(legacy.entities) ? legacy.entities.media : undefined;
  const list = Array.isArray(extended) ? extended : (Array.isArray(basic) ? basic : []);
  if (list.length === 0) return undefined;

  const items: MediaItem[] = [];
  for (const entry of list.slice(0, 4)) {
    if (!isObject(entry)) continue;
    const type = str(entry.type);
    const baseUrl = str(entry.media_url_https) || str(entry.media_url);
    if (!baseUrl) continue;

    const info = isObject(entry.original_info) ? entry.original_info : {};
    const width = typeof info.width === 'number' ? info.width : 0;
    const height = typeof info.height === 'number' ? info.height : 0;

    if (type === 'photo' || !type) {
      // The URL rule is `urls.ts`'s, not a second copy: it rewrites a WebP source
      // to JPEG and states `name=orig`, which is the same statement this channel
      // used to hardcode — but with the `orig -> large -> medium` fallback the
      // export path already relies on when `orig` 404s.
      items.push({
        type: 'image',
        url: upgradePhotoUrl(baseUrl),
        originalUrl: baseUrl,
        alt: str(entry.ext_alt_text),
        aspectRatio: width > 0 && height > 0 ? Number((width / height).toFixed(3)) : undefined,
      });
      continue;
    }

    if (type === 'video' || type === 'animated_gif') {
      const videoInfo = isObject(entry.video_info) ? entry.video_info : {};
      const variants = Array.isArray(videoInfo.variants) ? videoInfo.variants : [];
      let bestUrl = '';
      let bestBitrate = -1;
      for (const variant of variants) {
        if (!isObject(variant)) continue;
        if (str(variant.content_type) !== 'video/mp4') continue;
        const bitrate = typeof variant.bitrate === 'number' ? variant.bitrate : 0;
        if (bitrate > bestBitrate) {
          bestBitrate = bitrate;
          bestUrl = str(variant.url) || '';
        }
      }

      const durationMillis = typeof videoInfo.duration_millis === 'number' ? videoInfo.duration_millis : 0;
      const totalSeconds = Math.floor(durationMillis / 1000);
      // Same rule as the photo above, per `urls.ts`: the poster carries the
      // stated format and the resolution fallback.
      const poster = upgradePhotoUrl(baseUrl);

      items.push({
        type: type === 'animated_gif' ? 'gif' : 'video',
        // The card renders a still frame, so the poster is what is displayed.
        url: poster,
        originalUrl: bestUrl || poster,
        posterUrl: poster,
        alt: str(entry.ext_alt_text),
        aspectRatio: width > 0 && height > 0 ? Number((width / height).toFixed(3)) : undefined,
        duration: durationMillis > 0
          ? `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
          : undefined,
      });
    }
  }

  return items.length > 0 ? items : undefined;
}

function parseQuote(tweet: Json): QuoteTweetData | undefined {
  const quotedUnion = isObject(tweet.quoted_status_result) ? tweet.quoted_status_result : undefined;
  const quoted = unwrapTweetUnion(quotedUnion?.result ?? quotedUnion);
  if (!quoted.tweet) return undefined;
  const inner = quoted.tweet;
  const legacy = isObject(inner.legacy) ? inner.legacy : {};
  const fullText = str(legacy.full_text) || '';
  const quoteText = authorText(fullText, legacy);
  return {
    author: parseAuthor(inner),
    text: quoteText,
    richTokens: parseRichTokens(quoteText, isObject(legacy.entities) ? legacy.entities : undefined),
    timestamp: parseXDate(legacy.created_at),
    media: parseMedia(inner),
    url: inner.rest_id
      ? `https://x.com/${parseAuthor(inner).handle.replace(/^@/, '')}/status/${inner.rest_id}`
      : undefined,
  };
}

/**
 * The `text`-field form of the article strip.
 *
 * The token list goes through the shared `stripTrailingArticleToken`, but the
 * payload's `text` carries the `t.co` form rather than the expanded URL the
 * tokens hold, so the entity's own `indices` are what locate it here. The entity
 * is only removed when it is the last thing in the body. Without this, a post
 * whose body is nothing but its article link lost the link from the tokens and
 * then printed it again from `text`.
 */
function stripTrailingArticleEntity(text: string, entityContainer: unknown): string {
  if (!text || !isObject(entityContainer) || !Array.isArray(entityContainer.urls)) return text;

  for (const raw of entityContainer.urls) {
    if (!isObject(raw)) continue;
    if (!isArticlePermalink(str(raw.expanded_url) || '')) continue;
    const indices = Array.isArray(raw.indices) ? raw.indices : null;
    if (!indices || indices.length < 2) continue;
    const start = Number(indices[0]);
    const end = Number(indices[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (end !== text.length) continue;
    return text.slice(0, start).trimEnd();
  }

  return text;
}

/**
 * The author's own text from `legacy.full_text`, without the tail X appends.
 *
 * For a post with media, `full_text` ends with the media permalink's `t.co` URL
 * and `display_text_range` states where the author's text actually stops. The
 * card prints the author's words, not that tail; the DOM channel already drops
 * its `pic.twitter.com` form, and this is the GraphQL side of the same rule.
 *
 * Only the end is honoured. Entity indices are stated against `full_text`, so
 * trimming the start would shift every one of them, and X sets the range's start
 * to zero for the posts the card renders.
 */
function authorText(fullText: string, legacy: Json): string {
  const range = legacy.display_text_range;
  if (!Array.isArray(range) || typeof range[1] !== 'number') return fullText;
  const end = range[1];
  if (!(end > 0) || end >= fullText.length) return fullText;
  return fullText.slice(0, end);
}

/**
 * The body a tweet contributes to the card: its plain text and the styled-token
 * view, with the appended article link dropped when the post carries an article.
 *
 * Long posts carry their complete body under `note_tweet`; `legacy.full_text` is
 * the truncated fallback, and `fallbackText` is the last resort when neither
 * exists (a retweet's nested original inherits the outer body if it has none of
 * its own). Both fields are stripped together, since `text` is the card's
 * fallback when the token list is empty.
 *
 * A tweet and a retweet's nested original go through here alike, so the rule is
 * stated once instead of repeated for each.
 */
function parseBody(
  tweet: Json,
  legacy: Json,
  fallbackText: string
): { text: string; richTokens: RichToken[] | undefined; article: ArticleData | undefined } {
  const noteTweet = isObject(tweet.note_tweet) ? tweet.note_tweet.note_tweet_results : undefined;
  const noteResult = isObject(noteTweet) ? noteTweet.result : undefined;
  const entitySource = entitySourceFor(noteResult, legacy);
  const noteText = isObject(noteResult) ? str(noteResult.text) : undefined;
  const legacyText = str(legacy.full_text);
  const rawText =
    noteText ||
    (legacyText ? authorText(legacyText, legacy) : undefined) ||
    fallbackText;

  // Only a post that carries an article ends with the appended link to it; a
  // tweet merely ending with a link to someone else's article keeps that link.
  const article = parseArticle(tweet);
  const rawTokens = parseRichTokens(rawText, entitySource);
  return {
    text: article ? stripTrailingArticleEntity(rawText, entitySource) : rawText,
    richTokens: article ? stripTrailingArticleToken(rawTokens) : rawTokens,
    article,
  };
}

function parseTweet(entry: Json, fallbackId: string): TweetData | null {
  const itemContent = isObject(entry.content) ? entry.content.itemContent : undefined;
  if (!isObject(itemContent)) return null;

  const tweetResults = itemContent.tweet_results;
  const unwrapped = unwrapTweetUnion(isObject(tweetResults) ? tweetResults.result : undefined);
  if (!unwrapped.tweet) return null;

  const tweet = unwrapped.tweet;
  const legacy = isObject(tweet.legacy) ? tweet.legacy : {};
  const id = str(tweet.rest_id) || str(legacy.id_str) || fallbackId;

  const { text, richTokens, article } = parseBody(tweet, legacy, '');

  const data: TweetData = {
    id,
    url: `https://x.com/i/status/${id}`,
    author: parseAuthor(tweet),
    text,
    richTokens,
    timestamp: parseXDate(legacy.created_at),
    stats: parseStats(tweet),
    media: parseMedia(tweet),
    quotePost: parseQuote(tweet),
    article,
    isThreadPart: false,
  };

  // A retweet nests the original post; the visible body belongs to that other
  // account, so the attribution must follow. The reposting account is the
  // outer author and has to be captured before `author` is reassigned.
  const retweetedUnion = isObject(legacy.retweeted_status_result) ? legacy.retweeted_status_result : undefined;
  const retweeted = unwrapTweetUnion(retweetedUnion?.result ?? retweetedUnion);
  if (retweeted.tweet) {
    const original = retweeted.tweet;
    const originalLegacy = isObject(original.legacy) ? original.legacy : {};
    const originalAuthor = parseAuthor(original);
    const reposter = data.author.handle;

    data.author = originalAuthor;
    // The body and the article both belong to the original post, exactly as the
    // media and stats read below do; the outer body is only a last-resort
    // fallback for a nested original that somehow carries no text of its own.
    const originalBody = parseBody(original, originalLegacy, text);
    data.text = originalBody.text;
    data.richTokens = originalBody.richTokens;
    data.id = str(original.rest_id) || str(originalLegacy.id_str) || id;
    data.url = `https://x.com/${originalAuthor.handle.replace(/^@/, '')}/status/${data.id}`;
    // Media can be truncated on the outer object, so read the nested original.
    data.media = parseMedia(original) || data.media;
    data.stats = parseStats(original) || data.stats;
    data.article = originalBody.article || data.article;
    data.retweetedBy = reposter || undefined;
  }

  return data;
}

/** Collects tweet entries from the instruction list, including thread modules. */
function collectTweets(instructions: unknown): TweetData[] {
  if (!Array.isArray(instructions)) return [];

  const collected: Array<{ sortIndex: number; data: TweetData }> = [];
  const seen = new Set<string>();

  const push = (entry: Json, sortIndex: number) => {
    const parsed = parseTweet(entry, '');
    if (!parsed || seen.has(parsed.id)) return;
    seen.add(parsed.id);
    collected.push({ sortIndex, data: parsed });
  };

  for (const instruction of instructions) {
    if (!isObject(instruction)) continue;
    const entries = Array.isArray(instruction.entries) ? instruction.entries : [];
    for (const entry of entries) {
      if (!isObject(entry)) continue;
      const entryId = str(entry.entryId) || '';
      const entryType = str(entry.entryType) || '';
      // Paging cursors are not tweets.
      if (entryId.includes('-cursor-')) continue;

      const sortIndex = typeof entry.sortIndex === 'string' ? Number(entry.sortIndex) : 0;

      if (entryType === 'TimelineTimelineModule' || entryId.startsWith('conversationthread-')) {
        const items = isObject(entry.content) && Array.isArray(entry.content.items) ? entry.content.items : [];
        items.forEach((item, index) => {
          if (isObject(item)) push(item, Number.isFinite(sortIndex) ? sortIndex - index : 0);
        });
      } else {
        push(entry, Number.isFinite(sortIndex) ? sortIndex : 0);
      }
    }

    // Lazily loaded thread pages arrive through TimelineAddToModule.
    const moduleItems = isObject(instruction.moduleItems) ? instruction.moduleItems : undefined;
    if (Array.isArray(moduleItems)) {
      moduleItems.forEach((item, index) => {
        if (isObject(item)) push(item, -index);
      });
    }
  }

  // X does not guarantee ordering, and sortIndex descends with position.
  collected.sort((a, b) => b.sortIndex - a.sortIndex);
  return collected.map((entry) => entry.data);
}

export interface ParsedGraphQL {
  thread: ThreadData | null;
  tombstones: number;
  operationName: string;
  queryId: string;
  parseError?: string;
}

/**
 * Parses a `TweetDetail` or `TweetResultByRestId` response body.
 * Returns a null thread when the payload yielded no usable tweets, which the
 * caller must treat as a failure and route to the DOM channel.
 */
export function parseTweetDetailResponse(
  body: string,
  operationName: string,
  queryId: string,
  targetTweetId?: string
): ParsedGraphQL {
  const base: ParsedGraphQL = { thread: null, tombstones: 0, operationName, queryId };

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    return { ...base, parseError: error instanceof Error ? error.message : 'invalid JSON' };
  }

  if (!isObject(payload) || !isObject(payload.data)) {
    return { ...base, parseError: 'unexpected response shape' };
  }

  const data = payload.data;
  const instructions =
    (isObject(data.threaded_conversation_with_injections_v2) ? data.threaded_conversation_with_injections_v2.instructions : undefined) ??
    (isObject(data.tweet) && isObject(data.tweet.result) ? undefined : undefined);

  const tweets = collectTweets(instructions);
  if (tweets.length === 0) {
    return { ...base, parseError: 'no tweets in response' };
  }

  // The target tweet is whichever one the user is looking at.
  let targetTweetIndex = 0;
  if (targetTweetId) {
    const found = tweets.findIndex((tweet) => tweet.id === targetTweetId);
    if (found < 0) {
      // The payload does not contain the requested tweet. This happens when a
      // response captured earlier is still cached — e.g. the tweet opened in a
      // detail view before navigating back to the timeline. Falling back to
      // index 0 would render that other tweet's card, so this is reported as a
      // miss and the caller routes to the DOM channel instead.
      return { ...base, parseError: `target tweet ${targetTweetId} not in payload` };
    }
    targetTweetIndex = found;
  }

  return {
    ...base,
    thread: {
      author: tweets[targetTweetIndex]?.author ?? tweets[0].author,
      tweets,
      isSingle: tweets.length === 1,
      targetTweetIndex,
    },
  };
}
