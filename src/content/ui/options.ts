/**
 * The card's own options: what they may be, and what they are when unset.
 *
 * Every option used to be written three times — once as a union in
 * `types/card.ts`, once as a list the picker offers, and once as a hand-written
 * chain of comparisons inside a `sanitize*` function. The union is the type
 * layer's truth and cannot be read at runtime, so the other two had to be
 * repeated, and a value added to the union did not have to be added to either.
 *
 * On top of that, each `sanitize*` answered for two questions at once: what a
 * *missing* value means, and what an *invalid* one means. They disagreed.
 * `sanitizeRadius` answered `'12px'` for a value that was never set, while the
 * shipped default is `'theme'` — so `prefs.ts` had to guard the one call that
 * could not be protected by the merge above, and the comment explaining that
 * guard was longer than the guard.
 *
 * An option here answers for both with one figure: the default. A value that
 * was never set and a value that is not one of the option's own are the same
 * case — the user's stored preference does not name something the card can
 * show, so the card shows the one it ships with.
 */

import type {
  AspectRatioOption,
  CanvasBackgroundId,
  CanvasRatioOption,
  ImageFitOption,
  MediaLayoutOption,
  PaddingOption,
  RadiusOption,
} from '../../types/card.ts';

/**
 * One option: the values it may take, and the one it takes when unset.
 */
export interface CardOption<T extends string> {
  /** Every value the option may take, in the order the picker offers them. */
  readonly values: readonly T[];
  /** What the option is when it was never set, or set to something invalid. */
  readonly default: T;
}

/**
 * The card's own breathing room.
 *
 * Three tiers, and the tightest one ships: it leaves the most of the fixed
 * 640px width to the card's own content, and both larger steps are one click
 * away in the panel.
 */
export const PADDING: CardOption<PaddingOption> = {
  values: ['16px', '32px', '48px'],
  default: '16px',
};

/**
 * The card's corner.
 *
 * `'theme'` defers the corner to the material's own `radius` token, which is
 * what the card ships with: the materials were each drawn with a corner in
 * mind, and a fixed one would flatten that.
 */
export const RADIUS: CardOption<RadiusOption> = {
  values: ['theme', '0px', '12px', '20px'],
  default: 'theme',
};

/**
 * The card's minimum shape.
 *
 * `'auto'` means the card takes the height its content needs, which is the
 * default and the only shape that never crops a post.
 */
export const ASPECT_RATIO: CardOption<AspectRatioOption> = {
  values: ['auto', '3:4', '16:9'],
  default: 'auto',
};

/**
 * How a picture is fitted into its cell.
 *
 * `'contain'` shows the whole picture, which is the default; `'cover'` crops
 * to fill.
 */
export const IMAGE_FIT: CardOption<ImageFitOption> = {
  values: ['contain', 'cover'],
  default: 'contain',
};

/**
 * How several pictures are arranged.
 */
export const MEDIA_LAYOUT: CardOption<MediaLayoutOption> = {
  values: ['grid', 'stack'],
  default: 'grid',
};

/**
 * The exported canvas's shape.
 *
 * Distinct from the card's own shape: this one is the mat the card is mounted
 * on, and `'auto'` shrinks the mat to the card.
 */
export const CANVAS_RATIO: CardOption<CanvasRatioOption> = {
  values: ['auto', '1:1', '4:5', '3:4', '16:9'],
  default: 'auto',
};

/**
 * What the mat is painted with.
 *
 * The values are the ids; what each one paints is the table in `themes.ts`.
 * `'none'` is the default because it keeps the export byte-identical to the
 * card alone.
 */
export const CANVAS_BACKGROUND: CardOption<CanvasBackgroundId> = {
  values: [
    'none',
    'theme',
    'paper',
    'ink',
    'moss',
    'lagoon',
    'steel',
    'plum',
    'ember',
    'coral',
    'sunset',
    'citrus',
    'neon',
    'flamingo',
    'aurora',
  ],
  default: 'none',
};

/**
 * The value of one option, or its default when the stored value is not one it
 * may take.
 *
 * A missing value and an invalid one are the same case, and both answer the
 * option's default: the stored preference does not name something the card can
 * show, so the card shows the one it ships with.
 */
export function optionValue<T extends string>(option: CardOption<T>, value: unknown): T {
  if (typeof value === 'string' && (option.values as readonly string[]).includes(value)) {
    return value as T;
  }
  return option.default;
}
