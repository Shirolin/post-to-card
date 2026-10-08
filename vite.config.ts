import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Version plus the build's wall-clock minute, e.g. `v1.0.0·1352`.
 *
 * The version alone repeats across rebuilds of the same source, so it cannot
 * tell two builds apart. The minute makes every build distinguishable without
 * pulling in a git or hash dependency, and it is short enough to sit in the
 * card footer as a stamp.
 */
export function cardBuild(): string {
  const { version } = JSON.parse(
    readFileSync(resolve(__dirname, 'package.json'), 'utf8')
  ) as { version: string };
  const now = new Date();
  const hhmm =
    String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  return `v${version}·${hhmm}`;
}

function copyManifestPlugin(): Plugin {
  return {
    name: 'copy-manifest',
    closeBundle() {
      const manifestSrc = resolve(__dirname, 'manifest.json');
      const distDir = resolve(__dirname, 'dist');
      const manifestDest = resolve(distDir, 'manifest.json');

      if (existsSync(manifestSrc)) {
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }
        copyFileSync(manifestSrc, manifestDest);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isBackground = mode === 'background';
  const isHook = mode === 'hook';
  const hasPublicDir = existsSync(resolve(__dirname, 'public'));

  // GraphQL interceptor. Runs in the MAIN world so it can observe the page's
  // own fetch/XHR calls, which are invisible from the isolated content script.
  if (isHook) {
    return {
      publicDir: false,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'esnext',
        minify: false,
        lib: {
          entry: resolve(__dirname, 'src/content/graphql/hook.ts'),
          name: 'PostToCardGraphQLHook',
          formats: ['iife'],
          fileName: () => 'graphql-hook.js',
        },
        rollupOptions: {
          output: {
            entryFileNames: 'graphql-hook.js',
            extend: true,
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  if (isBackground) {
    return {
      publicDir: hasPublicDir ? 'public' : false,
      plugins: [copyManifestPlugin()],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'esnext',
        minify: false,
        lib: {
          entry: resolve(__dirname, 'src/background/index.ts'),
          formats: ['es'],
          fileName: () => 'background.js',
        },
        rollupOptions: {
          output: {
            entryFileNames: 'background.js',
          },
        },
      },
    };
  }

  // Content script build (mode === 'content' or default)
  return {
    publicDir: hasPublicDir ? 'public' : false,
    plugins: [copyManifestPlugin()],
    define: { __CARD_BUILD__: JSON.stringify(cardBuild()) },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'esnext',
      minify: false,
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'PostToCardContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          entryFileNames: 'content.js',
          extend: true,
          inlineDynamicImports: true,
        },
      },
    },
  };
});
