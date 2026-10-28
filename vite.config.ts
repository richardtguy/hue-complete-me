/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://<user>.github.io/hue-complete-me/; dev and preview use the same path.
export default defineConfig({
  base: '/hue-complete-me/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
