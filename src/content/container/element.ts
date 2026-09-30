import { render, h } from 'preact';
import type { ThreadData } from '../../types/tweet';
import { App } from '../ui/App';
import modalCss from '../styles/modal.css?inline';
import cardCss from '../styles/card.css?inline';

export class PostToCardContainer extends HTMLElement {
  public shadow!: ShadowRoot;
  public mountPoint!: HTMLDivElement;
  public styleElement!: HTMLStyleElement;

  constructor() {
    super();
    this.initComponent();
  }

  public initComponent(): void {
    if (this.mountPoint && this.shadow) {
      return;
    }

    try {
      this.shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });
    } catch {
      this.shadow = this.shadowRoot || (this as unknown as ShadowRoot);
    }

    this.styleElement = (this.shadow.querySelector?.('#post-to-card-styles') as HTMLStyleElement) || document.createElement('style');
    this.styleElement.id = 'post-to-card-styles';

    this.mountPoint = (this.shadow.querySelector?.('#post-to-card-root') as HTMLDivElement) || document.createElement('div');
    this.mountPoint.id = 'post-to-card-root';

    if (this.shadow.appendChild) {
      if (!this.shadow.contains(this.styleElement)) {
        this.shadow.appendChild(this.styleElement);
      }
      if (!this.shadow.contains(this.mountPoint)) {
        this.shadow.appendChild(this.mountPoint);
      }
    }

    this.injectStyles([modalCss, cardCss].join('\n\n'));
  }

  public injectStyles(cssText: string): void {
    if (this.styleElement) {
      this.styleElement.textContent = cssText;
    }
  }

  public unmountContent(): void {
    if (this.mountPoint) {
      render(null, this.mountPoint);
      this.mountPoint.innerHTML = '';
    }
  }

  disconnectedCallback(): void {
    this.unmountContent();
  }
}

// Safe Custom Elements registration guard (handles customElements === null in isolated extension worlds)
try {
  const ce = (typeof customElements !== 'undefined' && customElements !== null)
    ? customElements
    : (typeof window !== 'undefined' && window.customElements ? window.customElements : null);

  if (ce && typeof ce.get === 'function' && typeof ce.define === 'function') {
    if (!ce.get('post-to-card-container')) {
      ce.define('post-to-card-container', PostToCardContainer);
    }
  }
} catch (e) {
  console.warn('[Post-to-Card] customElements registration bypassed:', e);
}

let activeContainer: PostToCardContainer | null = null;

import type { Locale } from '../../types/card';

export function openCardModal(
  threadData: ThreadData,
  onExport?: (target: HTMLElement, scale: number, action?: 'copy' | 'download', locale?: Locale) => Promise<void>
): PostToCardContainer {
  // Singleton guard: check if a container element already exists in document
  let container = document.querySelector('post-to-card-container') as PostToCardContainer | null;
  if (!container) {
    container = document.createElement('post-to-card-container') as PostToCardContainer;
    document.body.appendChild(container);
  }

  // Ensure internal Shadow DOM and mount point are fully initialized
  if (typeof container.initComponent === 'function') {
    container.initComponent();
  } else {
    // Fallback if customElements did not upgrade the element
    const rawEl = container as unknown as PostToCardContainer;
    if (!rawEl.shadow) {
      let shadow = container.shadowRoot;
      if (!shadow && typeof container.attachShadow === 'function') {
        try {
          shadow = container.attachShadow({ mode: 'open' });
        } catch {
          // ignore
        }
      }
      rawEl.shadow = shadow || (container as unknown as ShadowRoot);
    }

    let styleEl = rawEl.shadow?.querySelector?.('#post-to-card-styles') as HTMLStyleElement | null;
    if (!styleEl && typeof document.createElement === 'function') {
      styleEl = document.createElement('style');
      styleEl.id = 'post-to-card-styles';
      styleEl.textContent = [modalCss, cardCss].join('\n\n');
      rawEl.shadow?.appendChild?.(styleEl);
    }
    rawEl.styleElement = styleEl!;

    let mount = rawEl.shadow?.querySelector?.('#post-to-card-root') as HTMLDivElement | null;
    if (!mount && typeof document.createElement === 'function') {
      mount = document.createElement('div');
      mount.id = 'post-to-card-root';
      rawEl.shadow?.appendChild?.(mount);
    }
    rawEl.mountPoint = mount!;
    rawEl.unmountContent = () => {
      if (rawEl.mountPoint) {
        render(null, rawEl.mountPoint);
        rawEl.mountPoint.innerHTML = '';
      }
    };
  }

  activeContainer = container;

  // Mount Preact App tree into Shadow DOM mount point
  render(
    h(App, {
      threadData,
      onClose: closeCardModal,
      onExport: onExport as any,
    }),
    container.mountPoint
  );

  return container;
}

export function closeCardModal(): void {
  const container = (document.querySelector('post-to-card-container') as PostToCardContainer | null) || activeContainer;
  if (container) {
    if (typeof container.unmountContent === 'function') {
      container.unmountContent();
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
  activeContainer = null;
}
