---
name: Logic/view split for entities
description: Established pattern: pure logic class + sibling view class, both under src/entities/
type: feedback
---

Entities are split into a pure logic class and a Three.js-owning view class, both colocated under `src/entities/`. Example pair: `Car.ts` (position/yaw/speed, accepts a structural `CarInput` type) and `CarView.ts` (group, body/cabin/wheel meshes, `update(dt)` reads from `Car`).

**Why:** CLAUDE.md mandates "game logic must not depend on the renderer." This split lets the logic class be unit-tested headless while the view stays a thin syncing layer.

**How to apply:**
- New gameplay entity → write the pure class first with explicit input/output (Vector3 types are fine; structural input types > importing the concrete `Input` class).
- The view class holds `readonly group = new THREE.Group()` and an `update(dt)` that copies state from logic.
- `main.ts` is the wiring point: construct logic, construct view-from-logic, add `view.group` to the scene.
- Tests live as `<Name>.test.ts` next to the logic file. Don't write tests for the view classes — they're just transform-copy code.
- `LapTracker` and `GameState` follow the same shape on the core/ side: pure data + tests.
