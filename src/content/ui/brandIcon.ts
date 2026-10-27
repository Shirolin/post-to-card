/**
 * The extension icon, as a `data:` URL ready for an `<img src>`.
 *
 * The three surfaces that show the product's mark as the icon itself -- the
 * card footer, the modal header and the popup's page -- take it from here. What
 * they must not do is name the file by a `chrome-extension://` address: the
 * footer's copy is rasterized into the exported PNG, and a cross-origin image
 * taints that canvas (the same reason every remote picture already travels as a
 * data URL). It would need to be a web-accessible resource besides, which is a
 * manifest permission bought for one thumbnail.
 *
 * Inlining sidesteps both, and it also passes `prepareCardImages` by, which
 * skips `data:` sources -- so the export does not try to proxy the extension's
 * own icon through the network.
 *
 * `public/icons/icon-128.png` is the source. The footer draws it at 14 CSS px
 * and the export runs at up to 3x, so the 42px the rasterizer asks for is well
 * inside 128. `?inline` is Vite's, and it emits the same bytes: a 4.8KB file
 * becomes a 6.5KB string, where the 1024px icon would have cost 32KB.
 *
 * Nothing in the action-bar path imports this. That button is drawn as line art
 * (see `brandMark.ts`), and `injection.ts` is loaded by the tests outside Vite,
 * which has no loader for a `.png` import.
 */
import iconFile from '../../../public/icons/icon-128.png?inline';

export const brandIconSrc: string = iconFile;
