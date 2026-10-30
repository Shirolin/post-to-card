/**
 * The GraphQL operations worth intercepting, and what each one is for.
 *
 * Matched by name only, never by `queryId`: X rotates that segment on its own
 * schedule (see `docs/x-graphql-research.md` §0, item 1) and the names are what
 * the client actually calls. The names below come from the client's own request
 * URLs, not from that report's §1.2 table — that table also lists profile,
 * follower and moderation operations this extension has no use for.
 *
 * The hook watches the union; the bridge decides what to build from a body. An
 * operation that is missing here simply falls back to the DOM channel, so a new
 * or renamed timeline operation costs the extension its extra proof, never its
 * cards.
 */

/**
 * Operations whose body is the card's own content on a status page.
 *
 * `TweetDetail` carries the whole conversation — every post of the thread, in
 * order, with its author. `TweetResultByRestId` carries the one post it was
 * asked for, with no instruction list, so `parse.ts` reshapes it into a
 * one-post thread; it is watched because a status page load that goes through
 * it would otherwise have no GraphQL channel at all.
 */
export const DETAIL_OPERATIONS: Record<string, true> = {
  TweetDetail: true,
  TweetResultByRestId: true,
};

/**
 * Operations behind the list views the trigger button appears in — the home
 * timeline, profiles, search, lists, communities, bookmarks.
 *
 * They never carry a conversation, but each post object in them states which
 * post it answers, which is the one fact X itself threads by (see
 * `bridge.ts`). Forwarding them is what lets a click in a feed prove its
 * thread; the linkage index itself is fed from every captured payload, so a
 * conversation contributes to it too.
 *
 * Forwarding their bodies means a copy across the world boundary and a parse per
 * timeline response. Reading the linkage in the hook instead would save the copy
 * and put payload knowledge in the transport, which is the exchange this list
 * takes: the hook stays a forwarder, and the cost lands where the payload is
 * already being handled.
 */
export const LINKAGE_OPERATIONS: Record<string, true> = {
  HomeTimeline: true,
  HomeLatestTimeline: true,
  UserTweets: true,
  UserTweetsAndReplies: true,
  UserOriginalsTimeline: true,
  UserRepliesTimeline: true,
  UserRepostsTimeline: true,
  UserMedia: true,
  UserPhotoTimeline: true,
  UserVideoTimeline: true,
  SearchTimeline: true,
  ListLatestTweetsTimeline: true,
  CommunityTweetsTimeline: true,
  Bookmarks: true,
};

/** Everything the MAIN-world hook forwards across the world boundary. */
export const WATCHED_OPERATIONS: Record<string, true> = {
  ...DETAIL_OPERATIONS,
  ...LINKAGE_OPERATIONS,
};
