/**
 * The product's mark -- a small printing press -- drawn twice from one
 * description, for every surface that shows it.
 *
 * Both drawings sit on the extension icon's 24-unit grid, so the sizes the
 * surfaces already used for the old glyph (18.75 in the action bar, 28.5 in the
 * card footer, 19 and 22 in the modal header and the popup) still mean what they
 * meant.
 *
 * `line` is the stroke drawing and the default. It strokes in `currentColor` at
 * 1.75/24 with round joins -- the weight and corners the old post line art had --
 * so it stands in X's row of thin outline icons instead of against it, and it
 * takes the card footer's `--faint` ink on all twelve papers. That is what the
 * action bar and the card footer need: both belong to someone else's surface. A
 * coloured mark in either would be the only foreign colour on them -- the card
 * themes are not allowed to carry even X's blue, so they are certainly not
 * allowed to carry ours, and mint on Riso's blue or Brutalist's yellow paper
 * fights the sheet. The action-bar trigger does turn mint while the pointer is
 * on it, but that is a passing state the stylesheet owns, not this drawing's
 * colour.
 *
 * `color` is the sticker: mint press body, dark-green outline, cream card. Its
 * colours are fixed rather than inherited, because these are our own dark
 * surfaces -- the popup page and the modal header -- and they are the one place
 * the brand is allowed to be itself. Without the tile the old icon had, the mint
 * body is what holds the silhouette on a near-black ground.
 *
 * Nothing here is a tile any more. The icon itself is one (near-black ground,
 * cream card, red fold), which is what a favicon needs at 16px on a toolbar, but
 * on the dark surfaces it measured 1.05:1 and stopped being a shape at all, and
 * its weight swamped the 11px credit line it stood beside. So these surfaces draw
 * the icon's *subject* instead: same press the icon shows, once as ink and once
 * in its own colours.
 */

/**
 * The press as strokes: body, paper slot, the card leaving it, two eyes on the
 * body and a dot plus a line on the card.
 *
 * The stroke attributes live on a group rather than on the `<svg>`, because the
 * eyes below are filled: put on the root they would trace a 1.75 ring around each
 * 1-unit radius and turn them into blobs.
 */
const LINE_ART =
  // The body. 18x10 of the 24-unit box -- wider than tall, so it reads as a
  // machine rather than as a head. Its bottom edge stops either side of the
  // paper slot, which the card comes through.
  '<g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M7.5 14H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H16.5"/>' +
  // The slot across the body, with the two eyes above it.
  '<path d="M6 11.75h12"/>' +
  // The card, out of the slot and down to the floor.
  '<path d="M7.5 11.75v7.5A1.75 1.75 0 0 0 9.25 21h5.5a1.75 1.75 0 0 0 1.75-1.75v-7.5"/>' +
  // What is printed on the card: a dot, then a line of type.
  '<path d="M12.6 16.6h1.65"/>' +
  '</g>' +
  // Filled, not stroked: the two eyes, and the dot on the card.
  '<g fill="currentColor">' +
  '<circle cx="10.1" cy="16.6" r="1"/>' +
  '<ellipse cx="9.5" cy="7.9" rx="1.3" ry="1.75"/>' +
  '<ellipse cx="14.5" cy="7.9" rx="1.3" ry="1.75"/>' +
  '</g>';

/**
 * The press in its own colours, for our own dark surfaces.
 *
 * The top strip of the body is a lighter mint over the body. The design file
 * clips a rounded rect to that strip with a `clipPath` that carries an id, and an
 * id is the one thing this string cannot have: the markup is inserted into live
 * pages, and a page can hold more than one mark at a time (the popup's own header
 * plus anything else that pastes it), at which point `url(#id)` in every copy
 * points at whichever copy registered first. Rather than generating a prefix per
 * insertion -- state to carry, and identical output no longer byte-identical --
 * the clipped shape is drawn as the path it clips to. Same geometry, no reference
 * to resolve, nothing to collide.
 */
const COLOR_ART =
  // The body: mint, outlined in the darker green that also carries the slot and
  // the card's edge.
  '<rect x="3" y="3.75" width="18" height="10.5" rx="3" fill="#6CC59C" stroke="#1E5A44" stroke-width="1.5"/>' +
  // The lighter top strip, i.e. the design's clipped highlight rect.
  '<path d="M3.75 7.75V6.9A2.4 2.4 0 0 1 6.15 4.5H17.85A2.4 2.4 0 0 1 20.25 6.9V7.75Z" fill="#A6E2C6"/>' +
  // The paper slot.
  '<rect x="5.75" y="11" width="12.5" height="1.6" rx=".875" fill="#1E5A44"/>' +
  // Eyes, each with a white highlight.
  '<g fill="#142019"><ellipse cx="9.5" cy="8.1" rx="1.4" ry="1.9"/><ellipse cx="14.5" cy="8.1" rx="1.4" ry="1.9"/></g>' +
  '<g fill="#fff"><circle cx="10" cy="7.25" r=".55"/><circle cx="15" cy="7.25" r=".55"/></g>' +
  // The card, cream, outlined like the body.
  '<path d="M7.5 11.75h9v7.5A1.75 1.75 0 0 1 14.75 21h-5.5A1.75 1.75 0 0 1 7.5 19.25Z" fill="#F8F8F5" stroke="#1E5A44" stroke-width="1.5" stroke-linejoin="round"/>' +
  // What is printed on it: a mint dot and two lines of mint type.
  '<circle cx="10" cy="15.4" r="1.05" fill="#6CC59C"/>' +
  '<g stroke="#6CC59C" stroke-width="1.3" stroke-linecap="round"><path d="M12.1 15.4h2.2"/><path d="M9.6 18.3h4.8"/></g>';

/**
 * The mark as markup, sized in CSS pixels.
 *
 * `line` (the default) inherits `currentColor`; `color` brings its own palette
 * and ignores the text colour. One description per variant, four surfaces, and
 * the four cannot drift.
 *
 * It is a string rather than elements because two of the four surfaces are not
 * Preact: the popup's page paints before its script runs, and the action-bar
 * button is built with `innerHTML`. Those two would otherwise need a second copy
 * of the shapes, which is the copy that drifts.
 */
export function brandMarkSvg(size: number, variant: 'line' | 'color' = 'line'): string {
  const inner = variant === 'color' ? COLOR_ART : LINE_ART;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    inner +
    '</svg>'
  );
}
