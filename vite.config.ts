import { defineConfig } from 'vite';

// Relative base so the built bundle also works from a subdirectory
// (GitHub Pages, itch.io zip, plain file server).
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
