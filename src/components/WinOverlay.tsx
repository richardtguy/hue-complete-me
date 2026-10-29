import { formatCountdown } from '../game/daily.ts';
import { formatDuration } from '../game/timer.ts';
import './Overlay.css';

interface WinOverlayProps {
  /** Time taken to solve, or null for a game finished before the timer existed. */
  elapsedMs: number | null;
  /** Time until tomorrow's puzzle unlocks. */
  msUntilNext: number;
  /** Show at once, without waiting for the win sequence (e.g. reopening a solved day). */
  immediate: boolean;
}

export default function WinOverlay({ elapsedMs, msUntilNext, immediate }: WinOverlayProps) {
  return (
    <div className="overlay">
      <div className={immediate ? 'overlay__card' : 'overlay__card overlay__card--after-win'}>
        <p className="overlay__title" role="status">
          Solved
        </p>
        <p className="overlay__text">
          {elapsedMs === null
            ? 'Today’s gradient is complete.'
            : `Today’s gradient took ${formatDuration(elapsedMs)}.`}
        </p>
        <p className="overlay__pill">New colours in {formatCountdown(msUntilNext)}</p>
      </div>
    </div>
  );
}
