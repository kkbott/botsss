import { defineConfig } from 'vite';

// Relative base keeps the build portable: GitHub Pages project sites,
// Netlify, Vercel and even file://-style static hosting all work.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
  },
});
