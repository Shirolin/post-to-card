import type { JSX } from 'preact';

/**
 * Keyboard behaviour for a `role="radiogroup"` built from `<button role="radio">`.
 *
 * ARIA expects two things the plain buttons do not give for free: arrow keys
 * move the selection, and only the checked radio is in the tab order (roving
 * tabindex) so the group is a single Tab stop. The caller supplies the tabindex
 * (`isActive ? 0 : -1`); this helper handles the key press and focus move.
 */
export function handleRadioKeyDown<T extends string | number>(
  e: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
  options: readonly T[],
  value: T,
  onSelect: (next: T) => void
): void {
  const currentIndex = options.indexOf(value);
  if (currentIndex < 0) return;

  let nextIndex: number;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = (currentIndex + 1) % options.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = (currentIndex - 1 + options.length) % options.length;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = options.length - 1;
      break;
    default:
      return;
  }

  e.preventDefault();
  onSelect(options[nextIndex]);

  // Roving focus: the browser skips tabindex="-1" siblings, so the newly
  // selected radio must be focused explicitly or focus is lost after a re-render.
  const group = e.currentTarget.parentElement;
  group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
}
