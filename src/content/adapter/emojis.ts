/**
 * Native Unicode emoji restoration and text sanitization for Twitter/X DOM.
 * Twitter replaces native Unicode emojis with Twemoji <img> tags.
 * This module restores original Unicode characters from img[alt] attributes,
 * handles multiline line breaks, and cleans up trailing media placeholder links.
 */

/**
 * Normalises the whitespace of a single text node.
 *
 * X renders line breaks as literal "\n" inside a `white-space: pre-wrap` block,
 * not as <br> elements, so a node's newlines are real and must survive. Running
 * whitespace between words collapses to one space, which is what keeps inline
 * spacing around emoji and links intact.
 *
 * A node can be whitespace-only and still carry a line break: X splits a body
 * around every inline element (link, mention, emoji img), so a paragraph break
 * between two such elements lands in a node of its own. Treating every
 * whitespace-only node as indentation collapsed that break to a space, which
 * flattened a multi-paragraph post into one blob.
 */
export function normalizeTweetWhitespace(raw: string): string {
  if (!raw) return '';
  const collapsed = raw.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n');
  // Nothing but whitespace: keep the line breaks it carries, otherwise the node
  // is the indentation between elements and reads as one separator.
  if (!/\S/.test(raw)) {
    return collapsed.includes('\n') ? collapsed.replace(/ +/g, '') : ' ';
  }
  return collapsed;
}

/**
 * Recursively traverses a DOM node tree and reconstructs the text content
 * with native Unicode emojis restored from img[alt] attributes and real line
 * breaks preserved.
 *
 * `skip` lets a caller drop a subtree that is UI chrome rather than the author's
 * words — X's "Show more" control is the one such node today. It is passed down
 * the recursion so the same rule applies at every depth, and it stays opt-in so
 * the name/handle callers keep reading the node whole.
 */
export function restoreUnicodeEmojis(
  node: Node | null | undefined,
  skip?: (el: Element) => boolean
): string {
  if (!node) return '';

  let result = '';
  const children = (node as { childNodes?: ArrayLike<Node> }).childNodes || [];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;

    // Node.TEXT_NODE === 3
    if (child.nodeType === 3) {
      result += normalizeTweetWhitespace(child.nodeValue || '');
      continue;
    }

    // Node.ELEMENT_NODE === 1
    if (child.nodeType === 1) {
      const el = child as Element;
      if (skip && skip(el)) continue;
      const tagName = (el.tagName || '').toUpperCase();

      if (tagName === 'IMG') {
        const alt = el.getAttribute('alt');
        if (alt) {
          result += alt;
        }
      } else if (tagName === 'BR') {
        result += '\n';
      } else {
        result += restoreUnicodeEmojis(child, skip);
      }
    }
  }

  return result;
}

/**
 * The media host, as both the string pass and the DOM pass need it.
 *
 * `pic.twitter.com` is the legacy host and `pic.x.com` the current one. Written
 * once so a new host is taught in one place: this literal used to appear in two
 * patterns in two modules, which is how the body-text stripper and the token
 * pass came to disagree about where a media link counts as appended.
 */
const PIC_MEDIA_HOST = 'pic\\.(?:twitter|x)\\.com';

/**
 * True when a string names a pic.x.com / pic.twitter.com media link.
 *
 * The host rule is here; whether a match is the appended tail is a separate
 * question, answered on the string by `stripPicTwitterLink` and on the DOM by
 * the token pass, each in the medium it works in.
 */
export function isPicMediaLink(value: string): boolean {
  return new RegExp(PIC_MEDIA_HOST).test(value || '');
}

/**
 * True when a string names an X article permalink.
 *
 * A post carrying an article ends with an entity pointing at that article. X
 * does not render it — the article block replaces it — but the entity survives
 * in the GraphQL payload and, in the rendered DOM, as a truncated
 * `x.com/i/article/2108…` label. Both channels must agree about dropping it, so
 * the rule lives here beside `isPicMediaLink`.
 *
 * This predicate cannot tell the post's own article from one the author merely
 * shared; that is why it only *identifies* the link and the caller decides
 * whether the post actually carries an article.
 */
export function isArticlePermalink(value: string): boolean {
  return /\/i\/article\/\d+/.test(value || '');
}

/**
 * Strips the trailing article permalink X appends to a post carrying an article.
 *
 * Same shape as `stripPicTwitterLink`: only a trailing link is removed, because
 * one the author wrote mid-sentence is their own text. Shares the predicate with
 * the GraphQL channel so the two cannot disagree about which link this is.
 *
 * The caller decides *whether* to strip: a link to some other article that a
 * tweet merely ends with is the author's own text, not an appended tail, so this
 * is only applied when the post actually carries an article.
 */
export function stripTrailingArticleLink(text: string): string {
  if (!text) return '';
  const match = text.match(/\s*(\S+)\s*$/);
  if (!match || match.index === undefined) return text;
  if (!isArticlePermalink(match[1])) return text;
  return text.slice(0, match.index).trimEnd();
}

/** The minimum shape `stripTrailingArticleToken` needs of a token list. */
interface TrailingLinkToken {
  type: string;
  value: string;
  href?: string;
}

/**
 * The token-list form of `stripTrailingArticleLink`.
 *
 * Both data channels end up with a rich-token list, and both must drop the same
 * trailing link from it; one implementation keeps them from disagreeing. The
 * caller still decides whether to strip, on the same rule as the text form.
 */
export function stripTrailingArticleToken<T extends TrailingLinkToken>(
  tokens: T[] | undefined
): T[] | undefined {
  if (!tokens || tokens.length === 0) return tokens;

  let end = tokens.length;
  // Skip the whitespace that separates the link from the body.
  while (end > 0 && tokens[end - 1].type === 'text' && tokens[end - 1].value.trim() === '') end--;

  const last = tokens[end - 1];
  if (!last || last.type !== 'link') return tokens;
  if (!isArticlePermalink(last.href || last.value) && !isArticlePermalink(last.value)) return tokens;

  const kept = tokens.slice(0, end - 1);
  // Trimming may strand the whitespace that preceded the link.
  while (kept.length > 0 && kept[kept.length - 1].type === 'text' && kept[kept.length - 1].value.trim() === '') {
    kept.pop();
  }
  return kept;
}

/**
 * Strips the trailing media attachment link X appends to tweets with media.
 *
 * The scheme is optional because X renders the link label as a bare host plus
 * path, with no protocol prefix. Only a trailing link is stripped: a pic link
 * the author wrote mid-sentence is their own text.
 */
export function stripPicTwitterLink(text: string): string {
  if (!text) return '';
  // The path is matched with URL characters only, not `\S+`: an emoji is glued
  // straight onto the link once it is restored to a glyph, and `\S+` would eat
  // it, making a link the author wrote mid-post look like the appended tail and
  // strip it. Anything that is not a URL character after the link means the link
  // is not the last thing, so it stays -- which is what the token pass does too.
  const PIC_PATH = '[A-Za-z0-9\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+';
  return text
    .replace(new RegExp(`(?:https?://)?${PIC_MEDIA_HOST}/${PIC_PATH}\\s*$`), '')
    .trim();
}

/**
 * Restores Unicode emojis and strips the trailing media attachment link.
 *
 * The article permalink is deliberately *not* stripped here: that link is only
 * an appended tail on a post that carries an article, and this function has no
 * way to know. The article's strip is applied by the caller that knows, so a
 * tweet ending with a link to someone else's article keeps it.
 *
 * `skip` is forwarded to `restoreUnicodeEmojis`; the extractor uses it to keep
 * X's "Show more" control out of the body text.
 */
export function cleanTweetText(
  node: Node | null | undefined,
  skip?: (el: Element) => boolean
): string {
  const restored = restoreUnicodeEmojis(node, skip);
  return stripPicTwitterLink(restored);
}
