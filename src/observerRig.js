// observerRig.js — Step 1's observer illustration (leaf module, ADR-007/
// ADR-033): a small eye marker sitting AT THE LIVE CAMERA POSITION, with a few
// dashed sight-lines reaching out to some of the wedge's corners. Because the
// marker and lines are re-anchored to the camera every frame
// (updateFromCamera), orbiting the scene IS moving the observer — the
// concrete payoff Step 4 later contrasts against ("parallel projectors don't
// care where you stand").
//
// Cheap by construction: three line segments + one marker, rewritten in place
// each frame (no per-frame allocation) — safe to update every tick without
// the rAF-throttling machinery heavier topics need for full occlusion passes
// (RULES.md §3.19/§3.32 don't apply here; there is no per-edge visibility
// classification, just three fixed endpoints following the camera).
//
// Layering (RULES.md §3.6): leaf module — imports three only, never a sibling
// leaf. main.js calls updateFromCamera() once per render-loop tick, same as
// it ticks anim.js tweens.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());

const EYE_RADIUS = 0.14;
const LW_SIGHT = 1.4;
const DASH = { dashSize: 0.14, gapSize: 0.10 };

/** Rewrite an existing multi-segment fat line IN PLACE (positions + dash
 *  distances), so the sight-lines can re-stretch to the camera every frame
 *  without allocating new GPU buffers each tick (mirrors the sibling topics'
 *  fold-riding-projector pattern in point.js). */
function setSegments(line, flat) {
  const geo = line.geometry;
  const posBuf = geo.attributes.instanceStart.data; // shared with instanceEnd
  posBuf.array.set(flat);
  posBuf.needsUpdate = true;
  const distBuf = geo.attributes.instanceDistanceStart.data; // shared with …End
  const distArr = distBuf.array;
  for (let i = 0, seg = 0; i < flat.length; i += 6, seg++) {
    const len = Math.hypot(flat[i + 3] - flat[i], flat[i + 4] - flat[i + 1], flat[i + 5] - flat[i + 2]);
    distArr[seg * 2] = 0;
    distArr[seg * 2 + 1] = len;
  }
  distBuf.needsUpdate = true;
}

/**
 * Build the observer rig.
 *
 * @param {Object} opts
 * @param {{x:number,y:number,z:number}[]} opts.targets  A few wedge corners the
 *   sight-lines reach toward (2–3 is plenty — this is an illustration, not a
 *   full per-vertex bundle).
 * @param {number} [opts.width=1]
 * @param {number} [opts.height=1]
 * @returns {{ group: THREE.Group,
 *             updateFromCamera: (camera: THREE.Camera) => void,
 *             setOpacity: (k: number) => void,
 *             setResolution: (w: number, h: number) => void,
 *             dispose: () => void }}
 */
export function createObserverRig({ targets, width = 1, height = 1 } = {}) {
  const inkCol = cssColor('--color-ink');
  const paper = cssColor('--color-paper');
  const res = new THREE.Vector2(width, height);
  const group = new THREE.Group();
  const fadeMats = [];

  // The eye marker: a small ink sphere over a paper halo, exactly the point.js
  // marker treatment, so it reads as "a point in space" like P does in the
  // sibling topics.
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(EYE_RADIUS * 1.6, 16, 12),
    new THREE.MeshBasicMaterial({ color: paper, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }),
  );
  halo.renderOrder = 2;
  group.add(halo);
  fadeMats.push(halo.material);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(EYE_RADIUS, 20, 14),
    new THREE.MeshBasicMaterial({ color: inkCol, transparent: true, opacity: 1, depthTest: false, depthWrite: false }),
  );
  eye.renderOrder = 3;
  group.add(eye);
  fadeMats.push(eye.material);

  // Sight-lines: one dashed segment per target, all starting at the (as yet
  // unknown) camera position — seeded at the eye marker's own position so the
  // first frame before updateFromCamera() runs draws zero-length, invisible
  // segments rather than stale ones.
  const flat = [];
  for (const t of targets) flat.push(0, 0, 0, t.x, t.y, t.z);
  const geo = new LineSegmentsGeometry();
  geo.setPositions(flat);
  const mat = new LineMaterial({
    color: inkCol.getHex(), linewidth: LW_SIGHT, worldUnits: false,
    transparent: true, dashed: true, dashSize: DASH.dashSize, gapSize: DASH.gapSize, dashScale: 1,
  });
  mat.resolution.set(res.x || 1, res.y || 1);
  const lines = new LineSegments2(geo, mat);
  lines.computeLineDistances();
  lines.frustumCulled = false; // endpoints track the live camera — keep it out of culling
  group.add(lines);
  fadeMats.push(mat);

  return {
    group,

    /** Re-anchor the eye marker and every sight-line to the live camera
     *  position — called once per render-loop tick (main.js), same cadence as
     *  anim.js's tween ticking. Pure in-place buffer writes, safe every frame. */
    updateFromCamera(camera) {
      const { x: cx, y: cy, z: cz } = camera.position;
      halo.position.set(cx, cy, cz);
      eye.position.set(cx, cy, cz);
      const flatNow = [];
      for (const t of targets) flatNow.push(cx, cy, cz, t.x, t.y, t.z);
      setSegments(lines, flatNow);
    },

    /** Whole-rig fade (step transitions). */
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
