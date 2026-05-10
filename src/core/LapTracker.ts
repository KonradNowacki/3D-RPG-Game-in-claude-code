import type { Checkpoint, StartLine } from './types';

/**
 * Tracks lap progression by requiring the player to pass through every
 * checkpoint in order before crossing the start/finish line.
 *
 * The tracker is purely numeric — it consumes (x, z) world positions and
 * has no Three.js or DOM dependencies, so it is fully unit-testable.
 *
 * Lifecycle:
 *   1. The race begins with `currentLap = 1` and zero checkpoints hit.
 *   2. Each time the car enters a checkpoint rectangle whose index matches
 *      `nextCheckpointIndex`, that checkpoint is marked hit and the index
 *      advances.
 *   3. When all checkpoints are hit AND the car enters the start line
 *      rectangle, the lap is committed: `lapsCompleted` increments, the
 *      checkpoint progress resets, and `currentLap` advances.
 *   4. Once `lapsCompleted >= totalLaps`, `finished` becomes true and the
 *      tracker stops mutating.
 *
 * Edge handling:
 *   - The car may "linger" inside a checkpoint zone across multiple frames;
 *     we only count the *first* entry per lap by ignoring re-hits while
 *     `wasInCheckpointZone` is true.
 */
export class LapTracker {
  readonly totalLaps: number;
  readonly checkpoints: readonly Checkpoint[];
  readonly startLine: StartLine;

  /** Number of fully-completed laps (0..totalLaps). */
  lapsCompleted = 0;
  /** Index of the next checkpoint to reach this lap. */
  nextCheckpointIndex = 0;
  /** True once `lapsCompleted >= totalLaps`. */
  finished = false;

  /** True if the car was inside *any* checkpoint zone last frame. */
  private wasInCheckpointZone = false;
  /** True if the car was inside the start-line zone last frame. */
  private wasInStartLine = true; // start grid sits on the line

  constructor(checkpoints: readonly Checkpoint[], startLine: StartLine, totalLaps = 3) {
    if (checkpoints.length === 0) throw new Error('LapTracker needs at least one checkpoint');
    if (totalLaps < 1) throw new Error('totalLaps must be >= 1');
    this.checkpoints = checkpoints;
    this.startLine = startLine;
    this.totalLaps = totalLaps;
  }

  /** 1-based lap label suitable for HUD ("Lap 1 / 3"). */
  get currentLap(): number {
    return Math.min(this.totalLaps, this.lapsCompleted + 1);
  }

  /**
   * Update lap progression with the car's current world XZ position.
   */
  update(x: number, z: number): void {
    if (this.finished) return;

    // ── Checkpoint detection ──────────────────────────────────
    // Only the *next* required checkpoint counts. We ignore drifts through
    // earlier or later checkpoints to keep the rule simple.
    const next = this.checkpoints[this.nextCheckpointIndex];
    const inNext = next ? this.inside(x, z, next.cx, next.cz, next.halfX, next.halfZ) : false;

    if (inNext && !this.wasInCheckpointZone) {
      this.nextCheckpointIndex++;
    }
    this.wasInCheckpointZone = inNext;

    // ── Start/finish line detection ───────────────────────────
    const inStart = this.inside(
      x, z,
      this.startLine.cx, this.startLine.cz,
      this.startLine.halfX, this.startLine.halfZ,
    );

    // Edge-trigger: count only the *entry* into the line zone.
    if (inStart && !this.wasInStartLine) {
      if (this.nextCheckpointIndex >= this.checkpoints.length) {
        this.lapsCompleted++;
        this.nextCheckpointIndex = 0;
        if (this.lapsCompleted >= this.totalLaps) {
          this.finished = true;
        }
      }
    }
    this.wasInStartLine = inStart;
  }

  private inside(x: number, z: number, cx: number, cz: number, hx: number, hz: number): boolean {
    return Math.abs(x - cx) <= hx && Math.abs(z - cz) <= hz;
  }
}