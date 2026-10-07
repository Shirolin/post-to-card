/**
 * Media grid: the one place a card decides how its pictures are arranged.
 *
 * A card mounts up to four MediaItems. Which arrangement they get is a single
 * decision with three inputs — how many, what shape each one is, and whether the
 * user asked for a poster ratio — and it used to be made in two places: once
 * while rendering, and again imperatively in every image's `onLoad`, once the
 * real shapes arrived from the network. The two copies drifted, so a grid could
 * render one way and settle into another.
 *
 * `planMediaGrid` is the interface: it takes the items plus the two options and
 * returns what the grid should be. `applyMediaGridPlan` writes a plan onto a
 * rendered grid and makes no decisions of its own, so the two call sites — the
 * initial render and the re-plan after a shape arrives — can only ever disagree
 * about the input, never about the rule.
 *
 * The render and re-plan adapters are both inside Card.tsx; this module exists
 * so the rule behind them is written once.
 */

import type { MediaItem } from '../../types/tweet.ts';
import type { AspectRatioOption, MediaLayoutOption } from '../../types/card.ts';

/** The arrangements card.css knows how to draw. */
export type GridLayout =
  | 'default'
  | 'columns'
  | 'stacked'
  | 'portrait-columns'
  | 'left-hero'
  | 'top-hero'
  | 'quad';

const GRID_LAYOUTS: readonly GridLayout[] = [
  'default',
  'columns',
  'stacked',
  'portrait-columns',
  'left-hero',
  'top-hero',
  'quad',
];

export interface MediaGridOptions {
  /** 'auto' lets the pictures shape the grid; the poster ratios are fixed. */
  aspectRatio: AspectRatioOption;
  mediaLayout: MediaLayoutOption;
}

export interface MediaGridPlan {
  layout: GridLayout;
  /**
   * The layout as a class. card.css matches the layout on both a class and a
   * data attribute, so the two are written together and must stay in step.
   */
  layoutClass: string;
  /**
   * Inline `aspect-ratio` for the grid, or undefined to leave the shape to
   * card.css. Only `auto` in grid mode produces one.
   */
  aspectRatio?: string;
}

/**
 * Picks the arrangement for a set of items.
 *
 * Thresholds are the ones the grid has always used, and they are read off the
 * first item because that is the one the hero slot holds.
 */
function chooseLayout(count: number, items: MediaItem[]): GridLayout {
  if (count === 3) {
    // 阈值 1.2：首图为竖图、正方形图（1.0，如漫画、插画）或接近正方形图（< 1.2）时采用 Twitter 标准「左一右二」Left-Hero；
    // 仅当首图为明确的横幅宽图（>= 1.2，如 16:9 全景、横向照片）时才采用「上一下二」Top-Hero
    const r0 = items[0]?.aspectRatio;
    const isPortrait = r0 !== undefined ? r0 < 1.2 : true;
    return isPortrait ? 'left-hero' : 'top-hero';
  }

  if (count === 2) {
    const r0 = items[0]?.aspectRatio;
    const r1 = items[1]?.aspectRatio;
    const bothKnown = r0 !== undefined && r1 !== undefined;

    // Both wide reads better as one hero above the other; both tall reads better
    // side by side. One of each is the plain two-column case. With only one
    // shape in hand a single tall picture is enough to call it, on a slightly
    // looser threshold, because the other may yet turn out to be tall too.
    const bothWide = bothKnown ? (r0 >= 1.25 && r1 >= 1.25) : false;
    const bothPortrait = bothKnown
      ? (r0 <= 0.88 && r1 <= 0.88)
      : ((r0 !== undefined && r0 <= 0.85) || (r1 !== undefined && r1 <= 0.85));

    if (bothWide) return 'stacked';
    if (bothPortrait) return 'portrait-columns';
    return 'columns';
  }

  if (count === 4) return 'quad';

  return 'default';
}

/**
 * The grid's own shape, worked back from the shapes of the pictures in it.
 *
 * Each branch targets the ratio that lets the pictures fill their slots without
 * cropping, given the track sizes card.css gives that layout.
 *
 * A branch that cannot be worked out returns undefined rather than a number
 * guessed from the shapes it does have, because card.css already states a
 * default for every (count, layout) pair and a number invented here would both
 * be wrong and be a second copy of the stylesheet's own table. This is not
 * hypothetical: the two-picture case reaches portrait-columns with only one
 * shape in hand, and a blanket wide fallback there rendered a pair of vertical
 * screenshots in a landscape box.
 */
function shapeForLayout(count: number, layout: GridLayout, items: MediaItem[]): number | undefined {
  if (count === 3) {
    const r0 = items[0]?.aspectRatio;
    if (layout === 'left-hero') {
      if (r0 === undefined) return 1.30;
      const r1 = items[1]?.aspectRatio;
      const r2 = items[2]?.aspectRatio;
      const rRight = (r1 !== undefined && r2 !== undefined) ? (r1 + r2) / 2 : (r1 ?? r2 ?? 1.0);
      // Left cell aspect ratio in 1.6fr:1fr columns is 0.615 * R_grid.
      // Target R_grid to let r0 fill left column: 1.625 * r0.
      // Balanced with right column target (0.77 * R_grid ~ rRight): 1.30 * rRight.
      const targetFromLeft = 1.625 * r0;
      const targetFromRight = 1.30 * rRight;
      const combined = (r1 !== undefined || r2 !== undefined)
        ? 0.65 * targetFromLeft + 0.35 * targetFromRight
        : targetFromLeft;
      return Number(Math.max(1.15, Math.min(1.65, combined)).toFixed(2));
    }
    // Top-hero: Row 1 is 1.4fr out of 2.4fr (0.583 H).
    // Row 1 cell aspect ratio is R_grid / 0.583 = 1.714 * R_grid.
    // Target R_grid to let r0 fill Row 1: 0.583 * r0.
    const r0Val = r0 ?? 1.6;
    const combined = 0.583 * r0Val;
    return Number(Math.max(1.00, Math.min(1.40, combined)).toFixed(2));
  }

  if (count === 2) {
    const r0 = items[0]?.aspectRatio;
    const r1 = items[1]?.aspectRatio;
    // Every branch below combines both shapes (a sum, or a harmonic mean), so
    // one on its own says nothing and the stylesheet's default stands.
    if (r0 === undefined || r1 === undefined) return undefined;
    if (layout === 'stacked') {
      return Number(Math.max(0.75, Math.min(1.45, (r0 * r1) / (r0 + r1))).toFixed(2));
    }
    if (layout === 'portrait-columns') {
      return Number(Math.max(0.78, Math.min(1.65, r0 + r1)).toFixed(2));
    }
    // Dual columns side-by-side: natural aspect ratio is r0 + r1
    return Number(Math.max(1.20, Math.min(2.10, r0 + r1)).toFixed(2));
  }

  if (count === 4) {
    const ratios = items.map(i => i.aspectRatio).filter((r): r is number => r !== undefined);
    if (ratios.length >= 2) {
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      return Number(Math.max(0.85, Math.min(1.85, avg)).toFixed(2));
    }
  }

  return undefined;
}

/**
 * Decides how a set of media should be arranged.
 *
 * Call it with whatever shapes are known. Re-calling it after an image reports
 * its real shape yields the settled arrangement, which is why the render path
 * and the load path can share it without agreeing on anything but the input.
 */
export function planMediaGrid(
  items: MediaItem[],
  options: MediaGridOptions
): MediaGridPlan {
  // The card renderer caps layouts at four items, so a longer set is trimmed
  // before it is planned rather than after.
  const visible = items.slice(0, 4);
  const layout = chooseLayout(visible.length, visible);

  // card.css carries a default shape per (count, layout, poster ratio), so a
  // plan only states one when the pictures are the thing being fitted.
  const fitToPictures = options.aspectRatio === 'auto' && options.mediaLayout !== 'stack';
  const shaped = visible.length >= 2 && fitToPictures
    ? shapeForLayout(visible.length, layout, visible)
    : undefined;

  return {
    layout,
    layoutClass: `grid-${layout}`,
    aspectRatio: shaped === undefined ? undefined : `${shaped}`,
  };
}

/**
 * Records one picture's real shape, returning a new list.
 *
 * A shape that is already known is left alone: the first known shape is the
 * one the plan will read, and a second report of the same picture says nothing
 * new. Returns the same list when nothing changed, so a caller can tell a
 * no-op from an update without diffing objects.
 */
export function recordShape(items: MediaItem[], index: number, ratio: number): MediaItem[] {
  const item = items[index];
  if (!item || item.aspectRatio !== undefined || !(ratio > 0)) return items;
  const next = items.slice();
  next[index] = { ...item, aspectRatio: ratio };
  return next;
}

/**
 * Writes a plan onto an already-rendered grid.
 *
 * No decisions here: the layout classes are cleared wholesale and the planned
 * one put back, because the previous arrangement is not always one of the three
 * the re-plan used to enumerate by hand.
 */
export function applyMediaGridPlan(grid: HTMLElement, plan: MediaGridPlan): void {
  for (const layout of GRID_LAYOUTS) {
    grid.classList.remove(`grid-${layout}`);
  }
  grid.classList.add(plan.layoutClass);
  grid.setAttribute('data-grid-layout', plan.layout);
  if (plan.aspectRatio !== undefined) {
    grid.style.aspectRatio = plan.aspectRatio;
  }
}