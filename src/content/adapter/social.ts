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
 */
export function getSocialContext(article: Element): Element | null {
  if (!article) return null;
  const found = article.querySelector('div[data-testid="socialContext"]');
  if (!found) return null;
  if (isInsideQuote(found)) return null;
  return found;
}

/**
 * Lists the profile handles linked from the social context. A retweet links the
 * reposting account; a reply links the replied-to account(s).
 */
export function getSocialContextHandles(article: Element): string[] {
  const social = getSocialContext(article);
  if (!social) return [];

  const handles: string[] = [];
  for (const link of Array.from(social.querySelectorAll('a[href^="/"]'))) {
    const href = link.getAttribute('href') || '';
    if (!href || href.includes('/status/') || href.includes('/i/')) continue;
    const handle = href.replace(/^\//, '').split('/')[0].toLowerCase();
    if (handle && !handle.startsWith('#') && !handles.includes(handle)) {
      handles.push(handle);
    }
  }
  return handles;
}

/**
 * Handle of the account that retweeted this entry, or null when it is an
 * original post.
 *
 * A social context is shared by retweets, pinned posts and replies, so a
 * handle there is not on its own proof of a retweet: replies also link the
 * account being replied to. The two are separated by the link's own text, which
 * for a retweet is the reposting account's own @handle label, while a reply
 * notice links handles that are not the author of the entry.
 */
export function getRetweetedBy(article: Element): string | null {
  const social = getSocialContext(article);
  if (!social) return null;

  // A reply target is not a retweeter. Checked first because both render a
  // profile link inside the same container.
  if (isReplyNotice(social)) return null;

  const authorHandle = getArticleAuthorHandle(article);
  for (const link of Array.from(social.querySelectorAll('a[href^="/"]'))) {
    const href = link.getAttribute('href') || '';
    if (!href || href.includes('/status/') || href.includes('/i/')) continue;
    const handle = href.replace(/^\//, '').split('/')[0].toLowerCase();
    if (!handle || handle.startsWith('#')) continue;
    // The reposting account is a third party; a reply target may be anyone.
    if (authorHandle && handle === authorHandle) continue;
    return handle;
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
 * Distinguishes a reply notice from a retweet notice.
 *
 * X wraps the replied-to handles in a link whose label is the handle itself,
 * while a retweet labels the reposting account the same way. The reliable
 * structural difference is that a reply notice keeps the "Replying to" wording
 * in the same subtree; this check is therefore textual but confined to the
 * small notice container rather than the whole article.
 */
/**
 * The wording X uses to introduce a reply notice, in every interface language
 * the card has seen. One list, because two copies of it already disagreed: the
 * notice check knew the Dutch phrase and the handle fallback did not, so a
 * Dutch reply was reported as a reply by the diagnostics and then not treated
 * as one when the thread was assembled.
 */
const REPLY_NOTICE = /replying to|replied to|回复|返信先|répondre a|respondeu a|antwoord op/i;

function isReplyNotice(social: Element): boolean {
  return REPLY_NOTICE.test(social.textContent || '');
}

/**
 * Handle of the account this entry replies to, or null when it is not a reply.
 */
export function getReplyingToHandle(article: Element): string | null {
  if (!article) return null;

  const social = getSocialContext(article);
  if (social) {
    // Inside a reply notice the linked handles are the replied-to accounts.
    const handles = getSocialContextHandles(article);
    if (handles.length > 0) return handles[0];
  }

  // Last-resort text match, confined to the social context so it cannot match
  // the same word inside a quoted post or a quoted bio.
  const scope: ParentNode = social || article;
  const rawText = (social ? social.textContent : article.textContent) || '';
  if (!REPLY_NOTICE.test(rawText)) {
    return null;
  }

  for (const link of Array.from(scope.querySelectorAll('a[href^="/"]:not([href*="/status/"])'))) {
    const text = link.textContent?.trim() || '';
    if (text.startsWith('@')) return text.toLowerCase();
  }

  return null;
}

/** Classifies the entry for diagnostic reporting. */
export function classifySocial(article: Element): 'retweet' | 'reply' | 'pinned' | 'none' {
  const social = getSocialContext(article);
  if (!social) return 'none';
  // A reply is classified before a retweet: both render a profile link in the
  // same container, so the retweet reading has to be ruled out first.
  if (isReplyNotice(social)) return 'reply';
  if (getRetweetedBy(article)) return 'retweet';
  if (/pinned|置顶|固定/i.test(social.textContent || '')) return 'pinned';
  return 'none';
}
