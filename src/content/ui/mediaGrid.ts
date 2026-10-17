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
 * `planMediaGrid` is the interface: it takes the items plus the options and
 * returns what the grid should be. `applyMediaGridPlan` writes a plan onto a
 * rendered grid and makes no decisions of its own, so the two call sites — the
 * initial render and the re-plan after a shape arrives — can only ever disagree
 * about the input, never about the rule.
 *
 * 完整展示 asks for the opposite of a crop, and that decides where a picture's
 * frame goes. A cell is a frame: it carries the material's mounting ink and its
 * corner, and the play badge hangs on the picture's own box inside it. So a
 * contained picture may not sit letterboxed inside a cell of some other shape —
 * the cell has to *be* the picture's rectangle, or the frame is drawn around
 * empty space with the picture floating in it. That is what a plan's `slots`
 * carry: each picture's shape plus the width it takes of the media track, in
 * proportions that give every picture in a line the same height and its own
 * width. On the shapes X actually serves this leaves no dead space in a cell,
 * where the fixed grid it replaces left 8–34% of the cell empty.
 *
 * The grouping itself is unchanged — a five-picture post still gets the same
 * hero, quad or pair decision — because that decision is about composition, and
 * only the size of each track was wrong. `cover` keeps the fixed grid, because a
 * crop is what it asks for.
 */

import type { MediaItem } from '../../types/tweet.ts';
import type { AspectRatioOption, ImageFitOption, MediaLayoutOption } from '../../types/card.ts';

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

/** Every layout except the one that divides the grid into two columns. */
type BandLayout = Exclude<GridLayout, 'left-hero'>;

export interface MediaGridOptions {
  /** 'auto' lets the pictures shape the grid; the poster ratios are fixed. */
  aspectRatio: AspectRatioOption;
  mediaLayout: MediaLayoutOption;
  /**
   * Which of the two fit modes the plan is for. It is an input because the two
   * want different things from the same pictures: a crop wants a grid of fixed
   * shapes to crop into, a full display wants the pictures' own shapes.
   */
  imageFit: ImageFitOption;
}

/**
 * One picture's place in a shaped grid: the shape it was planned against, and
 * the width it takes of its line as a CSS value.
 */
export interface MediaSlot {
  /** The picture's own shape, or the fallback when it has not reported one. */
  ratio: number;
  /** The width to write on the cell, already in proportions and gaps. */
  width: string;
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
   * card.css. Only a fixed-shape grid — cover, or a poster ratio — has one: a
   * grid whose tracks are the pictures' own rectangles has no shape of its own
   * to state, and card.css drops the one it would otherwise apply.
   */
  aspectRatio?: string;
  /**
   * 完整展示 in the auto ratio: one slot per picture, in item order. Absent when
   * the grid keeps a shape of its own.
   */
  slots?: MediaSlot[];
  /**
   * 完整展示 in the left-hero arrangement: the grid's two column weights. The
   * hero holds a column to itself and the other two divide the second, which no
   * single line can express, so that one arrangement stays a two-column grid and
   * is sized here instead.
   */
  columns?: string;
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
 * The shape a picture is planned against before it has reported one.
 *
 * Square is the one shape that claims nothing: a slot has to have a height
 * before the picture arrives, or the row collapses to nothing and the card jumps
 * when it lands, and a wrong-but-neutral box is better than a box the width of
 * the card. The picture's real shape replaces it on load.
 */
const UNKNOWN_SHAPE = 1;

function plannedShape(item: MediaItem | undefined): number {
  const ratio = item?.aspectRatio;
  return ratio !== undefined && ratio > 0 ? ratio : UNKNOWN_SHAPE;
}

/** Which pictures share each line, keyed by the layout that chose the grouping. */
const LINES_BY_LAYOUT: Record<BandLayout, number[][]> = {
  default: [[0]],
  columns: [[0, 1]],
  'portrait-columns': [[0, 1]],
  stacked: [[0], [1]],
  quad: [[0, 1], [2, 3]],
  'top-hero': [[0], [1, 2]],
};

/**
 * The lines a grouping draws, with any picture the table does not name left on a
 * line of its own.
 *
 * The table is read off the layout and the layout is chosen off the count, so
 * the two cannot disagree. The guard stays because a plan that quietly dropped a
 * picture would render an empty cell instead of failing.
 */
function linesFor(layout: BandLayout, count: number): number[][] {
  const lines = LINES_BY_LAYOUT[layout]
    .map(line => line.filter(index => index < count))
    .filter(line => line.length > 0);
  const named = new Set(lines.flat());
  for (let index = 0; index < count; index++) {
    if (!named.has(index)) lines.push([index]);
  }
  return lines;
}

/**
 * What a cell adds around its picture: the ring on both sides and, under a
 * material that mounts pictures on a passe-partout, the mount. Only the
 * picture's own box has to be proportional to its shape, so this fixed inset
 * comes out of the line before the shares divide it and is added back to each
 * cell — otherwise a line under a mat frame would come out with unequal
 * heights, the mount being a constant against pictures of different shapes.
 */
const CELL_INSET = '(var(--border-width, 1px) + var(--media-mount, 0px)) * 2';

/** A coefficient and its term, with the sign spelled out for `calc()`. */
function term(coefficient: number, expression: string): string {
  return `${coefficient < 0 ? '-' : '+'} ${Math.abs(coefficient).toFixed(4)} * ${expression}`;
}

/**
 * The width a picture takes of its line, as a CSS value.
 *
 * The shares are the pictures' own shapes, which is what makes a line come out
 * with every picture the same height and each one its own rectangle: a cell's
 * width is its share of the line's width less its share of the gutters and the
 * fixed insets, plus its own inset. The gap is part of the same hundred percent
 * the shares divide — a line filled to the percent would push its last picture
 * onto the line below — so it comes off in proportion to the share, and the line
 * as a whole stops a quarter pixel short so that rounding cannot decide the
 * wrap. A one-picture line is the same sum with nothing to subtract.
 */
function lineWidth(share: number, lineSize: number): string {
  if (lineSize === 1) return 'calc(100% - 0.25px)';
  const percent = (share * 100).toFixed(3);
  const gaps = term(-share * (lineSize - 1), 'var(--media-gap, 4px)');
  const insets = term(-share * lineSize + 1, CELL_INSET);
  return `calc(${percent}% ${gaps} ${insets} - 0.25px)`;
}

/**
 * The slots and columns for 完整展示 in the auto ratio: every cell the picture's
 * own rectangle, every line as wide as the track.
 */
function shapedPlan(items: MediaItem[], layout: GridLayout): Pick<MediaGridPlan, 'slots' | 'columns'> {
  const ratios = items.map(plannedShape);

  if (layout === 'left-hero') {
    // The hero holds a column to itself and the other two divide the second. A
    // picture of shape r0 filling a column of width w0 stands w0 / r0 tall, and
    // the pair in the other column stands w1 / r1 + w1 / r2 plus the gutter
    // between them. Solving the two for a common height gives the hero's width,
    // and the second column is whatever is left, so the plan states one width
    // and lets the grid fill the rest. The gutter and the cell insets are lengths
    // only the browser knows, so they stay `var()`s here rather than numbers:
    // with them in the sum the hero's cell and its picture agree to the pixel,
    // where weighting the columns alone left the hero up to one gutter short of
    // its frame. Each column's inset is constant across its own pictures, so it
    // moves to the other side of the equation as `n * inset`.
    const [hero, second, third] = ratios;
    const gutter = 'var(--media-gap, 4px)';
    // The hero's picture stands (c0 - 2b) / r0 tall; the pair's two stand
    // (c1 - 2b) / r1 + (c1 - 2b) / r2 plus their gutter. Setting the two column
    // heights equal, with the two column widths adding up to the track, gives
    // the hero's width below. `b` is one cell's inset per side — its ring and,
    // under a mat material, its mount — so it is subtracted once per side:
    // twice across the track, and four times down the pair's column, which has
    // two cells in it.
    const b = '(var(--border-width, 1px) + var(--media-mount, 0px))';
    const weight = 1 / second + 1 / third;
    const divisor = (1 + hero * weight).toFixed(4);
    const pairRoom = `100% - ${(1 + hero).toFixed(4)} * ${gutter} - ${(4 + 2 * hero).toFixed(4)} * ${b}`;
    const columns =
      `calc(100% - ${gutter} - 2 * ${b} - (${pairRoom}) / ${divisor})` +
      ' minmax(0, 1fr)';
    return { slots: ratios.map(ratio => ({ ratio, width: '100%' })), columns };
  }

  const slots: MediaSlot[] = new Array(items.length);
  for (const line of linesFor(layout, items.length)) {
    const total = line.reduce((sum, index) => sum + ratios[index], 0);
    for (const index of line) {
      slots[index] = { ratio: ratios[index], width: lineWidth(ratios[index] / total, line.length) };
    }
  }
  return { slots };
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
  const plan: MediaGridPlan = { layout, layoutClass: `grid-${layout}` };

  // 完整展示 in the auto ratio fits the pictures, so the plan states a place for
  // each one and no shape for the grid; every other case states a grid shape and
  // lets card.css's own table of (count, layout, poster ratio) defaults stand,
  // which is why those branches come out with no `aspectRatio` of their own.
  if (options.imageFit === 'contain' && options.aspectRatio === 'auto' && options.mediaLayout === 'grid') {
    return { ...plan, ...shapedPlan(visible, layout) };
  }

  const fitToGrid = options.aspectRatio === 'auto' && options.mediaLayout !== 'stack';
  const shaped = visible.length >= 2 && fitToGrid
    ? shapeForLayout(visible.length, layout, visible)
    : undefined;

  return { ...plan, aspectRatio: shaped === undefined ? undefined : `${shaped}` };
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
 * the re-plan used to enumerate by hand. The slots are written in item order
 * onto the grid's children, which is the order the card renders them in.
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
  // Cleared as well as set: a grid that was a two-column split still carries the
  // weights of the arrangement it has left.
  grid.style.gridTemplateColumns = plan.columns ?? '';
  if (!plan.slots) return;
  const cells = grid.children;
  plan.slots.forEach((slot, index) => {
    const cell = cells[index] as HTMLElement | undefined;
    if (cell?.style) cell.style.width = slot.width;
  });
}
