// wedgeGeometry.js — pure vertex/edge/face data + pure math for the topic's one
// fixed illustrative solid (a triangular-prism wedge). This topic teaches ONE
// object, not a parametric shape family, so there is no factory/generator
// contract to satisfy (unlike Module 2's iShape.js) — just the fixed numbers.
//
// This is the one file multiple sibling leaves (wedgeBlock.js, projectors.js,
// viewDrawing.js, labelLayer.js, main.js) are allowed to import, the same
// carve-out ADR-007 makes for genericSolid.js: it is pure data + pure math, no
// Three.js, no DOM, no state, so importing it everywhere cannot create the
// hidden coupling the no-cross-import rule (RULES.md §3.6) guards against.
//
// Local object space (before the object's world placement/turntable rotation):
// six corners, lettered A–F, forming a ridge running along local X — a
// triangular cross-section in the Y-Z plane, extruded from x=-1 to x=+1:
//
//        C (ridge, left)                F (ridge, right)
//       / \                            / \
//      A---B  (base, left)            D---E  (base, right)
//
// A/D sit toward the viewer (local z > 0), B/E away from the viewer (z < 0), so
// at rotationY = 0 the wedge's long axis (X) runs parallel to the projection
// plane and its front view is a plain rectangle; turning it toward 90° swings
// the ridge to face the plane and the front view becomes the wedge's true
// triangular profile — the Step 6 payoff (a different orientation genuinely
// produces a different-shaped view).

/** @typedef {'A'|'B'|'C'|'D'|'E'|'F'} WedgeVertexId */

/** Stable iteration order for every consumer (labels, projector bundles, …). */
export const VERTEX_ORDER = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

/** Local-space corner positions (world units). */
export const VERTICES = Object.freeze({
  A: Object.freeze([-1, -0.8, 0.7]),
  B: Object.freeze([-1, -0.8, -0.7]),
  C: Object.freeze([-1, 0.8, 0]),
  D: Object.freeze([1, -0.8, 0.7]),
  E: Object.freeze([1, -0.8, -0.7]),
  F: Object.freeze([1, 0.8, 0]),
});

/** The nine edges (letter pairs) — every straight line on the solid. Consumed
 *  both for the wireframe overlay (wedgeBlock.js) and to connect the projected
 *  landing points into the formed view (viewDrawing.js), so the view's outline
 *  always matches the solid's real edges. */
export const EDGES = Object.freeze([
  ['A', 'B'], ['B', 'C'], ['C', 'A'], // left triangular cap
  ['D', 'E'], ['E', 'F'], ['F', 'D'], // right triangular cap
  ['A', 'D'], ['B', 'E'], ['C', 'F'], // the three edges connecting the caps
]);

/** The eight triangulated faces (letter triples) — used to build the solid's
 *  hard-edged mesh (RULES.md §3.14: duplicated vertices per face, no shared/
 *  smoothed geometry, so the edges stay crisp). Winding is not load-bearing —
 *  the solid material renders THREE.DoubleSide. */
export const FACES = Object.freeze([
  ['A', 'B', 'C'], ['D', 'F', 'E'],          // the two triangular caps
  ['A', 'B', 'E'], ['A', 'E', 'D'],          // the base rectangle
  ['A', 'D', 'F'], ['A', 'F', 'C'],          // the front slanted face
  ['B', 'C', 'F'], ['B', 'F', 'E'],          // the back slanted face
]);

/** Where the wedge's local origin sits in world space — in front of the
 *  projection plane (which stands at world z = 0), lifted to roughly eye level
 *  for the default camera framing. */
export const WORLD_OFFSET = Object.freeze({ x: 0, y: 0.9, z: 2.6 });

/**
 * Rotate a local-space point about the world Y axis (the turntable), then
 * translate it to the wedge's world placement. Pure math — the one shared
 * source both wedgeBlock.js's THREE.Group transform and every plain-math
 * consumer (projectors.js, viewDrawing.js, labelLayer.js) derive from, so a
 * rotated vertex can never disagree between the rendered mesh and the
 * projected view.
 *
 * @param {readonly [number, number, number]} local
 * @param {number} rotationYDeg  Turntable angle in degrees.
 * @returns {{x:number, y:number, z:number}}
 */
export function worldVertex(local, rotationYDeg) {
  const rad = (rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [lx, ly, lz] = local;
  // Standard rotation about Y: x' = x·cosθ + z·sinθ ; z' = -x·sinθ + z·cosθ.
  const x = lx * cos + lz * sin;
  const z = -lx * sin + lz * cos;
  return { x: x + WORLD_OFFSET.x, y: ly + WORLD_OFFSET.y, z: z + WORLD_OFFSET.z };
}

/**
 * Every corner's current WORLD position, keyed by letter.
 * @param {number} rotationYDeg
 * @returns {Record<WedgeVertexId, {x:number,y:number,z:number}>}
 */
export function worldVertices(rotationYDeg) {
  /** @type {any} */
  const out = {};
  for (const id of VERTEX_ORDER) out[id] = worldVertex(VERTICES[id], rotationYDeg);
  return out;
}
