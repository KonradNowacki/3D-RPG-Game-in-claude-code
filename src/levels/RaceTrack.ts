import * as THREE from 'three';
import type { Checkpoint, StartLine } from '../core/types';

type ArcSeg = {
  kind: 'arc';
  cx: number; cz: number;
  radius: number;
  startAngle: number; sweep: number;
  startY: number; endY: number;
  name?: string;
};
type StraightSeg = {
  kind: 'straight';
  x1: number; z1: number; x2: number; z2: number;
  startY: number; endY: number;
  name?: string;
};
type Segment = StraightSeg | ArcSeg;

/**
 * Spa-Francorchamps inspired racing circuit at realistic scale (~3.4 km lap).
 *
 * Spec source: .claude/skills/track/SKILL.md, real-world Spa-Francorchamps reference.
 *
 * Layout (matches Spa flow with simplified arcade corners):
 *  - Pit straight at low elevation (Y=0)
 *  - Eau Rouge — fast left with STEEP UPHILL CLIMB (Y=0 → 25m, ~13% grade)
 *  - Raidillon connector — at the high plateau (Y=25)
 *  - Pouhon — descending left sweep
 *  - Kemmel — long high-speed straight at altitude
 *  - Les Combes — right-left chicane (3 segments)
 *  - Stavelot — short connector
 *  - Bus Stop — left 90° descending back
 *  - Blanchimont — long return straight (gradual descent)
 *  - La Source — final left, closes the loop at start elevation
 *
 * Single ribbon BufferGeometry guarantees no visual gaps.
 * Track follows 3D elevation profile (cars query heightAt for vertical position).
 */
export class RaceTrack {
  readonly trackHalfWidth = 8;     // 16m wide track (real F1 spec: 10-15m)
  readonly curbWidth = 1.5;
  readonly curbHeight = 0.15;      // low-profile curb (flush with road)

  readonly checkpoints: Checkpoint[];
  readonly startLine: StartLine;
  readonly segments: readonly Segment[];
  readonly startPosition: THREE.Vector3;
  readonly startYaw: number;

  /** Centerline samples (x, y, z) used both for ribbon mesh and heightAt queries. */
  private centerlineSamples: Array<{ x: number; y: number; z: number }> = [];

  constructor(scene: THREE.Scene) {
    this.segments = RaceTrack.buildSegments();

    // Start at the beginning of the start straight, at low elevation (pit straight bottom)
    this.startPosition = new THREE.Vector3(340, 0, 440);
    this.startYaw = Math.PI / 2;

    // Start/finish line at the far end of the start straight (before Eau Rouge braking zone)
    this.startLine = { cx: -300, cz: 440, halfX: 3, halfZ: this.trackHalfWidth };

    // One functional checkpoint mid-Kemmel (data only — main.ts skips visual marker)
    this.checkpoints = [
      { index: 0, cx: 0, cz: -320, halfX: 3, halfZ: this.trackHalfWidth },
    ];

    this.buildGeometry(scene);
  }

  private static buildSegments(): Segment[] {
    // Elevation profile (Y values in metres):
    //  - Start straight & approach: Y=0 (low)
    //  - Eau Rouge: 0 → 25m STEEP CLIMB during the arc itself
    //  - Raidillon descent → Kemmel: stay at top elevation (Y=22-25)
    //  - Pouhon → bus stop: gradually descend back to Y=0
    return [
      // ── 1. Start/Finish straight (heading -X, ~680m) at low elevation ──
      { kind: 'straight', x1: 360, z1: 440, x2: -320, z2: 440,
        startY: 0, endY: 0, name: 'Pit Straight' },

      // ── 2. Eau Rouge — LEFT 90° (-X → -Z), STEEP CLIMB 0 → 25m ────────
      { kind: 'arc', cx: -320, cz: 320, radius: 120,
        startAngle: Math.PI / 2, sweep: Math.PI / 2,
        startY: 0, endY: 25, name: 'Eau Rouge' },

      // ── 3. Raidillon plateau (heading -Z, ~520m) at high elevation ────
      { kind: 'straight', x1: -440, z1: 320, x2: -440, z2: -200,
        startY: 25, endY: 22, name: 'Raidillon' },

      // ── 4. Pouhon — LEFT 90° (-Z → +X), slight descent ────────────────
      { kind: 'arc', cx: -320, cz: -200, radius: 120,
        startAngle: Math.PI, sweep: Math.PI / 2,
        startY: 22, endY: 20, name: 'Pouhon' },

      // ── 5. Kemmel straight (heading +X, ~560m) — LONG, high plateau ───
      { kind: 'straight', x1: -320, z1: -320, x2: 240, z2: -320,
        startY: 20, endY: 18, name: 'Kemmel' },

      // ── 6. Les Combes — RIGHT chicane (small arc) ─────────────────────
      { kind: 'arc', cx: 240, cz: -368, radius: 48,
        startAngle: Math.PI / 2, sweep: -Math.PI / 2,
        startY: 18, endY: 17, name: 'Les Combes R' },

      // ── 7. Chicane connector (heading -Z) ─────────────────────────────
      { kind: 'straight', x1: 288, z1: -368, x2: 288, z2: -400,
        startY: 17, endY: 17, name: 'Chicane mid' },

      // ── 8. Les Combes — LEFT chicane (small arc) ──────────────────────
      { kind: 'arc', cx: 336, cz: -400, radius: 48,
        startAngle: Math.PI, sweep: Math.PI / 2,
        startY: 17, endY: 15, name: 'Les Combes L' },

      // ── 9. Stavelot connector (heading +X) ────────────────────────────
      { kind: 'straight', x1: 336, z1: -448, x2: 360, z2: -448,
        startY: 15, endY: 14, name: 'Stavelot' },

      // ── 10. Bus Stop — LEFT 90° (+X → +Z), descending ─────────────────
      { kind: 'arc', cx: 360, cz: -328, radius: 120,
        startAngle: -Math.PI / 2, sweep: Math.PI / 2,
        startY: 14, endY: 10, name: 'Bus Stop' },

      // ── 11. Blanchimont return straight (heading +Z, ~650m) ───────────
      { kind: 'straight', x1: 480, z1: -328, x2: 480, z2: 320,
        startY: 10, endY: 3, name: 'Blanchimont' },

      // ── 12. La Source — LEFT 90° (+Z → -X) — closes loop at low Y ─────
      { kind: 'arc', cx: 360, cz: 320, radius: 120,
        startAngle: 0, sweep: Math.PI / 2,
        startY: 3, endY: 0, name: 'La Source' },
    ];
  }

  /** Sample the centerline into a closed list of 3D points (for ribbon mesh & height query). */
  private sampleCenterline(): Array<{ x: number; y: number; z: number }> {
    const pts: Array<{ x: number; y: number; z: number }> = [];
    const STEP = 4;
    for (const seg of this.segments) {
      if (seg.kind === 'straight') {
        const dx = seg.x2 - seg.x1;
        const dz = seg.z2 - seg.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const n = Math.max(2, Math.ceil(len / STEP));
        for (let i = 0; i < n; i++) {
          const t = i / n;
          pts.push({
            x: seg.x1 + t * dx,
            y: seg.startY + t * (seg.endY - seg.startY),
            z: seg.z1 + t * dz,
          });
        }
      } else {
        const arcLen = Math.abs(seg.sweep) * seg.radius;
        const n = Math.max(12, Math.ceil(arcLen / STEP));
        for (let i = 0; i < n; i++) {
          const t = i / n;
          const angle = seg.startAngle + t * seg.sweep;
          pts.push({
            x: seg.cx + seg.radius * Math.cos(angle),
            y: seg.startY + t * (seg.endY - seg.startY),
            z: seg.cz + seg.radius * Math.sin(angle),
          });
        }
      }
    }
    return pts;
  }

  /** Returns the elevation (Y) of the track surface at a given (x, z) position. */
  heightAt(x: number, z: number): number {
    if (this.centerlineSamples.length === 0) return 0;
    let bestDist = Infinity;
    let bestY = 0;
    for (const p of this.centerlineSamples) {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        bestY = p.y;
      }
    }
    return bestY;
  }

  private buildGeometry(scene: THREE.Scene): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.85,
      metalness: 0.0,
    });
    const innerCurbMat = new THREE.MeshStandardMaterial({
      color: 0xcc1414,
      roughness: 0.8,
    });

    // ── Single ribbon BufferGeometry — guaranteed continuity with 3D Y ───
    const pts = this.sampleCenterline();
    this.centerlineSamples = pts;
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

      // Tangent (XZ plane only — no banking; perpendicular stays horizontal)
      const fdx = next.x - curr.x;
      const fdz = next.z - curr.z;
      const bdx = curr.x - prev.x;
      const bdz = curr.z - prev.z;
      let tx = fdx + bdx;
      let tz = fdz + bdz;
      const tlen = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= tlen;
      tz /= tlen;

      const px = -tz;
      const pz = tx;

      // Both edges at the same Y as centerline (flat road cross-section)
      positions.push(curr.x + px * hw, curr.y + 0.01, curr.z + pz * hw);
      positions.push(curr.x - px * hw, curr.y + 0.01, curr.z - pz * hw);

      if (i > 0) cumLen += Math.sqrt(fdx * fdx + fdz * fdz);
      const u = cumLen / 16;
      uvs.push(0, u, 1, u);
    }

    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = ((i + 1) % n) * 2;
      const d = c + 1;
      indices.push(a, c, b, c, d, b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geo.computeVertexNormals();
    const ribbon = new THREE.Mesh(geo, asphaltMat);
    ribbon.receiveShadow = true;
    scene.add(ribbon);

    // ── Inner curbs: built as BufferGeometry ribbons stuck to inside edge ─
    // Curb lies ON the road, occupying the innermost curbWidth metres of the
    // track surface. Y follows segment elevation so it sits flush on slopes.
    for (const seg of this.segments) {
      if (seg.kind !== 'arc') continue;
      this.buildArcCurb(scene, seg, innerCurbMat);
    }

    // ── Start/Finish line: visible checkered band across the track ───────
    this.buildStartFinishLine(scene);
  }

  /** Build inner curb as a BufferGeometry ribbon that follows segment elevation. */
  private buildArcCurb(scene: THREE.Scene, seg: ArcSeg, mat: THREE.Material): void {
    const innerR = seg.radius - this.trackHalfWidth;    // track inner edge
    const outerR = innerR + this.curbWidth;             // curb's outer edge (on track)
    const arcLen = Math.abs(seg.sweep) * seg.radius;
    const n = Math.max(16, Math.ceil(arcLen / 3));

    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const angle = seg.startAngle + t * seg.sweep;
      const y = seg.startY + t * (seg.endY - seg.startY) + this.curbHeight;
      // a = at innerR (track inner edge), b = at outerR (deeper into road)
      positions.push(
        seg.cx + innerR * Math.cos(angle), y, seg.cz + innerR * Math.sin(angle),
        seg.cx + outerR * Math.cos(angle), y, seg.cz + outerR * Math.sin(angle),
      );
    }

    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = (i + 1) * 2;
      const d = c + 1;
      // Determine winding so top face points up. For CCW arcs (sweep > 0)
      // inner radius is on the "left" of forward, swept counterclockwise.
      if (seg.sweep > 0) {
        indices.push(a, c, b, c, d, b);
      } else {
        indices.push(a, b, c, c, b, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
  }

  /** Visible checkered start/finish line at the startLine position. */
  private buildStartFinishLine(scene: THREE.Scene): void {
    const checkerTex = this.makeCheckeredTexture();
    const sf = this.startLine;
    const width = 4;
    const length = this.trackHalfWidth * 2;
    const geo = new THREE.PlaneGeometry(width, length);
    const mat = new THREE.MeshBasicMaterial({ map: checkerTex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const y = this.heightAt(sf.cx, sf.cz) + 0.03;
    mesh.position.set(sf.cx, y, sf.cz);
    scene.add(mesh);
  }

  private makeCheckeredTexture(): THREE.CanvasTexture {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 256;
    const ctx = cv.getContext('2d')!;
    const cellsX = 2;
    const cellsY = 8;
    const cellW = cv.width / cellsX;
    const cellH = cv.height / cellsY;
    for (let y = 0; y < cellsY; y++) {
      for (let x = 0; x < cellsX; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  isOnTrack(x: number, z: number): boolean {
    const hw = this.trackHalfWidth + 0.5;
    for (const seg of this.segments) {
      if (seg.kind === 'straight') {
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
