import { useCallback, useEffect, useState } from 'react';
import Board from './components/Board.tsx';
import WinOverlay from './components/WinOverlay.tsx';
import { dailyGame, dateKey, dateLabel, msUntilNextDay } from './game/daily.ts';
import { isSolved, swap, swapOutcome } from './game/puzzle.ts';
import { type Game, loadGame, saveGame } from './game/storage.ts';
import { useMinute } from './hooks/useMinute.ts';
import { success, tap } from './lib/haptics.ts';
import './App.css';

/** localStorage, or undefined where even accessing it throws (some privacy modes). */
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Resumes today's game if there is one (solved or not); otherwise starts today's puzzle. */
function initialGame(today: string): Game {
  const saved = loadGame(storage());
  return saved?.date === today ? saved : dailyGame(today);
}

export default function App() {
  const now = useMinute();
  const today = dateKey(now);
  const [game, setGame] = useState(() => initialGame(today));
  // True once the player has swapped this visit: tiles already in place on a resumed game
  // don't pulse, and a game solved on an earlier visit shows its result without replaying
  // the win sequence.
  const [live, setLive] = useState(false);
  useEffect(() => saveGame(storage(), game), [game]);
  const solved = isSolved(game.board);

  // Once today's puzzle is solved the board stays locked until the date changes, then the
  // next day's puzzle replaces it (even if the app was left open overnight). An unsolved
  // puzzle can be finished in this session; the next load starts the new day's.
  if (solved && game.date !== today) {
    setGame(dailyGame(today));
    setLive(false);
  }

  const handleSwap = useCallback(
    (a: number, b: number) => {
      const board = swap(game.board, a, b);
      setGame({ ...game, board });
      setLive(true);
      // Called from the pointerup handler, so haptics run inside the user gesture.
      const outcome = swapOutcome(board, a, b);
      if (outcome === 'solved') success();
      else if (outcome === 'placed') tap();
    },
    [game],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Hue Complete Me</h1>
        <p className="app__date">
          <time dateTime={game.date}>{dateLabel(game.date)}</time>
        </p>
      </header>
      <main className="app__main">
        <div className="app__stage">
          <Board
            board={game.board}
            colours={game.colours}
            onSwap={handleSwap}
            solved={solved}
            live={live}
          />
          {solved && <WinOverlay msUntilNext={msUntilNextDay(now)} immediate={!live} />}
        </div>
      </main>
    </div>
  );
}
