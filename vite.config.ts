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
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cards\.scryfall\.io\//,
            handler: 'CacheFirst',
            options: { cacheName: 'card-art', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
});
