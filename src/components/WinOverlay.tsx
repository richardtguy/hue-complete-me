import './WinOverlay.css';

interface WinOverlayProps {
  onNewGame: () => void;
}

export default function WinOverlay({ onNewGame }: WinOverlayProps) {
  return (
    <div className="win-overlay">
      <div className="win-overlay__card">
        <p className="win-overlay__title" role="status">
          Solved
        </p>
        <button type="button" className="win-overlay__button" onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  );
}
