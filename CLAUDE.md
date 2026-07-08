# CLAUDE.md — Simatrix · Module 1 Topic 4: Orthographic Projection (Introduction)

> **STATUS: BUILT (2026-07-09)** — data layer, the 7-step guided sequence, the
> wedge/plane/projector/view geometry leaves, the CSS2D label layer, glossary
> popovers, and the parameter dock are all wired through `src/main.js`.
> Pending: headless verification (ADR-019) against a running server, and
> registration in the root `ARCHITECTURE.md` / `CHANGELOG.md`.

This topic teaches the **concept of orthographic projection itself** — before
any of the machinery Module 1's other topics build on top of it. A learner
manipulates one solid, one projection plane, and one bundle of projectors, and
discovers by direct interaction:

- what a projection plane is,
- why projectors run parallel (contrasted against ordinary, converging
  perspective sight-lines),
- why projectors must be perpendicular to the plane (contrasted against a
  dial-able oblique tilt that visibly distorts the result),
- how a 3D object's corners become a flat 2D view, and
- why that guarantee (a flat drawing whose measurements can be trusted) is
  what makes orthographic projection the basis of engineering drawing.

## Scope — deliberately narrow (do not expand)

This is an **introduction**. It does **not** teach: First-Angle or
Third-Angle projection, quadrants, sectional views, auxiliary views, or
textbook drawing problems. Those are the `graphics_module_1_topic_2_spatial_framework`
(Quadrants + First-Angle) and `graphics_module_1_topic_3_points` /
`…_topic_lines` topics' job — this topic exists so a learner has the
underlying concept in hand *before* meeting those. Do not add a Problem
Library, a second plane, or a first/third-angle layout to this topic; if that
content is wanted, it belongs in a sibling topic, not a scope-creep here.

## Project-wide documentation (read before cross-module tasks)
Before starting any task that touches shared behavior, UI patterns,
or cross-module consistency, read these root-level files:
- ../ARCHITECTURE.md  — system map, component breakdown, data flow
- ../DECISIONS.md     — why key decisions were made (ADR log)
- ../RULES.md         — what you must and must not do (enforcement)
- ../DESIGN.md        — color tokens, typography, component standards
- ../PRODUCT.md       — who it's for, features, accessibility commitments

For module-specific work that doesn't touch shared behavior,
reading the root docs is optional but recommended.

**Design system rules:** Always read and strictly follow the consolidated platform design
system at `../DESIGN.md` (Simatrix root) for all colour, typography, spacing, component
styling, and UI/UX decisions — Module 2 is its master/reference implementation. Strategic
context — users, brand personality, anti-references, design principles, accessibility
commitments — lives in the consolidated root `../PRODUCT.md` (the single platform-wide
product contract; ADR-023). Never hard-code design values in CSS or JS — consume tokens
defined in `../DESIGN.md`. This topic does **not** and must **not** carry a local
`DESIGN.md`/`PRODUCT.md` copy (ADR-028, RULES.md §1.14).

**Scope boundary:** This module produces a self-contained Three.js *simulation payload* —
the 3D viewport plus its parameter dock, sliders, toggles, inline hints, and sim-internal
animations. The host Simatrix website (top-level navbar, module browser, account UI,
marketing chrome, login, dashboard) is built by other web developers and is **out of scope**
here.

---

## Architecture — Module 2 orchestrator pattern (ADR-033, overturns ADR-011 for this topic)

Per **ADR-033**, Module 1's remaining topics adopt **Module 2's orchestrator +
leaf-module pattern** (ADR-007) instead of the shared-`engine.js` + thin-page
structure (ADR-011). Concretely for this topic:

- `src/main.js` is the **orchestrator**: it owns the scene, the camera/
  `OrbitControls` (a single fixed 3/4 vantage — this topic needs no camera
  flights, no quadrant walk, no ortho quick-view; that machinery belongs to
  the Spatial Framework / Points topics), the single `rebuild()` pipeline (with
  the full WebGL disposal contract, ADR-004), the render loop, and
  `window.simAPI`.
- Leaf modules hang off `main.js` and **do not import one another** (ADR-007's
  star topology), with ONE deliberate carve-out mirroring `genericSolid.js`:
  **`wedgeGeometry.js`** is pure vertex/edge/face data + pure math (no THREE,
  no DOM), so `wedgeBlock.js`, `projectors.js`, `viewDrawing.js`, and
  `labelLayer.js` may all import it — it cannot create the hidden coupling the
  no-cross-import rule guards against (RULES.md §3.6). `projectors.js` also
  exports one pure function, `getLandingPoints()`, that `viewDrawing.js` and
  `labelLayer.js` import for the same reason (it is math, not behaviour).
- Built leaves: `wedgeBlock.js` (the one fixed illustrative solid — a
  triangular-prism wedge, NOT a parametric shape family; this topic teaches
  one object, so there is no `iShape.js`-style generator contract to satisfy),
  `projectionPlane.js` (the single generic projection plane), `projectors.js`
  (the parallel/perspective ray bundle + the perpendicular-vs-oblique tilt),
  `viewDrawing.js` (the formed 2D outline), `observerRig.js` (Step 1's
  camera-following sight-lines), `labelLayer.js` (CSS2D callouts), plus the
  chrome leaves `stepper.js`, `terms.js`, `uiManager.js`. Every geometry leaf
  exposes `{ group, setOpacity, setResolution, dispose }` (some add their own
  extras: `observerRig.js` adds `updateFromCamera()`).
- **No solid machinery beyond a fixed mesh.** Because the wedge is one
  hand-authored shape (not a parametric family), this topic has no
  `meshAnalyzer.js`, no `projectionDrawer.js`, and no hidden/visible edge
  classification — the formed view is simply the silhouette + edges of a
  convex solid, which never needs occlusion logic. Line-TYPE teaching
  (visible/hidden/centre lines) is `graphics_module_1_topic_1_foundations`'s
  job, not this topic's.
- **World axes:** the projection plane stands in the world XY plane at
  `z = 0`; the wedge sits in front of it at `z > 0`
  (`wedgeGeometry.WORLD_OFFSET`). This is the SAME z > 0 "in front of the
  plane" convention the Spatial Framework topic uses for its VP, but this
  topic's plane is deliberately **not named HP or VP** — it is introduced
  before that naming system exists (RULES.md §1.14 spirit: don't collide with
  a sibling topic's vocabulary).
- **Plane colour:** the projection plane renders in `--color-bench-grey`
  (curriculum-owner decision, 2026-07-09) — the platform's existing
  "reference grid / inactive linework" token — rather than a new token or the
  HP-teal/VP-amber hues those belong to the Spatial Framework topic.
- No shared `Module1/src/engine.js` frame is used here — this topic does not
  call `initSim()` and never will.
- **Sibling for cross-reference:** `../graphics_module_1_topic_2_spatial_framework`
  is the closest working example of this pattern (orbitable scene,
  `window.simAPI`, disposal contract, guided stepper, CSS2D labels). Its
  HP/VP fold and quadrant machinery is **not** relevant here — this topic has
  one static plane, no rabattement.

## Platform contract (already wired — do not add a second path)

- **`meta.json`** at the folder root carries all four required fields
  (`title`, `description`, `difficulty`, `tags` — RULES.md §2.11).
- **`window.simAPI`** (`src/main.js`) exposes `pause()` / `resume()` /
  `reset()`. `reset()` routes through the single `rebuild()` pipeline; there
  is no second reset path (RULES.md §2.9).
- **Mobile notice**, boot watchdog + WebGL fallback, and the reduced-motion
  collapse are wired in `index.html`/`main.js`.
- **Self-starting**: `src/main.js` calls `init()` itself at module load; no
  external caller.

## File structure

```
graphics_module_1_topic_4_orthographic_projection/
├── index.html            ← thin shell (importmap + canvas + 7-step wizard chrome)
├── meta.json              ← platform metadata
├── CLAUDE.md              ← THIS file
├── assets/fonts/          ← bundled woff2 (byte-identical to the platform set)
└── src/
    ├── main.js            ← orchestrator: scene, OrbitControls (one fixed vantage,
    │                         no camera flights), single rebuild() pipeline, the
    │                         Step-6 dissolve tween (easeDissolve), step-transition
    │                         fade-ins (easeDraw), window.simAPI
    ├── anim.js            ← tween/easing engine, byte-identical to the platform copy
    ├── orthoData.js       ← pure data: rotationY / projectorTilt / rayMode + RayMode enum
    ├── orthoSteps.js      ← pure data: the 7-step sequence + TERMS glossary + DEFAULT_VIEW
    ├── wedgeGeometry.js   ← pure vertex/edge/face data + pure math (worldVertex/worldVertices)
    │                         for the one fixed wedge — the genericSolid.js-style shared
    │                         file multiple leaves may import
    ├── wedgeBlock.js      ← the object leaf: hard-edged mesh + fat-line edges
    ├── projectionPlane.js ← the single generic projection plane leaf
    ├── projectors.js      ← the parallel/perspective ray-bundle leaf + getLandingPoints()
    ├── viewDrawing.js     ← the formed 2D view leaf (landing-point dots + outline)
    ├── observerRig.js     ← Step 1's eye marker + camera-following sight-lines
    ├── labelLayer.js      ← CSS2D callouts: vertex letters A–F, plane/view labels,
    │                         the live "∠ …°" projector-angle readout
    ├── stepper.js         ← guided-step controller + the discrete ray-mode / dissolve
    │                         toggles (continuous sliders live in uiManager.js instead)
    └── uiManager.js       ← the projector-tilt (Step 5) / rotation (Step 6) sliders,
                              each revealed independently — never both on stage at once
```

## Non-negotiables inherited from the platform (apply unchanged)

- No build step; CDN ES modules pinned to **three@0.160.0** via the exact
  import map; `.js` extensions on every import; all paths relative (ADR-001).
- Single `rebuild()` is the only path for geometry change; full disposal
  contract every rebuild (verify `renderer.info.memory` stays flat across 50
  rebuilds — ADR-004).
- Read all colours from CSS tokens — never hard-code hex (ADR-003).
- `LineMaterial` + `LineSegments2` for any fat linework; keep `resolution` in
  sync on resize (ADR-006). 3D pictorial projectors stay dashed (ADR-016
  §6.17); the formed view's own linework is solid.
- A new leaf module must not import a sibling leaf — only `wedgeGeometry.js`
  (pure data/math) and `projectors.js`'s `getLandingPoints()` are the
  documented shared exceptions (ADR-007, RULES.md §3.6).

---

*Module 1 Topic 4 — Orthographic Projection (Introduction) · Module-2
orchestrator pattern (ADR-033, overturns ADR-011 for this topic) · data +
wizard + 3D geometry + CSS2D label layer + term popovers + parameter dock
built · Three.js 0.160.0 · no build tools.*

## Session Digest Protocol
At the end of every session (or when asked), produce a digest in this format:

### SESSION DIGEST — [date] — [feature/task]
**What changed:** (3–5 bullets, concrete)
**Decisions made:** (with brief rationale)
**Patterns introduced:** (reusable code patterns or conventions)
**Open questions / next steps:**
**Files modified:** (list)
