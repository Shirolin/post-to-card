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

import type { ThreadData, TweetData, AuthorInfo, MediaItem, TweetStats, QuoteTweetData, ArticleData, RichToken } from '../../types/tweet.ts';
import { QUOTE_LEVELS, unavailableQuote } from '../../types/tweet.ts';
import { upgradeAvatarUrl, upgradePhotoUrl } from '../adapter/urls.ts';
import { isArticlePermalink, stripTrailingArticleToken } from '../adapter/emojis.ts';
import type { ReplyLink } from './bridge.ts';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

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
 * Why a `TweetUnion` did not yield a tweet.
 *
 * `gone` and `unreadable` have to stay apart. `gone` is X telling us the post
 * exists but cannot be shown — a `TweetTombstone` or `TweetUnavailable` — and
 * the card has a tombstone box for exactly that. `unreadable` is a payload this
 * parser does not understand, which is a miss to fall back on the DOM channel
 * for, not a claim that the post was deleted. Collapsing them made a
 * visibility-wrapped quote print "post unavailable" instead of falling back.
 */
type UnionReason = 'ok' | 'gone' | 'unreadable';

/**
 * Unwraps a `TweetUnion`: results can be a plain Tweet, a visibility wrapper
 * around one, a tombstone, unavailable, or missing entirely.
 */
function unwrapTweetUnion(value: unknown): { tweet?: Json; reason: UnionReason } {
  if (!isObject(value)) return { reason: 'unreadable' };
  const type = str(value.__typename);
  if (type === 'TweetTombstone' || type === 'TweetUnavailable') {
    return { reason: 'gone' };
  }
  if (isObject(value.tweet)) {
    // TweetWithVisibilityResults keeps the real payload under `tweet`.
    const inner = unwrapTweetUnion(value.tweet);
    return inner.tweet ? inner : { reason: inner.reason };
  }
  if (type === 'Tweet' && str(value.rest_id)) {
    return { tweet: value, reason: 'ok' };
  }
  return { reason: 'unreadable' };
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

/**
 * Extracts preview media from an external link card (e.g. `summary_large_image`,
 * "from digitalfoundry.net").
 *
 * In GraphQL payloads, external site cards are not listed under `entities.media`
 * or `extended_entities.media`. Instead, they ride on the tweet as `tweet.card`.
 * Their image and title live inside `card.legacy.binding_values`.
 */
function parseCardMedia(card: unknown): MediaItem | undefined {
  if (!isObject(card)) return undefined;
  const legacy = isObject(card.legacy) ? card.legacy : undefined;
  if (!isObject(legacy)) return undefined;

  const bindings = Array.isArray(legacy.binding_values) ? legacy.binding_values : [];
  if (bindings.length === 0) return undefined;

  const imageMap = new Map<string, { url: string; width?: number; height?: number }>();
  let altText: string | undefined;

  for (const entry of bindings) {
    if (!isObject(entry) || typeof entry.key !== 'string') continue;
    const val = isObject(entry.value) ? entry.value : undefined;
    if (!val) continue;

    if (entry.key.includes('alt_text') && typeof val.string_value === 'string' && val.string_value.trim()) {
      altText = val.string_value.trim();
    }

    const imageVal = isObject(val.image_value) ? val.image_value : undefined;
    if (imageVal && typeof imageVal.url === 'string' && imageVal.url) {
      imageMap.set(entry.key, {
        url: imageVal.url,
        width: typeof imageVal.width === 'number' ? imageVal.width : undefined,
        height: typeof imageVal.height === 'number' ? imageVal.height : undefined,
      });
    }
  }

  // Priority order from X's standard card binding keys:
  // Full-size original > Summary original > Thumbnail original > Standard fallback
  const candidateKeys = [
    'photo_image_full_size_original',
    'summary_photo_image_original',
    'thumbnail_image_original',
    'photo_image_full_size',
  ];

  let chosen: { url: string; width?: number; height?: number } | undefined;
  for (const key of candidateKeys) {
    chosen = imageMap.get(key);
    if (chosen) break;
  }
  if (!chosen) return undefined;

  const width = chosen.width || 0;
  const height = chosen.height || 0;

  return {
    type: 'image',
    url: upgradePhotoUrl(chosen.url),
    originalUrl: chosen.url,
    alt: altText,
    aspectRatio: width > 0 && height > 0 ? Number((width / height).toFixed(3)) : undefined,
  };
}

function parseMedia(tweet: Json, hasArticle = false): MediaItem[] | undefined {
  const legacy = isObject(tweet.legacy) ? tweet.legacy : {};
  const extended = isObject(legacy.extended_entities) ? legacy.extended_entities.media : undefined;
  const basic = isObject(legacy.entities) ? legacy.entities.media : undefined;
  const list = Array.isArray(extended) ? extended : (Array.isArray(basic) ? basic : []);

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

  // External site link card (e.g. "from digitalfoundry.net") only when nothing else.
  if (items.length === 0 && !hasArticle) {
    const card = isObject(tweet.card) ? tweet.card : (isObject(legacy.card) ? legacy.card : undefined);
    const cardMedia = parseCardMedia(card);
    if (cardMedia) items.push(cardMedia);
  }

  return items.length > 0 ? items : undefined;
}

/**
 * One quote level, plus the quote it carries.
 *
 * A quoted post is a full tweet, so it can itself quote: X nests the payload
 * the same way. Reading only the first level was silent data loss — the inner
 * author, body and media were absent from the card altogether, so this channel
 * and the DOM channel disagreed about the same post.
 */
function parseQuote(tweet: Json, depth: number = 1): QuoteTweetData | undefined {
  const quotedUnion = isObject(tweet.quoted_status_result) ? tweet.quoted_status_result : undefined;
  // No `quoted_status_result` at all means the post quotes nobody. One that is
  // present but carries a tombstone means it quotes a post that is gone, and the
  // two must not collapse into the same answer: the DOM channel renders the
  // second as a tombstone box, so dropping it here made the channels disagree
  // about the same post depending on which one answered.
  //
  // The third answer, `unreadable`, is neither: it is a payload this parser does
  // not understand, and it must stay a miss so the DOM channel answers instead.
  // Reading it as a tombstone would print "post unavailable" over a quote that
  // is merely a shape this build has not seen.
  if (!quotedUnion) return undefined;
  const quoted = unwrapTweetUnion(quotedUnion.result ?? quotedUnion);
  if (!quoted.tweet) {
    return quoted.reason === 'gone' ? unavailableQuote() : undefined;
  }
  const inner = quoted.tweet;
  const legacy = isObject(inner.legacy) ? inner.legacy : {};
  const quoteText = displayedText(legacy) || '';
  return {
    author: parseAuthor(inner),
    text: quoteText,
    richTokens: parseRichTokens(quoteText, isObject(legacy.entities) ? legacy.entities : undefined),
    timestamp: parseXDate(legacy.created_at),
    media: parseMedia(inner),
    url: inner.rest_id
      ? `https://x.com/${parseAuthor(inner).handle.replace(/^@/, '')}/status/${inner.rest_id}`
      : undefined,
    quotePost: depth < QUOTE_LEVELS ? parseQuote(inner, depth + 1) : undefined,
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
 * The text a `legacy` object actually displays, without the tail X appends.
 *
 * For a post with media, `full_text` ends with the media permalink's `t.co` URL,
 * and `display_text_range` states where the text X shows stops. The card prints
 * the author's words, not that tail; the DOM channel already drops its
 * `pic.twitter.com` form, and this is the GraphQL side of the same rule. The
 * range is authoritative, so it is applied whenever X gives one — a media
 * permalink is the common case, not a precondition.
 *
 * Only the range's end is honoured. Entity indices are stated against
 * `full_text`, so trimming the start would shift every one of them, and X
 * renders a reply's leading mentions in the DOM too, so keeping them here is
 * what makes the two channels agree. A missing range means no trim, and a
 * trailing space inside the range is dropped the way the DOM channel trims it.
 */
function displayedText(legacy: Json): string | undefined {
  const fullText = str(legacy.full_text);
  if (!fullText) return undefined;

  const range = legacy.display_text_range;
  if (!Array.isArray(range) || typeof range[1] !== 'number') return fullText;
  const end = range[1];
  if (!(end > 0) || end >= fullText.length) return fullText;
  return fullText.slice(0, end).trimEnd();
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
  const rawText = noteText || displayedText(legacy) || fallbackText;

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
  // A standalone entry carries its content at `content.itemContent`; an entry
  // inside a `TimelineTimelineModule` sits one level deeper, at
  // `item.itemContent`. Reading only the first shape drops every module post.
  const content = isObject(entry.content) ? entry.content : undefined;
  const nested = isObject(entry.item) ? entry.item : undefined;
  const itemContent =
    (content && isObject(content.itemContent) ? content.itemContent : undefined) ??
    (nested && isObject(nested.itemContent) ? nested.itemContent : undefined);
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
    media: parseMedia(tweet, Boolean(article)),
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
    data.media = parseMedia(original, Boolean(originalBody.article)) || data.media;
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
        // X puts a module's posts on the entry itself (`entry.items`); only
        // older payloads nest the array under `entry.content.items`. Reading
        // the nested key alone finds nothing in a current response, which
        // silently reduced a conversation to its root post.
        const nestedModule = isObject(entry.content) && Array.isArray(entry.content.items) ? entry.content.items : [];
        const items = Array.isArray(entry.items) ? entry.items : nestedModule;
        if (items.length === 0) {
          // A `conversationthread-` entry may carry its post directly instead
          // of a module; treating that as an empty module drops the post.
          push(entry, Number.isFinite(sortIndex) ? sortIndex : 0);
        } else {
          items.forEach((item, index) => {
            if (isObject(item)) push(item, Number.isFinite(sortIndex) ? sortIndex - index : 0);
          });
        }
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

/**
 * Why a payload did not answer.
 *
 * Five different things can go wrong, and they call for different responses:
 * no payload was ever captured, which means the channel never fired; a body
 * that is not JSON at all means the capture is broken; a shape that is not the
 * one this parser knows means X changed the payload; a payload with no tweets
 * in it is the empty-response case that a rotated endpoint produces; and a
 * payload that simply does not carry the post being asked about means the
 * cache holds a different conversation.
 *
 * A single string could carry all five, but then a caller could only compare it
 * against the literal text, and the one caller that had a reason to look —
 * the resolver, which reports *why* the GraphQL channel was not the answer —
 * had no way to tell them apart.
 */
export type GraphQLParseFailure =
  /** No payload was ever captured for the request. The channel never fired. */
  | { reason: 'no-payload' }
  /** The body was not JSON. The capture itself is suspect. */
  | { reason: 'invalid-json'; detail?: string }
  /** The body parsed but is not a shape this parser knows. X changed it. */
  | { reason: 'unexpected-shape' }
  /** The payload carried no tweets. The empty-response case. */
  | { reason: 'no-tweets' }
  /** The payload parsed and carried tweets, but not the one being asked about. */
  | { reason: 'target-absent'; targetTweetId: string };

export interface ParsedGraphQL {
  thread: ThreadData | null;
  operationName: string;
  queryId: string;
  /** Why this payload did not answer, when it did not. */
  failure?: GraphQLParseFailure;
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
  targetTweetId?: string,
  /**
   * The reply linkage of `body`, when the caller already has it.
   *
   * The bridge parses every captured body for its reply links anyway -- that
   * index is the only way a list view can prove thread membership -- so passing
   * the result down saves a second full `JSON.parse` plus walk of a body that
   * can run to megabytes. Omitted, this parses the body itself.
   */
  knownReplyLinks?: Map<string, ReplyLink>
): ParsedGraphQL {
  const base: ParsedGraphQL = { thread: null, operationName, queryId };

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    return {
      ...base,
      failure: {
        reason: 'invalid-json',
        detail: error instanceof Error ? error.message : undefined,
      },
    };
  }

  if (!isObject(payload) || !isObject(payload.data)) {
    return { ...base, failure: { reason: 'unexpected-shape' } };
  }

  const data = payload.data;
  const instructions = isObject(data.threaded_conversation_with_injections_v2)
    ? data.threaded_conversation_with_injections_v2.instructions
    : undefined;

  // `TweetResultByRestId` answers with one post and no instruction list, so it
  // has to be reshaped into the entry `parseTweet` reads rather than dropped:
  // the operation is watched and cached by name (`operations.ts`), and without
  // this branch every payload it ever delivers reports "no tweets in response"
  // and falls through to the DOM channel.
  const singleTweet =
    !instructions && isObject(data.tweet) && isObject(data.tweet.result)
      ? [
          {
            entries: [
              {
                entryId: '',
                content: { itemContent: { tweet_results: { result: data.tweet.result } } },
              },
            ],
          },
        ]
      : undefined;

  const tweets = collectTweets(instructions ?? singleTweet);
  if (tweets.length === 0) {
    return { ...base, failure: { reason: 'no-tweets' } };
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
      return { ...base, failure: { reason: 'target-absent', targetTweetId } };
    }
    targetTweetIndex = found;
  }

  const isPureSingleAuthor = tweets.every(
    (t) => t.author.handle.toLowerCase() === tweets[0].author.handle.toLowerCase()
  );

  let scopedTweets = tweets;
  if (targetTweetId && !isPureSingleAuthor) {
    const replyLinks = knownReplyLinks ?? parseReplyLinkage(body);
    const targetTweet = tweets[targetTweetIndex];

    const ancestors: TweetData[] = [];
    const seenIds = new Set<string>([targetTweet.id]);
    let currId = targetTweet.id;

    for (let depth = 0; depth < 10; depth++) {
      const parentId = replyLinks.get(currId)?.inReplyToId;
      if (parentId && !seenIds.has(parentId)) {
        const parentTweet = tweets.find((t) => t.id === parentId);
        if (parentTweet) {
          seenIds.add(parentId);
          ancestors.unshift(parentTweet);
          currId = parentId;
          continue;
        }
      }
      break;
    }

    if (
      targetTweetIndex > 0 &&
      ancestors.length === 0 &&
      tweets[0].id !== targetTweet.id &&
      !seenIds.has(tweets[0].id)
    ) {
      ancestors.unshift(tweets[0]);
    }

    const sameAuthorSuccessors: TweetData[] = [];
    for (let i = targetTweetIndex + 1; i < tweets.length; i++) {
      const nextTweet = tweets[i];
      if (nextTweet.author.handle.toLowerCase() !== targetTweet.author.handle.toLowerCase()) {
        break;
      }
      sameAuthorSuccessors.push(nextTweet);
    }

    if (ancestors.length > 0 || sameAuthorSuccessors.length > 0) {
      scopedTweets = [...ancestors, targetTweet, ...sameAuthorSuccessors];
      targetTweetIndex = ancestors.length;
    } else {
      scopedTweets = [targetTweet];
      targetTweetIndex = 0;
    }
  }

  if (scopedTweets.length > 1) {
    for (let idx = 0; idx < scopedTweets.length; idx++) {
      scopedTweets[idx].isThreadPart = true;
      scopedTweets[idx].threadIndex = idx;
      scopedTweets[idx].threadTotal = scopedTweets.length;
    }
  }

  return {
    ...base,
    thread: {
      author: scopedTweets[targetTweetIndex]?.author ?? scopedTweets[0].author,
      tweets: scopedTweets,
      isSingle: scopedTweets.length === 1,
      targetTweetIndex,
    },
  };
}

/** Node budget for the linkage walk. Hitting it only ever costs proofs. */
const MAX_LINKAGE_NODES = 250_000;

/**
 * Collects X's reply linkage out of any captured payload.
 *
 * Deliberately shape-agnostic. A `TweetDetail` conversation, a `HomeTimeline`
 * page, a `UserTweets` page and a `TweetResultByRestId` lookup all nest post
 * objects differently, and the thread fact this project needs -- which post a
 * post answers -- sits on whichever post object carries `legacy`. So the walk
 * looks for a post's own shape rather than for a path, and a payload it does not
 * recognise yields an empty map instead of an error, which leaves the DOM
 * channel exactly where it was.
 *
 * This runs once per captured response, and a timeline body is large, so it is
 * bounded by node count and stops early rather than walking a runaway payload.
 */
export function parseReplyLinkage(body: string): Map<string, ReplyLink> {
  const found = new Map<string, ReplyLink>();

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return found;
  }

  const stack: unknown[] = [payload];
  let visited = 0;

  while (stack.length > 0 && visited < MAX_LINKAGE_NODES) {
    const node = stack.pop();
    visited++;
    if (!node || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }

    const tweet = node as Json;
    const legacy = isObject(tweet.legacy) ? tweet.legacy : undefined;
    // A post object carries `full_text`; a user object's `legacy` (X still ships
    // one, see the avatar note in the parser above) does not, and indexing those
    // would spend the budget on entries that can never prove a thread.
    if (legacy && typeof legacy.full_text === 'string') {
      const id = str(tweet.rest_id) || str(legacy.id_str);
      if (id) {
        found.set(id, {
          inReplyToId: str(legacy.in_reply_to_status_id_str),
        });
      }
    }

    // `for...in` with an own-property guard, rather than `Object.values`: the
    // walk visits up to MAX_LINKAGE_NODES objects on a timeline body, and
    // `Object.values` allocates a fresh array of every value per node. The
    // guard keeps the same set -- an own enumerable key, the only kind
    // `Object.values` would have returned.
    for (const key in tweet) {
      if (Object.hasOwn(tweet, key)) stack.push(tweet[key]);
    }
  }

  return found;
}
