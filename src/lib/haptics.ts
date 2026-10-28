// Haptic feedback, best-effort. Never throws; does nothing where unsupported.
//
// - Android Chrome and others: the Vibration API.
// - iOS Safari has no Vibration API, but since iOS 18 toggling an
//   `<input type="checkbox" switch>` plays the system haptic, including when its label is
//   clicked from script during a user gesture.

const TAP_MS = 12;
const SUCCESS_PATTERN = [20, 40, 20, 40, 60];
/** iOS can only play fixed ticks, so success is a short burst of them. */
const IOS_SUCCESS_TICKS = 3;
const IOS_TICK_GAP_MS = 90;

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function hasSwitchInput(): boolean {
  return typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
}

function iosTick() {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  label.style.display = 'none';
  label.setAttribute('aria-hidden', 'true');
  document.head.appendChild(label);
  label.click();
  label.remove();
}

function safely(fn: () => void) {
  try {
    fn();
  } catch {
    // Haptics are a nicety; ignore any failure.
  }
}

/** A light tick: a tile landed in its correct place. */
export function tap() {
  safely(() => {
    if (canVibrate()) navigator.vibrate(TAP_MS);
    else if (hasSwitchInput()) iosTick();
  });
}

/** A celebratory pattern: the puzzle is solved. */
export function success() {
  safely(() => {
    if (canVibrate()) navigator.vibrate(SUCCESS_PATTERN);
    else if (hasSwitchInput()) {
      iosTick();
      for (let i = 1; i < IOS_SUCCESS_TICKS; i++) {
        window.setTimeout(() => safely(iosTick), i * IOS_TICK_GAP_MS);
      }
    }
  });
}
