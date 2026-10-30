/**
 * Clipboard API Simulation Layer with Granular Fault Injection.
 *
 * Only the surface the extension actually uses is modelled: `write([item])`,
 * which is how the export engine copies a card, and the four ways it can be
 * refused. `writeText`, `clear` and `ClipboardItem.getType` were here too and no
 * test, production file or fixture called any of them, so they read as covered
 * behaviour without being any.
 *
 * 1. Success path (navigator.clipboard.write)
 * 2. Focus loss (DOMException: Document is not focused)
 * 3. Gesture expiration (NotAllowedError: Must be handling a user gesture)
 * 4. Permission denial
 */

import type { DomDocument, DomElement } from './browser.ts';

export class MockClipboardItem {
  /** The MIME types the item was built with. All a test ever reads. */
  public types: string[];

  constructor(data: Record<string, Blob>) {
    this.types = Object.keys(data);
  }
}

export type ClipboardFailureMode =
  | 'none'
  | 'unfocused'
  | 'gesture_expired'
  | 'permission_denied';

export class MockClipboard {
  public failureMode: ClipboardFailureMode = 'none';
  public writtenItems: MockClipboardItem[] = [];

  public async write(items: MockClipboardItem[]): Promise<void> {
    switch (this.failureMode) {
      case 'unfocused':
        throw new Error("DOMException: Document is not focused.");
      case 'gesture_expired':
        throw new Error("NotAllowedError: Failed to execute 'write' on 'Clipboard': Must be handling a user gesture to use the Clipboard API.");
      case 'permission_denied':
        throw new Error("NotAllowedError: Clipboard permission denied.");
      case 'none':
      default:
        this.writtenItems.push(...items);
        return Promise.resolve();
    }
  }
}

/**
 * Installs a clipboard set to `failureMode` on `navigator` for the duration of
 * `body`, and returns the download anchors the fallback left in the document.
 *
 * The anchors are read before their cleanup timer fires, which is the only
 * moment they exist. `console.warn` is silenced for the same duration: every
 * refusal path logs one, and a suite that prints them reads like a failing run.
 *
 * Tiers 1 and 4 each used to keep a copy of this, and the copies had already
 * drifted — only tier 4 re-listed the failure union, so a fifth mode added to
 * `ClipboardFailureMode` would have gone stale there without a word.
 */
export async function withClipboard(
  failureMode: ClipboardFailureMode,
  body: (clipboard: MockClipboard) => Promise<void>
): Promise<DomElement[]> {
  const scope = globalThis as Record<string, unknown>;
  const doc = scope.document as DomDocument;
  const clipboard = new MockClipboard();
  clipboard.failureMode = failureMode;

  const savedClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  const savedItem = scope.ClipboardItem;
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: clipboard, configurable: true, writable: true });
  scope.ClipboardItem = MockClipboardItem;

  const savedWarn = console.warn;
  console.warn = () => {};
  try {
    await body(clipboard);
    return doc.body.querySelectorAll('a[download]');
  } finally {
    console.warn = savedWarn;
    if (savedClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', savedClipboard);
    } else {
      delete (globalThis.navigator as { clipboard?: unknown }).clipboard;
    }
    scope.ClipboardItem = savedItem;
  }
}

