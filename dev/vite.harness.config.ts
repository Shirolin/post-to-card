import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

/**
 * Dev harness config: serves dev/preview.html with the real content-script UI
 * mounted against fixtures. Never part of the extension build.
 */
export default defineConfig({
  root: resolve(root, 'dev'),
  server: { port: 5199, strictPort: true },
  build: { outDir: resolve(root, 'dist-harness'), emptyOutDir: true },
});
