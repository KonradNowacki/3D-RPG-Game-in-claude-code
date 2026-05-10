import * as THREE from 'three';
import type { Checkpoint, StartLine } from '../core/types';

type ArcSeg = {
  kind: 'arc';
  cx: number; cz: number;
  radius: number;
  startAngle: number; sweep: number;
  name?: string;
};
type StraightSeg = {
  kind: 'straight';
  x1: number; z1: number; x2: number; z2: number;
  name?: string;
};
type Segment = StraightSeg | ArcSeg;

/**
 * Spa-Francorchamps inspired racing circuit.
 *
 * Spec source: .claude/skills/track/SKILL.md
 *
 * Layout features the iconic Spa corners (simplified for arcade gameplay):
 *  - Long start/finish straight
 *  - Eau Rouge — fast left
 *  - Pouhon — descending left sweep
 *  - Kemmel — long high-speed straight
 *  - Les Combes — right-left chicane (3 apexes)
 *  - Bus Stop — left sweeper before final corner
 *  - Spa straight — return to start
 *
 * Single ribbon BufferGeometry guarantees no visual gaps.
 */
export class RaceTrack {
  readonly trackHalfWidth = 8;
  readonly curbWidth = 1.5;
  readonly curbHeight = 0.35;

  readonly checkpoints: Checkpoint[];
  readonly startLine: StartLine;
  readonly segments: readonly Segment[];
  readonly startPosition: THREE.Vector3;
  readonly startYaw: number;

  constructor(scene: THREE.Scene) {
    this.segments = RaceTrack.buildSegments();

    // Start at the beginning of the start straight, heading -X (down the straight)
    this.startPosition = new THREE.Vector3(85, 0, 110);
    this.startYaw = Math.PI / 2;

    // Start/finish line near far end of start straight (just before Eau Rouge braking zone)
    this.startLine = { cx: -75, cz: 110, halfX: 2, halfZ: this.trackHalfWidth };

    // One functional checkpoint mid-Kemmel (data only — main.ts skips visual marker)
    this.checkpoints = [
      { index: 0, cx: 0, cz: -80, halfX: 2, halfZ: this.trackHalfWidth },
    ];

    this.buildGeometry(scene);
  }

  private static buildSegments(): Segment[] {
    // Closed loop with 4 main 90° lefts + Les Combes chicane (R-L).
    // Every segment endpoint mathematically verified to match the next segment's start.
    return [
      // ── 1. Start/Finish straight (heading -X) ─────────────────────────
      { kind: 'straight', x1: 90, z1: 110, x2: -80, z2: 110, name: 'Start/Finish' },

      // ── 2. Eau Rouge — LEFT 90° (-X → -Z) ─────────────────────────────
      //   entry (-80, 110), exit (-110, 80)
      { kind: 'arc', cx: -80, cz: 80, radius: 30,
        startAngle: Math.PI / 2, sweep: Math.PI / 2, name: 'Eau Rouge' },

      // ── 3. Descent to Pouhon (heading -Z) ─────────────────────────────
      { kind: 'straight', x1: -110, z1: 80, x2: -110, z2: -50, name: 'Raidillon descent' },

      // ── 4. Pouhon — LEFT 90° (-Z → +X) ────────────────────────────────
      //   entry (-110, -50), exit (-80, -80)
      { kind: 'arc', cx: -80, cz: -50, radius: 30,
        startAngle: Math.PI, sweep: Math.PI / 2, name: 'Pouhon' },

      // ── 5. Kemmel straight (heading +X) — LONG ────────────────────────
      { kind: 'straight', x1: -80, z1: -80, x2: 60, z2: -80, name: 'Kemmel' },

      // ── 6. Les Combes — RIGHT chicane (small arc) ─────────────────────
      //   entry (60, -80), exit (72, -92), heading -Z
      { kind: 'arc', cx: 60, cz: -92, radius: 12,
        startAngle: Math.PI / 2, sweep: -Math.PI / 2, name: 'Les Combes R' },

      // ── 7. Chicane connector (heading -Z) ─────────────────────────────
      { kind: 'straight', x1: 72, z1: -92, x2: 72, z2: -100, name: 'Chicane mid' },

      // ── 8. Les Combes — LEFT chicane (small arc) ──────────────────────
      //   entry (72, -100), exit (84, -112), heading +X
      { kind: 'arc', cx: 84, cz: -100, radius: 12,
        startAngle: Math.PI, sweep: Math.PI / 2, name: 'Les Combes L' },

      // ── 9. Post-Combes straight (heading +X) ──────────────────────────
      { kind: 'straight', x1: 84, z1: -112, x2: 90, z2: -112, name: 'Stavelot' },

      // ── 10. Bus Stop — LEFT 90° (+X → +Z) ─────────────────────────────
      //   entry (90, -112), exit (120, -82)
      { kind: 'arc', cx: 90, cz: -82, radius: 30,
        startAngle: -Math.PI / 2, sweep: Math.PI / 2, name: 'Bus Stop' },

      // ── 11. Long return straight (heading +Z) ─────────────────────────
      { kind: 'straight', x1: 120, z1: -82, x2: 120, z2: 80, name: 'Blanchimont' },

      // ── 12. La Source — LEFT 90° (+Z → -X) — closes loop ──────────────
      //   entry (120, 80), exit (90, 110) → back to start straight
      { kind: 'arc', cx: 90, cz: 80, radius: 30,
        startAngle: 0, sweep: Math.PI / 2, name: 'La Source' },
    ];
  }

  /** Sample the centerline into a closed list of points (for ribbon mesh). */
  private sampleCenterline(): Array<{ x: number; z: number }> {
    const pts: Array<{ x: number; z: number }> = [];
    const STEP = 2.5;
    for (const seg of this.segments) {
      if (seg.kind === 'straight') {
        const dx = seg.x2 - seg.x1;
        const dz = seg.z2 - seg.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const n = Math.max(2, Math.ceil(len / STEP));
        for (let i = 0; i < n; i++) {
          const t = i / n;
          pts.push({ x: seg.x1 + t * dx, z: seg.z1 + t * dz });
        }
      } else {
        const arcLen = Math.abs(seg.sweep) * seg.radius;
        const n = Math.max(8, Math.ceil(arcLen / STEP));
        for (let i = 0; i < n; i++) {
          const angle = seg.startAngle + (i / n) * seg.sweep;
          pts.push({
            x: seg.cx + seg.radius * Math.cos(angle),
            z: seg.cz + seg.radius * Math.sin(angle),
          });
        }
      }
    }
    return pts;
  }

  private buildGeometry(scene: THREE.Scene): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.85,
      metalness: 0.0,
    });
    const innerCurbMat = new THREE.MeshStandardMaterial({
      color: 0xcc1414,
      roughness: 0.85,
    });

    // ── Single ribbon BufferGeometry — guaranteed continuity ─────────────
    const pts = this.sampleCenterline();
    const n = pts.length;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const hw = this.trackHalfWidth;
    let cumLen = 0;

    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const prev = pts[(i - 1 + n) % n];

      const fdx = next.x - curr.x;
      const fdz = next.z - curr.z;
      const bdx = curr.x - prev.x;
      const bdz = curr.z - prev.z;
      let tx = fdx + bdx;
      let tz = fdz + bdz;
      const tlen = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= tlen;
      tz /= tlen;

      const px = -tz; // perpendicular (left)
      const pz = tx;

      positions.push(curr.x + px * hw, 0.01, curr.z + pz * hw); // left edge
      positions.push(curr.x - px * hw, 0.01, curr.z - pz * hw); // right edge

      if (i > 0) cumLen += Math.sqrt(fdx * fdx + fdz * fdz);
      const u = cumLen / 16;
      uvs.push(0, u, 1, u);
    }

    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = ((i + 1) % n) * 2;
      const d = c + 1;
      indices.push(a, c, b, c, d, b); // CCW for upward normals
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geo.computeVertexNormals();
    const ribbon = new THREE.Mesh(geo, asphaltMat);
    ribbon.receiveShadow = true;
    scene.add(ribbon);

    // ── Inner curbs only (red, on inside of every arc) ───────────────────
    for (const seg of this.segments) {
      if (seg.kind !== 'arc') continue;

      const thetaStart = seg.sweep >= 0 ? seg.startAngle : seg.startAngle + seg.sweep;
      const thetaLength = Math.abs(seg.sweep);
      const innerR = seg.radius - hw;

      const curbGeo = new THREE.RingGeometry(
        Math.max(0.1, innerR - this.curbWidth),
        innerR,
        48, 1,
        thetaStart, thetaLength
      );
      const curb = new THREE.Mesh(curbGeo, innerCurbMat);
      curb.rotation.x = -Math.PI / 2;
      curb.position.set(seg.cx, this.curbHeight / 2, seg.cz);
      curb.castShadow = true;
      scene.add(curb);
    }
  }

  isOnTrack(x: number, z: number): boolean {
    const hw = this.trackHalfWidth + 0.5;
    for (const seg of this.segments) {
      if (seg.kind === 'straight') {
        // Proper perpendicular-distance test (works for any orientation)
        const sdx = seg.x2 - seg.x1;
        const sdz = seg.z2 - seg.z1;
        const sLen = Math.sqrt(sdx * sdx + sdz * sdz);
        if (sLen === 0) continue;
        const nx = sdx / sLen;
        const nz = sdz / sLen;
        const px = x - seg.x1;
        const pz = z - seg.z1;
        const along = px * nx + pz * nz;
        if (along < -hw || along > sLen + hw) continue;
        const perp = Math.abs(-px * nz + pz * nx);
        if (perp <= hw) return true;
      } else {
        const dx = x - seg.cx;
        const dz = z - seg.cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < seg.radius - hw || dist > seg.radius + hw) continue;
        let angle = Math.atan2(dz, dx);
        const lo = seg.sweep >= 0 ? seg.startAngle : seg.startAngle + seg.sweep;
        const hi = lo + Math.abs(seg.sweep);
        while (angle < lo - Math.PI) angle += 2 * Math.PI;
        while (angle > hi + Math.PI) angle -= 2 * Math.PI;
        if (angle >= lo - 0.25 && angle <= hi + 0.25) return true;
      }
    }
    return false;
  }
}
