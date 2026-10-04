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
 * not as <br> elements, so a content-bearing node's newlines are real and must
 * survive. Whitespace-only nodes are the indentation between elements and
 * collapse to a single separator space, which is what keeps inline spacing
 * around emoji and links intact.
 */
export function normalizeTweetWhitespace(raw: string): string {
  if (!raw) return '';
  if (!/\S/.test(raw)) return ' ';
  return raw.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n');
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
 * Strips the trailing media attachment link X appends to tweets with media.
 *
 * The scheme is optional because X renders the link label as a bare host plus
 * path, with no protocol prefix. Only a trailing link is stripped: a pic link
 * the author wrote mid-sentence is their own text.
 */
export function stripPicTwitterLink(text: string): string {
  if (!text) return '';
  return text
    .replace(new RegExp(`(?:https?://)?${PIC_MEDIA_HOST}/\\S+\\s*$`), '')
    .trim();
}

/**
 * Restores Unicode emojis and strips trailing media link from tweet text node.
 */
export function cleanTweetText(node: Node | null | undefined): string {
  const restored = restoreUnicodeEmojis(node);
  return stripPicTwitterLink(restored);
}
