import { type Rng, shuffle } from './random.ts';

/** Grid width and height. */
export const N = 5;
export const SIZE = N * N;

/** Fixed corner positions: top-left, top-right, bottom-left, bottom-right. */
export const CORNERS = [0, N - 1, N * (N - 1), SIZE - 1] as const;

/** Positions that hold movable tiles, in row-major order. */
export const INTERIOR: readonly number[] = Array.from({ length: SIZE }, (_, i) => i).filter(
  (i) => !isCorner(i),
);

/** `board[position] = tileId`, where a tile's id is the position it belongs in. */
export type Board = readonly number[];

export function isCorner(pos: number): boolean {
  return (CORNERS as readonly number[]).includes(pos);
}

export function rowCol(pos: number): { row: number; col: number } {
  return { row: Math.floor(pos / N), col: pos % N };
}

/**
 * The position under a point given as a fraction of the board's width and height, or null
 * if the point is off the board.
 */
export function positionAt(x: number, y: number): number | null {
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
  return Math.floor(y * N) * N + Math.floor(x * N);
}

export function solvedBoard(): number[] {
  return Array.from({ length: SIZE }, (_, i) => i);
}

/**
 * A random board with the corners in place and no interior tile in its correct position.
 */
export function scramble(rng: Rng): number[] {
  const tiles = shuffle(rng, INTERIOR);
  // Shuffling leaves some tiles where they started. Swapping each one with its neighbour in
  // the list fixes both slots, since neither tile belongs in the other's position.
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === INTERIOR[i]) {
      const j = (i + 1) % tiles.length;
      [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
    }
  }
  const board = solvedBoard();
  INTERIOR.forEach((pos, i) => {
    board[pos] = tiles[i]!;
  });
  return board;
}

/** Returns a new board with the tiles at positions `a` and `b` exchanged. */
export function swap(board: Board, a: number, b: number): number[] {
  const next = board.slice();
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

export function isCorrect(board: Board, pos: number): boolean {
  return board[pos] === pos;
}

export function isSolved(board: Board): boolean {
  return board.every((tile, pos) => tile === pos);
}
