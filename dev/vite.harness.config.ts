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
  // Bound to IPv4 explicitly. Vite's default resolves `localhost` to `::1` on
  // this machine, which leaves `127.0.0.1:5199` refusing connections while the
  // printed URL works -- so anything that probes the port by address (readiness
  // checks, tooling) fails on a server that is in fact up.
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  build: { outDir: resolve(root, 'dist-harness'), emptyOutDir: true },
  define: { __CARD_BUILD__: JSON.stringify(cardBuild()) },
});
