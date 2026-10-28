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

| Topic          | Decision                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Corner colours | **Daily puzzle**: seeded from the player's local date, so everyone gets the same colours and starting scramble each day (see _Daily puzzle_)                                                                                                                                                                                   |
| Blending       | Bilinear interpolation in **OKLab**                                                                                                                                                                                                                                                                                            |
| Extras         | Win animation, saved progress (localStorage), placement pulse, and **one puzzle a day**: once solved, the board stays locked until the next day. No move counter, timers or grid-size option. Easy ways round the lock (changing the clock, clearing storage) are acceptable; the aim is to encourage mindful play once a day. |
| Hosting        | GitHub Pages via GitHub Actions, as a PWA (manifest and service worker, offline play, add to home screen)                                                                                                                                                                                                                      |

Don't add features outside this list (move counter, timers, sizes, sound, accounts,
analytics, a way to play extra puzzles) unless the user asks.

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
npm run icons      # regenerate PWA icons from public/icon.svg
```

Before you commit, run `npm run lint`, `npm test` and `npm run build`. All three must pass.

## Architecture

```
src/
  main.tsx              React root, PWA registration
  App.tsx               Game state owner: today's puzzle, load/save, day rollover, win
  game/                 Pure TypeScript, no React, fully unit-tested
    colour.ts           sRGB <-> linear <-> OKLab/OKLCH, lerp, gamut mapping, CSS output
    palette.ts          Random contrasting corner generation; tile colour grid
    puzzle.ts           Board model, scramble, swap, isCorrect, isSolved
    storage.ts          Versioned localStorage save/load (wrapped in try/catch)
    random.ts           Seedable PRNG (mulberry32): seeds the daily puzzle; deterministic tests
    daily.ts            Date key, date seed, dailyGame(), countdown and date label helpers
  hooks/
    useDragSwap.ts      Pointer-event drag, hit-testing, FLIP swap animation
    useMinute.ts        Current time to the minute (interval + visibilitychange)
  lib/
    haptics.ts          tap() / success() via the Vibration API (Android)
  components/
    Board.tsx/.css      Grid layout, renders tiles, hosts the drag hook
    Tile.tsx/.css       One tile: colour, "correct" dot, fixed-corner styling
    WinOverlay.tsx/.css Solved card with the countdown to the next puzzle
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
- Pre-compute the 25 solved colours once per game (`generatePalette`) and store them with the save.

### Drag and swap (`useDragSwap.ts`)

- Use Pointer Events only (`pointerdown/move/up/cancel`) with `setPointerCapture`. The board has `touch-action: none` so the page doesn't scroll or zoom while dragging.
- On drag start, lift the tile with `scale(1.08)`, a shadow and a raised z-index. While dragging it follows the pointer through `transform: translate(...)` set directly on the element. Don't call React setState per pointermove, because it causes jank.
- Hit-test the drop target with `positionAt` (in `puzzle.ts`) from the pointer position against the board rect cached at drag start. Don't use `elementFromPoint`, because the dragged tile sits under the finger. The current target tile shrinks to `scale(0.9)` and gets a ring.
- **On drop over a valid, different interior tile**, swap with FLIP:
  1. Record the screen rects of both elements.
  2. Commit the swap inside `flushSync`, so React updates the DOM synchronously, then clear the dragged tile's inline transform and measure both rects again.
  3. Animate each tile from its inverse transform to `none` with the Web Animations API (`el.animate`), using `cubic-bezier(.4,0,.2,1)`. The dragged tile settles from where the finger released it over 300 ms. The displaced tile travels to the vacated slot over **420 ms**, lifting to `scale: 1.06` mid-flight with a shadow, so the player can see the swap happen.
     These timings were lengthened after on-device testing: at 220 ms with a strong ease-out (`.2,.8,.2,1`), tiles covered most of the distance in the first frames and the swap wasn't readable. Keep the displaced tile's motion slow enough to follow.
- **On drop anywhere else** (a corner, outside the board or the same slot), animate the tile back to its home over 320 ms.
- Ignore new drags while a swap or snap-back animation is running. Animations finish through the animation's `finished` promise, which resolves even when nothing moves (unlike `transitionend`). `settle` sets inline `transition: none` while it runs, which cancels any CSS transform transition (such as the target's shrink) that would otherwise override the animation, and clears it afterwards. Cancel cleanly on `pointercancel` or `lostpointercapture`.
- **Drag state lives in `data-*` attributes, not classes**: `data-drag="lifted|settling|displaced"` and `data-target`. React rewrites `className` when a tile re-renders, for example when it becomes correct mid-swap, which would wipe classes added imperatively.
- Respect `prefers-reduced-motion`. Settling animations get 0 ms duration and the lift isn't animated; the tile still follows the finger, because that is direct manipulation.

### Feedback

- **Dot**: a correctly placed interior tile shows a small centred dot, about 14% of the tile width. Choose white or near-black for the dot based on the tile's OKLab L. The dot pops in with a `dot-in` keyframe animation: scale 0 → 1, 300 ms, a slight overshoot, and a 340 ms delay so it lands as the swap animation finishes. Corners show no dot. Mark them as fixed with a subtly different treatment, such as a slightly smaller radius or an inset ring.
- **Placement pulse** (`Tile.css`): when a swap puts a tile in place, it pops (`scale` 1.07 plus a brightness flash, 460 ms) and a ring in the text colour (45%) ripples into the gaps (640 ms). It's the main placement cue on iPhones, which have no web haptics. It starts at **420 ms**, when the swap animations have finished: they also animate `scale` and must never overlap with the pulse. The tile is raised (`z-index: 1`) only while the pulse runs, through the keyframes. It only applies under `.board--live`, which `App` sets after the first swap of a visit, so tiles already in place on a resumed game don't pulse on load.
- **Haptics** (`haptics.ts`): after each swap, `swapOutcome(board, a, b)` (in `puzzle.ts`) returns `'solved' | 'placed' | 'none'`. Call `success()` for solved and `tap()` for placed. These use `navigator.vibrate`: a 12 ms pulse for `tap()` and `[20, 40, 20, 40, 60]` for `success()`. They never throw, and do nothing where unsupported.
  - **No haptics on iOS, by design.** Safari has no Vibration API, and the `<input type="checkbox" switch>` label-click trick doesn't work on current iOS (confirmed on the user's iPhone, and removed). WebKit only plays the switch haptic for a trusted click (`CheckboxInputType::willDispatchClick` checks `state.trusted`), and a script-initiated `label.click()` dispatches an untrusted simulated click (`Element::dispatchSimulatedClick` uses `SimulatedClickSource::Bindings` when the underlying event is untrusted). No other web API triggers iOS haptics. Don't reintroduce it; the placement pulse is the iPhone cue.
- **Win animation** (CSS only, no timers; timings are custom properties on `.board--solved` in `Board.css`): when the board is solved, `Board` gets `board--solved` and locks. After 650 ms, when the last swap has landed, the gap closes to 0 over 500 ms, tiles lose their radius, and dots and corner rings fade, leaving one seamless image. From 1150 ms a diagonal `wave` (scale 1.05 plus brightness) runs across the tiles, staggered by `--diag` (row + col, set per tile) × 40 ms. At 1950 ms `WinOverlay` fades in: a small frosted card **centred over the board** with "Solved", "Today's gradient is complete." and a "New colours in 5h 12m" countdown to local midnight. There's no New game button. It's a card rather than a full overlay so the finished gradient stays visible, and it fits in landscape, where there's no room below the board. The card is `visibility: hidden` until its animation starts, so it can't be tapped early. When the next day's puzzle replaces it, the class is removed and the gaps reopen.

### Daily puzzle (`daily.ts`, `App.tsx`)

- `dateKey(now)` is the player's **local** date as `YYYY-MM-DD`, so each player gets a new puzzle at their own midnight. `seedFor(key)` is a 32-bit FNV-1a hash. `dailyGame(key)` seeds `mulberry32` with it, then runs `generatePalette(rng)` followed by `scramble(rng)`, in that order. Everyone on the same date gets identical colours and starting positions.
  - Changing anything that consumes the RNG (palette generation, scramble, the validation threshold) changes every future day's puzzle, and today's for anyone who hasn't started it yet. That's fine, but keep it in mind.
  - Palette validation compares floating-point ΔE values against a threshold. In theory, a browser whose `Math.cbrt` or `Math.pow` differs in the last bit could land on the other side of the threshold and get a different palette. This is vanishingly unlikely, so it's accepted.
- **The game is locked once solved:** there's no New game button. `App` resumes the save if its `date` is today, whether solved or not. Otherwise it starts `dailyGame(today)`. A solved board stays locked, showing the overlay with "New colours in …" until the date changes.
- **Day rollover:** `useMinute()` re-renders at least every 15 s and on `visibilitychange`. If the current game is solved and `game.date !== today`, `App` replaces it with the new day's puzzle during render (a guarded state update). An **unsolved** puzzle from yesterday can be finished in the open session, and the next load starts today's.
- The header shows the puzzle's date (`dateLabel`, e.g. "Wed 28 Oct"), not the current date.
- `live` (set after the first swap of a visit) separates a solve during this visit from a day solved on an earlier visit. Reopening a solved day shows the finished gradient and the card at once (`.board--solved:not(.board--live)` disables the wave; `WinOverlay immediate` skips the fade-in delay).

### Persistence (`storage.ts`)

- The localStorage key is `hue-complete-me:v2`. The value is `{ version: 2, date, colours, board }`. `saveGame` deletes the old `hue-complete-me:v1` key (from before the daily puzzle). `colours` holds the 25 solved OKLab colours (not just the corners), so a resumed game looks identical even if the palette code changes. `solved` isn't stored, because it's derived from `board`.
- `storage.ts` stays free of DOM globals. `loadGame(storage)` and `saveGame(storage, game)` take a `Storage | undefined`, and `App` passes `window.localStorage`, using `undefined` if even accessing it throws.
- `parseSave` validates everything: the version, a `YYYY-MM-DD` date, 25 finite OKLab colours, and a board that is a permutation of 0–24 with the corners in place. Anything else returns `null`.
- `App` saves in an effect whenever `game` changes, which covers every swap and day rollover. On startup it resumes the save if it's for today (solved or not), and otherwise starts today's puzzle.
- `loadGame` and `saveGame` never throw. Private mode, blocked storage or a full quota just means no saving.

## UI and visual design

- Use a mobile-first, full-viewport layout with `height: 100dvh` and `env(safe-area-inset-*)` padding. Set `overscroll-behavior: none` to stop pull-to-refresh, and disable `user-select` and the iOS tap highlight and callout.
- Size the board as a square: `min(100vw, 100dvh - header) - gutters`, capped at 520px on desktop and **rounded down to a multiple of 5px** (`round()`, behind `@supports`), so that with no gap each tile is whole pixels and the solved board has no sub-pixel seams. Use a small gap between tiles (about 1.5% of board width) and slightly rounded corners.
- Use a quiet neutral background (near-black in dark mode, off-white in light mode, following `prefers-color-scheme`) so the tile colours carry the design. Keep chrome to a minimal title and the puzzle's date.
- The viewport meta tag should include `viewport-fit=cover`. Set `theme-color` for both schemes.
- Accessibility: the board is a `role="group"`, and each tile is a `role="img"` with an `aria-label` giving its row, column and whether it's in place. (ARIA `gridcell`s must sit inside `row` elements, which would force tiles to change parents when they move between rows. That rules them out; see _Rendering_ below.) Animations respect reduced motion. (Keyboard swapping is a possible later addition and isn't in scope.)

## PWA and deployment

- Live at **https://richardtguy.github.io/hue-complete-me/**. The Vite `base` is `/hue-complete-me/` in every mode, including dev and preview.
- `vite-plugin-pwa` (in `vite.config.ts`) uses `registerType: 'autoUpdate'` and `injectRegister: 'auto'`, which injects `registerSW.js` into `index.html`, so there's no registration code in `main.tsx`. The manifest is `standalone`, `portrait`, with theme and background `#111113`. The plugin's default precache glob (`js`, `css`, `html`) plus `includeAssets` and the manifest icons covers every file. Don't add a `workbox.globPatterns` that overlaps them, because that duplicates precache entries. The service worker only exists in production builds, so test offline behaviour with `npm run build && npm run preview`.
- **Icons**: `public/icon.svg` is the single source: a 3×3 OKLab gradient mini-board on `#111113`, drawn with the game's own palette logic. It also serves as the SVG favicon. `npm run icons` (`@vite-pwa/assets-generator`, configured in `pwa-assets.config.ts`) regenerates `pwa-64/192/512`, `maskable-icon-512x512` (10% padding, so the grid stays inside Android's 80% safe circle), `apple-touch-icon-180x180` (no padding) and `favicon.ico`. Commit the generated PNGs.
- **Workflow** (`.github/workflows/deploy.yml`, "CI and deploy"): every pull request and every push to `main` runs `npm ci`, lint, test and build on Node 22. Only pushes to `main` (or a manual run on `main`) upload `dist/` and deploy with `actions/deploy-pages`. Deploys don't cancel each other (concurrency group `pages`). Pages must be set to **Source: GitHub Actions** in the repository settings (done).
- Actions are pinned to major versions: checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5.

## Build plan (milestones)

1. **Scaffold**: Vite React-TS, ESLint, Prettier, Vitest, global styles, viewport meta, empty `App`.
2. **Game logic**: `random.ts`, `colour.ts`, `palette.ts`, `puzzle.ts`, with unit tests covering OKLab round-trips, gamut mapping, corner contrast validation, scramble invariants (corners fixed, no interior tile starting correct, the result is a permutation), swap and solved detection.
3. **Static board**: render a scrambled board with correct colours, layout and corner styling. Dots on correct tiles.
4. **Drag and swap**: `useDragSwap` with lift, follow, target highlight, FLIP swap animation, snap-back and reduced motion.
5. **Feedback**: haptics module and its wiring, dot animation.
6. **Win state**: solved detection, seamless gradient and wave animation, overlay, new game. (New game was later replaced by the daily puzzle lock.)
7. **Persistence**: storage module, resume on reload.
8. **PWA and deploy**: plugin config, icons, Pages workflow, offline check.
9. **Polish**: test on real iOS and Android devices, tune the contrast threshold and animation timings, check against Lighthouse PWA and performance.

## Conventions

- TypeScript strict mode, no `any`. Use named exports, except components, which may use default exports.
- Keep functions in `src/game/` pure and deterministic given an RNG. Pass `rng` in and never call `Math.random` directly there.
- Use British spelling in user-facing text and in identifiers (`colour`), consistently.
- Keep dependencies minimal. Ask before adding a runtime dependency.
