/**
 * The card's geometry: the numbers its shape is built on.
 *
 * Every figure here used to be written twice — once in the stylesheet and once
 * in the TypeScript that has to know the same number to answer a question the
 * stylesheet cannot. The card's width was 640 in `card.css` and 640 in
 * `App.tsx`; the 3:4 floor was 853px in the stylesheet and `round(640 * 4/3)`
 * in `themes.ts`; the grid's column weights were 1.6fr and 1.4fr in the
 * stylesheet and the numbers *derived* from them — 1.625 and 0.583 — were
 * written out by hand in the grid planner.
 *
 * The second copy is the dangerous one. Change the stylesheet's 1.6fr and the
 * planner's 1.625 still describes the old grid, so the pictures are laid out
 * against a shape the stylesheet no longer draws. Nothing reports the mismatch.
 *
 * This module is the one place those numbers live. The stylesheet reads them
 * as custom properties, which the card injects the way it already injects
 * every theme colour; the TypeScript reads them as constants. Neither keeps a
 * copy.
 *
 * The rules this module follows are the ones the token table already set for
 * colour: a value is named once here, and everything downstream consumes it.
 */

import type { AspectRatioOption } from '../../types/card.ts';

/**
 * The card's fixed width, in pixels.
 *
 * Fixed rather than fluid so that exports are pixel-exact: a card that grew
 * with the window would produce a differently sized file on every screen, and
 * the preview's zoom levels are fractions of this number so they mean the same
 * thing everywhere.
 */
export const CARD_WIDTH = 640;

/**
 * The width the stylesheet's fallback uses when a card is rendered outside the
 * card component — a test harness, a future host.
 *
 * The card injects `--card-width` itself, so this only fires when the stylesheet
 * is used on its own.
 */
export const CARD_WIDTH_FALLBACK = `${CARD_WIDTH}px`;

/**
 * The poster ratios the card can take, as a height over a width.
 *
 * `auto` is not here: it means the card takes the height its content needs,
 * which is no ratio at all.
 */
const POSTER_RATIOS: Record<Exclude<AspectRatioOption, 'auto'>, { height: number; width: number }> = {
  '3:4': { height: 4, width: 3 },
  '16:9': { height: 9, width: 16 },
};

/**
 * The card's minimum height under a poster ratio, as a CSS length.
 *
 * A floor rather than a height: a card taller than the floor simply grows, so
 * a long post is never cut off to fit the shape. `auto` has no floor, which is
 * what the stylesheet's own `min-height: unset` says.
 *
 * The value is a `calc()` over the card's width rather than a rounded number,
 * so it is the same expression the stylesheet computes and the two cannot
 * disagree about a third of a pixel.
 */
export function aspectMinHeight(ratio: AspectRatioOption, width: number = CARD_WIDTH): string {
  if (ratio === 'auto') return 'auto';
  const shape = POSTER_RATIOS[ratio];
  // A ratio this build does not know has no floor to give. Answering the
  // option's own default rather than computing `undefined` keeps a stored
  // value that slipped past the sanitiser from putting a broken length on the
  // card.
  if (!shape) return aspectMinHeight('auto', width);
  return `calc(${width}px * ${shape.height} / ${shape.width})`;
}

/**
 * The grid's column and row weights, as the stylesheet's `fr` units.
 *
 * These are the numbers the grid planner's arithmetic is derived from, so they
 * are named here rather than in the stylesheet alone. `leftHero` is the hero
 * column's weight against the pair beside it; `topHero` is the hero row's
 * weight against the row under it.
 */
export const GRID_TRACKS = {
  /** The hero column's weight in the left-hero arrangement: 1.6fr against 1fr. */
  leftHero: 1.6,
  /** The hero row's weight in the top-hero arrangement: 1.4fr against 1fr. */
  topHero: 1.4,
} as const;

/**
 * The hero cell's share of the grid's own shape, in the left-hero arrangement.
 *
 * The grid is `1.6fr` against `1fr`, so the hero column takes 1.6 of 2.6 of the
 * width. The hero cell stands the grid's full height, so its own width over
 * height is that share of the grid's width over height. The planner needs the
 * reciprocal to turn a picture's shape into the grid shape that lets it fill
 * the cell, which is why this is the cell's ratio and not the target's.
 */
export function heroCellRatio(): number {
  return GRID_TRACKS.leftHero / (GRID_TRACKS.leftHero + 1);
}

/**
 * The hero row's share of the grid's height, in the top-hero arrangement.
 *
 * The grid is `1.4fr` against `1fr` down its rows, so the hero row takes 1.4 of
 * 2.4 of the height. The planner multiplies a picture's shape by this to get
 * the grid shape that lets the picture fill the row.
 */
export function heroRowShare(): number {
  return GRID_TRACKS.topHero / (GRID_TRACKS.topHero + 1);
}

/**
 * The pass-partout a picture is mounted on, in pixels, under a material that
 * mounts pictures that way.
 *
 * A cell adds this on each side of its picture, so a line of mounted pictures
 * still comes out one height.
 */
export const MEDIA_MOUNT = '8px';

/**
 * The width below which the modal stacks its panes and the panel becomes a
 * bottom sheet.
 *
 * The stylesheet's own `@media (max-width: 900px)` is the same boundary, and
 * the two have to agree: the stylesheet decides how the panel looks and the
 * script decides how it starts, so a mismatch would show a collapsed panel on
 * a wide screen or an expanded one on a narrow.
 */
export const NARROW_BREAKPOINT = 900;

/**
 * The breathing room the preview viewport reserves on each side, in pixels.
 *
 * Uniform on both axes, and trimmed on the narrow layout where the stage has
 * to give the card every pixel it can get.
 */
export const VIEWPORT_PADDING = 24;
export const NARROW_VIEWPORT_PADDING = 12;

/**
 * The breathing room the viewport reserves at a given width.
 */
export function viewportPadding(width: number): number {
  return width <= NARROW_BREAKPOINT ? NARROW_VIEWPORT_PADDING : VIEWPORT_PADDING;
}
