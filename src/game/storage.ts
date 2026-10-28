import type { Oklab } from './colour.ts';
import { type Board, CORNERS, SIZE } from './puzzle.ts';

/** Everything needed to resume a game. */
export interface Game {
  /** Solved colour of each tile, indexed by tile id. */
  colours: Oklab[];
  board: Board;
}

export const STORAGE_KEY = 'hue-complete-me:v1';
const VERSION = 1;

interface SaveV1 {
  version: 1;
  colours: Oklab[];
  board: number[];
}

function isOklab(x: unknown): x is Oklab {
  if (typeof x !== 'object' || x === null) return false;
  const { L, a, b } = x as Record<string, unknown>;
  return [L, a, b].every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** A permutation of all tiles with the corners in place. */
function isBoard(x: unknown): x is number[] {
  if (!Array.isArray(x) || x.length !== SIZE) return false;
  if (!x.every((t) => Number.isInteger(t) && t >= 0 && t < SIZE)) return false;
  if (new Set(x).size !== SIZE) return false;
  return CORNERS.every((c) => x[c] === c);
}

/** Parses saved JSON, returning null for anything malformed or from another version. */
export function parseSave(json: string | null): Game | null {
  if (json === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { version, colours, board } = data as Record<string, unknown>;
  if (version !== VERSION) return null;
  if (!Array.isArray(colours) || colours.length !== SIZE || !colours.every(isOklab)) return null;
  if (!isBoard(board)) return null;
  return { colours, board };
}

export function serialiseGame({ colours, board }: Game): string {
  const save: SaveV1 = { version: VERSION, colours, board: [...board] };
  return JSON.stringify(save);
}

/** Loads the saved game, or null if there is none or it can't be read. Never throws. */
export function loadGame(storage: Storage | undefined): Game | null {
  try {
    return parseSave(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Saves the game, silently doing nothing if storage is unavailable or full. */
export function saveGame(storage: Storage | undefined, game: Game) {
  try {
    storage?.setItem(STORAGE_KEY, serialiseGame(game));
  } catch {
    // Private mode, blocked storage or quota exceeded: play on without saving.
  }
}
