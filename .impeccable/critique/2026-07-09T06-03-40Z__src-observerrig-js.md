---
target: src/observerRig.js
total_score: 18
p0_count: 0
p1_count: 1
p2_count: 1
p3_count: 2
timestamp: 2026-07-09T06-03-40Z
slug: src-observerrig-js
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Marker/lines render once correctly, but nothing on-canvas reconfirms identity after the learner stops reading the step card. |
| 2 | Match System / Real World | 4 | Eye-dot + converging dashed lines is an intuitive "you are looking at this" metaphor. |
| 3 | User Control and Freedom | 3 | Free orbit, no lock-in; consistent with rest of scene. |
| 4 | Consistency and Standards | 1 | Every other sibling-labeled element (vertices, plane, view, angle) gets a CSS2D callout per DESIGN.md §5.9; the observer does not. |
| 5 | Error Prevention | n/a | Passive illustration leaf, no user input to err on. |
| 6 | Recognition Rather Than Recall | 1 | Step 4's compare-eye position (`projectors.js:42`) differs from Step 1's `EYE_POSITION` (`observerRig.js:35`) with nothing visual tying them together, despite copy claiming "just like Step 1" (`orthoSteps.js:134`). |
| 7 | Flexibility and Efficiency | n/a | No expert-mode shortcuts relevant to a fixed illustration. |
| 8 | Aesthetic and Minimalist Design | 4 | Two spheres + 2-3 dashed lines; nothing extraneous; matches Flat-Ink Rule. |
| 9 | Error Recovery | n/a | No error states possible in this leaf. |
| 10 | Help and Documentation | 3 | The `observer` term-popover (`orthoSteps.js:29-32`) covers the definition well once discovered. |
| **Total** | | **18/28** (7 of 10 heuristics scored; 3 n/a) | Acceptable band, weighed down by the missing label and the cross-step visual mismatch. |

#### Anti-Patterns Verdict

**LLM assessment**: Not generic AI-slop. The fixed-point-vs-camera-tracking header comment (`observerRig.js:9-14`) is unusually rigorous institutional memory, and the leaf reuses the platform's existing halo-over-ink-sphere point marker rather than inventing a new glyph. The real smell is documentation drift: `main.js`'s own comment describing this leaf contradicts the leaf's carefully-argued header, and the marker is the only visual element in the rig with no DOM/label counterpart — an integration gap, not a slop tell.

**Deterministic scan**: `detect.mjs --json src/observerRig.js` → exit 0, `[]`, 0 findings. Re-run across `src/main.js` + `src/orthoSteps.js` → exit 0, `[]`, 0 findings. Clean, and expected: the scanner targets markup/CSS anti-patterns, and this is Three.js scene-graph logic with no markup surface. No false positives to flag.

Mechanical facts (grep-level, Assessment B): imports `THREE`, `LineSegments2`, `LineSegmentsGeometry`, `LineMaterial` (all four present, lines 19-22) — correct fat-line convention. Colors sourced via `getComputedStyle` + `cssColor()` reading `--color-ink`/`--color-paper` (lines 24, 52-53); **zero hard-coded hex literals**. Full leaf contract present: `group`, `setOpacity`, `setResolution`, `dispose` all exported. No TODO/FIXME/HACK. 117 lines total.

**Visual overlays**: Not available. No browser automation tool is exposed in this session and no dev server was running, so no live WebGL screenshot or DOM overlay could be captured. This critique relies on source-level review plus the deterministic scan; treat visual-only claims (color collision, "reads as separate from the solid") as reasoned-from-code, not observed.

#### Overall Impression
The file is technically solid and consistent with its siblings' contract — the code review found no anti-pattern smells, and the deterministic scanner is clean. What holds it back is a set of small integration gaps around it: a stale comment in the orchestrator that could reintroduce an already-fixed bug, one un-labeled new noun in a topic that labels every other noun, a color choice that lets the annotation blend into the object it's supposed to be distinguished from, and a Step 1 → Step 4 "same picture" claim that doesn't actually reuse the same geometry. None of these are big; together they're why a technically-clean leaf still lands at "Acceptable" rather than "Good."

#### What's Working
- **Leaf contract fidelity**: `{ group, setOpacity, setResolution, dispose }` and the disposal traversal match `wedgeBlock.js`/`projectionPlane.js` byte-for-byte in shape — real consistency, not superficial.
- **The fixed-point design and its justification** (`observerRig.js:9-14`) is exemplary: it documents *why* the "obvious" simpler implementation (camera-tracked eye) is actually broken, preventing regression.
- **Token discipline**: zero hard-coded hex, colors read live via `getComputedStyle` — fully compliant with ADR-003.

#### Priority Issues

**[P1] Stale/contradictory orchestrator comment**
- **What**: `main.js` describes this leaf as a "camera-following observer illustration," directly contradicting `observerRig.js`'s own header and CLAUDE.md's explicit instruction not to "simplify this back to camera-tracking."
- **Why it matters**: A future editor reading only `main.js` could "fix" the code to match the wrong comment and reintroduce the exact bug that was already caught and fixed once.
- **Fix**: Reword the `main.js` comment to "Step 1's fixed-point observer illustration."
- **Suggested command**: `$impeccable harden` (docs/comments correctness) or a direct one-line edit.

**[P2] No in-canvas label for the observer**
- **What**: `labelLayer.js` labels vertices, the plane, the angle, and the view, but has no branch for the observer marker.
- **Why it matters**: Violates DESIGN.md §5.9's viewport-aid convention and Nielsen #4 (Consistency); the one brand-new vocabulary term Step 1 introduces has zero on-canvas anchor, so a learner who orbits away from the step card loses track of what the dot means.
- **Fix**: Add an "Observer" chip near `EYE_POSITION` in `labelLayer.js`'s `generate()`, gated on `view.showObserver`.
- **Suggested command**: `$impeccable clarify`

**[P3] Color hierarchy collision between sight-lines and solid edges**
- **What**: Sight-lines use `--color-ink` (`observerRig.js:52,85`), identical to the wedge's own edges (`wedgeBlock.js:21`), while `projectors.js` deliberately uses the muted `--color-ink-secondary` for its rays.
- **Why it matters**: At the exact step meant to teach "this is a sight-line, not part of the object," the annotation competes with the object instead of reading as secondary.
- **Fix**: Switch sight-lines to `--color-ink-secondary`.
- **Suggested command**: `$impeccable colorize`

**[P3] Fragile `targets` param has no default**
- **What**: `createObserverRig({ targets, ... })` has no default; iterating `targets` throws if omitted, unlike every sibling leaf's fully-defaulted options object.
- **Why it matters**: Inconsistent defensive-coding posture vs. siblings; a future caller mirroring another leaf's call pattern could crash.
- **Fix**: Default to `targets = []`.
- **Suggested command**: `$impeccable harden`

#### Persona Red Flags

**Jordan (First-Timer)**: The unlabeled dot (P2) forces reliance on memory of the step-card text rather than the scene itself. The ink-color collision (P3) risks reading the sight-lines as part of the solid on first glance — at the exact step meant to teach the sight-line/object distinction. Only 3 of 6 corners get sight-lines with no in-scene explanation of why those three.

**Sam (Accessibility-Dependent)**: The eye marker and sight-lines exist only as WebGL pixels — no CSS2D/DOM node — so nothing here is screen-reader-traversable, unlike the plane/view/vertex labels which at least expose an accessible chip via `labelLayer.js`.

#### Minor Observations
- `dispose()`'s traverse-and-destroy block is duplicated near-verbatim across `observerRig.js`, `wedgeBlock.js`, `projectionPlane.js` — a shared disposal helper would cut repetition (platform-wide pattern, not unique to this file).
- `EYE_RADIUS`/`DASH`-style constants duplicate similarly-shaped constants in `projectors.js`/`wedgeBlock.js` with no shared source of truth.

#### Questions to Consider
- If Step 4's "perspective, just like Step 1" claim doesn't reuse Step 1's actual eye position or geometry, is it really the same picture, or just a same-sounding one?
- Why does every other new noun in this topic (plane, view, angle, vertex) earn a text label the instant it appears, except the first one the learner meets?
