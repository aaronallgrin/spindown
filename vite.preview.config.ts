// One-file build for a quick preview link (no offline support, no service worker).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  define: { __BUILD_DATE__: JSON.stringify('preview') },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist-preview', assetsInlineLimit: 100_000_000 },
});
