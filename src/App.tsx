import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Board from './components/Board.tsx';
import Clock from './components/Clock.tsx';
import StartOverlay from './components/StartOverlay.tsx';
import WinOverlay from './components/WinOverlay.tsx';
import { dailyGame, dateKey, dateLabel, msUntilNextDay } from './game/daily.ts';
import { isSolved, swap, swapOutcome } from './game/puzzle.ts';
import { type Game, loadGame, saveGame } from './game/storage.ts';
import { pauseStopwatch } from './game/timer.ts';
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

/**
 * The game plus when its timer's current running stretch began. `runningSince` isn't saved:
 * time only counts while the app is open and in the foreground, and `game.elapsedMs` banks
 * it whenever the timer pauses, a swap is made or the page is hidden.
 */
interface Session {
  game: Game;
  runningSince: number | null;
}

const isVisible = () => document.visibilityState === 'visible';
const isTiming = (game: Game) => game.started && !isSolved(game.board);

/** Resumes today's game if there is one (solved or not); otherwise starts today's puzzle. */
function initialSession(today: string): Session {
  const saved = loadGame(storage());
  const game = saved?.date === today ? saved : dailyGame(today);
  return { game, runningSince: isTiming(game) && isVisible() ? Date.now() : null };
}

/** Banks the running stretch into the game's elapsed time and pauses the timer. */
function pause({ game, runningSince }: Session, now: number): Session {
  const sw = pauseStopwatch({ elapsedMs: game.elapsedMs, runningSince }, now);
  return { game: { ...game, elapsedMs: sw.elapsedMs }, runningSince: null };
}

export default function App() {
  const now = useMinute();
  const today = dateKey(now);
  const [session, setSession] = useState(() => initialSession(today));
  const { game, runningSince } = session;
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
    setSession({ game: dailyGame(today), runningSince: null });
    setLive(false);
  }

  // Pause the timer whenever the app leaves the foreground, and resume it on return. Save
  // straight away when hiding, because a backgrounded app may be killed without warning.
  const latest = useRef(session);
  useLayoutEffect(() => {
    latest.current = session;
  });
  useEffect(() => {
    const sync = () => {
      const current = latest.current;
      if (!isTiming(current.game)) return;
      const t = Date.now();
      if (isVisible()) {
        if (current.runningSince === null) setSession({ ...current, runningSince: t });
      } else if (current.runningSince !== null) {
        const paused = pause(current, t);
        saveGame(storage(), paused.game);
        setSession(paused);
      }
    };
    // pagehide also covers reloads and closing the tab, where the page may stay "visible".
    // It pauses the in-memory session too, in case the page is frozen and later restored
    // from the back-forward cache (pageshow then resumes it).
    const leave = () => {
      const current = latest.current;
      if (current.runningSince === null) return;
      const paused = pause(current, Date.now());
      saveGame(storage(), paused.game);
      latest.current = paused;
      setSession(paused);
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  const handleStart = useCallback(() => {
    setSession((s) => ({ game: { ...s.game, started: true }, runningSince: Date.now() }));
  }, []);

  const handleSwap = useCallback(
    (a: number, b: number) => {
      const board = swap(game.board, a, b);
      const outcome = swapOutcome(board, a, b);
      // Bank the time on every swap, so little is lost if the app is killed; stop on solve.
      const t = Date.now();
      const banked = pause({ game: { ...game, board }, runningSince }, t);
      setSession(
        outcome === 'solved'
          ? banked
          : { ...banked, runningSince: runningSince === null ? null : t },
      );
      setLive(true);
      // Called from the pointerup handler, so haptics run inside the user gesture.
      if (outcome === 'solved') success();
      else if (outcome === 'placed') tap();
    },
    [game, runningSince],
  );

  const stopwatch = { elapsedMs: game.elapsedMs, runningSince };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Hue Complete Me</h1>
        <p className="app__date">
          <time dateTime={game.date}>{dateLabel(game.date)}</time>
          {game.started && (
            <>
              {' · '}
              <Clock stopwatch={stopwatch} />
            </>
          )}
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
            concealed={!game.started}
          />
          {!game.started && !solved && <StartOverlay date={game.date} onStart={handleStart} />}
          {solved && (
            <WinOverlay
              // Solving pauses the timer, so the banked time is final.
              elapsedMs={game.started ? game.elapsedMs : null}
              msUntilNext={msUntilNextDay(now)}
              immediate={!live}
            />
          )}
        </div>
      </main>
    </div>
  );
}
