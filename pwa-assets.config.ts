import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA icons in public/ from public/icon.svg. Run `npm run icons` after editing it.
// icon.svg already has a dark backdrop and padding, so the maskable icon needs only enough
// extra padding to keep the tile grid inside Android's 80% safe circle, and Apple's none.
const background = '#111113';

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background } },
    apple: { ...preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
