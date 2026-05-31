import { defineConfig } from 'vite';

// GitHub Pages serves a project site from /<repo>/, so the production bundle
// built in CI (GITHUB_ACTIONS=true) is based at /BWEK-Pro/. Local dev, build,
// and preview keep the root base so everything is reachable at "/".
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/BWEK-Pro/' : '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
