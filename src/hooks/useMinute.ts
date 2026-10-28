import { useSyncExternalStore } from 'react';

// Re-checks often enough to catch the minute changing, and straight away when the app
// returns to the foreground (phones suspend timers in the background).
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onChange);
  };
}

const currentMinute = () => Math.floor(Date.now() / 60_000);

/** The current time, truncated to the minute, as a `Date`. Re-renders when it changes. */
export function useMinute(): Date {
  return new Date(useSyncExternalStore(subscribe, currentMinute) * 60_000);
}
