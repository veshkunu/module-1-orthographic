// orthoData.js — the Orthographic Projection (Introduction) data layer. Adapted
// from the sibling topics' *Data.js shape (e.g. spatialData.js): stores raw
// numbers only — no Three.js, no DOM, no side effects. Every rebuild() call gets
// a fresh object from defaultOrthoData().
//
// This topic teaches the CONCEPT of orthographic projection with one solid, one
// plane, and one set of projectors — not quadrants, not first/third angle, not
// multiple coordinated views (those belong to the Spatial Framework / Points
// topics). So the data model is deliberately small: how far the object has been
// turned, whether the projectors are drawn perpendicular or tilted, and which of
// the two ray bundles (parallel vs. perspective) is on screen.

/**
 * @typedef {Object} OrthoData
 * @property {number} rotationY      The wedge's turntable rotation about the
 *   vertical (world Y) axis, in DEGREES, 0–360. Turning the object is what lets
 *   the learner see the formed view change shape (Step 6).
 * @property {number} projectorTilt  The parallel projector bundle's angle off the
 *   plane, in DEGREES, 60–90. 90 = perpendicular (the correct, textbook case);
 *   anything less is a deliberately WRONG oblique projection, kept dial-able so
 *   the learner can see the distortion it causes (Step 5).
 * @property {string} rayMode        One of RayMode's values — which ray bundle
 *   Step 4 is currently comparing.
 */

/** The two ray bundles Step 4 lets the learner compare. */
export const RayMode = Object.freeze({
  PARALLEL: 'parallel',       // orthographic — every ray shares one direction
  PERSPECTIVE: 'perspective', // a photograph — every ray converges on one eye point
});

/**
 * Canonical defaults: object square-on (0°), projectors perpendicular (90°),
 * parallel rays. Returns a fresh object every call so reset() never shares a
 * reference with a previous run.
 * @returns {OrthoData}
 */
export function defaultOrthoData() {
  return {
    rotationY: 0,
    projectorTilt: 90,
    rayMode: RayMode.PARALLEL,
  };
}
