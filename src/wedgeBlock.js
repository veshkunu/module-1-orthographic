// wedgeBlock.js — the object leaf (ADR-007/ADR-033): renders the topic's one
// fixed illustrative solid (wedgeGeometry.js's triangular-prism wedge) as a
// hard-edged CAD-style mesh with crisp fat-line edges, sitting on a
// THREE.Group whose transform mirrors wedgeGeometry.worldVertex() exactly
// (rotation.y in radians, position = WORLD_OFFSET) — so the rendered solid and
// every plain-math consumer of worldVertices() always agree on where each
// corner is.
//
// Layering (RULES.md §3.6): leaf module — imports three + wedgeGeometry.js
// (the one shared pure-data/math file, the genericSolid.js-style carve-out)
// only, never a sibling behaviour leaf. main.js owns rebuild(); this builder
// is called from that one seam and hands back the standard leaf contract.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { VERTICES, EDGES, FACES, WORLD_OFFSET } from './wedgeGeometry.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());

const LW_EDGE = 2.2; // solid edge weight, px (RULES.md §3.12)

/** Build the hard-edged (non-indexed, duplicated-per-face) solid mesh from
 *  FACES/VERTICES (RULES.md §3.14 — shared/smoothed geometry would break the
 *  crisp CAD-outline look). */
function buildMesh(fillColor) {
  const positions = [];
  for (const [a, b, c] of FACES) {
    positions.push(...VERTICES[a], ...VERTICES[b], ...VERTICES[c]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhongMaterial({
    color: fillColor,
    shininess: 0,        // flat CAD look, no PBR (RULES.md §3.24)
    side: THREE.DoubleSide,
    transparent: true,   // so setOpacity() can dissolve the solid (Step 6)
    polygonOffset: true, // keep the edge outline from z-fighting (RULES.md §3.18)
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Build every edge as one fat-line batch (LineSegments2 + LineMaterial —
 *  RULES.md §3.12–§3.13: LineBasicMaterial caps at 1px on most GPUs). */
function buildEdges(inkColor, res) {
  const flat = [];
  for (const [a, b] of EDGES) flat.push(...VERTICES[a], ...VERTICES[b]);
  const geo = new LineSegmentsGeometry();
  geo.setPositions(flat);
  const mat = new LineMaterial({
    color: inkColor.getHex(), linewidth: LW_EDGE, worldUnits: false, transparent: true,
  });
  mat.resolution.set(res.x || 1, res.y || 1);
  const line = new LineSegments2(geo, mat);
  return { line, mat };
}

/**
 * Build the wedge rig.
 *
 * @param {Object} [opts]
 * @param {number} [opts.rotationY=0]  Initial turntable angle in DEGREES, so a
 *   rebuild mid-drag lands in pose.
 * @param {number} [opts.width=1]      Viewport CSS px (LineMaterial.resolution).
 * @param {number} [opts.height=1]
 * @returns {{ group: THREE.Group,
 *             setOpacity: (k: number) => void,
 *             setResolution: (w: number, h: number) => void,
 *             dispose: () => void }}
 */
export function createWedgeBlock({ rotationY = 0, width = 1, height = 1 } = {}) {
  const fillColor = cssColor('--color-solid-fill');
  const inkColor = cssColor('--color-ink');
  const res = new THREE.Vector2(width, height);

  // The pivot carries the turntable rotation; its parent group carries the
  // fixed world placement — mirrors wedgeGeometry.worldVertex() exactly
  // (rotate about Y first, then translate by WORLD_OFFSET).
  const group = new THREE.Group();
  group.position.set(WORLD_OFFSET.x, WORLD_OFFSET.y, WORLD_OFFSET.z);
  const pivot = new THREE.Group();
  pivot.rotation.y = (rotationY * Math.PI) / 180;
  group.add(pivot);

  const mesh = buildMesh(fillColor);
  pivot.add(mesh);

  const { line: edges, mat: edgeMat } = buildEdges(inkColor, res);
  pivot.add(edges);

  const fadeMats = [mesh.material, edgeMat];

  return {
    group,

    /** Fade the whole solid in/out (the Step 6 "reveal the flat view" dissolve
     *  rides `1 − easeDissolve(t)` on this). */
    setOpacity(k) {
      for (const m of fadeMats) m.opacity = k;
    },

    /** Keep the edge LineMaterial's resolution in sync with the viewport
     *  (RULES.md §3.16). */
    setResolution(w, h) {
      edgeMat.resolution.set(w, h);
    },

    /** Full disposal contract (ADR-004): free every geometry + material this
     *  builder created, then empty the group. */
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
