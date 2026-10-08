/**
 * Export Engine: High-Resolution Rendering and Canvas CORS Protection.
 * 
 * Interacts with background service worker to convert twimg remote assets
 * into Base64 Data URLs before rasterization, preventing Canvas CORS contamination
 * (SecurityError on toBlob/toDataURL). Invokes modern-screenshot domToBlob at Retina
 * (scale: 2 or 3) resolution.
 */

import { domToBlob } from 'modern-screenshot';

export const FALLBACK_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23333333"/></svg>';

export interface RenderOptions {
  scale?: number;
  backgroundColor?: string | null;
  filter?: (node: Node) => boolean;
}

/**
 * Requests the Background Service Worker to fetch and convert a remote image URL
 * into a Base64 Data URL, bypassing web-page CORS restrictions via MV3 host_permissions.
 */
export async function fetchImageAsBase64(
  url: string,
  fallbackToPlaceholder: boolean = false
): Promise<string> {
  if (!url) {
    return '';
  }

  // Already a Data URL or Blob URL, no proxying required
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Check if Chrome extension messaging is available
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    typeof chrome.runtime.sendMessage !== 'function'
  ) {
    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGE_BASE64',
      url,
    });

    if (response && response.success && typeof response.dataUrl === 'string') {
      return response.dataUrl;
    }

    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  } catch (err) {
    console.warn('[Post-to-Card] Failed to fetch image via background proxy:', err);
    return fallbackToPlaceholder ? FALLBACK_PLACEHOLDER_DATA_URL : url;
  }
}

/**
 * Traverses an element's subtree and temporarily substitutes remote image src attributes
 * with Base64 Data URLs so the HTML5 canvas remains origin-clean during modern-screenshot export.
 * Returns a restoration function to revert the DOM once snapshotting completes.
 */
export async function replaceCardImagesWithBase64(cardElement: HTMLElement): Promise<() => void> {
  const images = Array.from(cardElement.querySelectorAll('img'));
  const originalSources: Array<{ img: HTMLImageElement; originalSrc: string }> = [];

  for (const img of images) {
    const currentSrc = img.src || img.getAttribute('src') || '';
    if (currentSrc && !currentSrc.startsWith('data:') && !currentSrc.startsWith('blob:')) {
      originalSources.push({ img, originalSrc: currentSrc });
      const base64Url = await fetchImageAsBase64(currentSrc, true);
      img.src = base64Url;
    }
  }

  // Wait for images to complete decoding
  await Promise.all(
    images.map(async (img) => {
      if (img.complete) return;
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // Continue if single image decoding fails
        }
      }
    })
  );

  return () => {
    for (const item of originalSources) {
      item.img.src = item.originalSrc;
    }
  };
}

/**
 * Mounts a copy of the card beside the content it lives in, outside any zoomed
 * ancestor, and returns it with a disposer.
 *
 * The preview scales the card with `zoom` to fit a narrow window. The
 * rasterizer lays the card out at that scaled size, so the PNG came out shrunk
 * and its footer wrapped ("Post to / Card"). Clearing `zoom` on the live
 * ancestors was not dependable: the new size was not yet visible to layout
 * when the capture read it. A copy keeps the live preview untouched and is
 * captured at the card's own width. It stays in the same root, so the card's
 * stylesheet still applies.
 */
function mountUnzoomedCopy(card: HTMLElement): { copy: HTMLElement; dispose: () => void } {
  const root = card.getRootNode();
  const host: Node = root instanceof ShadowRoot ? root : document.body;
  // The copy itself carries no positioning: the rasterizer serializes its inline
  // style, so an offset there would push the picture out of its own frame. The
  // off-screen placement lives on a wrapper the rasterizer never sees.
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText = 'position:fixed;left:-100000px;top:0;';
  const copy = card.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  wrapper.appendChild(copy);
  host.appendChild(wrapper);
  return { copy, dispose: () => wrapper.remove() };
}

/**
 * Renders the target card DOM node to a high-resolution PNG Blob.
 * Ensures the canvas remains 100% origin-clean without SecurityError.
 *
 * Two rewrites keep the canvas origin-clean and they do different jobs. The src
 * attributes on the live card are replaced first, which is what covers the
 * pictures the card is made of. The `fetchFn` below then covers anything the
 * rasterizer discovers on its own -- an image it meets inside the clone it
 * builds, such as a background it has to resolve -- which the first pass never
 * saw. A third implementation used to rewrite the TweetData model instead of
 * either; nothing reached it, because the card is rasterized from the DOM.
 */
export async function renderCardToBlob(
  cardElement: HTMLElement,
  options: RenderOptions = {}
): Promise<Blob> {
  const restoreImages = await replaceCardImagesWithBase64(cardElement);
  const { copy, dispose } = mountUnzoomedCopy(cardElement);
  await Promise.all(
    Array.from(copy.querySelectorAll('img')).map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => {}) : undefined
    )
  );

  try {
    const scale = options.scale ?? 2;
    const backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : null;

    const filter = (node: Node): boolean => {
      if (node instanceof HTMLElement) {
        // `data-html2canvas-ignore` is the attribute the card actually emits
        // (the html2canvas convention). `data-export-ignore` is kept as an
        // alias so either spelling works.
        if (
          node.getAttribute('data-html2canvas-ignore') === 'true' ||
          node.getAttribute('data-export-ignore') === 'true' ||
          node.dataset?.exportIgnore === 'true'
        ) {
          return false;
        }
      }
      if (options.filter) {
        return options.filter(node);
      }
      return true;
    };

    const blob = await domToBlob(copy, {
      scale,
      type: 'image/png',
      backgroundColor,
      features: {
        copyScrollbar: false,
        removeAbnormalAttributes: true,
        removeControlCharacter: true,
      },
      filter,
      fetchFn: async (url: string) => {
        const dataUrl = await fetchImageAsBase64(url, true);
        return dataUrl.startsWith('data:') ? dataUrl : false;
      },
    });

    if (!blob) {
      throw new Error('Screenshot engine produced an empty blob.');
    }

    return blob;
  } finally {
    dispose();
    restoreImages();
  }
}
