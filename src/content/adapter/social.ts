/**
 * Structural classification of a tweet's social context.
 *
 * X renders "Retweeted" / "Pinned" / "Replying to" notices inside
 * `div[data-testid="socialContext"]`. The container name is stable while the
 * text inside it is localized across the 40+ interface languages X supports,
 * so the container and the profile links it holds are the dependable signals.
 *
 * Kept in its own module because both the extractor and the thread walker need
 * it, and `thread.ts` already depends on `extractor.ts`.
 */

/** True when the element sits inside a quoted post. */
export function isInsideQuote(el: Element): boolean {
  return Boolean(el.closest('div[data-testid="quoteTweet"]'));
}

/**
 * Returns this tweet's own social context container, ignoring any that belongs
 * to a nested quoted post.
 *
 * Matched by testid alone, never by tag. The community documentation this was
 * written from said `div`, and a real repost measured on 2026-10-11 carries the
 * testid on a `span` -- so a `div[...]` query matched nothing, and every notice
 * was invisible: no repost was ever attributed and `classifySocial` answered
 * `none` for all of them. The testid is the stable part; the tag is not.
 */
export function getSocialContext(article: Element): Element | null {
  if (!article) return null;
  const found = article.querySelector('[data-testid="socialContext"]');
  if (!found) return null;
  if (isInsideQuote(found)) return null;
  return found;
}

/**
 * Lists the profile handles the social context names.
 *
 * Both nestings are read, because the two notice kinds nest oppositely. A reply
 * notice holds the replied-to account as a link *inside* itself; a repost notice
 * is the label *of* the reposter's profile link (measured 2026-10-11, see
 * `RETWEET_HTML`). Inside links are collected first, so a notice that somehow
 * carries both still reports the reply target.
 */
export function getSocialContextHandles(article: Element): string[] {
  const social = getSocialContext(article);
  if (!social) return [];

  const handles: string[] = [];
  const add = (rawHref: string | null): void => {
    const href = rawHref || '';
    if (!href || href.includes('/status/') || href.includes('/i/')) return;
    const handle = href.replace(/^\//, '').split('/')[0].toLowerCase();
    if (!handle || handle.startsWith('#')) return;
    if (!handles.includes(handle)) handles.push(handle);
  };

  for (const link of Array.from(social.querySelectorAll('a[href^="/"]'))) {
    add(link.getAttribute('href'));
  }
  add(social.closest('a[href^="/"]')?.getAttribute('href') ?? null);

  return handles;
}

/**
 * Handle of the account that reposted this entry, or null when it is an
 * original post.
 *
 * A social context is shared by reposts, pinned posts and replies, so a handle
 * there is not on its own proof of a repost: replies also link the account being
 * replied to. The two are separated by the notice's own wording -- a reply keeps
 * "Replying to", a repost does not -- which is textual but confined to the small
 * notice rather than the whole article.
 *
 * The reposter's handle is the notice's *own* link, not a link inside it: a real
 * repost renders `<a href="/reposter"><span data-testid="socialContext">…</span></a>`
 * (measured 2026-10-11). Inside links are still read first, so a notice that
 * nests its handle keeps working.
 */
export function getRetweetedBy(article: Element): string | null {
  const social = getSocialContext(article);
  if (!social) return null;

  // A reply target is not a reposter. Checked first because both name an
  // account, and the notice's own structure says which one this is.
  if (noticeKind(social) === 'reply') return null;

  const authorHandle = getArticleAuthorHandle(article);
  for (const handle of getSocialContextHandles(article)) {
    // The reposting account is a third party; a reply target may be anyone.
    if (authorHandle && handle === authorHandle) continue;
    return `@${handle}`;
  }
  return null;
}

/** Handle of the entry's own author, used to exclude self-links. */
function getArticleAuthorHandle(article: Element): string | null {
  const userName = article.querySelector('div[data-testid="User-Name"]');
  if (!userName) return null;
  const link = userName.querySelector('a[href^="/"]:not([href*="/status/"])');
  const href = link?.getAttribute('href') || '';
  if (!href) return null;
  return href.replace(/^\//, '').split('/')[0].toLowerCase();
}

/**
 * Which notice this is, read from structure alone.
 *
 * The wording is localized into forty-odd languages and this check used to read
 * it, so a German or Korean interface reported no reply at all. Structure does
 * not vary that way, and the three notices are structurally distinct:
 *
 *   repost: the notice *is* the reposter's own profile link, so it sits inside
 *           an `a[href^="/"]` (measured 2026-10-11)
 *   reply:  the notice *holds* its target as a link inside it
 *   pinned: the notice names no account at all
 *
 * Unverified and deliberately not guessed at: a repost rendered as a container
 * holding its own link would read as a reply here, and a reply whose notice was
 * itself wrapped in an anchor would read as a repost. Neither shape has been
 * seen; the wording below is kept for the no-container fallback, where there is
 * no structure to read.
 */
function noticeKind(social: Element): 'reply' | 'repost' | 'pinned' {
  if (social.closest('a[href^="/"]')) return 'repost';
  if (social.querySelectorAll('a[href^="/"]').length > 0) return 'reply';
  return 'pinned';
}

/**
 * Handle of the account this entry replies to, or null when it is not a reply.
 *
 * Always `@handle`, the form the caller compares against `author.handle`. The
 * structured path used to return a bare handle while the text fallback returned
 * a prefixed one, so a reply to the entry's own author compared unequal to them
 * and the post was read as aimed elsewhere.
 */
export function getReplyingToHandle(article: Element): string | null {
  if (!article) return null;

  const social = getSocialContext(article);
  // A repost notice is the reposter's own link, not a reply target. Without this
  // the reposter was reported as the account being replied to.
  if (social && noticeKind(social) === 'reply') {
    // Inside a reply notice the linked handles are the replied-to accounts.
    const handles = getSocialContextHandles(article);
    if (handles.length > 0) return `@${handles[0]}`;
  }

  // Last-resort text match, confined to the social context so it cannot match
  // the same word inside a quoted post or a quoted bio.
  const scope: ParentNode = social || article;
  const rawText = (social ? social.textContent : article.textContent) || '';
  if (!REPLY_NOTICE.test(rawText)) {
    return null;
  }

  for (const link of Array.from(scope.querySelectorAll('a[href^="/"]:not([href*="/status/"])'))) {
    // The byline holds the author's own profile link, which is never a reply
    // target. Without this the fallback reported the author as the account being
    // replied to whenever the notice sat below the byline, which the caller reads
    // as "not a reply" and merges the post into the thread.
    if (link.closest('div[data-testid="User-Name"]')) continue;
    const text = link.textContent?.trim() || '';
    if (text.startsWith('@')) return text.toLowerCase();
  }

  return null;
}

/**
 * Wording X uses to mark a pinned notice. Kept only as a second signal beside
 * the structural one below: it knows three languages out of the forty-odd X
 * ships, so on its own it silently reported `none` for most of the world.
 */
const PINNED_NOTICE = /pinned|置顶|固定/i;

/**
 * Wording X uses to introduce a reply notice, for the no-container fallback
 * only -- where there is no structure to read. It knows seven languages out of
 * the forty-odd X ships, so it is never the primary signal.
 */
const REPLY_NOTICE = /replying to|replied to|回复|返信先|répondre a|respondeu a|antwoord op/i;

/** Classifies the entry for diagnostic reporting. */
export function classifySocial(article: Element): 'retweet' | 'reply' | 'pinned' | 'none' {
  const social = getSocialContext(article);
  if (!social) return 'none';
  // Read from the notice's structure, not its wording: a repost notice is the
  // reposter's own link, a reply notice holds its target as a link inside it,
  // and a pinned notice names no account. See `noticeKind`.
  const kind = noticeKind(social);
  if (kind === 'reply') return 'reply';
  if (kind === 'pinned') return 'pinned';
  if (getRetweetedBy(article)) return 'retweet';
  // The wording stays as a second signal: a pinned notice that ever does link
  // its author would read as a repost above, and this catches it.
  if (PINNED_NOTICE.test(social.textContent || '')) return 'pinned';
  return 'none';
}
