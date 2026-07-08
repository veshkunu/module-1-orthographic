// viewDrawing.js — the formed 2D view (leaf module, ADR-007/ADR-033): connects
// each corner's landing point on the plane the same way the wedge's own edges
// connect, so the flat outline traced on the plane always matches the solid's
// real geometry — the Step 6 payoff ("formation of the view").
//
// This is always the TRUE orthographic result — parallel projectors at
// whatever tilt Step 5 dialled in — regardless of Step 4's ray-mode compare
// toggle, which only ever affects the projector bundle shown in that one step
// (main.js forces rayMode back to PARALLEL once Step 4 is behind the learner).
//
// Drawing convention (ADR-016 §6.16–§6.17): landing points are thick filled
// dots; the flat view's own linework is SOLID (this is the finished drawing
// itself, not a 3D pictorial projector).
//
// Layering (RULES.md §3.6): leaf module — imports three + wedgeGeometry.js +
// projectors.js's pure getLandingPoints() (both the shared pure-data/math
// carve-out) only, never a sibling behaviour leaf.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EDGES } from './wedgeGeometry.js';
import { getLandingPoints } from './projectors.js';
import { RayMode } from './orthoData.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());

const LW_VIEW = 2.4;
const DOT_RADIUS = 0.09;

/** A thick filled dot at one landing point (ADR-016), lifted off the plane by
 *  a hair so it never z-fights the sheet fill. */
function landingDot(x, y, colour, paper) {
  const markers = [];
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(DOT_RADIUS * 1.6, 20),
    new THREE.MeshBasicMaterial({ color: paper, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }),
  );
  halo.position.set(x, y, 0.01);
  halo.renderOrder = 2;
  markers.push(halo);

  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(DOT_RADIUS, 20),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 1, depthTest: false, depthWrite: false }),
  );
  dot.position.set(x, y, 0.02);
  dot.renderOrder = 3;
  markers.push(dot);
  return markers;
}

/**
 * Build the formed view.
 *
 * @param {Object} [opts]
 * @param {number} [opts.rotationY=0]
 * @param {number} [opts.tiltDeg=90]
 * @param {number} [opts.width=1]
 * @param {number} [opts.height=1]
 * @returns {{ group: THREE.Group,
 *             setOpacity: (k: number) => void,
 *             setResolution: (w: number, h: number) => void,
 *             dispose: () => void }}
 */
export function createViewDrawing({ rotationY = 0, tiltDeg = 90, width = 1, height = 1 } = {}) {
  const paper = cssColor('--color-paper');
  const inkCol = cssColor('--color-ink');
  const res = new THREE.Vector2(width, height);
  const group = new THREE.Group();
  const fadeMats = [];

  const landings = getLandingPoints(rotationY, RayMode.PARALLEL, tiltDeg);

  // The outline — every wedge edge, connected between its two landing points.
  const flat = [];
  for (const [a, b] of EDGES) {
    const pa = landings[a];
    const pb = landings[b];
    flat.push(pa.x, pa.y, 0.015, pb.x, pb.y, 0.015);
  }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(flat);
  const mat = new LineMaterial({ color: inkCol.getHex(), linewidth: LW_VIEW, worldUnits: false, transparent: true });
  mat.resolution.set(res.x || 1, res.y || 1);
  const lines = new LineSegments2(geo, mat);
  group.add(lines);
  fadeMats.push(mat);

  // A thick dot at every landing point (ADR-016).
  for (const id of Object.keys(landings)) {
    const { x, y } = landings[id];
    for (const m of landingDot(x, y, inkCol, paper)) {
      group.add(m);
      fadeMats.push(m.material);
    }
  }

  return {
    group,

    /** Whole-drawing fade — rides the Step 6 dissolve alongside the wedge's
     *  own opposite fade (main.js drives both from the same easeDissolve tween). */
    setOpacity(k) {
      for (const m of fadeMats) m.opacity = k;
    },

    /** Keep resolution in sync with the viewport (RULES.md §3.16). */
    setResolution(w, h) {
      mat.resolution.set(w, h);
    },

    /** Full disposal contract (ADR-004). */
    dispose() {
      group.traverse((obj) => {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      group.clear();
    },
  };
}
