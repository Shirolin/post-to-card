/**
 * The product's mark: the extension icon's subject, drawn as line art.
 *
 * The icon ships as PNGs under `public/icons/`, and none of them can be used
 * where this mark is drawn. The card footer's copy is rasterized into the
 * exported PNG, so an `<img>` at a `chrome-extension://` URL would taint the
 * export canvas -- the same reason every remote picture already travels as a
 * data URL -- and it would have to become a web-accessible resource besides,
 * which is a manifest permission bought for one thumbnail.
 *
 * So the mark is a drawing, not the icon. It is the same subject -- a post: a
 * card with a folded corner, an avatar and a media block -- reduced to strokes
 * on the empty background. The icon's tile and its three fills are what a
 * favicon needs at 16px on someone's toolbar; here the mark stands beside the
 * product's own name on surfaces the product already colours, and a filled tile
 * at 14px is a black square that says nothing.
 *
 * Drawn on a 24-unit grid at the weight the rest of the interface uses for line
 * icons (`stroke-width` 1.75, round joins), and it takes `currentColor`, so each
 * surface decides its own ink: the footer's faint text colour, the modal's
 * white, the popup's accent.
 *
 * One drawing, four surfaces: the card footer, the modal header, the popup's
 * static page and the button injected into a tweet's action bar. Each drops
 * this markup into the element it already has, so the four cannot drift.
 */
const SHAPES =
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
 * The mark as markup, sized in CSS pixels.
 *
 * It is a string rather than elements because two of the four surfaces are not
 * Preact: the popup's page paints before its script runs, and the action-bar
 * button is built with `innerHTML`. Those two would otherwise need a second
 * copy of the shapes, which is the copy that drifts. The two Preact surfaces
 * put the same string on the element they already have.
 */
export function brandMarkSvg(size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    SHAPES +
    '</svg>'
  );
}
