/**
 * Thread scope: which tweets a card is showing right now.
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
 * `threadScope` is the answer. Callers read the counts and the may-exclude
 * verdict from here rather than counting for themselves, and build their next
 * set from the one it returns, which drops the stale keys as a side effect
 * rather than needing a rule for when to clear them.
 *
 * The floor that guarantees a card is never empty is not applied here: the card
 * renders a fallback tweet and the preview summary floors its count, and those
 * are two different decisions about two different surfaces.
 */

import type { ThreadData, TweetData } from '../../types/tweet.ts';

/**
 * A tweet's key within its thread.
 *
 * The post id is the identity. A post that arrived without one falls back to
 * its position, which is only stable for the thread it came from — so every
 * surface has to derive the key the same way, or a row in the controls panel
 * and a button on the card end up naming different tweets.
 */
export function tweetKey(tweet: TweetData | undefined, index: number): string {
  return tweet?.id || String(index);
}

export interface ThreadScope {
  /**
   * Excluded keys that belong to this thread. A fresh set, so a caller may
   * mutate it and hand the result back as the thread's new exclusions.
   */
  excluded: Set<string>;
  /** Tweets the card shows, before any floor. Zero when all are excluded. */
  activeCount: number;
  totalCount: number;
  /**
   * Whether one more tweet may be dropped. False as soon as a single tweet is
   * left, which is the one that has to stay.
   */
  canExcludeMore: boolean;
}

/**
 * Works out the scope of a thread against the exclusions saved for it.
 */
export function threadScope(
  thread: ThreadData | null | undefined,
  storedExclusions: string[] | undefined
): ThreadScope {
  const tweets = thread?.tweets || [];

  const inThread = new Set<string>();
  for (let index = 0; index < tweets.length; index++) {
    inThread.add(tweetKey(tweets[index], index));
  }

  // Only this thread's keys carry meaning here. Keeping the others would let
  // another thread's exclusions decide how many tweets this card may drop.
  const excluded = new Set<string>();
  for (const key of storedExclusions || []) {
    if (inThread.has(key)) excluded.add(key);
  }

  const totalCount = tweets.length;
  const activeCount = totalCount - excluded.size;

  return {
    excluded,
    activeCount,
    totalCount,
    canExcludeMore: activeCount > 1,
  };
}

/**
 * Next exclusions after toggling one tweet. Re-adding is always allowed;
 * dropping goes through the scope verdict, so the last showing tweet stays.
 * Built from the scope's own set, which drops stale keys as a side effect.
 */
export function toggleExcluded(
  thread: ThreadData | null | undefined,
  storedExclusions: string[] | undefined,
  key: string
): string[] {
  const scope = threadScope(thread, storedExclusions);
  const next = new Set(scope.excluded);
  if (next.has(key)) {
    next.delete(key);
  } else if (scope.canExcludeMore) {
    next.add(key);
  }
  return Array.from(next);
}

/**
 * Next exclusions that leave only the target tweet showing.
 */
export function selectCurrentOnly(thread: ThreadData | null | undefined): string[] {
  if (!thread) return [];
  const targetIdx = thread.targetTweetIndex ?? 0;
  const key = tweetKey(thread.tweets[targetIdx], targetIdx);
  return thread.tweets
    .map((item, idx) => tweetKey(item, idx))
    .filter((k) => k !== key);
}