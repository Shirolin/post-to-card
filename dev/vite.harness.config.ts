import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardBuild } from '../vite.config';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

/**
 * Dev harness config: serves dev/preview.html with the real content-script UI
 * mounted against fixtures. Never part of the extension build.
 *
 * The card's build stamp is defined here too, so the harness shows the same
 * footer the shipped bundle does. Without it the stamp reads `dev`, which is
 * honest but stops the harness from previewing the real mark.
 */
export default defineConfig({
  root: resolve(root, 'dev'),
  server: { port: 5199, strictPort: true },
  build: { outDir: resolve(root, 'dist-harness'), emptyOutDir: true },
  define: { __CARD_BUILD__: JSON.stringify(cardBuild()) },
});
