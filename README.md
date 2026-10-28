# Hue Complete Me

**Play: https://richardtguy.github.io/hue-complete-me/**

A calm colour-gradient puzzle for your phone.

The board is a 5×5 grid. The four corner tiles are fixed, each a different, contrasting colour. Every other tile belongs somewhere on the smooth gradient that blends between those corners, but the tiles start scrambled. Drag tiles to swap them until the whole gradient falls into place.

## How to play

- **Drag** any non-corner tile onto another to swap the two. They animate into each other's places.
- A tile in its **correct position** shows a small **dot** in its centre, and your phone gives a little haptic tap.
- The four **corners never move**. Use them as anchors and work inwards.
- When every tile is in place, the gaps close and the board becomes one seamless gradient. Tap **New game** for a fresh palette.

Every game has new, randomly generated corner colours. Your progress is saved automatically, so you can close the tab and carry on later. You can also install the game to your home screen and play offline.

## Features

- Random four-corner palettes with guaranteed contrast, blended in the perceptual **OKLab** colour space for smooth, even steps
- Touch-first drag-to-swap with smooth swap animations
- Haptic feedback on Android through the Vibration API, with best-effort support on iOS 18+
- Correct-tile dots and a celebratory solve animation
- Auto-saved progress (localStorage)
- Installable PWA that works offline
- Respects `prefers-reduced-motion` and light/dark colour schemes

## Tech

Static single-page app with no backend.

- [React](https://react.dev/) + TypeScript
- [Vite](https://vitejs.dev/) with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Vitest](https://vitest.dev/) for unit tests
- Pointer Events and CSS transforms for drag and animation, with no extra libraries

## Development

Requires Node.js 22 (or 20.19+).

```bash
npm install
npm run dev          # start the dev server
npm run dev -- --host  # expose on your LAN to test on a phone
npm test             # run unit tests
npm run lint         # lint
npm run build        # production build to dist/
npm run preview      # preview the production build
npm run icons        # regenerate the PWA icons from public/icon.svg
```

Haptics and the PWA install prompt need a real device. The service worker only runs in the production build (`npm run build && npm run preview`).

## Project structure

```
src/
  game/        pure puzzle logic: colour maths, palettes, board model, storage
  hooks/       useDragSwap: pointer drag + FLIP swap animation
  lib/         haptics
  components/  Board, Tile, WinOverlay
  styles/      global styles and theme tokens
```

See [CLAUDE.md](./CLAUDE.md) for the detailed design and build plan.

## Deployment

`.github/workflows/deploy.yml` runs lint, tests and a build on every pull request. Each push to `main` is also deployed to **GitHub Pages** (repository settings → Pages → Source: **GitHub Actions**). The site is served from `/hue-complete-me/`.

## Roadmap

1. Scaffold the project and tooling
2. Game logic and unit tests
3. Static board rendering
4. Drag-to-swap with animation
5. Haptics and correct-tile dots
6. Win state and animation
7. Saved progress
8. PWA and GitHub Pages deployment
9. On-device polish and tuning
