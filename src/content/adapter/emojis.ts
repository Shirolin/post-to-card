/**
 * Native Unicode emoji restoration and text sanitization for Twitter/X DOM.
 * Twitter replaces native Unicode emojis with Twemoji <img> tags.
 * This module restores original Unicode characters from img[alt] attributes,
 * handles multiline line breaks, and cleans up trailing media placeholder links.
 */

/**
 * Recursively traverses a DOM node tree and reconstructs the text content
 * with native Unicode emojis restored from img[alt] attributes and <br> converted to \n.
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
      const raw = child.nodeValue || '';
      // Twitter renders real line breaks as <br>, never as literal newlines in
      // text nodes. Any newline here is server-side pretty-print indentation and
      // must not leak into the card. Intra-line spaces are preserved.
      result += raw.replace(/\s*\n\s*/g, ' ');
      continue;
    }

    // Node.ELEMENT_NODE === 1
    if (child.nodeType === 1) {
      const el = child as Element;
      const tagName = (el.tagName || '').toUpperCase();

      if (tagName === 'IMG') {
        const alt = typeof el.getAttribute === 'function'
          ? el.getAttribute('alt')
          : (child as { alt?: string }).alt;
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
 * Strips trailing pic.twitter.com media attachment links automatically appended by Twitter.
 */
export function stripPicTwitterLink(text: string): string {
  if (!text) return '';
  return text.replace(/https?:\/\/pic\.twitter\.com\/\w+\s*$/, '').trim();
}

/**
 * Restores Unicode emojis and strips trailing media link from tweet text node.
 */
export function cleanTweetText(node: Node | null | undefined): string {
  const restored = restoreUnicodeEmojis(node);
  return stripPicTwitterLink(restored);
}
