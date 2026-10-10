/**
 * X's own reply linkage, keyed by post id.
 *
 * X draws a self-thread's sections from the payload, not from the rendered DOM.
 * A section is the next one exactly when its
 * `legacy.in_reply_to_status_id_str` names the previous section's id — X's own
 * condition, measured against a real self-thread in `docs/detection-audit.md` —
 * and `legacy.in_reply_to_screen_name` is the author half of the same rule. Only
 * the id is kept: the walk's own author check already establishes the other
 * half, so a second copy of it would be a field with no reader.
 *
 * The rendered DOM carries no equivalent: on a status page a thread's sections
 * are plainly adjacent posts with no marker at all, and the same holds in the
 * list views, where a click has nothing else to consult. So this index is the
 * only positive proof a feed can offer, and the DOM walk asks it first.
 *
 * It is fed from every captured list-view payload, because a single timeline
 * response carries many posts and the reader may click any of them, and it is
 * bounded: past `MAX_LINKS` the oldest records are dropped, since the reader
 * clicks what is on screen.
 */

export interface ReplyLink {
  /** `legacy.in_reply_to_status_id_str`: the post this one answers, if any. */
  inReplyToId?: string;
}

const MAX_LINKS = 4000;

const links = new Map<string, ReplyLink>();

/** Records what a payload said. A re-seen id moves to the newest position. */
export function rememberReplyLinks(parsed: Map<string, ReplyLink>): void {
  for (const [id, link] of parsed) {
    links.delete(id);
    links.set(id, link);
  }

  while (links.size > MAX_LINKS) {
    const oldest = links.keys().next();
    if (oldest.done) break;
    links.delete(oldest.value);
  }
}

/** What X's payload said about this post, or undefined when it was never seen. */
export function lookupReplyLink(tweetId?: string): ReplyLink | undefined {
  return tweetId ? links.get(tweetId) : undefined;
}
