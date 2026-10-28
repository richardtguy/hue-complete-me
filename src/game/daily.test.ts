import { describe, expect, it } from 'vitest';
import {
  dailyGame,
  dateKey,
  dateLabel,
  formatCountdown,
  msUntilNextDay,
  seedFor,
} from './daily.ts';
import { minNeighbourDeltaE, MIN_NEIGHBOUR_DELTA_E } from './palette.ts';
import { INTERIOR, isCorrect } from './puzzle.ts';

describe('dateKey', () => {
  it('formats the local calendar date', () => {
    expect(dateKey(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
    expect(dateKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });
});

describe('seedFor', () => {
  it('is stable and differs between days', () => {
    expect(seedFor('2026-10-28')).toBe(seedFor('2026-10-28'));
    expect(seedFor('2026-10-28')).not.toBe(seedFor('2026-10-29'));
    expect(Number.isInteger(seedFor('2026-10-28'))).toBe(true);
    expect(seedFor('2026-10-28')).toBeGreaterThanOrEqual(0);
  });
});

describe('dailyGame', () => {
  it('gives every player the same puzzle on the same day', () => {
    expect(dailyGame('2026-10-28')).toEqual(dailyGame('2026-10-28'));
  });

  it('gives a different puzzle on a different day', () => {
    const a = dailyGame('2026-10-28');
    const b = dailyGame('2026-10-29');
    expect(a.colours).not.toEqual(b.colours);
    expect(a.board).not.toEqual(b.board);
  });

  it('records its date and is a valid, scrambled, solvable puzzle', () => {
    for (let day = 1; day <= 60; day++) {
      const key = dateKey(new Date(2026, 0, day));
      const game = dailyGame(key);
      expect(game.date).toBe(key);
      expect(minNeighbourDeltaE(game.colours)).toBeGreaterThanOrEqual(MIN_NEIGHBOUR_DELTA_E);
      for (const pos of INTERIOR) expect(isCorrect(game.board, pos)).toBe(false);
    }
  });
});

describe('msUntilNextDay', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 9, 28, 23, 0))).toBe(60 * 60_000);
    expect(msUntilNextDay(new Date(2026, 9, 28, 0, 0))).toBe(24 * 60 * 60_000);
  });
});

describe('formatCountdown', () => {
  it('rounds up to the minute', () => {
    expect(formatCountdown(5 * 3_600_000 + 12 * 60_000)).toBe('5h 12m');
    expect(formatCountdown(12 * 60_000 - 1)).toBe('12m');
    expect(formatCountdown(3_600_000)).toBe('1h 0m');
    expect(formatCountdown(10_000)).toBe('1m');
    expect(formatCountdown(0)).toBe('1m');
  });
});

describe('dateLabel', () => {
  it('formats a short British date', () => {
    expect(dateLabel('2026-10-28')).toBe('Wed 28 Oct');
  });
});
