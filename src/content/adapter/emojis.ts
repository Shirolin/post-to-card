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
 */
export function restoreUnicodeEmojis(node: Node | null | undefined): string {
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
      const tagName = (el.tagName || '').toUpperCase();

      if (tagName === 'IMG') {
        const alt = el.getAttribute('alt');
        if (alt) {
          result += alt;
        }
      } else if (tagName === 'BR') {
        result += '\n';
      } else {
        result += restoreUnicodeEmojis(child);
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
 * True when a string names a post's own X article permalink.
 *
 * A long-form post's body carries a trailing entity pointing at its article. X
 * does not render it — the article preview replaces it, and the server-rendered
 * body has no such link — but the entity survives in the GraphQL payload and, in
 * the logged-out client, in the DOM too. Both channels must agree about dropping
 * it, so the rule lives here beside `isPicMediaLink`, the same way the media-host
 * rule does, and each channel consults it in the medium it works in.
 *
 * The rendered link's label is a truncated `x.com/i/article/2108…`, so the match
 * is on the path prefix rather than on a whole URL.
 */
export function isArticlePermalink(value: string): boolean {
  return /\/i\/article\/\d+/.test(value || '');
}

/**
 * Strips the trailing article permalink X appends to a long-form post.
 *
 * Same shape as `stripPicTwitterLink`: only a trailing link is removed, because
 * one the author wrote mid-sentence is their own text. Shares the predicate with
 * the GraphQL channel so the two cannot disagree about which link this is.
 */
export function stripTrailingArticleLink(text: string): string {
  if (!text) return '';
  const match = text.match(/\s*(\S+)\s*$/);
  if (!match || match.index === undefined) return text;
  if (!isArticlePermalink(match[1])) return text;
  return text.slice(0, match.index).trimEnd();
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
 * Restores Unicode emojis and strips the trailing links X appends to a tweet:
 * the media attachment link, and the article permalink on a long-form post.
 *
 * Both are stripped here rather than one at the call site, because `text` is the
 * canonical field the card falls back to when the token list is empty; stripping
 * only the tokens would let a body that is nothing but the link reappear.
 */
export function cleanTweetText(node: Node | null | undefined): string {
  const restored = restoreUnicodeEmojis(node);
  return stripTrailingArticleLink(stripPicTwitterLink(restored));
}
