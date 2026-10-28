/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/hue-complete-me/; dev and preview use the same path.
export default defineConfig({
  base: '/hue-complete-me/',
  plugins: [
    react(),
    // Precaches the whole app so it works offline, and updates silently on the next visit.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/hue-complete-me/',
        name: 'Hue Complete Me',
        short_name: 'Hue',
        description: 'A calm colour-gradient puzzle. Swap tiles to complete the hue.',
        lang: 'en-GB',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#111113',
        background_color: '#111113',
        // Generated from public/icon.svg by `npm run icons`.
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
