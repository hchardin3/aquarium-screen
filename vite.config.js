import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  // Relative paths so Electron can load dist/index.html over file://
  base: './',
  // Three.js alone is ~600 kB; code-splitting buys nothing for a local wallpaper.
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1000 },
});
