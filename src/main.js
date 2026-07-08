// Orchestrator (Module 1 Topic 4 — Orthographic Projection, Introduction).
//
// See ../CLAUDE.md. Boots an orbitable Three.js scene, the full platform
// contract (rebuild() pipeline, disposal contract, window.simAPI), the
// guided-step wizard (stepper.js driving the 7-step orthoSteps.js sequence),
// and the 3D lesson content on Module 2's orchestrator pattern (ADR-007,
// ADR-033): the one fixed wedge (wedgeBlock.js), the single projection plane
// (projectionPlane.js), the projector ray bundle (projectors.js), the formed
// 2D view (viewDrawing.js), Step 1's camera-following observer illustration
// (observerRig.js), and the CSS2D label layer (labelLayer.js).
//
// Scope (deliberate — do not expand): ONE object, ONE plane, no quadrants, no
// first/third-angle, no coordinated multi-view layout, no textbook problem
// set. Those belong to the Spatial Framework / Points / Lines topics.
//
// World axes: the projection plane stands in the world XY plane at z = 0; the
// wedge sits in front of it at z > 0 (wedgeGeometry.WORLD_OFFSET). Projectors
// run from the wedge toward the plane (parallel, or converging on
// projectors.EYE_POINT for the Step 4 perspective compare).
//
// Layering rule (ADR-007 / RULES.md §3.6): main.js is the orchestrator and the
// ONLY place leaf modules meet.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { defaultOrthoData, RayMode } from './orthoData.js';
import { DEFAULT_VIEW } from './orthoSteps.js';
import { VERTEX_ORDER, worldVertices } from './wedgeGeometry.js';
import { initStepper } from './stepper.js';
import { initTerms } from './terms.js';
import { initUIManager } from './uiManager.js';
import { createWedgeBlock } from './wedgeBlock.js';
import { createProjectionPlane } from './projectionPlane.js';
import { createProjectors } from './projectors.js';
import { createViewDrawing } from './viewDrawing.js';
import { createObserverRig } from './observerRig.js';
import { createLabelLayer } from './labelLayer.js';
import { tween, tick as tickTweens, cancelAll as cancelTweens, easeDissolve, easeDraw } from './anim.js';

const rootStyle = getComputedStyle(document.documentElement);
const cssColor = (name) => new THREE.Color(rootStyle.getPropertyValue(name).trim());

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A 3/4 vantage that keeps both the wedge (z ≈ 2.6) and the plane (z = 0) in
 *  frame, with enough depth between them that the projector bundle reads
 *  clearly. This is the ONLY camera pose this topic needs — no quadrant walk,
 *  no square-on quick-view (those belong to the Spatial Framework topic). */
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(6.2, 3.4, 8.6);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.9, 1.2);

/** The Step 6 dissolve: how long the wedge takes to fade away, on the named
 *  curve DESIGN.md's motion palette documents for exactly this move ("the 3D
 *  body dissolving into its flat drawing"). */
const DISSOLVE_MS = 900;

/** Ordinary step-transition fade-in duration (matches the sibling topics'
 *  fadeInLeaf timing). */
const FADE_MS = 560;

// ============================================================================
// Module state
// ============================================================================

let renderer;
let scene;
let camera;
let controls;
let viewport;
let labelRenderer;
let contentGroup;
let rafId = null;
let running = false;
let lastFrameTime = 0;

/** The single bag of numbers rebuild() consumes. Mutated ONLY via commit(). */
let currentData = defaultOrthoData();

/** The active step's viewport flags, merged over DEFAULT_VIEW by applyView(). */
let currentView = { ...DEFAULT_VIEW };

/** The geometry leaves' controller handles, rebuilt by rebuild(), or null
 *  while their view flag is off. */
let wedge = null;
let plane = null;
let projectors = null;
let viewDrawing = null;
let observer = null;
let labelLayer = null;

/** Whether the wedge is currently dissolved away (Step 6's "reveal the flat
 *  view" toggle) and whether that has happened at least once this run (the
 *  step's done-gate). Reset by simAPI.reset(). */
let flatOnly = false;
let dissolvedOnce = false;
let dissolveTween = null;
/** Live 0(shown)→1(hidden) wedge-dissolve level, re-stamped onto a freshly
 *  rebuilt wedge leaf so a rebuild mid-toggle (e.g. a rotation drag while
 *  dissolved) keeps the wedge hidden instead of popping back to full. */
let dissolveK = 0;

/** Per-leaf step-transition fade-in state (mirrors the sibling topics'
 *  fadeState — `leaf` reads the LIVE module handle so a rebuild mid-fade keeps
 *  animating the fresh instance). */
const fadeState = {
  wedge: { k: 1, tween: null, leaf: () => wedge },
  plane: { k: 1, tween: null, leaf: () => plane },
  projectors: { k: 1, tween: null, leaf: () => projectors },
  viewDrawing: { k: 1, tween: null, leaf: () => viewDrawing },
  observer: { k: 1, tween: null, leaf: () => observer },
};

/** The last view actually applied, for detecting what just turned on so only
 *  newly-shown leaves fade in (never re-fade something already on screen). */
let prevAppliedView = { ...DEFAULT_VIEW };

let stepper = null;
let ui = null;
const statusRegion = document.getElementById('sim-status');

// ============================================================================
// Small helpers
// ============================================================================

function viewportSize() {
  return { width: viewport?.clientWidth || 1, height: viewport?.clientHeight || 1 };
}

function announce(message) {
  if (statusRegion) statusRegion.textContent = message;
}

const TOAST_HOLD = 3500;
let toastEl = null;
let toastTimer = null;
let toastHideTimer = null;

/** A brief, calm success toast — the "lesson complete" win (platform pattern). */
function showToast(message) {
  toastEl ??= document.getElementById('sim-toast');
  if (!toastEl) return;
  const text = toastEl.querySelector('.sim-toast__text');
  if (text) text.textContent = message;
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('is-visible'));
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    toastHideTimer = setTimeout(() => { toastEl.hidden = true; }, 240);
  }, TOAST_HOLD);
}

function markBooted() {
  window.__simBooted = true;
  if (window.__simBootTimer) { clearTimeout(window.__simBootTimer); window.__simBootTimer = null; }
  const fallback = document.getElementById('sim-fallback');
  if (fallback) fallback.hidden = true;
}

// ============================================================================
// Scene bootstrap
// ============================================================================

function buildScene(container) {
  scene = new THREE.Scene();
  scene.background = cssColor('--color-paper');

  const { clientWidth: w, clientHeight: h } = container;

  camera = new THREE.PerspectiveCamera(45, (w || 1) / (h || 1), 0.1, 100);
  camera.position.copy(DEFAULT_CAMERA_POSITION);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = false; // no cast shadows (RULES.md §3.24)
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(5, 8, 6);
  key.castShadow = false;
  scene.add(key);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.enableDamping = !prefersReducedMotion;
  controls.dampingFactor = 0.08;
  controls.update();

  contentGroup = new THREE.Group();
  scene.add(contentGroup);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  const overlay = labelRenderer.domElement;
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.pointerEvents = 'none';
  container.appendChild(overlay);
}

// ============================================================================
// rebuild() — THE ONLY path for geometry changes (RULES.md §3.1, non-negotiable).
// ============================================================================

function disposeContent() {
  wedge?.dispose(); wedge = null;
  plane?.dispose(); plane = null;
  projectors?.dispose(); projectors = null;
  viewDrawing?.dispose(); viewDrawing = null;
  observer?.dispose(); observer = null;
  labelLayer?.dispose(); labelLayer = null;
  contentGroup.clear();
}

/** Step 4's compare toggle only ever affects rendering while the step
 *  explicitly permits it (rayModeControl) — every other step's projectors are
 *  the true orthographic parallel bundle regardless of whatever the toggle
 *  was left on. */
function effectiveRayMode() {
  return currentView.rayModeControl ? currentData.rayMode : RayMode.PARALLEL;
}

function rebuild() {
  disposeContent();
  const { width, height } = viewportSize();

  if (currentView.showPlane) {
    plane = createProjectionPlane({ width, height });
    contentGroup.add(plane.group);
  }

  if (currentView.showWedge) {
    wedge = createWedgeBlock({ rotationY: currentData.rotationY, width, height });
    contentGroup.add(wedge.group);
  }

  if (currentView.showProjectors) {
    projectors = createProjectors({
      rotationY: currentData.rotationY,
      mode: effectiveRayMode(),
      tiltDeg: currentData.projectorTilt,
      width, height,
    });
    contentGroup.add(projectors.group);
  }

  if (currentView.showView) {
    viewDrawing = createViewDrawing({
      rotationY: currentData.rotationY,
      tiltDeg: currentData.projectorTilt,
      width, height,
    });
    contentGroup.add(viewDrawing.group);
  }

  if (currentView.showObserver) {
    const verts = worldVertices(currentData.rotationY);
    const targets = ['A', 'C', 'F'].map((id) => verts[id]);
    observer = createObserverRig({ targets, width, height });
    contentGroup.add(observer.group);
  }

  labelLayer = createLabelLayer({ width, height });
  labelLayer.generate({ view: currentView, rotationY: currentData.rotationY, tiltDeg: currentData.projectorTilt });
  contentGroup.add(labelLayer.group);

  // Re-stamp in-progress fades (step transitions + the dissolve) onto the
  // fresh leaves so a rebuild mid-fade (e.g. dragging a slider while
  // dissolved) inherits the current opacity instead of popping to full.
  applyFadeLevels();
  wedge?.setOpacity((1 - dissolveK) * fadeState.wedge.k);
}

/** Merge a partial change into the topic data and re-derive the scene — the
 *  one write path for currentData (controls never touch the scene directly,
 *  RULES.md §3.2). */
function commit(patch) {
  currentData = { ...currentData, ...patch };
  rebuild();
  ui?.sync();
  stepper?.sync();
}

// ============================================================================
// simController — the injected contract every leaf module receives (ADR-007).
// ============================================================================

const simController = {
  announce,
  showToast,
  getData: () => ({ ...currentData }),
  getView: () => ({ ...currentView }),
  isFlatOnly: () => flatOnly,
  hasDissolved: () => dissolvedOnce,

  commit,

  /** The stepper pushes each step's viewport flags through here. Leaving
   *  Step 4 resets rayMode to PARALLEL so re-entering it always starts from
   *  the correct default, and any Step-6 dissolve resets on any step change
   *  other than a re-visit of Step 6 itself, so the wedge is always visible
   *  when a new step's illustration first appears. */
  applyView(stepView) {
    const prevView = prevAppliedView;
    currentView = { ...DEFAULT_VIEW, ...stepView };

    if (!currentView.rayModeControl && currentData.rayMode !== RayMode.PARALLEL) {
      currentData = { ...currentData, rayMode: RayMode.PARALLEL };
    }
    if (!currentView.rotationControl && flatOnly) {
      // Leaving Step 6 (the only step that can dissolve the wedge): always
      // restore the solid instantly so the next step's illustration is whole.
      flatOnly = false;
      dissolveTween?.cancel();
      dissolveTween = null;
      dissolveK = 0;
    }

    rebuild();

    // Cross-fade in whatever just turned on (never re-fade something already
    // on screen from the previous step).
    const turnedOn = (key) => currentView[key] && !prevView[key];
    if (turnedOn('showPlane')) fadeInLeaf('plane');
    if (turnedOn('showWedge')) fadeInLeaf('wedge');
    if (turnedOn('showProjectors')) fadeInLeaf('projectors');
    if (turnedOn('showView')) fadeInLeaf('viewDrawing');
    if (turnedOn('showObserver')) fadeInLeaf('observer');

    prevAppliedView = currentView;
    ui?.sync();
  },

  /** Step 6's "reveal the flat view" toggle: dissolve the wedge away (or
   *  restore it) on the platform's named curve for exactly this move
   *  (DESIGN.md motion palette — "the 3D body dissolving into its flat
   *  drawing"). Reversible; the view drawing itself never moves. */
  setFlatOnly(on) {
    if (on === flatOnly) return;
    flatOnly = on;
    if (on) dissolvedOnce = true;
    dissolveTween?.cancel();
    const from = dissolveK;
    const to = on ? 1 : 0;
    dissolveTween = tween({
      from, to, duration: DISSOLVE_MS, ease: easeDissolve,
      onUpdate: (k) => { dissolveK = k; wedge?.setOpacity((1 - k) * fadeState.wedge.k); },
      onComplete: () => { dissolveTween = null; },
    });
  },
};

// ============================================================================
// Step-transition fades
// ============================================================================

function applyFadeLevels() {
  fadeState.plane.leaf()?.setOpacity(fadeState.plane.k);
  fadeState.projectors.leaf()?.setOpacity(fadeState.projectors.k);
  fadeState.viewDrawing.leaf()?.setOpacity(fadeState.viewDrawing.k);
  fadeState.observer.leaf()?.setOpacity(fadeState.observer.k);
  // wedge is handled in rebuild() itself (it composes with the dissolve level).
}

function fadeInLeaf(name, duration = FADE_MS, ease = easeDraw) {
  const s = fadeState[name];
  s.tween?.cancel();
  s.k = 0;
  s.leaf()?.setOpacity(0);
  s.tween = tween({
    from: 0, to: 1, duration, ease,
    onUpdate: (k) => {
      s.k = k;
      if (name === 'wedge') wedge?.setOpacity((1 - dissolveK) * k);
      else s.leaf()?.setOpacity(k);
    },
    onComplete: () => { s.k = 1; s.tween = null; },
  });
}

function resetCamera() {
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.update();
}

// ============================================================================
// Render loop
// ============================================================================

function animate(now) {
  rafId = requestAnimationFrame(animate);
  const delta = lastFrameTime ? Math.min(now - lastFrameTime, 64) : 16;
  lastFrameTime = now;

  tickTweens(delta);
  controls.update();
  observer?.updateFromCamera(camera); // Step 1's sight-lines track the live camera
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function startLoop() {
  if (running) return;
  running = true;
  lastFrameTime = 0;
  rafId = requestAnimationFrame(animate);
}

function stopLoop() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  rafId = null;
}

// ============================================================================
// Resize
// ============================================================================

function handleResize(container) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);

  wedge?.setResolution(w, h);
  plane?.setResolution(w, h);
  projectors?.setResolution(w, h);
  viewDrawing?.setResolution(w, h);
  observer?.setResolution(w, h);
  labelLayer?.setResolution(w, h);
}

// ============================================================================
// Mobile advisory — banner only, never blocks the sim (RULES.md §2.13).
// ============================================================================

function setupMobileNotice() {
  const notice = document.getElementById('mobile-notice');
  const dismiss = document.getElementById('mobile-notice-dismiss');
  if (!notice || !dismiss) return;
  const mq = window.matchMedia('(max-width: 767px)');
  let dismissed = false;
  const sync = () => { notice.hidden = !mq.matches || dismissed; };
  dismiss.addEventListener('click', () => { dismissed = true; sync(); });
  mq.addEventListener('change', sync);
  sync();
}

// ============================================================================
// Platform contract — window.simAPI (RULES.md §2.8–§2.9).
// ============================================================================

window.simAPI = {
  pause() { stopLoop(); },
  resume() { startLoop(); },
  reset() {
    currentData = defaultOrthoData();
    currentView = { ...DEFAULT_VIEW };
    prevAppliedView = { ...DEFAULT_VIEW };
    flatOnly = false;
    dissolvedOnce = false;
    dissolveK = 0;
    cancelTweens();
    dissolveTween = null;
    for (const s of Object.values(fadeState)) { s.tween = null; s.k = 1; }
    rebuild();
    resetCamera();
    stepper?.reset();
    announce('Simulation reset.');
  },
};

// ============================================================================
// Self-start (RULES.md §2.14).
// ============================================================================

function init() {
  const container = document.getElementById('sim-viewport');
  viewport = container;

  try {
    buildScene(container);
  } catch (err) {
    console.error('Simatrix sim: WebGL initialisation failed.', err);
    window.__showSimFallback?.('webgl');
    return;
  }

  try {
    setupMobileNotice();
    rebuild();

    stepper = initStepper(simController);
    initTerms();
    ui = initUIManager(simController);

    document.fonts.ready.then(() => rebuild());

    new ResizeObserver(() => handleResize(container)).observe(container);
    startLoop();
  } catch (err) {
    console.error('Simatrix sim: initialisation failed.', err);
    window.__showSimFallback?.();
    return;
  }

  markBooted();
}

init();
