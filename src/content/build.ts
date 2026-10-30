/**
 * Build identity, baked into the bundle at build time.
 *
 * The stamp rides in the card footer so a shared image names the build that drew
 * it. Two builds of the same version differ only in this string, which is the one
 * thing a plain version number cannot tell you -- and the difference matters
 * when a card comes back wrong and you need to know which code produced it.
 */
declare const __CARD_BUILD__: string | undefined;

/** e.g. `v1.0.0·1352`. Reads as `dev` where no build stamped it. */
export const CARD_BUILD: string =
  typeof __CARD_BUILD__ === 'string' ? __CARD_BUILD__ : 'dev';