import type { JSX } from 'preact';

/**
 * Keyboard behaviour for a `role="radiogroup"` built from `<button role="radio">`.
 *
 * ARIA expects two things the plain buttons do not give for free: arrow keys
 * move the selection, and only one radio is in the tab order (roving tabindex)
 * so the group is a single Tab stop. The caller supplies that tabindex; this
 * helper handles the key press, skips any radio it has disabled, and moves
 * focus onto the element that ends up selected.
 */
export function handleRadioKeyDown<T extends string | number>(
  e: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
  options: readonly T[],
  value: T,
  onSelect: (next: T) => void
): void {
  const currentIndex = options.indexOf(value);
  if (currentIndex < 0) return;

  const group = e.currentTarget.parentElement;
  const radios = group
    ? Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    : [];
  // A level can be shown but unavailable (the preview zoom does this when the
  // card cannot fit the window at that scale). Such a level must be skipped:
  // selecting it would do nothing, and a disabled button cannot hold focus, so
  // focus would be dumped on the body.
  const isSelectable = (index: number) => !radios[index]?.disabled;
  const step = (delta: number) => {
    for (let i = 1; i <= options.length; i++) {
      const candidate = (currentIndex + delta * i + options.length) % options.length;
      if (isSelectable(candidate)) return candidate;
    }
    return currentIndex;
  };

  let nextIndex: number;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = step(1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = step(-1);
      break;
    case 'Home':
      nextIndex = options.findIndex((_, index) => isSelectable(index));
      break;
    case 'End': {
      let last = -1;
      options.forEach((_, index) => {
        if (isSelectable(index)) last = index;
      });
      nextIndex = last;
      break;
    }
    default:
      return;
  }

  if (nextIndex < 0) return;

  // Arrow keys are consumed even when the selection cannot move (a group with
  // one reachable level, or a wrap back onto itself). Returning early instead
  // would let the browser's default arrow handling scroll the page and drop
  // focus off the control.
  e.preventDefault();
  if (nextIndex !== currentIndex) onSelect(options[nextIndex]);

  // Roving focus: the browser skips tabindex="-1" siblings, so the newly
  // selected radio must be focused explicitly or focus is lost after a re-render.
  //
  // This runs on the next frame because selecting a level re-renders the group,
  // and that render can change which levels are available (picking a higher
  // zoom can push the card past the window and disable it again). Focusing
  // before the render commits lands on a button that is about to be disabled,
  // which silently drops focus onto the body.
  requestAnimationFrame(() => {
    const buttons = group
      ? Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
      : [];
    const preferred = buttons[nextIndex];
    if (preferred && !preferred.disabled) {
      preferred.focus();
      return;
    }
    // The level chosen above turned out to be unavailable; keep focus in the
    // group on whichever radio is actually reachable.
    const fallback =
      buttons.find((radio) => !radio.disabled && radio.tabIndex === 0) ??
      buttons.find((radio) => !radio.disabled);
    fallback?.focus();
  });
}
