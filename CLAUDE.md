# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser-based 3D game built with **Three.js** and **TypeScript**, bundled with **Vite**.

## Current Project: Racing Game

The game has been rebuilt as an arcade-style racing simulator with the following features:

- **World:** 300×300m grass field with a technical racing circuit
- **HUD:** Real-time display of lap count, elapsed time, speed (km/h)
- **Win Condition:** Complete 3 laps to trigger "Race Complete!" overlay

### Skills Documentation

**Always consult skill files when modifying track or car:**

- **`.claude/skills/car/SKILL.md`** — Mercedes-AMG GTR specifications
  - 250 km/h (69.4 m/s) top speed, 30 km/h reverse
  - 500 HP acceleration curve, realistic physics model
  - Web Audio procedural engine/tire sound design
  
- **`.claude/skills/track/SKILL.md`** — Spa-Francorchamps circuit specifications
  - 7.2 km lap with 8 major corners (Eau Rouge, Raidillon, Kemmel, Pouhon, Les Combes, Blanchimont, Bus Stop)
  - Elevation changes, weather effects, checkpoint layout
  - Asphalt-only road with inner curbs at corners

## Agents

**Prefer using specialized agents rather than implementing directly.** Available agents:

- **game-feature-builder** — Use for implementing new game features, levels, mechanics, UI systems, and content additions. This agent handles architecture decisions, design validation, integration testing, and full implementation lifecycle.
- **docs-explorer** — Use for searching and synthesizing documentation across frameworks and libraries (Three.js, TypeScript, Vite, Vitest, physics libraries). Efficiently finds API details, best practices, and implementation guidance.
- **game-debugger** — Use when debugging unexpected behavior, crashes, or misbehavior in the 3D game. Traces root causes for physics issues, rendering problems, game state inconsistencies, and performance problems using systematic debugging methodology.
- **code-review-commit** — Use for reviewing newly written code in the current commit for performance issues, code quality, and readability. Focuses exclusively on changes in the current commit, not the entire codebase.

When you have a feature request, use the agent to design and implement it rather than coding directly. Agents provide better validation, testing, and architectural oversight.

## Engine: Three.js
Three.js was chosen for its:
- Largest WebGL ecosystem and community
- Full control over game architecture (not opinionated)
- Excellent TypeScript types (`@types/three`)
- Native GLTF/asset loader support
- Easy integration with physics libs (`@dimforge/rapier3d` or `cannon-es`)

## Commands

```bash
npm install         # Install dependencies
npm run dev         # Dev server with HMR at localhost:5173
npm run build       # Production build → dist/
npm run preview     # Preview production build locally
npm run lint        # Run ESLint
npm run test        # Run Vitest (all tests, single pass)
npm run test:watch  # Run Vitest in watch mode (TDD workflow)
```

## Testing (TDD)

**Vitest** is the test runner (shares Vite config, no extra setup). Tests live alongside source files as `*.test.ts`.

The critical architectural rule for TDD: **game logic must not depend on the renderer.** Three.js `WebGLRenderer` requires a real GPU/canvas and cannot run in jsdom. Keep logic (physics step, entity state, input processing, game rules) in pure classes that accept Three.js math types (`Vector3`, `Quaternion`) but never reference `WebGLRenderer` or `Scene` directly. Tests can then import and exercise logic without a browser.

```
src/core/Engine.test.ts      # Test game loop timing, delta, pause/resume
src/core/Input.test.ts       # Test key state mapping
src/entities/Player.test.ts  # Test movement, collision response logic
```

## Architecture

```
src/
  main.ts         # Entry — wires up Renderer, Scene, Camera, starts Engine
  core/
    Engine.ts     # requestAnimationFrame loop, delta time, pause/resume
    Input.ts      # Keyboard/mouse state, pointer lock
  scene/
    World.ts      # Scene graph, lighting, fog, environment
  entities/       # Player, enemies, interactable objects
  assets/         # GLTF loaders, texture helpers
public/           # Static assets (models, textures) — served as-is by Vite
index.html        # Vite entry point
```
    
Key Three.js objects flow: `WebGLRenderer` → `Scene` → `PerspectiveCamera` → `Engine` game loop calls `renderer.render(scene, camera)` each frame.

**Renderer boundary:** `World.ts` and `entities/` own Three.js scene objects. `Engine.ts` drives the loop and calls update on all systems — but the logic within each system is pure and testable without a GPU.

Physics (if added): integrate Rapier or cannon-es in `Engine.ts`, step the physics world before rendering.
