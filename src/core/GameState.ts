/**
 * Race-wide state: lap progress, elapsed time, finished flag.
 *
 * Lap numbers are owned by `LapTracker`; this class glues them together with
 * an elapsed-time counter and the win condition so the HUD/main loop can read
 * a single object.
 */
export class GameState {
  readonly totalLaps: number;
  lapsCompleted = 0;
  /** Seconds since the race began (paused once `finished`). */
  elapsed = 0;
  finished = false;

  constructor(totalLaps = 3) {
    this.totalLaps = totalLaps;
  }

  /** 1-based lap label, capped at `totalLaps`. */
  get currentLap(): number {
    return Math.min(this.totalLaps, this.lapsCompleted + 1);
  }

  /** Advance the race timer. Stops counting once the race has finished. */
  tick(dt: number): void {
    if (!this.finished) this.elapsed += dt;
  }

  /** Sync from a LapTracker. Called once per frame after the tracker updates. */
  syncLaps(lapsCompleted: number, finished: boolean): void {
    this.lapsCompleted = lapsCompleted;
    if (finished) this.finished = true;
  }
}