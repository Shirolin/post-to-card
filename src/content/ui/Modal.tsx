import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Locale } from '../../types/card';
import { getTranslation } from '../i18n';
import { Sparkles, X } from 'lucide-preact';

let activeScrollLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function lockScroll(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (activeScrollLocks === 0) {
    const docEl = document.documentElement;
    const body = document.body;
    const scrollbarWidth = window.innerWidth - (docEl?.clientWidth || body?.clientWidth || 0);

    previousOverflow = body ? body.style.overflow : '';
    previousPaddingRight = body ? body.style.paddingRight : '';

    if (body) {
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
  }
  activeScrollLocks++;
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;

  activeScrollLocks = Math.max(0, activeScrollLocks - 1);
  if (activeScrollLocks === 0 && document.body) {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  }
}

export interface ModalProps {
  isOpen?: boolean;
  locale?: Locale;
  onClose: () => void;
  children: ComponentChildren;
}

export function Modal({ isOpen = true, locale = 'en-US', onClose, children }: ModalProps): JSX.Element | null {
  const t = getTranslation(locale);

  useEffect(() => {
    if (!isOpen) return;

    lockScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
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
        class="post-to-card-dialog"
        onClick={handleDialogClick}
      >
        {/* Header */}
        <div class="modal-header">
          <div class="modal-brand">
            <div class="modal-brand-icon" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2} />
            </div>
            <span>{t.brandName}</span>
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
