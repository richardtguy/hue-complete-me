# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Hue Complete Me** is a colour-gradient puzzle for mobile browsers. It is a static
single-page React app with no server side, deployed to GitHub Pages as an
installable, offline-capable PWA.

The board is a 5×5 grid. The four corner tiles are fixed and have contrasting
colours. Each interior tile's colour is a 2D blend of the four corners. Interior
tiles start scrambled, and the player drags tiles to swap them until every tile is
in place.

## Decisions (agreed with the user)

| Topic          | Decision                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Corner colours | Random each game, with guaranteed contrast (see _Palette generation_)                                     |
| Blending       | Bilinear interpolation in **OKLab**                                                                       |
| Extras         | Win animation and saved progress (localStorage). No move counter and no grid-size option for now.         |
| Hosting        | GitHub Pages via GitHub Actions, as a PWA (manifest and service worker, offline play, add to home screen) |

Don't add features outside this list (move counter, timers, sizes, sound, accounts,
analytics) unless the user asks.

## Tech stack

- **Vite 8 + React 19 + TypeScript 6.0** (strict mode, `noUncheckedIndexedAccess`)
  - TypeScript is pinned to `~6.0` because typescript-eslint doesn't support TS 7 yet. Don't bump it until typescript-eslint does.
- Plain CSS with custom properties (one global stylesheet plus a CSS file per component). No UI framework.
- **No drag or animation libraries.** Use Pointer Events and CSS transforms/transitions with FLIP.
- **vite-plugin-pwa** for the manifest and the Workbox service worker
- **Vitest** for unit tests of the pure game logic
- ESLint (flat config: typescript-eslint, react-hooks, react-refresh) and Prettier (single quotes, width 100)
- Write only the **unprefixed** form of CSS properties that need vendor prefixes, such as `backdrop-filter`. Vite's CSS minifier adds the prefixes. If you write both forms, it keeps only the `-webkit-` one, which Chrome ignores.
- npm as the package manager
  - npm 10 crashes (`reading 'edgesOut'`) when adding vitest 4. Run `npx npm@11 install ...` to add or upgrade dev dependencies. `npm ci` and `npm install` from the lockfile work with npm 10.

## Commands

```bash
npm install
npm run dev        # Vite dev server at http://localhost:5173/hue-complete-me/ (--host for LAN)
npm run build      # type-check + production build to dist/
npm run preview    # serve dist/ locally
npm test           # vitest run
npm run lint       # eslint + prettier --check
npm run format     # prettier --write
```

Before you commit, run `npm run lint`, `npm test` and `npm run build`. All three must pass.

## Architecture

```
src/
  main.tsx              React root, PWA registration
  App.tsx               Game state owner: new game, load/save, win detection
  game/                 Pure TypeScript, no React, fully unit-tested
    colour.ts           sRGB <-> linear <-> OKLab/OKLCH, lerp, gamut mapping, CSS output
    palette.ts          Random contrasting corner generation; tile colour grid
    puzzle.ts           Board model, scramble, swap, isCorrect, isSolved
    storage.ts          Versioned localStorage save/load (wrapped in try/catch)
    random.ts           Seedable PRNG (mulberry32) so tests are deterministic
  hooks/
    useDragSwap.ts      Pointer-event drag, hit-testing, FLIP swap animation
  lib/
    haptics.ts          tap() / success() with progressive enhancement
  components/
    Board.tsx/.css      Grid layout, renders tiles, hosts the drag hook
    Tile.tsx/.css       One tile: colour, "correct" dot, fixed-corner styling
    WinOverlay.tsx/.css Solved state + "New game"
  styles/global.css     Reset, viewport, theme tokens
```

Keep game logic in `src/game/` free of React and DOM APIs. Components stay thin.

### Rendering (`Board.tsx`)

- Tiles are rendered in **tile-id order** (keyed by tile id) and placed with `grid-row` / `grid-column` from their current position. When a tile moves, only its grid coordinates change, so its DOM element stays the same. FLIP animation and `setPointerCapture` both depend on this, so don't render tiles in position order.
- Tile colours come from the per-game `colours` array (indexed by tile id). The dot and the corner ring use `--ink`, which is white or dark depending on `needsDarkInk(colour)` (OKLab L > 0.68).

### Board model (`puzzle.ts`)

- `N = 5`. Positions are indices `0..24` in row-major order: `row = Math.floor(i / N)`, `col = i % N`.
- Each tile's identity is its **solved index**. The board is `number[]` of length 25, where `board[pos] = tileId`.
- A tile is correct when `board[pos] === pos`. The board is solved when every tile is correct.
- Corner positions `{0, 4, 20, 24}` are fixed. They can't be dragged and aren't valid drop targets.
- `scramble(rng)`: Fisher–Yates over the 21 interior tiles, then repair any fixed points by swapping with a neighbour in the shuffled list. No interior tile may start in its correct place.
- `swap(board, a, b)` returns a new array. Never mutate state.

### Colour (`colour.ts`, `palette.ts`)

- Convert corners to OKLab. For the tile at `(r, c)` use `u = c/(N-1)`, `v = r/(N-1)`:
  `top = lerp(TL, TR, u)`, `bottom = lerp(BL, BR, u)`, `colour = lerp(top, bottom, v)`.
- Convert back to sRGB for display. Clamp out-of-gamut colours by reducing OKLCH chroma at constant L and h, not by naively clipping channels.
- **Palette generation** (`randomCorners(rng)`):
  - Choose a random base hue and place the four corners about 90° apart (±20° jitter), **in order around the square** (TL→TR→BR→BL), with a random starting corner and direction. Diagonal lightness cancels along the middle row and column, so hue is the only difference there. Other arrangements can cancel the hue difference too and leave identical neighbours: only about 34% of random arrangements pass validation, against about 99% for cyclic ones.
  - Vary lightness across the corners: one diagonal pair lighter (L ≈ 0.75–0.88) and the other darker (L ≈ 0.45–0.6). This gives the grid a luminance gradient as well as a hue gradient.
  - Use chroma that is as high as fits in gamut, around 0.10–0.18.
  - Validate the result. Compute the OKLab ΔE between every pair of horizontally and vertically adjacent tiles. If the minimum is below `MIN_NEIGHBOUR_DELTA_E` (0.03, to be tuned by eye in milestone 9), regenerate, up to 50 attempts, keeping the best. The puzzle must be solvable by eye. Typical minimum ΔE is about 0.04, limited by the hue-only steps in the middle row and column.
- Pre-compute the 25 solved colours once per game and store them with the save.

### Drag and swap (`useDragSwap.ts`)

- Use Pointer Events only (`pointerdown/move/up/cancel`) with `setPointerCapture`. The board has `touch-action: none` so the page doesn't scroll or zoom while dragging.
- On drag start, lift the tile with `scale(1.08)`, a shadow and a raised z-index. While dragging it follows the pointer through `transform: translate(...)` set directly on the element. Don't call React setState per pointermove, because it causes jank.
- Hit-test the drop target with `positionAt` (in `puzzle.ts`) from the pointer position against the board rect cached at drag start. Don't use `elementFromPoint`, because the dragged tile sits under the finger. The current target tile shrinks to `scale(0.9)` and gets a ring.
- **On drop over a valid, different interior tile**, swap with FLIP:
  1. Record the screen rects of both elements.
  2. Commit the swap inside `flushSync`, so React updates the DOM synchronously, then clear the dragged tile's inline transform and measure both rects again.
  3. Apply the inverse transforms and transition to `transform: none` over 220 ms with `cubic-bezier(.2,.8,.2,1)`.
     The dragged tile settles from where the finger released it, and the displaced tile glides to the vacated slot.
- **On drop anywhere else** (a corner, outside the board or the same slot), animate the tile back to its home.
- Ignore new drags while a swap or snap-back animation is running. Animations end on a timer, not `transitionend`, which doesn't fire when nothing moves. Cancel cleanly on `pointercancel` or `lostpointercapture`.
- **Drag state lives in `data-*` attributes, not classes**: `data-drag="lifted|settling|displaced"` and `data-target`. React rewrites `className` when a tile re-renders, for example when it becomes correct mid-swap, which would wipe classes added imperatively.
- Respect `prefers-reduced-motion`. Settling is instant (0 ms) and the lift isn't animated; the tile still follows the finger, because that is direct manipulation.

### Feedback

- **Dot**: a correctly placed interior tile shows a small centred dot, about 14% of the tile width. Choose white or near-black for the dot based on the tile's OKLab L. The dot pops in with a `dot-in` keyframe animation: scale 0 → 1, 280 ms, a slight overshoot, and a 120 ms delay so it lands as the swap animation finishes. Corners show no dot. Mark them as fixed with a subtly different treatment, such as a slightly smaller radius or an inset ring.
- **Haptics** (`haptics.ts`): after each swap, `swapOutcome(board, a, b)` (in `puzzle.ts`) returns `'solved' | 'placed' | 'none'`. Call `success()` for solved and `tap()` for placed. `App.handleSwap` makes these calls, and it runs from the pointerup handler (through `flushSync`), so the haptics fire inside the user gesture. Keep it that way, because iOS ignores the switch trick outside a gesture.
  - Use `navigator.vibrate` where it exists (Android Chrome). Use a short pulse of about 12 ms for `tap()` and a pattern such as `[20, 40, 20, 40, 60]` for `success()`.
  - iOS Safari has no Vibration API. As best-effort progressive enhancement, when `'switch' in HTMLInputElement.prototype`, create a `display: none` `<label>` wrapping an `<input type="checkbox" switch>`, append it to `<head>`, click the label, and remove it. This plays the system haptic on iOS 18+. `success()` on iOS is three ticks 90 ms apart. Never throw, and accept no haptics on unsupported browsers.
- **Win animation** (CSS only, no timers; timings are custom properties on `.board--solved` in `Board.css`): when the board is solved, `Board` gets `board--solved` and locks. After 400 ms, when the last swap has landed, the gap closes to 0 over 500 ms, tiles lose their radius, and dots and corner rings fade, leaving one seamless image. From 900 ms a diagonal `wave` (scale 1.05 plus brightness) runs across the tiles, staggered by `--diag` (row + col, set per tile) × 40 ms. At 1700 ms `WinOverlay` fades in: a small frosted card **centred over the board** with "Solved" and **New game**. It's a card rather than a full overlay so the finished gradient stays visible, and it fits in landscape, where there's no room below the board. The card is `visibility: hidden` until its animation starts, so it can't be tapped early. Starting a new game removes the class, and the gaps reopen.

### Persistence (`storage.ts`)

- The localStorage key is `hue-complete-me:v1`. The value is `{ version: 1, corners, board, solved }`.
- Save after every swap and on new game. Load on startup and validate the shape. On any error or mismatch, start a fresh game.
- Wrap every storage access in try/catch, because private mode or blocked storage can throw.

## UI and visual design

- Use a mobile-first, full-viewport layout with `height: 100dvh` and `env(safe-area-inset-*)` padding. Set `overscroll-behavior: none` to stop pull-to-refresh, and disable `user-select` and the iOS tap highlight and callout.
- Size the board as a square: `min(100vw, 100dvh - header) - gutters`, capped at 520px on desktop and **rounded down to a multiple of 5px** (`round()`, behind `@supports`), so that with no gap each tile is whole pixels and the solved board has no sub-pixel seams. Use a small gap between tiles (about 1.5% of board width) and slightly rounded corners.
- Use a quiet neutral background (near-black in dark mode, off-white in light mode, following `prefers-color-scheme`) so the tile colours carry the design. Keep chrome to a minimal title and a "New game" icon button.
- The viewport meta tag should include `viewport-fit=cover`. Set `theme-color` for both schemes.
- Accessibility: the board is a `role="group"`, and each tile is a `role="img"` with an `aria-label` giving its row, column and whether it's in place. (ARIA `gridcell`s must sit inside `row` elements, which would force tiles to change parents when they move between rows. That rules them out; see _Rendering_ below.) Animations respect reduced motion. (Keyboard swapping is a possible later addition and isn't in scope.)

## PWA and deployment

- The Vite `base` is `/hue-complete-me/` for GitHub Pages builds.
- Configure `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest (name, short_name, `display: standalone`, `orientation: portrait`, theme and background colours) and icons at 192, 512 and maskable 512 in `public/`. Generate the icons from a single SVG of a 2×2 gradient tile motif.
- `.github/workflows/deploy.yml` runs on push to `main`: install, lint, test, build, then `actions/upload-pages-artifact` and `actions/deploy-pages`.

## Build plan (milestones)

1. **Scaffold**: Vite React-TS, ESLint, Prettier, Vitest, global styles, viewport meta, empty `App`.
2. **Game logic**: `random.ts`, `colour.ts`, `palette.ts`, `puzzle.ts`, with unit tests covering OKLab round-trips, gamut mapping, corner contrast validation, scramble invariants (corners fixed, no interior tile starting correct, the result is a permutation), swap and solved detection.
3. **Static board**: render a scrambled board with correct colours, layout and corner styling. Dots on correct tiles.
4. **Drag and swap**: `useDragSwap` with lift, follow, target highlight, FLIP swap animation, snap-back and reduced motion.
5. **Feedback**: haptics module and its wiring, dot animation.
6. **Win state**: solved detection, seamless gradient and wave animation, overlay, new game.
7. **Persistence**: storage module, resume on reload.
8. **PWA and deploy**: plugin config, icons, Pages workflow, offline check.
9. **Polish**: test on real iOS and Android devices, tune the contrast threshold and animation timings, check against Lighthouse PWA and performance.

## Conventions

- TypeScript strict mode, no `any`. Use named exports, except components, which may use default exports.
- Keep functions in `src/game/` pure and deterministic given an RNG. Pass `rng` in and never call `Math.random` directly there.
- Use British spelling in user-facing text and in identifiers (`colour`), consistently.
- Keep dependencies minimal. Ask before adding a runtime dependency.
