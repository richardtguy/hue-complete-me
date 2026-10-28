// Haptic feedback through the Vibration API (Android Chrome and others). Never throws; does
// nothing where unsupported.
//
// iOS Safari has no way for a web page to trigger haptics: the switch-input trick needs a
// trusted click, and WebKit marks script-initiated clicks untrusted. iPhone players get the
// visual placement pulse instead (Tile.css).

const TAP_MS = 12;
const SUCCESS_PATTERN = [20, 40, 20, 40, 60];

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are a nicety; ignore any failure.
  }
}

/** A light tick: a tile landed in its correct place. */
export function tap() {
  vibrate(TAP_MS);
}

/** A celebratory pattern: the puzzle is solved. */
export function success() {
  vibrate(SUCCESS_PATTERN);
}
