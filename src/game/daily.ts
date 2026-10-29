import { generatePalette } from './palette.ts';
import { scramble } from './puzzle.ts';
import { mulberry32 } from './random.ts';
import type { Game } from './storage.ts';

/**
 * The player's local calendar date as `YYYY-MM-DD`. Everyone gets the same puzzle on the
 * same date, each in their own time zone.
 */
export function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 32-bit FNV-1a hash of the date key, used to seed the day's puzzle. */
export function seedFor(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The puzzle for a date: the same colours and starting scramble for every player. */
export function dailyGame(key: string): Game {
  const rng = mulberry32(seedFor(key));
  const { colours } = generatePalette(rng);
  return { date: key, colours, board: scramble(rng), started: false, elapsedMs: 0 };
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextDay(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

/** A short countdown, rounded up to the minute: "5h 12m", "12m" or "1m". */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A date key as a short label, e.g. "Wed 28 Oct". */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
