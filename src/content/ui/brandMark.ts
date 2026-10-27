/**
 * The product's mark for the one surface that draws it: the button injected
 * into a tweet's action bar.
 *
 * The other three -- the card footer, the modal header and the popup's page --
 * show the extension icon itself, from `brandIcon.ts`. This one cannot: the
 * action bar is X's own row of thin outline icons, and a filled tile at 18.75px
 * is a black square in the middle of them. So the icon's subject is drawn
 * instead -- a post, a card with a folded corner, an avatar and a media block --
 * on a 24-unit grid at `stroke-width` 1.75 with round joins, in `currentColor`,
 * so it takes the ink of the row it lands in.
 *
 * The two modules sit side by side because they answer the same question -- what
 * is this product's mark -- and a change to one should make someone look at the
 * other.
 */
const LINE_ART =
  // The card. Its top-right corner is where the fold is, so the outline turns
  // there instead of rounding.
  '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>' +
  // The fold: down from the top edge, then the same radius as the other three
  // corners across to the clipped diagonal.
  '<path d="M16 3v3a2 2 0 0 0 2 2h3"/>' +
  // Avatar, then the media block beneath it.
  '<circle cx="7.1" cy="7.1" r="1.75"/>' +
  '<rect x="5.4" y="11.6" width="13.2" height="6.4" rx="1.3"/>';

/**
 * The line-art mark as markup, sized in CSS pixels.
 *
 * It is a string rather than elements because the action-bar button is built
 * with `innerHTML` before any component can mount.
 */
export function brandMarkSvg(size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    LINE_ART +
    '</svg>'
  );
}
