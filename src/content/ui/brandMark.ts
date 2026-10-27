/**
 * The product's mark, drawn as line art, for every surface that shows it.
 *
 * The extension icon itself is a filled tile: near-black background, cream
 * card, red fold. That is what a favicon needs at 16px on a browser toolbar. It
 * is not what these surfaces need. The card footer sits on the card's own paper
 * or its dark sheet, the modal header on a dark panel, the popup on its own
 * near-black page -- and on the dark ones a near-black tile against a near-black
 * ground measures 1.05:1, so the icon stops being a shape at all. A tile also
 * carries more weight than the 11px credit line it stands beside.
 *
 * So the icon's subject is drawn instead, on a 24-unit grid at `stroke-width`
 * 1.75 with round joins, in `currentColor`. Each surface decides the ink: the
 * footer's faint text colour, the modal's white, the popup's accent, the action
 * bar's own grey. One drawing, four surfaces, and the four cannot drift.
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
 * The mark as markup, sized in CSS pixels.
 *
 * It is a string rather than elements because two of the four surfaces are not
 * Preact: the popup's page paints before its script runs, and the action-bar
 * button is built with `innerHTML`. Those two would otherwise need a second
 * copy of the shapes, which is the copy that drifts.
 */
export function brandMarkSvg(size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    LINE_ART +
    '</svg>'
  );
}
