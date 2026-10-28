import { useCallback, useState } from 'react';
import Board from './components/Board.tsx';
import WinOverlay from './components/WinOverlay.tsx';
import type { Oklab } from './game/colour.ts';
import { generatePalette } from './game/palette.ts';
import { type Board as BoardState, isSolved, scramble, swap, swapOutcome } from './game/puzzle.ts';
import { mulberry32 } from './game/random.ts';
import { success, tap } from './lib/haptics.ts';
import './App.css';

interface Game {
  colours: Oklab[];
  board: BoardState;
}

function newGame(): Game {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const rng = mulberry32(seed);
  const { colours } = generatePalette(rng);
  return { colours, board: scramble(rng) };
}

export default function App() {
  const [game, setGame] = useState(newGame);
  const solved = isSolved(game.board);
  const startNewGame = () => setGame(newGame());
  const handleSwap = useCallback(
    (a: number, b: number) => {
      const board = swap(game.board, a, b);
      setGame({ ...game, board });
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
        <button
          type="button"
          className="app__icon-button"
          aria-label="New game"
          onClick={startNewGame}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <main className="app__main">
        <div className="app__stage">
          <Board board={game.board} colours={game.colours} onSwap={handleSwap} solved={solved} />
          {solved && <WinOverlay onNewGame={startNewGame} />}
        </div>
      </main>
    </div>
  );
}
