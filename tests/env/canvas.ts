/**
 * Canvas 2D Context & modern-screenshot Simulation Layer.
 * Accurately tracks canvas origin-clean state and enforces Same-Origin SecurityError
 * on unproxied external image resources.
 */

import { DomElement, DomImageElement } from './browser.ts';

export class MockCanvasRenderingContext2D {
  public canvas: MockCanvasElement;
  public fillStyle: string = '#000000';
  public strokeStyle: string = '#000000';
  public currentScale: { x: number; y: number } = { x: 1, y: 1 };
  public drawnOperations: any[] = [];

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  public scale(x: number, y: number): void {
    this.currentScale = { x, y };
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    this.drawnOperations.push({ op: 'fillRect', x, y, w, h });
  }

  public drawImage(img: any, dx: number, dy: number, dw?: number, dh?: number): void {
    const src = img.src || (img.getAttribute && img.getAttribute('src')) || '';
    this.drawnOperations.push({ op: 'drawImage', src, dx, dy, dw, dh });

    // Same-Origin policy check
    if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('about:')) {
      if (src.includes('twimg.com') || src.startsWith('http://') || src.startsWith('https://')) {
        // Taints canvas!
        this.canvas.originClean = false;
      }
    }
  }

  public getImageData(_sx: number, _sy: number, sw: number, sh: number): any {
    if (!this.canvas.originClean) {
      throw new Error("SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': Tainted canvases may not be exported.");
    }
    return { data: new Uint8ClampedArray(sw * sh * 4), width: sw, height: sh };
  }
}

export class MockCanvasElement extends DomElement {
  public width: number = 640;
  public height: number = 400;
  public originClean: boolean = true;
  private ctx: MockCanvasRenderingContext2D | null = null;

  constructor() {
    super('CANVAS');
  }

  public getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === '2d') {
      if (!this.ctx) {
        this.ctx = new MockCanvasRenderingContext2D(this);
      }
      return this.ctx;
    }
    return null;
  }

  public toBlob(callback: (blob: Blob | null) => void, type: string = 'image/png', _quality?: number): void {
    if (!this.originClean) {
      throw new Error("SecurityError: Failed to execute 'toBlob' on 'HTMLCanvasElement': Tainted canvases may not be exported.");
    }
    const byteSize = this.width * this.height * 4;
    const buffer = new Uint8Array(byteSize);
    const blob = new Blob([buffer], { type });
    setTimeout(() => callback(blob), 5);
  }

  public toDataURL(type: string = 'image/png'): string {
    if (!this.originClean) {
      throw new Error("SecurityError: Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.");
    }
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }
}

export interface ScreenshotOptions {
  scale?: number;
  type?: string;
  backgroundColor?: string | null;
  filter?: (node: any) => boolean;
  features?: Record<string, any>;
}

/**
 * High-fidelity modern-screenshot mock.
 * Inspects target DOM element. If any nested img has an unproxied external URL,
 * throws SecurityError simulating canvas taint.
 */
export async function mockDomToBlob(target: DomElement, options: ScreenshotOptions = {}): Promise<Blob> {
  const { scale = 2, type = 'image/png', filter } = options;

  // Gather all nested images
  const images = target.querySelectorAll<DomImageElement>('img');
  const canvas = new MockCanvasElement();
  canvas.width = 640 * scale;
  canvas.height = 400 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  for (const img of images) {
    if (filter && !filter(img)) continue;
    const src = img.src || '';
    if (src) {
      ctx.drawImage(img, 0, 0);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Screenshot engine produced an empty blob."));
        } else {
          resolve(blob);
        }
      }, type);
    } catch (err) {
      reject(err);
    }
  });
}
