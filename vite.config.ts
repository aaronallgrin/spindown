import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// the version shown on Home is the date of the latest deploy, Philadelphia time
const buildDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replaceAll('-', '_');

export default defineConfig({
  base: './',
  define: { __BUILD_DATE__: JSON.stringify(buildDate) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Spindown',
        short_name: 'Spindown',
        description: 'Magic: The Gathering life counter with game history and stats',
        theme_color: '#1b1b1b',
        background_color: '#1b1b1b',
        display: 'fullscreen',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the SQL engine (wasm) is only for Query, so it's cached the first time Query opens
        // instead of on install; everything else, rules included, works offline from the start
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'sql-engine', expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: /^https:\/\/cards\.scryfall\.io\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-art',
              // the art loads as a CSS background, which is a no-cors (opaque, status 0) request;
              // without status 0 here Workbox never stores it and the art is missing offline
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
});
