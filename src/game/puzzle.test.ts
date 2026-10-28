import { describe, expect, it } from 'vitest';
import {
  CORNERS,
  INTERIOR,
  N,
  SIZE,
  isCorner,
  isCorrect,
  isSolved,
  positionAt,
  rowCol,
  scramble,
  solvedBoard,
  swap,
} from './puzzle.ts';
import { mulberry32 } from './random.ts';

describe('board geometry', () => {
  it('has four corners and 21 interior positions', () => {
    expect(CORNERS).toEqual([0, 4, 20, 24]);
    expect(INTERIOR).toHaveLength(SIZE - 4);
    expect(INTERIOR.some(isCorner)).toBe(false);
  });

  it('maps positions to rows and columns', () => {
    expect(rowCol(0)).toEqual({ row: 0, col: 0 });
    expect(rowCol(N - 1)).toEqual({ row: 0, col: N - 1 });
    expect(rowCol(7)).toEqual({ row: 1, col: 2 });
    expect(rowCol(SIZE - 1)).toEqual({ row: N - 1, col: N - 1 });
  });
});

describe('positionAt', () => {
  it('maps fractional board coordinates to positions', () => {
    expect(positionAt(0, 0)).toBe(0);
    expect(positionAt(0.99, 0)).toBe(4);
    expect(positionAt(0.5, 0.5)).toBe(12);
    expect(positionAt(0.21, 0.19)).toBe(1);
    expect(positionAt(0.999, 0.999)).toBe(24);
  });

  it('returns null off the board', () => {
    expect(positionAt(-0.01, 0.5)).toBeNull();
    expect(positionAt(1, 0.5)).toBeNull();
    expect(positionAt(0.5, 1.2)).toBeNull();
  });
});

describe('scramble', () => {
  it('upholds its invariants across many seeds', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const board = scramble(mulberry32(seed));
      expect(board).toHaveLength(SIZE);
      // A permutation of all tiles.
      expect(board.slice().sort((a, b) => a - b)).toEqual(solvedBoard());
      // Corners fixed.
      for (const c of CORNERS) expect(board[c]).toBe(c);
      // No interior tile starts in place.
      for (const pos of INTERIOR) expect(isCorrect(board, pos)).toBe(false);
    }
  });

  it('is deterministic for a seed and varies between seeds', () => {
    expect(scramble(mulberry32(5))).toEqual(scramble(mulberry32(5)));
    expect(scramble(mulberry32(5))).not.toEqual(scramble(mulberry32(6)));
  });
});

describe('swap', () => {
  it('exchanges two tiles without mutating the input', () => {
    const board = solvedBoard();
    const next = swap(board, 1, 7);
    expect(board).toEqual(solvedBoard());
    expect(next[1]).toBe(7);
    expect(next[7]).toBe(1);
    expect(swap(next, 1, 7)).toEqual(board);
  });
});

describe('isCorrect / isSolved', () => {
  it('detects solved and unsolved boards', () => {
    const solved = solvedBoard();
    expect(isSolved(solved)).toBe(true);
    const unsolved = swap(solved, 2, 3);
    expect(isSolved(unsolved)).toBe(false);
    expect(isCorrect(unsolved, 2)).toBe(false);
    expect(isCorrect(unsolved, 1)).toBe(true);
  });

  it('can solve a scrambled board by swapping tiles home', () => {
    let board = scramble(mulberry32(99));
    for (const pos of INTERIOR) {
      if (!isCorrect(board, pos)) board = swap(board, pos, board.indexOf(pos));
    }
    expect(isSolved(board)).toBe(true);
  });
});
