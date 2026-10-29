import { dateLabel } from '../game/daily.ts';
import './Overlay.css';

interface StartOverlayProps {
  /** The puzzle's date key. */
  date: string;
  onStart: () => void;
}

/** Shown over the hidden board until the player starts today's puzzle and its timer. */
export default function StartOverlay({ date, onStart }: StartOverlayProps) {
  return (
    <div className="overlay">
      <div className="overlay__card">
        <p className="overlay__eyebrow">{dateLabel(date)}</p>
        <button type="button" className="overlay__button" onClick={onStart}>
          Start
        </button>
        <p className="overlay__text">The timer pauses whenever you leave the app.</p>
      </div>
    </div>
  );
}
