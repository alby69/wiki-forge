import { defineConfig } from 'vite';

// Minimal Vite config for the Wiki-Forge UI.
// The app is a static single-page app: index.html -> /src/index.ts.
// All Markdown sources under wiki/ and raw/ are bundled at build time
// (see src/storage/FileStorage.ts) so no backend is required.
export default defineConfig({
  // `open: false` so the dev server does not try to launch a browser — inside
  // Docker there is no browser, and on the host you open the URL manually.
  server: { host: true, port: 5173, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
});
