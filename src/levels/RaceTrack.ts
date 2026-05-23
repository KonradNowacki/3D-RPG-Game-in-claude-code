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

  // Lateral extent of the grass embankment slope. Must be referenced by both
  // buildEmbankment (visual mesh) and groundHeightAt (physics) so that the
  // car sits on the visual surface exactly.
  private static readonly SKIRT_WIDTH = 35;

  readonly checkpoints: Checkpoint[];
  readonly startLine: StartLine;
  readonly segments: readonly Segment[];
  readonly startPosition: THREE.Vector3;
  readonly startYaw: number;

  /**
   * Centerline samples (x, y, z) used for ribbon mesh and heightAt queries.
   * `curbSide` is +1 if the curb is on the "+perp" side at this sample,
   * -1 if on the "-perp" side, or 0 if there's no curb (straight segment).
   */
  private centerlineSamples: Array<{ x: number; y: number; z: number; curbSide: number }> = [];

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
  private sampleCenterline(): Array<{ x: number; y: number; z: number; curbSide: number }> {
    const pts: Array<{ x: number; y: number; z: number; curbSide: number }> = [];
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
            curbSide: 0,
          });
        }
      } else {
        // For CCW arcs (sweep > 0) the arc center is on the +perp side of
        // forward — curb sits there. CW arcs put curb on the -perp side.
        const curbSide = seg.sweep > 0 ? +1 : -1;
        const arcLen = Math.abs(seg.sweep) * seg.radius;
        const n = Math.max(12, Math.ceil(arcLen / STEP));
        for (let i = 0; i < n; i++) {
          const t = i / n;
          const angle = seg.startAngle + t * seg.sweep;
          pts.push({
            x: seg.cx + seg.radius * Math.cos(angle),
            y: seg.startY + t * (seg.endY - seg.startY),
            z: seg.cz + seg.radius * Math.sin(angle),
            curbSide,
          });
        }
      }
    }
    return pts;
  }

  /** Returns the elevation (Y) of the track surface at a given (x, z) position. */
  heightAt(x: number, z: number): number {
    const samples = this.centerlineSamples;
    const n = samples.length;
    if (n === 0) return 0;
    if (n === 1) return samples[0].y;
    // Find the closest centerline segment (closed loop) and linearly interpolate Y
    // along it. Prevents Y from snapping between discrete samples on slopes.
    let bestDist = Infinity;
    let bestY = samples[0].y;
    for (let i = 0; i < n; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % n];
      const ax = a.x, az = a.z;
      const bx = b.x, bz = b.z;
      const ex = bx - ax;
      const ez = bz - az;
      const len2 = ex * ex + ez * ez;
      let t = len2 > 0 ? ((x - ax) * ex + (z - az) * ez) / len2 : 0;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = ax + ex * t;
      const pz = az + ez * t;
      const dx = x - px;
      const dz = z - pz;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        bestY = a.y + (b.y - a.y) * t;
      }
    }
    return bestY;
  }

  /**
   * Returns the terrain height at any world (x, z): track surface inside the
   * road, embankment slope on the skirt, or Y=0 on flat grass. The skirt
   * formula `trackY * (1 - s)^2` must match buildEmbankment exactly so the
   * car sits flush on the visual mesh instead of clipping or hovering.
   */
  groundHeightAt(x: number, z: number): number {
    const samples = this.centerlineSamples;
    const n = samples.length;
    if (n === 0) return 0;
    if (n === 1) return samples[0].y;
    let bestDist2 = Infinity;
    let bestTrackY = samples[0].y;
    for (let i = 0; i < n; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % n];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len2 = ex * ex + ez * ez;
      let t = len2 > 0 ? ((x - a.x) * ex + (z - a.z) * ez) / len2 : 0;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = a.x + ex * t;
      const pz = a.z + ez * t;
      const dx = x - px;
      const dz = z - pz;
      const d = dx * dx + dz * dz;
      if (d < bestDist2) {
        bestDist2 = d;
        bestTrackY = a.y + (b.y - a.y) * t;
      }
    }
    const lateral = Math.sqrt(bestDist2);
    if (lateral <= this.trackHalfWidth) return bestTrackY;
    const s = (lateral - this.trackHalfWidth) / RaceTrack.SKIRT_WIDTH;
    if (s >= 1) return 0;
    const falloff = (1 - s) * (1 - s);
    return bestTrackY * falloff;
  }

  private buildGeometry(scene: THREE.Scene): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.85,
      metalness: 0.0,
    });
    // Red-white striped curb material driven by a procedural texture
    const stripeTex = this.makeRedWhiteStripedTexture();
    const innerCurbMat = new THREE.MeshStandardMaterial({
      map: stripeTex,
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

    // ── Embankment skirts: smooth grass slopes under elevated sections ───
    this.buildEmbankment(scene, pts);

    // ── White side lines: continuous markings along both edges ───────────
    this.buildSideLines(scene, pts);

    // ── Banner barriers: vertical advertising panels along outer edge ────
    this.buildBanners(scene, pts);

    // ── Start/Finish line: visible checkered band across the track ───────
    this.buildStartFinishLine(scene);
  }

  /**
   * Build smooth grass embankment skirts on both sides of the road.
   * Where the road is elevated, the skirt forms a CURVED slope (quadratic
   * profile, drops fast near the road then tapers off) from the road
   * shoulder down to ground level (Y=0). On flat sections the skirt is
   * flush with the ground.
   *
   * Uses multiple cross-section layers per centerline sample to give a
   * smooth curved silhouette rather than a single flat facet.
   */
  private buildEmbankment(scene: THREE.Scene, pts: Array<{ x: number; y: number; z: number }>): void {
    const n = pts.length;
    const hw = this.trackHalfWidth;
    const SKIRT_WIDTH = RaceTrack.SKIRT_WIDTH;
    const LAYERS = 5;              // cross-section vertices per side (for smoothness)

    const grassTex = this.makeGrassTexture();
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.95,
      metalness: 0.0,
    });

    for (const side of [+1, -1] as const) {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i < n; i++) {
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const prev = pts[(i - 1 + n) % n];

        let tx = (next.x - curr.x) + (curr.x - prev.x);
        let tz = (next.z - curr.z) + (curr.z - prev.z);
        const tlen = Math.sqrt(tx * tx + tz * tz) || 1;
        tx /= tlen;
        tz /= tlen;
        const px = -tz * side;
        const pz =  tx * side;

        // Generate LAYERS cross-section vertices. t goes 0 (track shoulder)
        // to 1 (skirt foot at ground level). Y profile is quadratic for
        // smooth concave slope: y(t) = trackY * (1 - t)^2.
        for (let li = 0; li < LAYERS; li++) {
          const t = li / (LAYERS - 1);
          const lateral = hw + t * SKIRT_WIDTH;
          const yFalloff = (1 - t) * (1 - t);
          const xPos = curr.x + px * lateral;
          const zPos = curr.z + pz * lateral;
          const yPos = curr.y * yFalloff;
          positions.push(xPos, yPos, zPos);
          // UV tiles the grass texture — V follows track length, U lateral
          uvs.push(t * 2, i * 0.6);
        }
      }

      // Triangulate the (LAYERS-1) strips per cross-section, closing loop.
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        for (let li = 0; li < LAYERS - 1; li++) {
          const a = i  * LAYERS + li;
          const b = i  * LAYERS + li + 1;
          const c = i2 * LAYERS + li;
          const d = i2 * LAYERS + li + 1;
          if (side === +1) {
            indices.push(a, b, c, c, b, d);
          } else {
            indices.push(a, c, b, c, d, b);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, grassMat);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  /**
   * Build two continuous white side lines along the track edges. The line
   * on each side sits at the outermost stripe of asphalt; on segments where
   * a curb occupies the inner edge, the line is shifted inward by curbWidth
   * so it always stays on the asphalt just outside the curb.
   */
  private buildSideLines(
    scene: THREE.Scene,
    pts: Array<{ x: number; y: number; z: number; curbSide: number }>,
  ): void {
    const LINE_WIDTH = 0.3;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const side of [+1, -1] as const) {
      const positions: number[] = [];
      const indices: number[] = [];
      const n = pts.length;

      for (let i = 0; i < n; i++) {
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const prev = pts[(i - 1 + n) % n];

        let tx = (next.x - curr.x) + (curr.x - prev.x);
        let tz = (next.z - curr.z) + (curr.z - prev.z);
        const tlen = Math.sqrt(tx * tx + tz * tz) || 1;
        tx /= tlen;
        tz /= tlen;
        const px = -tz;
        const pz = tx;

        // Outer edge of line = at road edge, minus curb shift if curb on this side.
        const curbShift = (curr.curbSide === side) ? this.curbWidth : 0;
        const distOuter = (this.trackHalfWidth - curbShift) * side;
        const distInner = distOuter - LINE_WIDTH * side;

        const y = curr.y + 0.02; // slightly above asphalt to avoid z-fighting
        positions.push(curr.x + px * distOuter, y, curr.z + pz * distOuter);
        positions.push(curr.x + px * distInner, y, curr.z + pz * distInner);
      }

      for (let i = 0; i < n; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = ((i + 1) % n) * 2;
        const d = c + 1;
        if (side === +1) {
          indices.push(a, c, b, c, d, b);
        } else {
          indices.push(a, b, c, c, b, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, lineMat));
    }
  }

  /** Procedural grass texture for the embankment slopes. */
  private makeGrassTexture(): THREE.CanvasTexture {
    const size = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#4a8c50';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 25 + Math.random() * 35;
      const g = 90 + Math.random() * 70;
      const b = 20 + Math.random() * 25;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 3 + Math.random() * 7);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 30);
    return tex;
  }

  /** Procedural red/white striped texture for the curbs. */
  private makeRedWhiteStripedTexture(): THREE.CanvasTexture {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 32;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#cc1414';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(32, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Place vertical advertising banners at regular intervals along the outer
   * edge of the track. Each banner is a thin coloured panel standing upright
   * on the road shoulder; it serves as a visual track boundary.
   */
  private buildBanners(scene: THREE.Scene, pts: Array<{ x: number; y: number; z: number }>): void {
    const colors = [0xc62828, 0x1565c0, 0xf9a825, 0x2e7d32, 0xffffff, 0xff8f00];
    const BANNER_SPACING = 28;   // metres between banners
    const BANNER_W = 5;
    const BANNER_H = 1.8;

    const n = pts.length;
    let distSinceLast = BANNER_SPACING; // place first one immediately

    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const fdx = next.x - curr.x;
      const fdz = next.z - curr.z;
      const segLen = Math.sqrt(fdx * fdx + fdz * fdz);
      distSinceLast += segLen;

      if (distSinceLast < BANNER_SPACING) continue;
      distSinceLast = 0;

      // Tangent along forward direction
      const tx = fdx / (segLen || 1);
      const tz = fdz / (segLen || 1);
      // Outer perpendicular (right side of forward in our convention)
      const px = -tz;
      const pz = tx;

      // Place banner on the OUTER edge of the road (right side, away from inner curb)
      // For most arcs, "right side" of forward direction is the outer side of the turn.
      const bx = curr.x - px * (this.trackHalfWidth + 1.5);
      const bz = curr.z - pz * (this.trackHalfWidth + 1.5);
      const by = curr.y + BANNER_H / 2;

      const color = colors[Math.floor(((i / 4) % colors.length))];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      const geo = new THREE.PlaneGeometry(BANNER_W, BANNER_H);
      const mesh = new THREE.Mesh(geo, mat);
      // Orient the banner so its width follows the track tangent
      mesh.position.set(bx, by, bz);
      mesh.rotation.y = Math.atan2(tx, tz); // face perpendicular to tangent
      mesh.castShadow = true;
      scene.add(mesh);
    }
  }

  /**
   * Build inner curb as a BufferGeometry ribbon that follows segment elevation.
   * Includes UV coords so a red-white striped texture tiles along the arc
   * length, producing alternating ~1.5m red/white blocks.
   */
  private buildArcCurb(scene: THREE.Scene, seg: ArcSeg, mat: THREE.Material): void {
    const innerR = seg.radius - this.trackHalfWidth;    // track inner edge
    const outerR = innerR + this.curbWidth;             // curb's outer edge (on track)
    const arcLen = Math.abs(seg.sweep) * seg.radius;
    const n = Math.max(16, Math.ceil(arcLen / 3));
    const STRIPE_PERIOD = 3; // metres per red+white pair → ~1.5m blocks

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let cumLen = 0;
    let prevX = 0, prevZ = 0;

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const angle = seg.startAngle + t * seg.sweep;
      const y = seg.startY + t * (seg.endY - seg.startY) + this.curbHeight;
      const xInner = seg.cx + innerR * Math.cos(angle);
      const zInner = seg.cz + innerR * Math.sin(angle);
      const xOuter = seg.cx + outerR * Math.cos(angle);
      const zOuter = seg.cz + outerR * Math.sin(angle);

      if (i > 0) {
        const dx = xInner - prevX;
        const dz = zInner - prevZ;
        cumLen += Math.sqrt(dx * dx + dz * dz);
      }
      prevX = xInner;
      prevZ = zInner;

      // a = at innerR (track inner edge), b = at outerR (deeper into road)
      positions.push(xInner, y, zInner);
      positions.push(xOuter, y, zOuter);
      // U follows arc length so stripes appear along the curb; V across width
      const u = cumLen / STRIPE_PERIOD;
      uvs.push(u, 0);
      uvs.push(u, 1);
    }

    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = (i + 1) * 2;
      const d = c + 1;
      if (seg.sweep > 0) {
        indices.push(a, c, b, c, d, b);
      } else {
        indices.push(a, b, c, c, b, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
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

  isOnTrack(x: number, z: number, hwOverride?: number): boolean {
    const hw = hwOverride ?? (this.trackHalfWidth + 0.5);
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
