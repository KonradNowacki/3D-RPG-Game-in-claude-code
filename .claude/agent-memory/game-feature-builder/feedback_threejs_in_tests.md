---
name: Three.js in vitest tests
description: Which Three.js primitives are safe to use inside unit tests, and which trigger renderer/jsdom problems
type: feedback
---

Three.js math and most geometry/material/Scene constructors run fine under vitest's default (node) environment — `RaceTrack.test.ts` constructs a `Scene`, `RingGeometry`, `MeshStandardMaterial`, `CanvasTexture` (via `World`-style helpers) without any setup and tests pass.

**Why:** No vitest jsdom config exists in the repo (`vite.config.ts` is empty, no `environment` flag). The 36-test suite runs green in node because none of those constructors touch `WebGLRenderer` or `gl`.

**How to apply:**
- Pure logic classes (Car, LapTracker, GameState) take Three.js math types (`Vector3`, etc.) and are trivially testable.
- A test may instantiate `THREE.Scene` and add geometry to verify level math (e.g. checkpoint placement vs `isOnTrack`).
- Avoid `WebGLRenderer`, `WebGLRenderTarget`, or anything that calls `gl.createTexture` in tests — that's where you'd need jsdom + headless-gl.
- `CanvasTexture` works in tests *only* if the test environment provides `document.createElement('canvas')` — which node alone does not. If you need it, gate the texture creation behind a `World` boundary (the renderer-owning class) and don't construct it from logic.
