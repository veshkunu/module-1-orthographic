// projectionPlane.js — the single, generic projection plane (leaf module,
// ADR-007/ADR-033): a flat standing sheet in the world XY plane (z = 0) that
// the object's shadow is cast onto.
//
// Deliberately NOT called "HP" or "VP" — those are the Spatial Framework
// topic's own vocabulary for a specific pair of named planes (RULES.md §1.14
// spirit: don't collide with a sibling topic's terms). This topic teaches the
// idea of A projection plane before any naming system exists, so it stays
// generic and singular.
//
// Colour (per curriculum-owner decision, 2026-07-09): the plane uses
// `--color-bench-grey` — the platform's existing "reference grid / inactive
// linework" token (DESIGN.md §2.1) — rather than a new token. This plane is
// exactly that: a neutral reference surface, not yet carrying HP/VP-specific
// meaning, so reusing the existing semantic is correct, not a placeholder.
// The Two-Cue Rule is satisfied by the "Projection Plane" text callout
// (labelLayer.js) standing in for a functional colour pairing.
//
// Layering (RULES.md §3.6): leaf module — imports three only, never a sibling
// leaf. main.js owns rebuild(); this builder hands back the standard leaf
// contract (no fold hinge here — unlike hvPlanes.js, there is only one static
// plane, nothing to rabattement).

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());
const mixToward = (a, b, t) => a.clone().lerp(b, t);

// ── Sheet + stroke constants ──
// Sheet trimmed from 9 to 7.5 (~17%) for a little breathing room around the
// scene. GRID.divs drops 18 → 15 in lockstep so GRID_CELL stays exactly 0.5 —
// the grid spacing is unchanged, there are just fewer cells on the smaller
// sheet. Purely visual: the projection math treats the plane as the infinite
// z = 0 plane, so landing points are unaffected.
const SHEET = 7.5;
const HALF = SHEET / 2;
const CENTER_Y = 0.9; // frame the sheet around the wedge's own vertical center
const LW_BORDER = 1.8;
const FILL_OPACITY = 0.09;
const GRID = { opacity: 0.5, fade: 0.6, divs: 15 };
const GRID_CELL = SHEET / GRID.divs; // = 0.5, identical to the old 9 / 18

/** The plane-hued cage grid (see hvPlanes.js's calmGrid — same treatment,
 *  single plane so no HP/VP map() indirection is needed). */
function buildGrid(hue, paper) {
  const pos = [];
  const steps = GRID.divs;
  for (let i = 0; i <= steps; i++) {
    const u = -HALF + i * GRID_CELL;
    pos.push(u, -HALF + CENTER_Y, 0, u, HALF + CENTER_Y, 0);
    pos.push(-HALF, -HALF + CENTER_Y + i * GRID_CELL, 0, HALF, -HALF + CENTER_Y + i * GRID_CELL, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: mixToward(hue, paper, GRID.fade),
    transparent: true, opacity: GRID.opacity, depthWrite: false,
  });
  const grid = new THREE.LineSegments(geo, mat);
  grid.renderOrder = -1;
  return grid;
}

/**
 * Build the single projection plane.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=1]  Viewport CSS px (LineMaterial.resolution).
 * @param {number} [opts.height=1]
 * @returns {{ group: THREE.Group,
 *             setOpacity: (k: number) => void,
 *             setResolution: (w: number, h: number) => void,
 *             dispose: () => void }}
 */
export function createProjectionPlane({ width = 1, height = 1 } = {}) {
  const paper = cssColor('--color-paper');
  const planeCol = cssColor('--color-bench-grey');
  const res = new THREE.Vector2(width, height);
  const group = new THREE.Group();
  const lineMats = [];
  const fadeMats = [];

  // Faint fill.
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(SHEET, SHEET),
    new THREE.MeshBasicMaterial({
      color: mixToward(planeCol, paper, 0.7),
      transparent: true, opacity: FILL_OPACITY, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  fill.position.set(0, CENTER_Y, 0);
  fill.renderOrder = -2;
  group.add(fill);
  fadeMats.push({ mat: fill.material, base: FILL_OPACITY });

  // Cage grid.
  const grid = buildGrid(planeCol, paper);
  group.add(grid);
  fadeMats.push({ mat: grid.material, base: GRID.opacity });

  // Fat-line border.
  const c = [-HALF, HALF];
  const corners = [
    [c[0], -HALF + CENTER_Y, 0], [c[1], -HALF + CENTER_Y, 0],
    [c[1], HALF + CENTER_Y, 0], [c[0], HALF + CENTER_Y, 0],
  ];
  const flat = [];
  for (let i = 0; i < corners.length; i++) flat.push(...corners[i], ...corners[(i + 1) % corners.length]);
  const borderGeo = new LineSegmentsGeometry();
  borderGeo.setPositions(flat);
  const borderMat = new LineMaterial({
    color: planeCol.getHex(), linewidth: LW_BORDER, worldUnits: false, transparent: true,
  });
  borderMat.resolution.set(res.x || 1, res.y || 1);
  const border = new LineSegments2(borderGeo, borderMat);
  group.add(border);
  lineMats.push(borderMat);
  fadeMats.push({ mat: borderMat, base: 1 });

  return {
    group,

    /** Whole-plane fade (intro / step transitions). Pure uniform writes — safe
     *  every tween frame. */
    setOpacity(k) {
      for (const { mat, base } of fadeMats) mat.opacity = base * k;
    },

    /** Keep the border LineMaterial's resolution in sync with the viewport
     *  (RULES.md §3.16). */
    setResolution(w, h) {
      for (const m of lineMats) m.resolution.set(w, h);
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
