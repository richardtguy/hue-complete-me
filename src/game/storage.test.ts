import { describe, expect, it } from 'vitest';
import { generatePalette } from './palette.ts';
import { scramble, swap } from './puzzle.ts';
import { mulberry32 } from './random.ts';
import { type Game, STORAGE_KEY, loadGame, parseSave, saveGame, serialiseGame } from './storage.ts';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  return { ...memoryStorage(), getItem: fail, setItem: fail };
}

function sampleGame(seed = 1): Game {
  const rng = mulberry32(seed);
  const { colours } = generatePalette(rng);
  return { date: '2026-10-28', colours, board: scramble(rng) };
}

describe('save round trip', () => {
  it('restores exactly what was saved', () => {
    const storage = memoryStorage();
    const game = sampleGame();
    saveGame(storage, game);
    expect(loadGame(storage)).toEqual(game);
  });

  it('keeps the latest save', () => {
    const storage = memoryStorage();
    const game = sampleGame();
    saveGame(storage, game);
    const moved = { ...game, board: swap(game.board, 6, 7) };
    saveGame(storage, moved);
    expect(loadGame(storage)?.board).toEqual(moved.board);
  });

  it('stores under the versioned key', () => {
    const storage = memoryStorage();
    saveGame(storage, sampleGame());
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(2);
  });

  it('removes the old v1 save', () => {
    const storage = memoryStorage();
    storage.setItem('hue-complete-me:v1', '{}');
    saveGame(storage, sampleGame());
    expect(storage.getItem('hue-complete-me:v1')).toBeNull();
  });
});

describe('unavailable storage', () => {
  it('returns null when nothing is saved or storage is missing', () => {
    expect(loadGame(memoryStorage())).toBeNull();
    expect(loadGame(undefined)).toBeNull();
  });

  it('never throws when storage throws', () => {
    const storage = throwingStorage();
    expect(() => saveGame(storage, sampleGame())).not.toThrow();
    expect(loadGame(storage)).toBeNull();
    expect(() => saveGame(undefined, sampleGame())).not.toThrow();
  });
});

describe('parseSave rejects bad data', () => {
  const valid = JSON.parse(serialiseGame(sampleGame()));
  const withChanges = (changes: object) => JSON.stringify({ ...valid, ...changes });

  it('accepts a valid save', () => {
    expect(parseSave(JSON.stringify(valid))).not.toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['null', 'null'],
    ['a number', '42'],
    ['another version', withChanges({ version: 1 })],
    ['no date', withChanges({ date: undefined })],
    ['a malformed date', withChanges({ date: '28/10/2026' })],
    ['no version', withChanges({ version: undefined })],
    ['a short board', withChanges({ board: valid.board.slice(1) })],
    ['a repeated tile', withChanges({ board: [...valid.board.slice(0, 24), valid.board[1]] })],
    ['a moved corner', withChanges({ board: swap(valid.board, 0, 6) })],
    [
      'an out-of-range tile',
      withChanges({ board: valid.board.map((t: number) => (t === 6 ? 25 : t)) }),
    ],
    ['missing colours', withChanges({ colours: undefined })],
    ['too few colours', withChanges({ colours: valid.colours.slice(1) })],
    [
      'a malformed colour',
      withChanges({ colours: [{ L: 'x', a: 0, b: 0 }, ...valid.colours.slice(1)] }),
    ],
  ])('rejects %s', (_, json) => {
    expect(parseSave(json)).toBeNull();
  });
});
