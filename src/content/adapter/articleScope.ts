/**
 * Where a long-form post's article sits inside its tweet, and what that means
 * for everything that walks the tweet's DOM.
 *
 * A tweet carrying an X article renders the article as a nested `<article>`:
 *
 *   article[data-testid="tweet"]
 *     └─ …─ article[data-testid="twitterArticleReadView"]
 *             ├─ div[data-testid="twitterArticleRichTextView"]   ← the prose
 *             └─ img (the cover, inside tweetPhoto)
 *
 * That shape breaks three assumptions the extractor made about nesting, and all
 * three failed silently on a real post:
 *
 *   1. `isInsideNestedArticle` read any article-in-an-article as a quoted post,
 *      so the article body counted as quote content. `extractTweetStats` drops
 *      stats from quoted posts and `extractTweetMedia` drops quoted photos —
 *      both of which the article legitimately owns — so the card lost its stats
 *      and its cover.
 *   2. `findQuoteContainer`'s second-level fallback is a bare
 *      `article.querySelector('article')`, which matches the read view every
 *      time. The whole article became a fake quote box.
 *   3. The article's prose embeds other tweets (`simpleTweet`) and their media,
 *      which would otherwise be adopted as the card's own.
 *
 * The read-view markers are checked structurally (via data-testid) rather than
 * by any wording, and they were verified against a logged-in session on
 * 2026-10-09 — see `docs/observed-dom-2026-10-09.md`.
 */

/** The article's reading surface: the nested `<article>` holding the prose. */
const ARTICLE_READ_VIEW = '[data-testid="twitterArticleReadView"]';

/**
 * The article's own content region. Media and links inside it belong to the
 * article, not to the tweet that carries it.
 */
const ARTICLE_BODY = '[data-testid="twitterArticleRichTextView"], [data-testid="longformRichTextComponent"]';

/** True when `el` is, or sits inside, the article's reading surface. */
export function isInsideArticleReadView(el: Element | null | undefined): boolean {
  if (!el) return false;
  const closest = (el as Element).closest;
  // `closest` matches the element itself too, which is what we want: the read
  // view element is as much "article" as its children.
  return typeof closest === 'function' ? Boolean(closest.call(el, ARTICLE_READ_VIEW)) : false;
}

/**
 * True when `el` sits inside the article's prose.
 *
 * Deliberately narrower than `isInsideArticleReadView`: the cover image and the
 * title live in the read view but outside the prose, and they are the two parts
 * of the article the card actually keeps.
 */
export function isInsideArticleBody(el: Element | null | undefined): boolean {
  if (!el) return false;
  const closest = (el as Element).closest;
  return typeof closest === 'function' ? Boolean(closest.call(el, ARTICLE_BODY)) : false;
}

/** The article's reading surface inside a tweet, or null when there is none. */
export function findArticleReadView(article: Element): Element | null {
  if (!article) return null;
  return article.querySelector(ARTICLE_READ_VIEW);
}
