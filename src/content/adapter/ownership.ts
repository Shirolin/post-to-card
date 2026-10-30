/**
 * Which part of a tweet does an element belong to.
 *
 * A tweet's markup holds more than one post: the post itself, a post it
 * quotes, and — for a long-form post — an article with a reading surface and a
 * prose region. Every pass that reads the markup has to say which of those it
 * is looking at, and the extractor used to answer that question with five
 * separate predicates, each call site picking its own combination.
 *
 * The combinations were not arbitrary but they were invisible: the quoted
 * post's body was excluded by one predicate, its pictures by three, its
 * statistics by two, and its timestamp by one. Nothing said that these were
 * meant to agree, so a change to one of them changed one surface and left the
 * others answering about a different post. That is the shape a mistake takes
 * when a rule is written down four times.
 *
 * This module answers the question once. Two things are said about an element,
 * because they are two independent facts: which post it belongs to, and which
 * part of the article it belongs to. A quoted post inside an article is both,
 * and the two answers do not cancel each other.
 *
 * The structure is resolved once per tweet rather than per element. Finding
 * the quoted post means walking the markup, and the answer is the same for
 * every element of the same tweet — but it used to be walked again for every
 * candidate picture, statistic and timestamp.
 */

/** The article's reading surface: the nested <article> holding the prose. */
export const ARTICLE_READ_VIEW = '[data-testid="twitterArticleReadView"]';

/**
 * The article's own content region. Media and links inside it belong to the
 * article, not to the tweet that carries it.
 */
export const ARTICLE_BODY = '[data-testid="twitterArticleRichTextView"], [data-testid="longformRichTextComponent"]';

/** Which post an element belongs to. */
export type PostOwner = 'tweet' | 'quote';

/**
 * What an element belongs to.
 *
 * The post, and the article's two regions. The two article answers are
 * independent rather than exclusive: the prose sits *inside* the reading
 * surface, so an element in the prose is in both, and a caller that wants one
 * of them has to say which — the cover picture is in the surface but not the
 * prose, while an embedded post is in the prose and therefore in the surface.
 */
export interface Owner {
  /** Which post the element is part of. */
  post: PostOwner;
  /** Whether the element is in the article's reading surface, prose included. */
  inArticle: boolean;
  /** Whether the element is in the article's prose. */
  inArticleBody: boolean;
}

/**
 * The structures of one tweet that decide ownership.
 *
 * Resolved once and passed around, because finding the quoted post walks the
 * markup and the answer does not change between one element and the next.
 */
export interface TweetOwnership {
  /** The box holding the quoted post, when the tweet quotes one. */
  quoteBox: Element | null;
  /** The article's reading surface, when the tweet carries an article. */
  readView: Element | null;
  /**
   * The quoted post's own quoted post, when there is one.
   *
   * A quoted post that quotes someone renders as two boxes, and the inner one
   * is its own post's — not the outer tweet's. The boundary between them is
   * what says which of the two a candidate belongs to.
   */
  nestedQuoteBox: Element | null;
}

/** True when `el` is, or sits inside, the article's reading surface. */
function isInsideArticleReadView(el: Element): boolean {
  const closest = (el as Element).closest;
  return typeof closest === 'function' ? Boolean(closest.call(el, ARTICLE_READ_VIEW)) : false;
}

/**
 * True when `el` sits inside the article's prose.
 *
 * Deliberately narrower than the reading surface: the cover image and the
 * title live in the read view but outside the prose, and they are the two parts
 * of the article the card actually keeps.
 */
function isInsideArticleBody(el: Element): boolean {
  const closest = (el as Element).closest;
  return typeof closest === 'function' ? Boolean(closest.call(el, ARTICLE_BODY)) : false;
}

/**
 * True when `el` sits inside an <article> that is itself nested in another
 * <article> (how X sometimes renders a quoted post).
 *
 * A long-form post renders its article as a nested <article> too, but that
 * article is the tweet's own content rather than a quoted post. Counting it here
 * made every element of the article look quoted, and the extractor treats quoted
 * content as not-the-tweet's: stats were dropped and the cover image was
 * filtered out of the media pass. So the walk skips the article's reading
 * surface when deciding what counts as an article boundary.
 */
function isInsideNestedArticle(el: Element): boolean {
  let curr: Element | null = el.parentElement;
  let seenArticle = false;
  while (curr) {
    const isReadView = isInsideArticleReadView(curr);
    if ((curr.tagName || '').toUpperCase() === 'ARTICLE' && !isReadView) {
      if (seenArticle) return true;
      seenArticle = true;
    }
    curr = curr.parentElement;
  }
  return false;
}

/**
 * Locates the quoted-post container inside a tweet article.
 *
 * `scope` is where the search starts: the tweet's own article at the top level,
 * or the quote box being read when looking for the quote *it* carries. The one
 * box that must never be a candidate is the caller's own — a quoted post that
 * quotes someone renders as two boxes with the same testid, one nested in the
 * other, and the outer one is the very thing being read. `exclude` names it.
 *
 * X has changed the marker for this box more than once, and a missed match is
 * silent: the quote is dropped AND its media leaks into the main tweet. So we
 * fall back through progressively weaker structural signals instead of trusting
 * a single data-testid.
 */
export function findQuoteContainer(article: Element, exclude?: Element | null): Element | null {
  if (!article) return null;

  const isNotSelf = (candidate: Element) => candidate !== exclude;

  // 1. Canonical marker used by current X. The article's prose can embed a post
  //    that itself quotes someone, and that quote carries the same testid, so a
  //    document-order search would adopt a stranger's quote as this tweet's.
  //    Scoped past the article body for the same reason step 3 is.
  const byTestId = Array.from(article.querySelectorAll('div[data-testid="quoteTweet"]')).find(
    (candidate) => !isInsideArticleBody(candidate) && isNotSelf(candidate)
  );
  if (byTestId) return byTestId;

  // 1b. Preview marker for a quote inside a quote. `nestedQuotePreview` is the
  //     only testid X renders for the inner level (measured 2026-10-14; the
  //     whole page carries zero `quoteTweet`). It is matched explicitly — but
  //     only when looking for the quote a quote carries (`exclude` is set):
  //     at the top level the outer box has no testid of its own, and matching
  //     the inner box there would promote the inner post to level 1.
  const byPreviewTestId = exclude
    ? Array.from(article.querySelectorAll('[data-testid="nestedQuotePreview"]')).find(
        (candidate) => !isInsideArticleBody(candidate) && isNotSelf(candidate)
      )
    : undefined;
  if (byPreviewTestId) return byPreviewTestId;

  // 2. Nested <article> — the quoted post rendered as its own article. The
  //    article's reading surface is a nested <article> as well, and a bare
  //    `querySelector('article')` matched it every time, turning a long-form
  //    post into a fake quote box holding its own article. A quoted post carries
  //    no read view, so skipping that subtree leaves genuine quotes intact —
  //    including a quote inside an article, which keeps its own `quoteTweet`.
  const nestedArticle = Array.from(article.querySelectorAll('article')).find(
    (candidate) => !isInsideArticleReadView(candidate) && isNotSelf(candidate)
  );
  if (nestedArticle) return nestedArticle;

  // 3. Structural fallback: any descendant that owns a second User-Name plus a
  //    tweetText, while not containing the main post's User-Name. The article's
  //    prose embeds other tweets, which carry both of those, so it is excluded
  //    here for the same reason step 2 excludes the read view.
  const mainUserName = article.querySelector('div[data-testid="User-Name"]');
  const allUserNames = Array.from(article.querySelectorAll('div[data-testid="User-Name"]'));
  for (const userName of allUserNames) {
    if (userName === mainUserName) continue;
    if (isInsideArticleBody(userName)) continue;

    let node: Element | null = userName.parentElement;
    while (node && node !== article) {
      if (node === exclude) break;
      if (node.querySelector('div[data-testid="tweetText"]')) {
        if (!mainUserName || !node.contains(mainUserName)) return node;
        break;
      }
      node = node.parentElement;
    }
  }

  return null;
}

/**
 * Resolves the structures that decide who owns what in one tweet.
 *
 * The quoted post is found once here rather than once per candidate element:
 * finding it walks the markup, and the answer is the same for every element of
 * the same tweet.
 */
export function resolveOwnership(article: Element): TweetOwnership {
  const quoteBox = findQuoteContainer(article);
  return {
    quoteBox,
    readView: article.querySelector(ARTICLE_READ_VIEW),
    // The quoted post's own quoted post. Resolved from the quote box rather
    // than from the tweet, because that is where it lives.
    nestedQuoteBox: quoteBox ? findQuoteContainer(quoteBox) : null,
  };
}

/**
 * Who an element belongs to.
 *
 * Three answers, because they are three facts. The first is which post the
 * element is part of; the other two are the article's regions, and the prose
 * sits inside the reading surface rather than beside it.
 */
export function ownerOf(el: Element, ownership: TweetOwnership): Owner {
  const { quoteBox, readView, nestedQuoteBox } = ownership;

  // The quoted post's own quoted post is a further post, so it is checked
  // before the outer one: an element inside both is inside the inner.
  const inNestedQuote =
    !!nestedQuoteBox && (nestedQuoteBox === el || nestedQuoteBox.contains(el));
  const inQuoteBox = !!quoteBox && (quoteBox === el || quoteBox.contains(el));

  // A quoted post rendered as its own <article> rather than a marked box:
  // the nesting is the only signal, and the article's own reading surface is
  // skipped so a long-form post's article is not mistaken for one.
  const inNestedArticle = isInsideNestedArticle(el);

  // The box itself counts as the quoted post's: it is that post's container,
  // and the first signal the old answer used — the box's own marker — said so
  // before the walk-up ever ran. What is inside it is the quoted post's too.
  const post: PostOwner = inNestedQuote || inQuoteBox || inNestedArticle ? 'quote' : 'tweet';

  return {
    post,
    // The reading surface is resolved once, so this is a containment check
    // rather than a walk up the tree for every candidate element. The first
    // read view in the tweet is the outer one, which is the one that answers
    // "is this inside the article" for everything nested under it.
    inArticle: !!readView && (readView === el || readView.contains(el)),
    inArticleBody: isInsideArticleBody(el),
  };
}
