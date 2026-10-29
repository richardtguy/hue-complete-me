import { useEffect, useState } from 'react';
import { formatDuration, readStopwatch, type Stopwatch } from '../game/timer.ts';

/** The puzzle's elapsed time, ticking while the stopwatch runs. Re-renders only itself. */
export default function Clock({ stopwatch }: { stopwatch: Stopwatch }) {
  const running = stopwatch.runningSince !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);
  return (
    <span className="app__clock" role="timer" aria-label="Time">
      {formatDuration(readStopwatch(stopwatch, now))}
    </span>
  );
}
