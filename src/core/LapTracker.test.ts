import { describe, it, expect } from 'vitest';
import { LapTracker } from './LapTracker';
import type { Checkpoint, StartLine } from './types';

/**
 * Build a minimal 4-checkpoint oval for tests:
 *   start line at (0, +50)  — bottom of oval
 *   cp 0       at (+50, 0)  — right
 *   cp 1       at (0, -50)  — top
 *   cp 2       at (-50, 0)  — left
 */
function makeOval(): { checkpoints: Checkpoint[]; startLine: StartLine } {
  const checkpoints: Checkpoint[] = [
    { index: 0, cx: 50, cz: 0, halfX: 6, halfZ: 6 },
    { index: 1, cx: 0, cz: -50, halfX: 6, halfZ: 6 },
    { index: 2, cx: -50, cz: 0, halfX: 6, halfZ: 6 },
  ];
  const startLine: StartLine = { cx: 0, cz: 50, halfX: 6, halfZ: 2 };
  return { checkpoints, startLine };
}

/**
 * Move the tracker through a sequence of (x, z) waypoints — between waypoints
 * we leave both the checkpoint and start-line zones (by passing through a
 * neutral point) so each entry edge-triggers cleanly.
 */
function visit(t: LapTracker, points: [number, number][]) {
  for (const [x, z] of points) {
    // Step out of any zone before the new point so edge-triggers fire.
    t.update(999, 999);
    t.update(x, z);
  }
}

describe('LapTracker', () => {
  it('starts on lap 1 with no checkpoints hit', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    expect(tr.currentLap).toBe(1);
    expect(tr.lapsCompleted).toBe(0);
    expect(tr.nextCheckpointIndex).toBe(0);
    expect(tr.finished).toBe(false);
  });

  it('counts checkpoints in order', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    visit(tr, [[50, 0]]);
    expect(tr.nextCheckpointIndex).toBe(1);
    visit(tr, [[0, -50]]);
    expect(tr.nextCheckpointIndex).toBe(2);
    visit(tr, [[-50, 0]]);
    expect(tr.nextCheckpointIndex).toBe(3);
  });

  it('ignores out-of-order checkpoint passes', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    // Skip cp0 and try to grab cp1 — should not advance.
    visit(tr, [[0, -50]]);
    expect(tr.nextCheckpointIndex).toBe(0);
  });

  it('only commits a lap if all checkpoints are hit before the start line', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    // Cross start line without any checkpoints — no progress.
    visit(tr, [[0, 50]]);
    expect(tr.lapsCompleted).toBe(0);
  });

  it('completes a lap when all checkpoints are hit then start line is crossed', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    visit(tr, [[50, 0], [0, -50], [-50, 0], [0, 50]]);
    expect(tr.lapsCompleted).toBe(1);
    expect(tr.currentLap).toBe(2);
    expect(tr.nextCheckpointIndex).toBe(0); // resets
  });

  it('finishes the race after the configured number of laps', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    for (let lap = 0; lap < 3; lap++) {
      visit(tr, [[50, 0], [0, -50], [-50, 0], [0, 50]]);
    }
    expect(tr.lapsCompleted).toBe(3);
    expect(tr.finished).toBe(true);
  });

  it('does not double-count a checkpoint while the car lingers inside it', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    // Several frames inside cp0 — should advance exactly once.
    tr.update(50, 0);
    tr.update(50, 0);
    tr.update(50, 0);
    expect(tr.nextCheckpointIndex).toBe(1);
  });

  it('does not double-count a lap while the car lingers across the start line', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 3);
    visit(tr, [[50, 0], [0, -50], [-50, 0]]);
    // Multiple frames on the start line.
    tr.update(0, 50);
    tr.update(0, 50);
    tr.update(0, 50);
    expect(tr.lapsCompleted).toBe(1);
  });

  it('stops mutating state after the race is finished', () => {
    const { checkpoints, startLine } = makeOval();
    const tr = new LapTracker(checkpoints, startLine, 1);
    visit(tr, [[50, 0], [0, -50], [-50, 0], [0, 50]]);
    expect(tr.finished).toBe(true);
    visit(tr, [[50, 0], [0, -50], [-50, 0], [0, 50]]);
    expect(tr.lapsCompleted).toBe(1);
  });

  it('rejects empty checkpoint lists and bad lap counts', () => {
    expect(() => new LapTracker([], { cx: 0, cz: 0, halfX: 1, halfZ: 1 }, 3)).toThrow();
    const { checkpoints, startLine } = makeOval();
    expect(() => new LapTracker(checkpoints, startLine, 0)).toThrow();
  });
});