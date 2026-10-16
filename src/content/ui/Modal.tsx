import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { Locale } from '../../types/card.ts';
import { getTranslation, sanitizeLocale } from '../i18n.ts';
import { Sparkles, X } from 'lucide-preact';

let activeScrollLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';
let previousDocOverflow = '';
let previousScrollY = 0;

/**
 * Freezes the host page's scroll while the modal is open.
 *
 * The lock is applied to documentElement, which is the scrolling element on an
 * X page; locking only body left the document scrollable and reset the position
 * to the top on release. The offset is also captured explicitly and restored,
 * because the host page is a single-page app whose layout can shift while the
 * overlay is mounted.
 */
export function lockScroll(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (activeScrollLocks === 0) {
    const docEl = document.documentElement;
    const body = document.body;
    const scrollbarWidth = window.innerWidth - (docEl?.clientWidth || body?.clientWidth || 0);

    previousScrollY = window.scrollY || docEl?.scrollTop || 0;
    previousDocOverflow = docEl ? docEl.style.overflow : '';
    previousOverflow = body ? body.style.overflow : '';
    previousPaddingRight = body ? body.style.paddingRight : '';

    if (docEl) {
      docEl.style.overflow = 'hidden';
    }
    if (body) {
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        // Added to whatever the page already had, not written over it. The
        // padding stands in for the scrollbar that just went away, so replacing
        // an offset the page already carried under-compensates by exactly that
        // offset and the content jumps sideways as the modal opens.
        const existing = Number.parseFloat(body.style.paddingRight) || 0;
        body.style.paddingRight = `${existing + scrollbarWidth}px`;
      }
    }
  }
  activeScrollLocks++;
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // A release with nothing held is not a release. Falling through here would
  // write whatever the *last* lock captured onto a page that is not locked —
  // an unlock from a modal that was torn down twice restored an overflow the
  // host page had long since moved past.
  if (activeScrollLocks === 0) return;

  activeScrollLocks--;
  if (activeScrollLocks > 0) return;

  const docEl = document.documentElement;
  if (docEl) {
    docEl.style.overflow = previousDocOverflow;
  }
  if (document.body) {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  }

  // Restored after the overflow change so the offset survives.
  window.scrollTo(0, previousScrollY);
}

export interface ModalProps {
  isOpen?: boolean;
  locale?: Locale;
  /** Short context line shown next to the brand in the header. */
  summary?: string;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Resolves the truly focused element.
 *
 * `document.activeElement` only ever returns the shadow host when focus sits
 * inside a shadow tree, so it cannot be compared against nodes queried from
 * within that tree. Reading `activeElement` off the root node yields the real
 * inner element; for light DOM it falls back to the document.
 */
function getDeepActiveElement(): Element | null {
  const active = document.activeElement;
  if (!active) return null;
  const root = active.shadowRoot;
  return root ? root.activeElement : active;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({ isOpen = true, locale, summary, onClose, children }: ModalProps): JSX.Element | null {
  const t = getTranslation(sanitizeLocale(locale));
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Captured before the dialog steals focus, so it can be restored on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Guards the initial focus so a later re-render cannot yank focus back.
  const hasFocusedRef = useRef(false);

  /**
   * Callback ref rather than a plain ref read inside the effect: Preact has
   * not attached the node during the first effect pass, so focusing from
   * there silently did nothing. This fires the moment the node is inserted.
   *
   * The callback identity must stay stable. An inline ref is re-invoked on
   * every render — Preact detaches it with `null` and reattaches the node —
   * which pulled focus back onto the dialog each time a control was changed
   * and broke arrow-key navigation inside the radio groups.
   */
  const attachDialog = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    if (!node) return;
    if (!restoreFocusRef.current) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
    }
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      node.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Reset so a reopen (without unmounting) focuses the dialog again.
      hasFocusedRef.current = false;
      return;
    }

    lockScroll();

    // Fallback for the case where the node already existed before this effect
    // ran (e.g. a re-render that did not remount the dialog). Guarded so it can
    // only ever fire once: an unguarded focus here runs after the first user
    // interaction and pulls focus off whatever control was just used.
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      dialogRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Trap Tab inside the dialog: the host page behind the overlay must
      // stay unreachable while the modal is open.
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = getDeepActiveElement();

      // Focus that already escaped the dialog (e.g. moved by the host page)
      // is pulled back to the nearest edge.
      if (!current || !dialog.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      // The container may already be detached at this point, so guard the
      // restore instead of assuming the trigger still exists.
      const restore = restoreFocusRef.current;
      if (restore && document.contains(restore)) {
        restore.focus();
      }
      restoreFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'post-to-card-backdrop') {
      onClose();
    }
  };

  const handleDialogClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div id="post-to-card-backdrop" onClick={handleBackdropClick}>
      <div
        id="post-to-card-dialog"
        ref={attachDialog}
        class="post-to-card-dialog"
        onClick={handleDialogClick}
        role="dialog"
        aria-modal="true"
        aria-label={t.brandName}
        tabIndex={-1}
      >
        {/* Header */}
        <div class="modal-header">
          <div class="modal-brand">
            <div class="modal-brand-icon" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2} />
            </div>
            <span class="modal-brand-name">{t.brandName}</span>
            {summary && <span class="modal-header-summary">{summary}</span>}
          </div>
          <button
            type="button"
            class="modal-close-btn"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div class="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
