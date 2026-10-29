/**
 * A pausable stopwatch: time banked so far, plus the start of the running stretch (if any).
 * Times are epoch milliseconds (`Date.now()`), passed in so this stays pure.
 */
export interface Stopwatch {
  elapsedMs: number;
  /** When the current running stretch began, or null while paused. */
  runningSince: number | null;
}

/** Total elapsed time at `now`. A clock that jumps backwards never makes time negative. */
export function readStopwatch({ elapsedMs, runningSince }: Stopwatch, now: number): number {
  return elapsedMs + (runningSince === null ? 0 : Math.max(0, now - runningSince));
}

export function pauseStopwatch(sw: Stopwatch, now: number): Stopwatch {
  return sw.runningSince === null ? sw : { elapsedMs: readStopwatch(sw, now), runningSince: null };
}

export function resumeStopwatch(sw: Stopwatch, now: number): Stopwatch {
  return sw.runningSince === null ? { ...sw, runningSince: now } : sw;
}

/** Elapsed time as "0:07", "12:34" or "1:02:03" (whole seconds, rounded down). */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
