import { h, type ComponentChild } from 'preact';
import { useMemo } from 'preact/hooks';
import qrcode from 'qrcode-generator';

/**
 * Sanitizes tracking and analytics query parameters from URL
 * to keep QR code matrix density minimal and easily scannable.
 */
export function sanitizeQrUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 's', 't'];
    trackingParams.forEach((param) => u.searchParams.delete(param));
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export interface QrVectorData {
  viewBox: string;
  path: string;
  moduleCount: number;
}

export function generateQrCodeData(url: string): QrVectorData | null {
  try {
    const clean = sanitizeQrUrl(url);
    const qr = qrcode(0, 'M');
    qr.addData(clean);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const rects: string[] = [];
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          rects.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }

    return {
      viewBox: `0 0 ${moduleCount} ${moduleCount}`,
      path: rects.join(' '),
      moduleCount,
    };
  } catch (err) {
    console.error('[Post-to-Card] QR generation failed:', err);
    return null;
  }
}

export interface CardQrCodeProps {
  url: string;
  fillColor?: string;
  className?: string;
  /**
   * Tooltip text. Required, not optional: the card is the only caller and always
   * has a translator in hand, and an optional tooltip is how the hard-coded
   * English literal grew here in the first place.
   */
  title: string;
}

export function CardQrCode({ url, fillColor = 'currentColor', className, title }: CardQrCodeProps): ComponentChild {
  const data = useMemo(() => generateQrCodeData(url), [url]);

  if (!data) return null;

  return h(
    'div',
    {
      class: `card-qr-container ${className || ''}`,
      title,
    },
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: data.viewBox,
        class: 'card-qr-svg',
        'shape-rendering': 'crispEdges',
      },
      h('path', {
        d: data.path,
        fill: fillColor,
      })
    )
  );
}
