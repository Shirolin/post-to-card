/**
 * Clipboard API Simulation Layer with Granular Fault Injection.
 * Supports simulating:
 * 1. Success path (navigator.clipboard.write)
 * 2. Focus loss (DOMException: Document is not focused)
 * 3. Gesture expiration (NotAllowedError: Must be handling a user gesture)
 * 4. Permission denial
 */

export class MockClipboardItem {
  public types: string[];
  private data: Record<string, Blob>;

  constructor(data: Record<string, Blob>) {
    this.data = data;
    this.types = Object.keys(data);
  }

  public async getType(type: string): Promise<Blob> {
    const blob = this.data[type];
    if (!blob) throw new Error(`Type ${type} not found in ClipboardItem`);
    return blob;
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

  public async writeText(text: string): Promise<void> {
    if (this.failureMode !== 'none') {
      return this.write([]);
    }
    const blob = new Blob([text], { type: 'text/plain' });
    this.writtenItems.push(new MockClipboardItem({ 'text/plain': blob }));
  }

  public clear(): void {
    this.writtenItems = [];
    this.failureMode = 'none';
  }
}

