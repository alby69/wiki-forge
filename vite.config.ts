import { defineConfig } from 'vite';

// Minimal Vite config for the Wiki-Forge UI.
// The app is a static single-page app: index.html -> /src/index.ts.
// All Markdown sources under wiki/ and raw/ are bundled at build time
// (see src/storage/FileStorage.ts) so no backend is required.
export default defineConfig({
  server: { port: 5173, open: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
