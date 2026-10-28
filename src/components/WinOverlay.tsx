import { formatCountdown } from '../game/daily.ts';
import './WinOverlay.css';

interface WinOverlayProps {
  /** Time until tomorrow's puzzle unlocks. */
  msUntilNext: number;
  /** Show at once, without waiting for the win sequence (e.g. reopening a solved day). */
  immediate: boolean;
}

export default function WinOverlay({ msUntilNext, immediate }: WinOverlayProps) {
  return (
    <div className="win-overlay">
      <div
        className={
          immediate ? 'win-overlay__card win-overlay__card--immediate' : 'win-overlay__card'
        }
      >
        <p className="win-overlay__title" role="status">
          Solved
        </p>
        <p className="win-overlay__text">Today’s gradient is complete.</p>
        <p className="win-overlay__next">New colours in {formatCountdown(msUntilNext)}</p>
      </div>
    </div>
  );
}
