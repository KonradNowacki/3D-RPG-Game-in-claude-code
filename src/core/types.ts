/**
 * A checkpoint along the race track.
 * The player's car must pass through checkpoints in order, then cross the
 * start/finish line to register a lap.
 *
 * The checkpoint is modelled as an axis-aligned rectangle on the ground plane.
 */
export interface Checkpoint {
  /** Index in the ordered checkpoint list (0-based). */
  index: number;
  /** Center of the checkpoint on the XZ plane. */
  cx: number;
  cz: number;
  /** Half-extents of the checkpoint rectangle on XZ. */
  halfX: number;
  halfZ: number;
}

/**
 * Defines the start/finish line. Same shape as a checkpoint but conceptually
 * separate — crossing it after hitting all checkpoints completes a lap.
 */
export interface StartLine {
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
}