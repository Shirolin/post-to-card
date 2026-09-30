import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

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
  const hasPublicDir = existsSync(resolve(__dirname, 'public'));

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
