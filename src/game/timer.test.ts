import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  pauseStopwatch,
  readStopwatch,
  resumeStopwatch,
  type Stopwatch,
} from './timer.ts';

describe('stopwatch', () => {
  it('counts only while running', () => {
    let sw: Stopwatch = { elapsedMs: 0, runningSince: null };
    expect(readStopwatch(sw, 5_000)).toBe(0);

    sw = resumeStopwatch(sw, 10_000);
    expect(readStopwatch(sw, 15_000)).toBe(5_000);

    sw = pauseStopwatch(sw, 16_000);
    expect(sw).toEqual({ elapsedMs: 6_000, runningSince: null });
    // Time while paused (e.g. the app in the background) isn't counted.
    expect(readStopwatch(sw, 600_000)).toBe(6_000);

    sw = resumeStopwatch(sw, 600_000);
    expect(readStopwatch(sw, 604_000)).toBe(10_000);
  });

  it('ignores repeated pause and resume', () => {
    const running = resumeStopwatch({ elapsedMs: 1_000, runningSince: null }, 2_000);
    expect(resumeStopwatch(running, 9_000)).toBe(running);
    const paused = pauseStopwatch(running, 3_000);
    expect(pauseStopwatch(paused, 9_000)).toBe(paused);
  });

  it('never goes backwards if the clock jumps back', () => {
    expect(readStopwatch({ elapsedMs: 4_000, runningSince: 10_000 }, 8_000)).toBe(4_000);
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds, adding hours when needed', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7_999)).toBe('0:07');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(12 * 60_000 + 34_000)).toBe('12:34');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
