/**
 * Thread Session: the editing lifecycle of one thread inside the card modal.
 *
 * A card holds one thread, but the exclusions live in the saved preferences
 * rather than with the thread, so they outlive it. Excluding two of three
 * tweets and then opening a different thread leaves two keys behind that name
 * tweets this card does not have. Whether the card may drop another tweet was
 * therefore answered from two different sets — one counted every key ever
 * saved, the other only this thread's — and the two disagreed exactly when
 * stale keys were present. The on-card exclude button asks neither; it appears
 * whenever more than one tweet is showing, so it could be pressed and do
 * nothing.
 *
 * This module is the one answer. It names the posts the card is showing, the
 * post the thread is about, the count the panel quotes, and the verdict on
 * whether one more may be dropped. The card, the panel, the preview summary and
 * the export handler all read it, so they cannot disagree about which posts
 * those are.
 *
 * The floor that guarantees a card is never empty lives here too: `showing` is
 * never empty, because a card with nothing on it is not a card. The raw count
 * is reported beside it, because "three posts are excluded" and "one post is
 * being printed" are two different facts about two different surfaces — the
 * panel quotes the first, the card shows the second.
 */

import type { ThreadData, TweetData } from '../types/tweet.ts';

/**
 * A post's key within its thread.
 *
 * The post id is the identity. A post that arrived without one falls back to
 * its position, which is only stable for the thread it came from — so every
 * surface has to derive the key the same way, or a row in the controls panel
 * and a button on the card end up naming different tweets.
 */
function tweetKey(tweet: TweetData | undefined, index: number): string {
  return tweet?.id || String(index);
}

/**
 * One post in the thread, as the panel lists it: the post itself, the key that
 * names it, and whether it is currently excluded.
 */
export interface ThreadSessionRow {
  tweet: TweetData;
  /** The post's key within this thread. Names it in `toggleExcluded`. */
  key: string;
  /** True when this post is excluded from the card. */
  excluded: boolean;
}

/**
 * The state of one thread's editing session, answered in one call.
 */
export interface ThreadSession {
  /**
   * The posts the card is showing, in order. Never empty *because of the
   * exclusions*: when every post is excluded the target post stands in,
   * because a card with nothing on it is not a card. A thread that holds no
   * posts at all shows none, which is a different thing entirely.
   */
  showing: TweetData[];
  /**
   * How many posts are not excluded, before the floor above. Zero when every
   * post is excluded.
   */
  rawCount: number;
  /** How many posts the thread holds. */
  totalCount: number;
  /**
   * Whether one more post may be dropped. False as soon as a single post is
   * left, which is the one that has to stay.
   */
  canExcludeMore: boolean;
  /**
   * The post the thread is about — the one that was opened, and the one the
   * export names the file after. It is not the first post that happens to be
   * showing, and it is not affected by the exclusions.
   */
  targetTweet: TweetData | undefined;
  /** The target post's key within this thread. */
  targetKey: string;
  /** Whether the target post is currently excluded. */
  targetExcluded: boolean;
  /**
   * The excluded posts' keys, in the order they were saved.
   *
   * The rows above list the thread in thread order; this lists the exclusions
   * in the order the preferences store holds them, which is the order the next
   * set is written back in.
   */
  excludedKeys: string[];
  /**
   * Every post in the thread, excluded ones included, each with its key and
   * its excluded state. The panel lists these; the card prints the subset
   * that is showing.
   */
  rows: ThreadSessionRow[];
}

/**
 * Works out the session of a thread against the exclusions saved for it.
 */
export function threadSession(
  thread: ThreadData | null | undefined,
  storedExclusions: string[] | undefined
): ThreadSession {
  const tweets = thread?.tweets || [];

  const inThread = new Set<string>();
  for (let index = 0; index < tweets.length; index++) {
    inThread.add(tweetKey(tweets[index], index));
  }

  // Only this thread's keys carry meaning here. Keeping the others would let
  // another thread's exclusions decide how many tweets this card may drop.
  // The set is built in the order the keys were saved, so the next exclusions
  // read back in that same order.
  const excluded = new Set<string>();
  for (const key of storedExclusions || []) {
    if (inThread.has(key)) excluded.add(key);
  }

  const rows: ThreadSessionRow[] = tweets.map((tweet, index) => {
    const key = tweetKey(tweet, index);
    return { tweet, key, excluded: excluded.has(key) };
  });

  const showing = rows.filter((row) => !row.excluded).map((row) => row.tweet);
  const rawCount = showing.length;
  const totalCount = tweets.length;

  // The post the thread is about. It is the one the user opened, and the one
  // the export names the file after — neither fact depends on what is showing.
  const targetIndex = thread?.targetTweetIndex ?? 0;
  const targetTweet = tweets[targetIndex] || tweets[0];
  // A key is derived from the post's own position, so the fallback post is
  // keyed by where it actually sits rather than by where the target was meant
  // to be.
  const targetPosition = tweets[targetIndex] ? targetIndex : 0;
  const targetKey = targetTweet ? tweetKey(targetTweet, targetPosition) : '';
  const targetExcluded = targetKey ? excluded.has(targetKey) : false;

  // The floor: a card with nothing on it is not a card, so the target post
  // stands in when everything is excluded. The count above still reports the
  // exclusion as it is — the panel quotes that, and the card shows this.
  if (showing.length === 0 && targetTweet) {
    showing.push(targetTweet);
  }

  return {
    showing,
    rawCount,
    totalCount,
    canExcludeMore: rawCount > 1,
    targetTweet,
    targetKey,
    targetExcluded,
    excludedKeys: Array.from(excluded),
    rows,
  };
}

/**
 * Next exclusions after toggling one post. Re-adding is always allowed;
 * dropping goes through the scope verdict, so the last showing post stays.
 * Built from the session's own set, which drops stale keys as a side effect.
 */
export function toggleExcluded(
  thread: ThreadData | null | undefined,
  storedExclusions: string[] | undefined,
  key: string
): string[] {
  const session = threadSession(thread, storedExclusions);
  const next = new Set(session.excludedKeys);
  if (next.has(key)) {
    next.delete(key);
  } else if (session.canExcludeMore) {
    next.add(key);
  }
  return Array.from(next);
}

/**
 * Next exclusions that leave only the target post showing.
 */
export function selectCurrentOnly(thread: ThreadData | null | undefined): string[] {
  if (!thread) return [];
  const session = threadSession(thread, undefined);
  return session.rows
    .filter((row) => row.key !== session.targetKey)
    .map((row) => row.key);
}
