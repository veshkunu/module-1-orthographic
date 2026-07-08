// labelLayer.js — the CSS2D label layer (leaf module, ADR-007/ADR-033): every
// DOM label that names things in the viewport — the wedge's six lettered
// corners (A–F), the "Projection Plane" callout, "The View" callout on the
// formed outline, and a live "∠ …°" readout at the plane showing the current
// projector angle (Step 5's perpendicular-vs-oblique payoff, doubling as the
// platform's "show real values, not vibes" numeric readout, PRODUCT.md §4.4).
//
// WHY CSS2D (RULES.md §3.27): a CSS2DObject is a real DOM node positioned at a
// 3D point — crisp at any DPR, themed from the same CSS tokens as the chrome
// (the .lbl / .lbl--chip classes in index.html), and readable by assistive
// tech.
//
// DISPOSAL (RULES.md §3.5): clear()/dispose() physically remove every
// CSS2DObject's backing DOM node before dropping the objects — Three's own
// cleanup only fires on a direct remove(), so a group-level clear alone would
// strand every label's <div> in the overlay.
//
// Layering (RULES.md §3.6): leaf module — imports three + CSS2DObject +
// wedgeGeometry.js + projectors.js's pure getLandingPoints() (the shared
// pure-data/math carve-out) only, never a sibling behaviour leaf.

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as THREE from 'three';
import { VERTEX_ORDER, worldVertices } from './wedgeGeometry.js';
import { getLandingPoints } from './projectors.js';
import { RayMode } from './orthoData.js';

// ── Fixed viewport anchors (world units — hand-placed against the plane's
//    known 9×9 sheet centred at y = 0.9, matching projectionPlane.js). ──
const PLANE_LABEL_ANCHOR = [-3.6, 4.15, 0.05];

/** Outward nudge for each vertex letter, so the chip sits just clear of the
 *  solid's own edges rather than sitting on top of the corner. */
const LETTER_OFFSET = { A: [-0.3, -0.1, 0.35], B: [-0.3, -0.1, -0.35], C: [-0.3, 0.35, 0], D: [0.3, -0.1, 0.35], E: [0.3, -0.1, -0.35], F: [0.3, 0.35, 0] };

/**
 * @param {Object} [options]
 * @param {number} [options.width=1]
 * @param {number} [options.height=1]
 * @returns {{
 *   group: THREE.Group,
 *   generate: (state: { view: object, rotationY: number, tiltDeg: number }) => void,
 *   setResolution: (w: number, h: number) => void,
 *   clear: () => void,
 *   dispose: () => void,
 * }}
 */
export function createLabelLayer({ width = 1, height = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'Orthographic Projection Labels';

  /** One label: a DOM node wrapped in a CSS2DObject at a world anchor. */
  function makeLabel(text, className, x, y, z) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.set(x, y, z);
    obj.center.set(0.5, 0.5);
    group.add(obj);
    return obj;
  }

  return {
    group,

    /**
     * (Re)build every label for the current state — clears first, so it is
     * safe to call repeatedly.
     * @param {Object} state
     * @param {Object} [state.view]        The merged currentView flags.
     * @param {number} [state.rotationY=0] The wedge's current turntable angle.
     * @param {number} [state.tiltDeg=90]  The current projector tilt.
     */
    generate({ view = {}, rotationY = 0, tiltDeg = 90 } = {}) {
      this.clear();

      // ── Vertex letters (Step 2+).
      if (view.showLabels) {
        const verts = worldVertices(rotationY);
        for (const id of VERTEX_ORDER) {
          const [ox, oy, oz] = LETTER_OFFSET[id];
          const v = verts[id];
          makeLabel(id, 'lbl lbl--chip lbl--ink', v.x + ox, v.y + oy, v.z + oz);
        }
      }

      // ── The plane callout (Step 3+).
      if (view.showPlane) makeLabel('Projection Plane', 'lbl lbl--plane', ...PLANE_LABEL_ANCHOR);

      // ── The perpendicularity readout (Step 5+) — a live numeric value at the
      //    plane, doubling as the "show real values" readout the design
      //    principles ask for (PRODUCT.md §4.4).
      if (view.showAngle) {
        const landings = getLandingPoints(rotationY, RayMode.PARALLEL, tiltDeg);
        const a = landings.A;
        makeLabel(`∠ ${Math.round(tiltDeg)}°`, 'lbl lbl--chip lbl--angle', a.x - 0.9, a.y - 0.5, 0.05);
      }

      // ── "The View" callout, floating above the formed outline (Step 6+).
      if (view.showView) {
        const landings = getLandingPoints(rotationY, RayMode.PARALLEL, tiltDeg);
        let topY = -Infinity;
        let midX = 0;
        for (const id of VERTEX_ORDER) { topY = Math.max(topY, landings[id].y); midX += landings[id].x; }
        midX /= VERTEX_ORDER.length;
        makeLabel('The View', 'lbl lbl--chip lbl--view', midX, topY + 0.45, 0.05);
      }
    },

    /** No fat lines here, but main.js drives resolution uniformly across the
     *  leaves on resize; accepted for contract parity (unused otherwise). */
    setResolution() {},

    /** Remove every CSS2DObject AND its backing DOM node (RULES.md §3.5). */
    clear() {
      const doomed = [];
      group.traverse((obj) => { if (obj.isCSS2DObject) doomed.push(obj); });
      for (const obj of doomed) {
        obj.element?.remove();
        obj.removeFromParent();
      }
    },

    /** Full disposal contract (ADR-004/RULES.md §3.5). */
    dispose() {
      this.clear();
      group.clear();
    },
  };
}
