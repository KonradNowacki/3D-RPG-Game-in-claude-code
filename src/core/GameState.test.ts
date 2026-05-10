import { describe, it, expect } from 'vitest';
import { GameState } from './GameState';

describe('GameState', () => {
  it('starts on lap 1 with no laps completed and zero elapsed time', () => {
    const gs = new GameState(3);
    expect(gs.totalLaps).toBe(3);
    expect(gs.lapsCompleted).toBe(0);
    expect(gs.currentLap).toBe(1);
    expect(gs.elapsed).toBe(0);
    expect(gs.finished).toBe(false);
  });

  it('increments elapsed via tick()', () => {
    const gs = new GameState(3);
    gs.tick(0.5);
    gs.tick(0.25);
    expect(gs.elapsed).toBeCloseTo(0.75, 6);
  });

  it('stops the clock once finished', () => {
    const gs = new GameState(3);
    gs.tick(1);
    gs.syncLaps(3, true);
    const frozen = gs.elapsed;
    gs.tick(2); // ignored
    expect(gs.elapsed).toBe(frozen);
    expect(gs.finished).toBe(true);
  });

  it('currentLap reflects laps completed and caps at totalLaps', () => {
    const gs = new GameState(3);
    gs.syncLaps(1, false);
    expect(gs.currentLap).toBe(2);
    gs.syncLaps(2, false);
    expect(gs.currentLap).toBe(3);
    gs.syncLaps(3, true);
    expect(gs.currentLap).toBe(3);
  });
});
