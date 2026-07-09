// projectors.js — the projector ray bundle (leaf module, ADR-007/ADR-033):
// draws one line from every wedge corner to its landing point on the
// projection plane (z = 0), in one of two modes:
//
//   PARALLEL     — every ray shares one direction. `tiltDeg` (60–90°, 90 =
//                  perpendicular) tilts that shared direction away from the
//                  plane's own perpendicular, letting Step 5 show the
//                  distorted, non-true-shape result of an oblique projection.
//   PERSPECTIVE  — every ray converges on one EYE point (Step 4's compare
//                  toggle), the way a camera or the human eye actually sees.
//
// Both modes are pure geometry (no Three.js needed to derive the landing
// points), so getLandingPoints() is exported standalone for viewDrawing.js to
// consume without duplicating this math (ADR-007's genericSolid.js-style
// carve-out — pure math, safe to share).
//
// Drawing convention (ADR-016 §6.17): these are 3D pictorial-view projectors,
// so they stay DASHED regardless of mode (only the flat 2D drawing's own
// projectors would be solid — this topic draws no such 2D sheet separately
// from the 3D scene).
//
// Layering (RULES.md §3.6): leaf module — imports three + wedgeGeometry.js
// (the shared pure-data file) only, never a sibling behaviour leaf.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { VERTEX_ORDER, worldVertices } from './wedgeGeometry.js';
import { RayMode } from './orthoData.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());

const LW_PROJECTOR = 1.6;
const DASH = { dashSize: 0.16, gapSize: 0.11 };

/** Where the compare toggle's perspective rays converge — well beyond the
 *  wedge, standing in for the eye of a camera looking at the object (fixed so
 *  the converging bundle reads clearly from any orbit angle). */
export const EYE_POINT = Object.freeze({ x: 0, y: 0.9, z: 9 });

/**
 * Where a single ray from `vertex` reaches the plane (world z = 0).
 *
 * @param {{x:number,y:number,z:number}} vertex
 * @param {string} mode         A RayMode value.
 * @param {number} tiltDeg      PARALLEL mode only: 90 = perpendicular to the
 *   plane; less tilts the shared ray direction, shearing the landing point
 *   sideways in Y in proportion to the vertex's own distance from the plane.
 * @returns {{x:number, y:number, z:number}}
 */
function landingPoint(vertex, mode, tiltDeg) {
  if (mode === RayMode.PERSPECTIVE) {
    // Ray from EYE_POINT through `vertex`, extended to z = 0.
    const dz = vertex.z - EYE_POINT.z;
    const s = -EYE_POINT.z / dz; // param where z(s) = 0 along EYE_POINT → vertex
    return {
      x: EYE_POINT.x + s * (vertex.x - EYE_POINT.x),
      y: EYE_POINT.y + s * (vertex.y - EYE_POINT.y),
      z: 0,
    };
  }
  // PARALLEL: shared direction (0, sinφ, -cosφ), φ = 90° − tiltDeg (0 at the
  // textbook-correct 90°, growing as the slider tilts away from perpendicular).
  const phi = ((90 - tiltDeg) * Math.PI) / 180;
  const dy = Math.sin(phi);
  const dz = -Math.cos(phi);
  const t = -vertex.z / dz; // param where z(t) = 0 along vertex + t·(0,dy,dz)
  return { x: vertex.x, y: vertex.y + t * dy, z: 0 };
}

/**
 * Every corner's landing point on the plane, keyed by letter — exported for
 * viewDrawing.js so the formed outline always matches the same rays drawn here.
 *
 * @param {number} rotationYDeg
 * @param {string} mode
 * @param {number} tiltDeg
 * @returns {Record<string, {x:number,y:number,z:number}>}
 */
export function getLandingPoints(rotationYDeg, mode, tiltDeg) {
  const verts = worldVertices(rotationYDeg);
  /** @type {any} */
  const out = {};
  for (const id of VERTEX_ORDER) out[id] = landingPoint(verts[id], mode, tiltDeg);
  return out;
}

/**
 * Build the projector ray bundle.
 *
 * @param {Object} [opts]
 * @param {number} [opts.rotationY=0]
 * @param {string} [opts.mode=RayMode.PARALLEL]
 * @param {number} [opts.tiltDeg=90]
 * @param {number} [opts.width=1]
 * @param {number} [opts.height=1]
 * @returns {{ group: THREE.Group,
 *             setOpacity: (k: number) => void,
 *             setResolution: (w: number, h: number) => void,
 *             dispose: () => void }}
 */
export function createProjectors({
  rotationY = 0, mode = RayMode.PARALLEL, tiltDeg = 90, width = 1, height = 1,
} = {}) {
  const projCol = cssColor('--color-ink-secondary');
  const res = new THREE.Vector2(width, height);
  const group = new THREE.Group();

  const verts = worldVertices(rotationY);
  const flat = [];
  for (const id of VERTEX_ORDER) {
    const v = verts[id];
    const land = landingPoint(v, mode, tiltDeg);
    flat.push(v.x, v.y, v.z, land.x, land.y, land.z);
  }

  const geo = new LineSegmentsGeometry();
  geo.setPositions(flat);
  const mat = new LineMaterial({
    color: projCol.getHex(), linewidth: LW_PROJECTOR, worldUnits: false,
    transparent: true, dashed: true, dashSize: DASH.dashSize, gapSize: DASH.gapSize, dashScale: 1,
  });
  mat.resolution.set(res.x || 1, res.y || 1);
  const lines = new LineSegments2(geo, mat);
  lines.computeLineDistances();
  group.add(lines);

  return {
    group,

    /** Whole-bundle fade (step transitions). */
    setOpacity(k) {
      mat.opacity = k;
    },

    /** Keep resolution in sync with the viewport (RULES.md §3.16). */
    setResolution(w, h) {
      mat.resolution.set(w, h);
    },

    /** Full disposal contract (ADR-004). */
    dispose() {
      geo.dispose();
      mat.dispose();
      group.clear();
    },
  };
}
